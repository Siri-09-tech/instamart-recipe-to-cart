import { z } from "zod";
import { jsonError, requireAccessToken, getSession } from "@/lib/api/helpers";
import { updateCart, getCart, clearCart } from "@/lib/mcp/instamart";

const fillSchema = z.object({
  items: z
    .array(
      z.object({
        spinId: z.string().min(1),
        quantity: z.number().int().min(1).max(20).default(1),
      })
    )
    .min(1),
  addressId: z.string().optional(),
  replace: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const { token, session } = await requireAccessToken();
    const body = fillSchema.parse(await req.json());
    const addressId = body.addressId || session.addressId;

    if (!addressId) {
      return Response.json(
        { error: "Select a delivery address first.", code: "NO_ADDRESS" },
        { status: 400 }
      );
    }

    // Docs: update_cart replaces entire cart. Clear first for a clean recipe cart.
    if (body.replace) {
      try {
        await clearCart(token);
      } catch {
        // non-fatal if cart already empty
      }
    }

    await updateCart(token, addressId, body.items);
    const cart = await getCart(token);

    const s = await getSession();
    s.addressId = addressId;
    await s.save();

    return Response.json({
      ok: true,
      cart,
      itemCount: body.items.length,
    });
  } catch (err) {
    return jsonError(err, "Failed to fill Instamart cart");
  }
}

export async function GET() {
  try {
    const { token } = await requireAccessToken();
    const cart = await getCart(token);
    return Response.json({ cart });
  } catch (err) {
    return jsonError(err, "Failed to load cart");
  }
}
