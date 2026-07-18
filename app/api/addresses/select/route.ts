import { z } from "zod";
import { getSession, jsonError, requireAccessToken } from "@/lib/api/helpers";

const bodySchema = z.object({
  addressId: z.string().min(1),
  addressLabel: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAccessToken();
    const body = bodySchema.parse(await req.json());
    const session = await getSession();
    session.addressId = body.addressId;
    session.addressLabel = body.addressLabel;
    await session.save();
    return Response.json({ ok: true });
  } catch (err) {
    return jsonError(err, "Failed to save address");
  }
}
