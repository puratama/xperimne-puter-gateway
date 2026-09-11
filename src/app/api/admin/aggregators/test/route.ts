import { NextRequest, NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fetchUpstream, normalizeBaseUrl } from "@/lib/upstream";

/**
 * POST /api/admin/aggregators/test
 * Test connection to an aggregator by sending a lightweight request.
 */
export async function POST(request: NextRequest) {
  const authError = await requireSuperadmin();
  if (authError) return authError;
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const agg = await prisma.aggregatorConfig.findUnique({ where: { id } });
    if (!agg) {
      return NextResponse.json({ error: "Aggregator not found" }, { status: 404 });
    }

    const apiKey = agg.apiKeyEnc;
    if (!apiKey) {
      return NextResponse.json({ ok: false, status: 0, latency: 0, error: "API key belum dikonfigurasi untuk provider ini" });
    }

    let baseUrl: string;
    try {
      baseUrl = normalizeBaseUrl(agg.baseUrl);
    } catch (e) {
      return NextResponse.json({
        ok: false,
        status: 0,
        latency: 0,
        error: e instanceof Error ? e.message : "Base URL tidak valid",
      });
    }

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
      return NextResponse.json({ ok: false, status: 0, latency: result.latency, error: result.error });
    }

    if (result.ok) {
      const data = await result.response.json().catch(() => null);
      const modelCount = data?.data?.length ?? data?.models?.length ?? null;
      return NextResponse.json({ ok: true, status: result.status, latency: result.latency, modelCount });
    }

    const errorBody = await result.response.text().catch(() => "");
    const hint =
      result.status === 401 || result.status === 403
        ? "API key ditolak provider"
        : result.status === 404
          ? "Endpoint /models tidak ditemukan — base URL mungkin kurang/berlebih path (mis. /v1)"
          : result.status === 429
            ? "Rate limit provider tercapai"
            : "";
    return NextResponse.json({
      ok: false,
      status: result.status,
      latency: result.latency,
      error: [hint, errorBody.slice(0, 200) || result.response.statusText].filter(Boolean).join(": "),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal server error" }, { status: 500 });
  }
}
