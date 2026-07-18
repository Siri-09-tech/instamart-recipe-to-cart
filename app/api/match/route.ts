import { z } from "zod";
import { jsonError, requireAccessToken, getSession } from "@/lib/api/helpers";
import { parseRecipeInput } from "@/lib/recipe";
import { matchIngredientsToProducts } from "@/lib/match/matchIngredients";

const bodySchema = z.object({
  input: z.string().min(1).optional(),
  ingredients: z
    .array(
      z.object({
        original: z.string(),
        name: z.string(),
        quantity: z.number().nullable(),
        unit: z.string().nullable(),
        searchQuery: z.string(),
        avoid: z.array(z.string()).default([]),
      })
    )
    .optional(),
  addressId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { token, session } = await requireAccessToken();
    const body = bodySchema.parse(await req.json());

    const addressId = body.addressId || session.addressId;
    if (!addressId) {
      return Response.json(
        { error: "Select a delivery address first.", code: "NO_ADDRESS" },
        { status: 400 }
      );
    }

    let ingredients = body.ingredients;
    let title: string | undefined;
    let source: string | undefined;
    let note: string | undefined;
    let servings: number | undefined;
    let appetite: string | undefined;
    let provider: string | undefined;
    let model: string | undefined;

    if (!ingredients) {
      if (!body.input) {
        return Response.json(
          { error: "Provide input or ingredients." },
          { status: 400 }
        );
      }
      const parsed = await parseRecipeInput(body.input);
      ingredients = parsed.ingredients;
      title = parsed.title;
      source = parsed.source;
      note = parsed.note;
      servings = parsed.servings;
      appetite = parsed.appetite;
      provider = parsed.provider;
      model = parsed.model;
    }

    const matches = await matchIngredientsToProducts(
      token,
      addressId,
      ingredients
    );

    // Persist selected address if passed
    if (body.addressId && body.addressId !== session.addressId) {
      const s = await getSession();
      s.addressId = body.addressId;
      await s.save();
    }

    return Response.json({
      title,
      source,
      note,
      servings,
      appetite,
      provider,
      model,
      addressId,
      matches,
      matchedCount: matches.filter((m) => m.status === "matched").length,
      totalCount: matches.length,
    });
  } catch (err) {
    return jsonError(err, "Failed to match ingredients");
  }
}
