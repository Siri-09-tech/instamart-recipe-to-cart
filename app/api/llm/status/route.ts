import { detectLlmProvider } from "@/lib/llm/provider";

export async function GET() {
  const detected = await detectLlmProvider();
  return Response.json({
    ready: Boolean(detected.provider),
    provider: detected.provider,
    detail: detected.detail,
  });
}
