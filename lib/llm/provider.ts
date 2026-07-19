/**
 * LLM chat completions for recipe extraction.
 * Priority: NVIDIA NIM → Ollama (local) → Groq → Gemini
 */

export type LlmProviderName = "nvidia" | "ollama" | "groq" | "gemini";

export type LlmChatResult = {
  provider: LlmProviderName;
  model: string;
  text: string;
};

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const NVIDIA_API_KEY =
  process.env.NVIDIA_API_KEY || process.env.NIM_API_KEY || "";
const NVIDIA_BASE =
  process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
// Prefer a smaller/faster instruct model; 70B often cold-starts past client timeouts
const NVIDIA_MODEL =
  process.env.NVIDIA_NIM_MODEL || "meta/llama-3.1-8b-instruct";

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function detectLlmProvider(): Promise<{
  provider: LlmProviderName | null;
  detail: string;
}> {
  if (NVIDIA_API_KEY) {
    return {
      provider: "nvidia",
      detail: `NVIDIA NIM (${NVIDIA_MODEL})`,
    };
  }
  if (await isOllamaAvailable()) {
    return {
      provider: "ollama",
      detail: `Ollama @ ${OLLAMA_BASE} (${OLLAMA_MODEL})`,
    };
  }
  if (process.env.GROQ_API_KEY) {
    return { provider: "groq", detail: `Groq (${GROQ_MODEL})` };
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return { provider: "gemini", detail: `Gemini (${GEMINI_MODEL})` };
  }
  return {
    provider: null,
    detail:
      "No LLM configured. Set NVIDIA_API_KEY (build.nvidia.com), or install Ollama and `ollama pull llama3.2`, or set GROQ_API_KEY / GEMINI_API_KEY in .env.local",
  };
}

export async function chatJson(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<LlmChatResult> {
  const detected = await detectLlmProvider();
  if (!detected.provider) {
    throw new Error(detected.detail);
  }

  if (detected.provider === "nvidia") {
    return chatNvidia(opts);
  }
  if (detected.provider === "ollama") {
    return chatOllama(opts);
  }
  if (detected.provider === "groq") {
    return chatGroq(opts);
  }
  return chatGemini(opts);
}

async function chatNvidia(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<LlmChatResult> {
  let res: Response;
  try {
    res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        temperature: opts.temperature ?? 0.2,
        max_tokens: 2048,
        stream: false,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/aborted|timeout|TimeoutError/i.test(msg)) {
      throw new Error(
        `NVIDIA NIM timed out waiting for ${NVIDIA_MODEL}. Try a faster model in .env.local (e.g. NVIDIA_NIM_MODEL=meta/llama-3.1-8b-instruct) or check build.nvidia.com status.`
      );
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NVIDIA NIM error (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("NVIDIA NIM returned an empty response");
  return { provider: "nvidia", model: NVIDIA_MODEL, text };
}

async function chatOllama(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<LlmChatResult> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      format: "json",
      options: { temperature: opts.temperature ?? 0.2 },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
    signal: AbortSignal.timeout(240_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Ollama error (${res.status}): ${text.slice(0, 200)}. Is model "${OLLAMA_MODEL}" pulled? Try: ollama pull ${OLLAMA_MODEL}`
    );
  }

  const json = (await res.json()) as {
    message?: { content?: string };
  };
  const text = json.message?.content?.trim();
  if (!text) throw new Error("Ollama returned an empty response");
  return { provider: "ollama", model: OLLAMA_MODEL, text };
}

async function chatGroq(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<LlmChatResult> {
  const key = process.env.GROQ_API_KEY!;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: opts.temperature ?? 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq returned an empty response");
  return { provider: "groq", model: GROQ_MODEL, text };
}

async function chatGemini(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<LlmChatResult> {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        responseMimeType: "application/json",
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response");
  return { provider: "gemini", model: GEMINI_MODEL, text };
}
