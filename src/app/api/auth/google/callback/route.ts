import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback: exchange code, verify identity, create/login user.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const loginUrl = `${baseUrl}/login?error=google_failed`;

  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.redirect(loginUrl);
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

    // Decode ID token header + payload (no signature verification — Google validates via TLS + we got it from token endpoint)
    const payload = decodeJwtPayload(idToken);
    if (!payload || !payload.sub || !payload.email) {
      return NextResponse.redirect(loginUrl);
    }

    const googleSub = payload.sub;
    const email = payload.email.toLowerCase();
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
      select: { id: true, email: true, role: true, status: true, provider: true },
    });

    // 2) If not found, find by email (auto-link existing email account)
    if (!user) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true, status: true, provider: true, providerId: true, passwordHash: true },
      });

      if (existingByEmail) {
        // Auto-link: upgrade existing account to support Google login
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            provider: "google",
            providerId: googleSub,
            avatar: avatar || existingByEmail.passwordHash ? undefined : avatar,
            emailVerified: emailVerified ? new Date() : undefined,
            name: name || undefined,
          },
          select: { id: true, email: true, role: true, status: true, provider: true },
        });
      } else {
        // 3) Create new user
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
          select: { id: true, email: true, role: true, status: true, provider: true },
        });
      }
    }

    if (!user || user.status !== "active") {
      return NextResponse.redirect(`${baseUrl}/login?error=account_inactive`);
    }

    // Create session
    await createSession({
      sub: user.id,
      email: user.email,
      role: user.role as "user" | "superadmin",
      status: user.status as "active" | "suspended" | "banned",
    });

    // Redirect based on role
    const dest = user.role === "superadmin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(`${baseUrl}${dest}`);
  } catch (err) {
    console.error("[google-callback]", err);
    return NextResponse.redirect(loginUrl);
  }
}

/** Decode JWT payload without verification (used only for Google ID tokens obtained over TLS from the token endpoint). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}
