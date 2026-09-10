import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { type JWK } from "jose";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS_CACHE_TTL = 60 * 60_000; // 1 hour
const JWKS_FETCH_TIMEOUT_MS = 8_000;

let cachedJwks: { keys: { kid: string; n: string; e: string }[]; fetchedAt: number } | null = null;

async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<Record<string, unknown> | null> {
  try {
    const { importJWK, jwtVerify: jwVerify } = await import("jose");

    // Parse header to get kid
    const headerB64 = idToken.split(".")[0];
    const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
    const kid = header.kid as string;

    // Fetch JWKS with timeout
    if (!cachedJwks || Date.now() - cachedJwks.fetchedAt > JWKS_CACHE_TTL) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), JWKS_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(GOOGLE_JWKS_URI, { signal: controller.signal });
        if (!res.ok) throw new Error(`Failed to fetch Google JWKS: ${res.status}`);
        const data = await res.json();
        cachedJwks = { keys: data.keys, fetchedAt: Date.now() };
      } finally {
        clearTimeout(timeout);
      }
    }

    const jwk = cachedJwks.keys.find((k) => k.kid === kid);
    if (!jwk) throw new Error("Google public key not found for kid");

    const key = await importJWK(jwk as unknown as JWK, "RS256");
    const { payload } = await jwVerify(idToken, key, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    });

    return payload as unknown as Record<string, unknown>;
  } catch (err) {
    console.error("[google-verify-id-token]", err);
    return null;
  }
}

/**
 * Verify the OAuth state parameter to prevent CSRF attacks.
 * Reads the signed state cookie, verifies its JWT signature,
 * and checks it matches the state returned by Google.
 */
async function verifyOAuthState(
  stateFromGoogle: string | null
): Promise<boolean> {
  if (!stateFromGoogle) return false;

  const cookieStore = await cookies();
  const stateToken = cookieStore.get("google_oauth_state")?.value;
  if (!stateToken) return false;

  // Delete the state cookie (one-time use)
  cookieStore.delete("google_oauth_state");

  try {
    const { jwtVerify } = await import("jose");
    const { getSecret } = await import("@/lib/auth-config");
    const { payload } = await jwtVerify(stateToken, getSecret());
    return payload.state === stateFromGoogle;
  } catch {
    return false;
  }
}

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback: exchange code, verify identity, create/login user.
 *
 * Account linking logic:
 * 1. Find by providerId (already linked Google account) → login
 * 2. Find by email → link Google to existing account (preserve original provider field)
 * 3. Not found → create new Google-only user
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const loginUrl = `${baseUrl}/login?error=google_failed`;

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code) {
      return NextResponse.redirect(loginUrl);
    }

    // Verify CSRF state parameter
    if (!(await verifyOAuthState(state))) {
      return NextResponse.redirect(`${baseUrl}/login?error=google_failed`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(loginUrl);
    }

    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(loginUrl);
    }

    const tokens = await tokenRes.json();
    const idToken = tokens.id_token as string | undefined;
    if (!idToken) {
      return NextResponse.redirect(loginUrl);
    }

    // Verify ID token signature using Google's public JWKS
    const payload = await verifyGoogleIdToken(idToken, clientId);
    if (!payload || !payload.sub || !payload.email) {
      return NextResponse.redirect(loginUrl);
    }

    const googleSub = payload.sub as string;
    const email = (payload.email as string).toLowerCase();
    const name = (payload.name as string) || null;
    const avatar = (payload.picture as string) || null;
    const emailVerified = payload.email_verified === true;

    // Rate limit: 10 google logins / 15 min per IP
    const { rateLimit } = await import("@/lib/rate-limit");
    const rl = rateLimit(request, "google-login", { limit: 10, windowMs: 15 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.redirect(`${baseUrl}/login?error=rate_limited`);
    }

    // 1) Find by providerId (already linked Google account)
    let user = await prisma.user.findUnique({
      where: { providerId: googleSub },
      select: { id: true, name: true, email: true, role: true, status: true, provider: true, passwordHash: true },
    });

    // 2) If not found, find by email (auto-link existing email account)
    if (!user) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          provider: true,
          providerId: true,
          passwordHash: true,
        },
      });

      if (existingByEmail) {
        if (!existingByEmail.providerId) {
          // Auto-link: attach Google sub to existing account
          user = await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              providerId: googleSub,
              avatar: avatar || undefined,
              emailVerified: emailVerified ? new Date() : undefined,
            },
            select: { id: true, name: true, email: true, role: true, status: true, provider: true, passwordHash: true },
          });
        } else {
          return NextResponse.redirect(`${baseUrl}/login?error=google_account_conflict`);
        }
      } else {
        // 3) Create new user via Google
        user = await prisma.user.create({
          data: {
            email,
            provider: "google",
            providerId: googleSub,
            name,
            avatar,
            emailVerified: emailVerified ? new Date() : null,
            wallet: { create: { balance: 0 } },
          },
          select: { id: true, name: true, email: true, role: true, status: true, provider: true, passwordHash: true },
        });
      }
    }

    if (!user || user.status !== "active") {
      return NextResponse.redirect(`${baseUrl}/login?error=account_inactive`);
    }

    // Update avatar on every Google login (profile pic may change)
    if (avatar) {
      await prisma.user.update({ where: { id: user.id }, data: { avatar } }).catch(() => {});
    }

    // Create session
    await createSession({
      sub: user.id,
      name: user.name ?? "",
      email: user.email,
      role: user.role as "user" | "superadmin",
      status: user.status as "active" | "suspended" | "banned",
    });

    const dest = user.role === "superadmin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(`${baseUrl}${dest}`);
  } catch (err) {
    console.error("[google-callback]", err);
    return NextResponse.redirect(loginUrl);
  }
}
