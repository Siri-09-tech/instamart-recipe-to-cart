import { SessionOptions } from "iron-session";

export type SwiggySession = {
  accessToken?: string;
  expiresAt?: number;
  /** Dynamic Client Registration client_id */
  clientId?: string;
  /** PKCE verifier held between authorize → callback */
  codeVerifier?: string;
  oauthState?: string;
  /** Selected Instamart delivery address */
  addressId?: string;
  addressLabel?: string;
  isLoggedIn: boolean;
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "dev-only-insecure-session-secret-min-32-chars!!",
  cookieName: "recipe_to_cart_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 5, // align with Swiggy access token (~5 days)
  },
};

export function isTokenValid(session: SwiggySession): boolean {
  if (!session.accessToken || !session.expiresAt) return false;
  // refresh buffer: 60s
  return Date.now() < session.expiresAt - 60_000;
}
