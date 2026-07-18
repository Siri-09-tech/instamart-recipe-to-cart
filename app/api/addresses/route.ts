import { jsonError, requireAccessToken } from "@/lib/api/helpers";
import { getAddresses } from "@/lib/mcp/instamart";

export async function GET() {
  try {
    const { token } = await requireAccessToken();
    const { addresses, raw } = await getAddresses(token);
    return Response.json({
      addresses,
      count: addresses.length,
      // Helps debug unexpected MCP payload shapes in the browser Network tab
      _debugRaw: process.env.NODE_ENV === "development" ? raw : undefined,
    });
  } catch (err) {
    return jsonError(err, "Failed to load addresses");
  }
}
