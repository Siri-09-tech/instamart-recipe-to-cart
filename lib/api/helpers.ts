import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import {
  sessionOptions,
  isTokenValid,
  type SwiggySession,
} from "@/lib/auth/session";
import { McpAuthError } from "@/lib/mcp/client";

export async function getSession() {
  return getIronSession<SwiggySession>(await cookies(), sessionOptions);
}

export async function requireAccessToken(): Promise<{
  token: string;
  session: Awaited<ReturnType<typeof getSession>>;
}> {
  const session = await getSession();
  if (!session.isLoggedIn || !isTokenValid(session)) {
    throw new McpAuthError();
  }
  return { token: session.accessToken!, session };
}

export function jsonError(err: unknown, fallback = "Request failed") {
  if (err instanceof McpAuthError) {
    return Response.json(
      { error: err.message, code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }
  const message = err instanceof Error ? err.message : fallback;
  return Response.json({ error: message }, { status: 400 });
}
