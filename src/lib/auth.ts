// Auth helpers (Node.js full runtime)
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash } from "crypto";
import { getSecret, COOKIE_NAME, EXPIRY, type SessionPayload } from "./auth-config";
import { prisma } from "./db";

export { COOKIE_NAME, EXPIRY, type SessionPayload };

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());

  const sessionCookies = await cookies();
  sessionCookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const sessionCookies = await cookies();
    const token = sessionCookies.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    const session = payload as unknown as SessionPayload;
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { status: true, role: true },
    });
    if (!user || user.status !== "active") return null;
    return { ...session, role: user.role as SessionPayload["role"] };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const sessionCookies = await cookies();
  sessionCookies.delete(COOKIE_NAME);
}

// Edge-safe JWT verify (for middleware)
export async function verifyTokenEdge(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// Legacy password hashing — internal only for migration.
// Deprecated: all new code should use password.ts (bcrypt).
const LEGACY_SALT_FALLBACK = "xperimne-salt";

/** @deprecated Used only for migrating legacy SHA-256 hashes. */
function legacyHashPassword(password: string): string {
  const salt = process.env.AUTH_SALT;
  const currentSalt = salt || LEGACY_SALT_FALLBACK;
  return createHash("sha256").update(password + currentSalt).digest("hex");
}

/** @deprecated Used only by password.ts for legacy hash verification during migration. */
export { legacyHashPassword };

// Cron secret guard — production wajib set CRON_SECRET
export function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("FATAL: CRON_SECRET environment variable is required in production");
  }
  return secret || "";
}

export function requireCronAuth(authHeader: string | null): { ok: boolean; message?: string } {
  const secret = getCronSecret();
  if (!secret) {
    // No secret configured — only allow if a header is present matching empty string (never true), effectively blocking all.
    // In dev, warn and block unless explicitly bypassed via CRON_SECRET.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[cron] CRON_SECRET not set — cron endpoints are blocked. Set CRON_SECRET in .env to enable.");
    }
    return { ok: false, message: "Unauthorized: CRON_SECRET not configured" };
  }
  if (authHeader !== `Bearer ${secret}`) {
    return { ok: false, message: "Unauthorized" };
  }
  return { ok: true };
}

