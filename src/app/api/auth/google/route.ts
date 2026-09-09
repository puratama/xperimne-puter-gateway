import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { getSecret } from "@/lib/auth-config";
import { randomBytes } from "crypto";

/**
 * GET /api/auth/google
 * Redirect user to Google OAuth consent screen with CSRF state parameter.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!clientId) {
    return NextResponse.json({ error: "Google login not configured" }, { status: 503 });
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const scope = "openid email profile";

  // Generate random state and sign it as a short-lived JWT cookie
  const state = randomBytes(32).toString("hex");
  const stateToken = await new SignJWT({ state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", stateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
