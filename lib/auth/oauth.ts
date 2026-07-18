import { createHash, randomBytes } from "crypto";

const SWIGGY_BASE = process.env.SWIGGY_MCP_BASE || "https://mcp.swiggy.com";

export function generatePkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { codeVerifier, codeChallenge, state };
}

export type RegisteredClient = {
  client_id: string;
  client_secret?: string;
};

/** RFC 7591 Dynamic Client Registration */
export async function registerOAuthClient(
  redirectUri: string
): Promise<RegisteredClient> {
  const res = await fetch(`${SWIGGY_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Recipe-to-Cart",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp:tools mcp:resources mcp:prompts",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth DCR failed (${res.status}): ${text}`);
  }

  return res.json();
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}) {
  const url = new URL(`${SWIGGY_BASE}/auth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", opts.clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("scope", "mcp:tools mcp:resources mcp:prompts");
  return url.toString();
}

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export async function exchangeCodeForToken(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<TokenResponse> {
  const res = await fetch(`${SWIGGY_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: opts.code,
      code_verifier: opts.codeVerifier,
      redirect_uri: opts.redirectUri,
      client_id: opts.clientId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return res.json();
}
