import { NextRequest, NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fetchUpstream, normalizeBaseUrl } from "@/lib/upstream";

export async function POST(request: NextRequest) {
  const authError = await requireSuperadmin();
  if (authError) return authError;
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const model = await prisma.appModel.findUnique({ where: { id } });
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const providerName = model.provider.toLowerCase().replace(/\s+/g, "-");
    const aggregators = await prisma.aggregatorConfig.findMany({
      where: { isActive: true },
    });
    const aggregator = aggregators.find(
      (item) => item.name.toLowerCase().replace(/\s+/g, "-") === providerName
    );

    if (!aggregator?.apiKeyEnc) {
      return NextResponse.json({
        ok: false,
        status: 0,
        latency: 0,
        error: `Provider "${model.provider}" tidak ditemukan atau API key belum dikonfigurasi`,
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (providerName === "anthropic") {
      headers["x-api-key"] = aggregator.apiKeyEnc;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers.Authorization = `Bearer ${aggregator.apiKeyEnc}`;
    }

    let baseUrl: string;
    try {
      baseUrl = normalizeBaseUrl(aggregator.baseUrl);
    } catch (e) {
      return NextResponse.json({
        ok: false,
        status: 0,
        latency: 0,
        error: e instanceof Error ? e.message : "Base URL tidak valid",
      });
    }

    const result = await fetchUpstream(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: model.providerModelId || model.modelId,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
        stream: false,
      }),
      timeoutMs: 30_000,
      retries: 1,
    });

    if (!result.response) {
      return NextResponse.json({ ok: false, status: 0, latency: result.latency, error: result.error });
    }

    if (result.ok) {
      return NextResponse.json({ ok: true, status: result.status, latency: result.latency });
    }

    const errorBody = await result.response.text().catch(() => "");
    return NextResponse.json({
      ok: false,
      status: result.status,
      latency: result.latency,
      error: errorBody.slice(0, 240) || result.response.statusText,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
