/**
 * Swiggy Instamart MCP client — Streamable HTTP (docs).
 * Endpoint: https://mcp.swiggy.com/im
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const IM_URL = process.env.SWIGGY_IM_URL || "https://mcp.swiggy.com/im";

export type McpSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type McpFailure = {
  success: false;
  error: {
    message: string;
    reportLink?: string;
    reportHint?: string;
  };
};

export type McpResult<T> = McpSuccess<T> | McpFailure;

export class McpAuthError extends Error {
  status = 401;
  constructor(message = "Swiggy session expired. Please sign in again.") {
    super(message);
    this.name = "McpAuthError";
  }
}

export class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolError";
  }
}

type ToolCaller = <T>(
  name: string,
  args?: Record<string, unknown>
) => Promise<T>;

/**
 * Run multiple Instamart tool calls on one MCP connection.
 * Cart mutations are more reliable when get/clear/update share a session.
 */
function isTransportFlake(message: string): boolean {
  return /Streamable HTTP|POSTing to endpoint|fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(
    message
  );
}

async function openInstamartSession(
  accessToken: string,
  fn: (call: ToolCaller) => Promise<unknown>
): Promise<unknown> {
  const client = new Client({ name: "recipe-to-cart", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(IM_URL), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const call: ToolCaller = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    const payload = result as {
      isError?: boolean;
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: unknown;
    };

    if (payload.isError) {
      const msg = extractText(payload) || "Instamart tool returned an error";
      if (/unauth|401|expired|session/i.test(msg)) {
        throw new McpAuthError(msg);
      }
      throw new McpToolError(msg);
    }

    return parseToolPayload(payload);
  };

  try {
    await client.connect(transport);
    return await fn(call);
  } catch (err) {
    if (err instanceof McpAuthError || err instanceof McpToolError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (/401|Unauthorized|unauth/i.test(message)) {
      throw new McpAuthError(message);
    }
    throw new McpToolError(message || "MCP call failed");
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  }
}

/**
 * Run multiple Instamart tool calls on one MCP connection.
 * Retries once on empty Streamable HTTP POST flakes.
 */
export async function withInstamartSession<T>(
  accessToken: string,
  fn: (call: ToolCaller) => Promise<T>
): Promise<T> {
  try {
    return (await openInstamartSession(accessToken, fn)) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof McpAuthError || !isTransportFlake(message)) {
      throw err;
    }
    console.log("[mcp] transport flake — retrying once:", message);
    await new Promise((r) => setTimeout(r, 400));
    return (await openInstamartSession(accessToken, fn)) as T;
  }
}

export async function callInstamartTool<T>(
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  return withInstamartSession(accessToken, (call) => call<T>(name, args));
}

function extractText(result: {
  content?: Array<{ type: string; text?: string }>;
}): string {
  if (!Array.isArray(result.content)) return "";
  return result.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n")
    .trim();
}

function parseToolPayload<T>(result: {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
}): T {
  if (result.structuredContent != null) {
    return unwrapEnvelope(result.structuredContent);
  }

  const text = extractText(result);
  if (text) {
    try {
      return unwrapEnvelope(JSON.parse(text));
    } catch {
      return { message: text } as T;
    }
  }

  return result as unknown as T;
}

function unwrapEnvelope<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "success" in (raw as object)) {
    const envelope = raw as McpResult<T>;
    if (!envelope.success) {
      throw new McpToolError(
        envelope.error?.message || "Instamart tool failed"
      );
    }
    return envelope.data;
  }
  return raw as T;
}
