// Upstream connection helpers: base URL normalization + fetch with timeout/retry.
// ponytail: in-process only, no shared circuit breaker.
// Upgrade path: reuse router-engine circuit breaker if these calls get hot.

export function normalizeBaseUrl(raw: string): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Base URL kosong");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Base URL tidak valid. Contoh: https://api.provider.com/v1");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL harus memakai http:// atau https://");
  }
  // Common paste mistakes: full endpoint path instead of base.
  return trimmed.replace(/\/(chat\/completions|models)$/, "");
}

/** Human-readable reason for a failed upstream fetch. */
export function describeUpstreamError(err: unknown, timeoutMs: number): string {
  if (!(err instanceof Error)) return "Koneksi gagal";
  if (err.name === "TimeoutError" || err.name === "AbortError") {
    return `Timeout setelah ${timeoutMs >= 1000 ? `${Math.round(timeoutMs / 1000)}s` : `${timeoutMs}ms`} — base URL tidak merespons (host salah, diblokir firewall/proxy, atau provider lambat)`;
  }

  // Node hides the real reason inside `cause`; `.message` is only "fetch failed".
  const rawCause = (err as { cause?: unknown }).cause;
  const cause = rawCause as { code?: string; message?: string } | undefined;
  switch (cause?.code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "Host base URL tidak dapat di-resolve (DNS gagal) — periksa ejaan domain";
    case "ECONNREFUSED":
      return "Koneksi ditolak — port/host salah atau layanan tidak berjalan";
    case "ECONNRESET":
      return "Koneksi terputus oleh server/jaringan perantara (bisa firewall/proxy)";
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
      return "Gagal membuka koneksi ke host (kemungkinan diblokir firewall/proxy)";
    case "EPROTO":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "CERT_HAS_EXPIRED":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return "Handshake TLS gagal / sertifikat tidak valid — cek http vs https pada base URL";
  }

  if (cause?.code) return `${cause.code}: ${cause.message || err.message}`;
  if (cause?.message) return cause.message;
  // Bare "fetch failed" carries no diagnostic value on its own — say what it means.
  if (err.message.toLowerCase().includes("fetch failed")) {
    return "Tidak dapat terhubung ke base URL (koneksi gagal dibuka) — cek base URL, DNS, firewall/proxy, dan http vs https";
  }
  return err.message;
}

export interface UpstreamFetchOptions extends Omit<RequestInit, "signal"> {
  timeoutMs?: number;
  retries?: number;
}

export interface UpstreamFetchResult {
  ok: boolean;
  response?: Response;
  error?: string;
  status: number;
  latency: number;
  attempts: number;
}

/**
 * Fetch an upstream URL with timeout and retry on transient network failures.
 * Never throws — inspect `ok`/`error`.
 */
export async function fetchUpstream(
  url: string,
  { timeoutMs = 20_000, retries = 1, ...init }: UpstreamFetchOptions = {}
): Promise<UpstreamFetchResult> {
  const start = Date.now();
  let lastError = "Koneksi gagal";
  let attempt = 0;

  while (attempt < retries + 1) {
    attempt++;
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      return {
        ok: response.ok,
        response,
        status: response.status,
        latency: Date.now() - start,
        attempts: attempt,
      };
    } catch (err) {
      lastError = describeUpstreamError(err, timeoutMs);
      console.warn(`[upstream] ${url} attempt ${attempt} failed: ${lastError}`);
      if (!isRetryable(err) || attempt > retries) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  return { ok: false, error: lastError, status: 0, latency: Date.now() - start, attempts: attempt };
}

/**
 * Transient failures worth one more shot.
 *
 * Deliberately excludes deterministic misconfiguration: ENOTFOUND (domain does
 * not exist) and ECONNREFUSED (nothing listening) fail identically on retry, so
 * retrying only delays the error the user needs to see.
 */
function isRetryable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  const code = (err as { cause?: { code?: string } }).cause?.code;
  return code
    ? ["ECONNRESET", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"].includes(code)
    : false;
}
