import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/google
 * Redirect user to Google OAuth consent screen.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  if (!clientId) {
    return NextResponse.json({ error: "Google login not configured" }, { status: 503 });
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const scope = "openid email profile";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
