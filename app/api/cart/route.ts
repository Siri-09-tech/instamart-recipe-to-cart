import { z } from "zod";
import { jsonError, requireAccessToken, getSession } from "@/lib/api/helpers";
import { replaceCart, getCartSafe } from "@/lib/mcp/instamart";
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

    const updateResult = await replaceCart(
      token,
      addressId,
      body.items.map((i) => ({
        spinId: i.spinId,
        ...(i.skuId ? { skuId: i.skuId } : {}),
        quantity: i.quantity,
        ...(i.name ? { name: i.name } : {}),
      })),
      { forceClear: body.replace !== false }
    );

    // Use verified cart from replaceCart — extra get_cart often flakes after long fills
    const cart = updateResult.cart;

    const cartItems = Array.isArray(cart?.items)
      ? (cart!.items as Array<Record<string, unknown>>)
      : [];

    // Diff against what actually landed (after substitutions), not the UI pick
    const availabilityIssues = diffCartAvailability(
      updateResult.accepted.map((a) => ({
        spinId: a.spinId,
        quantity: a.quantity,
        name: a.name,
      })),
      cartItems
    );

    const s = await getSession();
    s.addressId = addressId;
    await s.save();

    const itemCount = cartItems.length || updateResult.accepted.length;

    return Response.json({
      ok: true,
      cart,
      itemCount,
      replaced: body.replace,
      availabilityIssues,
      substitutions: updateResult.substitutions,
    });
  } catch (err) {
    return jsonError(err, "Failed to fill Instamart cart");
  }
}

export async function GET() {
  try {
    const { token } = await requireAccessToken();
    const { cart, clearedStale } = await getCartSafe(token);
    return Response.json({ cart, clearedStale });
  } catch (err) {
    return jsonError(err, "Failed to load cart");
  }
}
