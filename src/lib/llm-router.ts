// LLM Router — routes requests to providers with retry, fallback, load balancing, circuit breaker, cost routing
// Integrates: key pools, prompt compression, health check, model alias, rate limiting, request tracing

import {
  findProvidersForModelAsync,
  getProviderApiKey,
  shouldFallback,
  cooldownKey,
  markKeyFailure,
  markKeySuccess,
  type ProviderConfig,
} from "./providers";
import {
  sortProviders,
  trackStart,
  trackEnd,
  markSuccess,
  markFailure,
  markRateLimited,
  isRateLimited,
  shouldSkipProvider,
  sleep,
  getBackoffDelay,
  emitRequestLog,
  getRouterConfig,
  type RoutingStrategy,
} from "./router-engine";
import { resolveModelAlias, getModelFallbacks } from "./model-aliases";
import { compressMessages } from "./compression";
import { runWithTrace, addHop, formatTrace, type TraceContext } from "./tracing";
import { isHealthy } from "./health-check";
import { prisma } from "./db";

async function getModelMaxOutputTokens(modelId: string) {
  const model = await prisma.appModel.findUnique({
    where: { modelId },
    select: { maxOutputTokens: true },
  });
  return model?.maxOutputTokens ?? null;
}

export interface RouterRequest {
  model: string;
  messages: { role: string; content: unknown }[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: Array<Record<string, unknown>>;
  tool_choice?: string | Record<string, unknown>;
  response_format?: Record<string, unknown>;
  parallel_tool_calls?: boolean;
  top_p?: number;
  stop?: string | string[];
  seed?: number;
  user?: string;
  metadata?: Record<string, unknown>;
  preferProvider?: string; // provider name to prioritize (matches provider config name)
  userId?: string;        // for observability
  routingStrategy?: RoutingStrategy; // override default strategy per-request
  traceId?: string;       // optional trace ID for cross-request correlation
  enableCompression?: boolean; // enable prompt compression (default: true)
}

export interface RouterResult {
  success: boolean;
  data?: Response;
  error?: string;
  status?: number;       // HTTP status code for the error response
  provider: string;
  usedModel?: string;    // actual model used (may differ from requested due to fallback)
  attempts: { provider: string; status: number; error?: string; keyId?: string }[];
  trace?: TraceContext;
  compression?: {
    originalChars: number;
    compressedChars: number;
    savedPercent: number;
  };
}

// Try a provider with retry + exponential backoff
async function tryProviderWithRetry(
  provider: ProviderConfig,
  req: RouterRequest,
  signal?: AbortSignal,
  keyId?: string,
  apiModel?: string
): Promise<{ response: Response; provider: string; keyId?: string }> {
  const { maxRetries, baseDelayMs, maxDelayMs } = getRouterConfig();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = getBackoffDelay(attempt - 1, baseDelayMs, maxDelayMs);
      await sleep(delay);
    }

    try {
      const result = await tryProviderRaw(provider, req, signal, keyId, apiModel);
      return result;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message.toLowerCase();

      // 429 → mark both provider and key as rate-limited
      if (msg.includes("429") || msg.includes("rate limit")) {
        markRateLimited(provider.name);
        if (keyId) cooldownKey(keyId);
        continue; // retry with next attempt or fallback
      }

      // Only retry on transient errors
      if (msg.includes("fetch failed") || msg.includes("network") ||
          msg.includes("econnrefused") || msg.includes("timeout") ||
          msg.includes("timed out") || msg.includes("500") ||
          msg.includes("502") || msg.includes("503") ||
          msg.includes("service unavailable")) {
        if (keyId) markKeyFailure(keyId);
        continue;
      }
      // Non-retryable errors (401, 400, bad request etc.) — stop immediately
      throw lastError;
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

// Raw provider call
async function tryProviderRaw(
  provider: ProviderConfig,
  req: RouterRequest,
  signal?: AbortSignal,
  keyId?: string,
  apiModel?: string
): Promise<{ response: Response; provider: string; keyId?: string }> {
  const apiKey = getProviderApiKey(provider);
  if (!apiKey) {
    throw new Error(`No API key configured for ${provider.name}`);
  }

  const resolvedKey = apiKey.keyId || keyId || apiKey.keyId;
  const url = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider.name === "anthropic") {
    headers["x-api-key"] = apiKey.key;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${apiKey.key}`;
  }

  // Attach trace ID header for downstream observability
  const trace = await import("./tracing").then((m) => m.getTrace());
  if (trace) {
    headers["X-Trace-Id"] = trace.traceId;
  }

  const body: Record<string, unknown> = {
    model: apiModel || req.model,
    messages: req.messages,
    stream: req.stream || false,
  };
  // Ask upstream for real token usage on the final SSE event (OpenAI-compatible).
  if (req.stream) body.stream_options = { include_usage: true };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.max_tokens !== undefined) {
    const configuredLimit = await getModelMaxOutputTokens(req.model);
    body.max_tokens = configuredLimit === null
      ? req.max_tokens
      : Math.min(req.max_tokens, configuredLimit);
  }
  if (req.tools !== undefined) body.tools = req.tools;
  if (req.tool_choice !== undefined) body.tool_choice = req.tool_choice;
  if (req.response_format !== undefined) body.response_format = req.response_format;
  if (req.parallel_tool_calls !== undefined) body.parallel_tool_calls = req.parallel_tool_calls;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.stop !== undefined) body.stop = req.stop;
  if (req.seed !== undefined) body.seed = req.seed;
  if (req.user !== undefined) body.user = req.user;
  if (req.metadata !== undefined) body.metadata = req.metadata;

  // ponytail: single hard ceiling for upstream calls so a hung provider can't
  // pin the connection open forever. Add per-model overrides only if needed.
  const timeout = AbortSignal.timeout(120_000);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  return { response, provider: provider.name, keyId: resolvedKey };
}

// Main router: try providers in order with retry, load balancing, circuit breaker, fallback
export async function routeRequest(
  req: RouterRequest,
  signal?: AbortSignal
): Promise<RouterResult> {
  // Run entire routing within a trace context
  return runWithTrace(async () => {
    const trace = await import("./tracing").then((m) => m.getTrace());
    if (trace && req.traceId) {
      // Use caller-provided trace ID (cast-safe since we just created it)
      (trace as { traceId: string }).traceId = req.traceId;
    }

    addHop({ provider: "router", model: req.model, status: "attempt" });

    // ── 1. Resolve model alias ──────────────────────────────────────────────
    // First, check if the model is registered in DB (managed model with optional providerModelId).
    // If found, skip alias resolution — managed models use the registered modelId directly.
    let effectiveModel = req.model;
    let apiModel: string | undefined;

    try {
      const appModel = await prisma.appModel.findUnique({ where: { modelId: req.model } });
      if (appModel?.providerModelId) {
        apiModel = appModel.providerModelId;
        // effectiveModel stays as req.model — no alias resolution for managed models
      } else if (!appModel) {
        // Not a managed model — apply alias resolution
        const resolvedModel = resolveModelAlias(req.model);
        if (resolvedModel !== req.model) {
          console.log(`[Router] Model alias: "${req.model}" → "${resolvedModel}"`);
          addHop({ provider: "router", model: `${req.model}→${resolvedModel}`, status: "attempt" });
        }
        effectiveModel = resolvedModel;
      }
      // appModel exists but no providerModelId — use req.model as-is
    } catch {
      // DB error — fallback to alias resolution
      const resolvedModel = resolveModelAlias(req.model);
      if (resolvedModel !== req.model) {
        console.log(`[Router] Model alias (fallback): "${req.model}" → "${resolvedModel}"`);
        addHop({ provider: "router", model: `${req.model}→${resolvedModel}`, status: "attempt" });
      }
      effectiveModel = resolvedModel;
    }

    // ── 2. Compress messages ────────────────────────────────────────────────
    let compressionResult: { originalChars: number; compressedChars: number; savedPercent: number } | undefined;
    const enableCompression = req.enableCompression !== false;
    let compressedMessages = req.messages;

    if (enableCompression) {
      const result = compressMessages(req.messages);
      if (result.savedChars > 0) {
        compressionResult = {
          originalChars: result.originalChars,
          compressedChars: result.compressedChars,
          savedPercent: result.savedPercent,
        };
        compressedMessages = result.messages;
        addHop({
          provider: "compression",
          model: effectiveModel,
          status: "attempt",
          latencyMs: 0,
        });
      }
    }

    // ── 3. Validate messages ────────────────────────────────────────────────
    // Catch common format errors early — before wasting time on provider requests
    const validationError = validateMessages(compressedMessages, req.tools);
    if (validationError) {
      addHop({ provider: "validation", model: effectiveModel, status: "failure", error: validationError });
      return {
        success: false,
        error: validationError,  // plain error message, status communicates HTTP code
        status: 400,             // client error — not a provider issue
        provider: "validation",
        attempts: [],
        trace: trace || undefined,
        compression: compressionResult,
      };
    }

    // ── 4. Find providers ───────────────────────────────────────────────────
    let providers = await findProvidersForModelAsync(effectiveModel);

    // Fallback: if alias resolved to a different name but no providers found,
    // try the original model name (fully-qualified paths like "nvidia/deepseek-ai/deepseek-v4-flash")
    if (providers.length === 0 && effectiveModel !== req.model) {
      console.log(`[Router] No providers for "${effectiveModel}", retrying with original "${req.model}"`);
      providers = await findProvidersForModelAsync(req.model);
      if (providers.length > 0) {
        effectiveModel = req.model; // use original model name for the upstream call
      }
    }
    const attempts: { provider: string; status: number; error?: string; keyId?: string }[] = [];
    const startTime = Date.now();
    const config = getRouterConfig();
    const strategy = req.routingStrategy || config.strategy;

    if (providers.length === 0) {
      addHop({ provider: "none", model: effectiveModel, status: "failure" });
      return {
        success: false,
        error: `No provider found for model: ${effectiveModel}`,
        status: 502,
        provider: "none",
        attempts,
        trace: trace || undefined,
        compression: compressionResult,
      };
    }

    // ── 4. Sort providers ───────────────────────────────────────────────────
    let sortedProviders = providers.sort((a, b) => {
      if (req.preferProvider) {
        const aMatch = a.name === req.preferProvider || a.name.includes(req.preferProvider) ? 0 : 1;
        const bMatch = b.name === req.preferProvider || b.name.includes(req.preferProvider) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return a.priority - b.priority;
    });

    if (!req.preferProvider) {
      sortedProviders = await sortProviders(sortedProviders, strategy, effectiveModel);
    }

    // ── 5. Filter by health ─────────────────────────────────────────────────
    const healthyProviders = sortedProviders.filter((p) => {
      const healthy = isHealthy(p.name);
      if (!healthy) {
        attempts.push({ provider: p.name, status: 0, error: "health-check: unhealthy" });
        addHop({ provider: p.name, model: effectiveModel, status: "circuit-breaker", latencyMs: 0 });
      }
      return healthy;
    });

    let providersToTry = healthyProviders.length > 0 ? healthyProviders : sortedProviders;

    let lastError = "";

    // ── 6. Route with model fallback ────────────────────────────────────────
    // Try the requested model first. If ALL providers fail with permanent errors,
    // try fallback models from the same family (OmniRoute combo resolver concept).

    const modelsToTry = [effectiveModel, ...getModelFallbacks(effectiveModel)];
    let usedModel = effectiveModel;

    MODEL_LOOP: for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
      usedModel = modelsToTry[modelIdx];

      // Re-find providers for this model variant
      if (modelIdx > 0) {
        let fallbackProviders = await findProvidersForModelAsync(usedModel);
        // Fallback to original provider list if no specific match
        if (fallbackProviders.length === 0) {
          fallbackProviders = sortedProviders;
        }
        console.log(`[Router] Model fallback: "${effectiveModel}" → "${usedModel}" (${fallbackProviders.length} providers)`);
        addHop({ provider: "router", model: `${effectiveModel}→${usedModel}`, status: "attempt" });
        sortedProviders = await sortProviders(fallbackProviders, strategy, usedModel);
        providersToTry = sortedProviders.filter((p) => isHealthy(p.name));
        if (providersToTry.length === 0) providersToTry = sortedProviders;
      }

      for (const provider of providersToTry) {
      // Skip if circuit-broken or rate-limited
      if (shouldSkipProvider(provider.name)) {
        const reason = isRateLimited(provider.name) ? "rate-limited" : "circuit-breaker";
        attempts.push({ provider: provider.name, status: 0, error: `${reason}: cooldown` });
        addHop({ provider: provider.name, model: effectiveModel, status: reason as any });
        continue;
      }

      const providerStart = Date.now();
      trackStart(provider.name);
      addHop({ provider: provider.name, model: effectiveModel, status: "attempt" });

      try {
        const providerModel = usedModel !== effectiveModel ? undefined : apiModel;
        const { response, keyId } = await tryProviderWithRetry(provider, {
          ...req,
          model: usedModel,
          messages: compressedMessages,
        }, signal, undefined, providerModel);

        const latency = Date.now() - providerStart;

        if (response.ok) {
          trackEnd(provider.name);
          markSuccess(provider.name, latency);
          if (keyId) markKeySuccess(keyId);
          attempts.push({ provider: provider.name, status: response.status, keyId });

          addHop({ provider: provider.name, model: effectiveModel, status: "success", latencyMs: latency });

          emitRequestLog({
            userId: req.userId || "unknown",
            model: effectiveModel,
            provider: provider.name,
            attempt: attempts.length,
            success: true,
            latencyMs: latency,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            strategy,
          });

          return {
            success: true,
            data: response,
            provider: provider.name,
            usedModel,
            attempts,
            trace: trace || undefined,
            compression: compressionResult,
          };
        }

        // Error response from provider
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errBody = await response.text();
          if (errBody) errorMsg = `${response.status}: ${errBody.slice(0, 200)}`;
        } catch {}

        trackEnd(provider.name);

        // Circuit breaker: only trigger on transient/server errors (5xx, network).
        // 4xx errors (except 429) are model/config issues — don't circuit-break.
        const isTransientError = response.status >= 500;
        if (isTransientError) {
          markFailure(provider.name, config.circuitBreakerThreshold, config.circuitBreakerCooldownMs);
        }
        if (keyId) markKeyFailure(keyId);

        // 429 → mark as rate-limited (separate from circuit breaker)
        if (response.status === 429) {
          markRateLimited(provider.name);
        }

        attempts.push({ provider: provider.name, status: response.status, error: errorMsg, keyId });
        lastError = errorMsg;

        addHop({ provider: provider.name, model: effectiveModel, status: "failure", latencyMs: latency, error: errorMsg });

        emitRequestLog({
          userId: req.userId || "unknown",
          model: effectiveModel,
          provider: provider.name,
          attempt: attempts.length,
          success: false,
          latencyMs: latency,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          error: errorMsg,
          strategy,
        });

        // Non-fallbackable errors — stop here
        if (!shouldFallback({ message: errorMsg })) {
          const nestedStatus = errorMsg.match(/upstream_proxy_error[\s\S]*?HTTP (\d{3})/i)?.[1];
          const status = nestedStatus ? Number(nestedStatus) : response.status;
          return { success: false, error: errorMsg, status: status >= 400 && status < 600 ? status : 502, provider: provider.name, attempts, trace: trace || undefined, compression: compressionResult };
        }

      } catch (error: unknown) {
        if (signal?.aborted) throw error;

        const latency = Date.now() - providerStart;
        trackEnd(provider.name);

        const errorMsg = error instanceof Error ? error.message : String(error);
        markFailure(provider.name, config.circuitBreakerThreshold, config.circuitBreakerCooldownMs);

        attempts.push({ provider: provider.name, status: 0, error: errorMsg });
        lastError = errorMsg;

        addHop({ provider: provider.name, model: effectiveModel, status: "failure", latencyMs: latency, error: errorMsg });

        emitRequestLog({
          userId: req.userId || "unknown",
          model: effectiveModel,
          provider: provider.name,
          attempt: attempts.length,
          success: false,
          latencyMs: latency,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          error: errorMsg,
          strategy,
        });

        if (!shouldFallback(error)) {
          return { success: false, error: errorMsg, status: 502, provider: provider.name, attempts, trace: trace || undefined, compression: compressionResult };
        }
      }
    } // end of provider loop

      // All providers failed for this model variant
      const totalTime = Date.now() - startTime;
      addHop({ provider: "router", model: usedModel, status: "failure", latencyMs: totalTime, error: lastError });
    } // end of MODEL_LOOP

    // All models in the fallback chain failed
    return {
      success: false,
      error: lastError || "All providers failed",
      status: 502,
      provider: sortedProviders[sortedProviders.length - 1]?.name || "none",
      usedModel,
      attempts,
      trace: trace || undefined,
      compression: compressionResult,
    };
  });
}

// ─── Message Validation ─────────────────────────────────────────────────────

interface MessageLike {
  role?: string;
  content?: unknown;
  tool_call_id?: string;
  [key: string]: unknown;
}

/** Validate chat messages before sending to providers.
 *  Returns error string or null if valid. */
function validateMessages(
  messages: MessageLike[],
  tools?: Array<Record<string, unknown>>
): string | null {
  if (!messages || messages.length === 0) return "messages array is empty";

  const systemMessages = messages.filter((m) => m.role === "system");
  if (systemMessages.length > 1) return "multiple system messages are not allowed";

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg.role) return `messages[${i}]: missing required field 'role'`;

    if (msg.role === "tool" && !msg.tool_call_id) {
      return `messages[${i}]: 'tool_call_id' is required for tool messages`;
    }

    // non-tool messages must have content (assistant can have null content with tool_calls)
    const requiresContent = msg.role !== "tool" && !(msg.role === "assistant" && msg.tool_calls);
    if (requiresContent && msg.content === undefined) {
      return `messages[${i}]: missing required field 'content'`;
    }

    // tool_call_id is only valid on tool messages (OpenAI spec)
    if (msg.role !== "tool" && msg.tool_call_id) {
      return `messages[${i}]: 'tool_call_id' is only valid on messages with 'role:tool'`;
    }

    // Content can be string or array (multimodal) — pass through to upstream provider
  }

  const toolCallIds = new Set<string>();
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls as Array<{ id?: string }>) {
        if (toolCall.id) toolCallIds.add(toolCall.id);
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === "tool" && !toolCallIds.has(message.tool_call_id!)) {
      return `messages[${i}]: 'tool_call_id' does not match an assistant tool call`;
    }
  }

  return null;
}

// Try to find any working provider (for streaming convenience)
export async function routeStreaming(
  req: RouterRequest,
  signal?: AbortSignal
): Promise<Response> {
  const result = await routeRequest(req, signal);
  if (!result.success || !result.data) {
    throw new Error(result.error || "All providers failed");
  }
  return result.data;
}
