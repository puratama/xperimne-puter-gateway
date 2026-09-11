import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/health — liveness probe.
 *
 * Only checks that the app can reach its database. Aggregator reachability is
 * deliberately NOT probed here: it took 12-26s per call on the configured
 * provider, which made this endpoint slower than any safe Docker liveness
 * timeout and multiplied upstream traffic by every open browser tab.
 * Provider connectivity is verified on demand via /admin/providers → Test.
 */
export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    { status: dbOk ? "ok" : "down", dbOk },
    { status: dbOk ? 200 : 503 },
  );
}
