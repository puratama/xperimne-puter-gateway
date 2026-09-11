import { NextRequest, NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fetchUpstream, normalizeBaseUrl } from "@/lib/upstream";

interface AggregatorModel {
  id: string;
  name?: string;
  provider?: string;
  context?: number;
}

/**
 * GET /api/admin/aggregators/models?id=<aggregator_id>
 * Fetch available models from an aggregator's API.
 */
export async function GET(request: NextRequest) {
  const authError = await requireSuperadmin();
  if (authError) return authError;
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const agg = await prisma.aggregatorConfig.findUnique({ where: { id } });
    if (!agg) {
      return NextResponse.json({ error: "Aggregator not found" }, { status: 404 });
    }

    if (!agg.isActive) {
      return NextResponse.json({ error: "Aggregator is not active" }, { status: 400 });
    }

    const apiKey = agg.apiKeyEnc;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured for this aggregator" }, { status: 500 });
    }

    let baseUrl: string;
    try {
      baseUrl = normalizeBaseUrl(agg.baseUrl);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Base URL tidak valid" },
        { status: 400 }
      );
    }

    // Fetch models from aggregator (OpenAI-compatible /models endpoint)
    const result = await fetchUpstream(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeoutMs: 20_000,
      retries: 1,
    });

    if (!result.response) {
      return NextResponse.json({ error: result.error }, { status: 504 });
    }

    if (!result.ok) {
      const errorBody = await result.response.text().catch(() => "");
      return NextResponse.json({
        error: `Aggregator returned ${result.status}: ${errorBody.slice(0, 200) || result.response.statusText}`,
      }, { status: 502 });
    }

    const data = await result.response.json().catch(() => ({}));

    // Handle both OpenAI-compatible format ({data: [...]}) and flat array format
    const rawModels: unknown[] = Array.isArray(data) ? data : (data?.data ?? data?.models ?? []);

    // Normalize into consistent shape
    const models: AggregatorModel[] = rawModels.map((m: unknown) => {
      const model = m as Record<string, unknown>;
      return {
        id: String(model.id || model.name || ""),
        name: String(model.name || model.id || ""),
        provider: String(model.owned_by || model.provider || agg.name),
        context: typeof model.context_length === "number" ? model.context_length : undefined,
      };
    }).filter((m) => m.id);

    // Cross-reference with existing AppModels to flag which are already configured
    const existingModels = await prisma.appModel.findMany({ select: { modelId: true } });
    const existingIds = new Set(existingModels.map((m) => m.modelId));

    return NextResponse.json({
      aggregator: agg.name,
      models: models.map((m) => ({
        ...m,
        alreadyConfigured: existingIds.has(m.id),
      })),
      total: models.length,
      alreadyConfigured: models.filter((m) => existingIds.has(m.id)).length,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
