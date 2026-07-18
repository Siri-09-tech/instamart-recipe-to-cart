import { getSession } from "@/lib/api/helpers";
import {
  buildAuthorizeUrl,
  generatePkce,
  registerOAuthClient,
} from "@/lib/auth/oauth";

export async function GET() {
  const redirectUri =
    process.env.NEXT_PUBLIC_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback`;

  const session = await getSession();

  // Reuse client_id within session; otherwise Dynamic Client Registration
  if (!session.clientId) {
    const registered = await registerOAuthClient(redirectUri);
    session.clientId = registered.client_id;
  }

  const { codeVerifier, codeChallenge, state } = generatePkce();
  session.codeVerifier = codeVerifier;
  session.oauthState = state;
  await session.save();

  const url = buildAuthorizeUrl({
    clientId: session.clientId,
    redirectUri,
    codeChallenge,
    state,
  });

  return Response.redirect(url);
}
