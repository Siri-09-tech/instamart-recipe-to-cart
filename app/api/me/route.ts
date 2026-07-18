import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import {
  sessionOptions,
  isTokenValid,
  type SwiggySession,
} from "@/lib/auth/session";

export async function GET() {
  const session = await getIronSession<SwiggySession>(
    await cookies(),
    sessionOptions
  );

  return Response.json({
    isLoggedIn: Boolean(session.isLoggedIn && isTokenValid(session)),
    addressId: session.addressId ?? null,
    addressLabel: session.addressLabel ?? null,
    expiresAt: session.expiresAt ?? null,
  });
}
