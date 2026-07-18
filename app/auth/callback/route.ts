import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/helpers";
import { exchangeCodeForToken } from "@/lib/auth/oauth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return Response.redirect(
      `${appUrl}/?authError=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return Response.redirect(`${appUrl}/?authError=missing_code`);
  }

  if (!session.oauthState || state !== session.oauthState) {
    return Response.redirect(`${appUrl}/?authError=invalid_state`);
  }

  if (!session.codeVerifier || !session.clientId) {
    return Response.redirect(`${appUrl}/?authError=missing_pkce`);
  }

  const redirectUri =
    process.env.NEXT_PUBLIC_REDIRECT_URI || `${appUrl}/auth/callback`;

  try {
    const token = await exchangeCodeForToken({
      code,
      codeVerifier: session.codeVerifier,
      redirectUri,
      clientId: session.clientId,
    });

    session.accessToken = token.access_token;
    session.expiresAt = Date.now() + token.expires_in * 1000;
    session.isLoggedIn = true;
    session.codeVerifier = undefined;
    session.oauthState = undefined;
    await session.save();

    return Response.redirect(`${appUrl}/`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_failed";
    return Response.redirect(
      `${appUrl}/?authError=${encodeURIComponent(message)}`
    );
  }
}
