import { getSession } from "@/lib/api/helpers";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return Response.json({ ok: true });
}

export async function GET() {
  const session = await getSession();
  session.destroy();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return Response.redirect(`${appUrl}/`);
}
