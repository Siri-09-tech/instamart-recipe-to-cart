import { z } from "zod";
import { jsonError, requireAccessToken, getSession } from "@/lib/api/helpers";
import { updateCart, getCart } from "@/lib/mcp/instamart";
import { diffCartAvailability } from "@/lib/match/availability";

const fillSchema = z.object({
  items: z
    .array(
      z.object({
        spinId: z.string().min(1),
        skuId: z.string().min(1).optional(),
        quantity: z.number().int().min(1).max(20).default(1),
        name: z.string().optional(),
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

    // update_cart already replaces the entire cart — do NOT clear first.
    // clear_cart → update_cart often yields "all items out of stock" from Instamart.
    const updateResult = await updateCart(token, addressId, body.items);
    let cart = await getCart(token);
    if (!cart || (Array.isArray(cart.items) && cart.items.length === 0)) {
      const fromUpdate =
        updateResult && typeof updateResult === "object"
          ? (updateResult as Record<string, unknown>)
          : null;
      if (
        fromUpdate &&
        Array.isArray(fromUpdate.items) &&
        fromUpdate.items.length
      ) {
        cart = fromUpdate as typeof cart;
      }
    }

    const cartItems = Array.isArray(cart.items)
      ? (cart.items as Array<Record<string, unknown>>)
      : [];

    const availabilityIssues = diffCartAvailability(
      body.items.map((i) => ({
        spinId: i.spinId,
        quantity: i.quantity,
        name: i.name,
      })),
      cartItems
    );

    const s = await getSession();
    s.addressId = addressId;
    await s.save();

    const itemCount = cartItems.length || body.items.length;

    return Response.json({
      ok: true,
      cart,
      itemCount,
      replaced: body.replace,
      availabilityIssues,
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
