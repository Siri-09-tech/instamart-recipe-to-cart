import { z } from "zod";
import { jsonError } from "@/lib/api/helpers";
import { parseRecipeInput } from "@/lib/recipe";

const bodySchema = z.object({
  input: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { input } = bodySchema.parse(await req.json());
    const result = await parseRecipeInput(input);
    return Response.json(result);
  } catch (err) {
    return jsonError(err, "Failed to parse recipe");
  }
}
