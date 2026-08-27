/**
 * Chat completion provider for seed/bot replies (server-only).
 *
 * Uses an OpenAI-compatible API so many backends work with one code path. The
 * provider is chosen automatically from whichever key is present, in order:
 *
 *   1. Generic OpenAI-compatible endpoint — AI_API_KEY + AI_API_BASE (+AI_MODEL)
 *      Use this for any self-hosted or enterprise gateway later.
 *   2. xAI Grok        — XAI_API_KEY   (most permissive for adult/edgy chat;
 *                                       paid but very cheap, ~pennies)
 *   3. Groq            — GROQ_API_KEY  (FREE tier, very fast; recommended to
 *                                       start. Get one at console.groq.com)
 *   4. OpenRouter      — OPENROUTER_API_KEY (FREE models; openrouter.ai)
 *   5. Google Gemini   — GEMINI_API_KEY / GOOGLE_AI_API_KEY (free; NOTE:
 *                                       Gemini filters explicit content hard)
 *
 * Override the model with AI_MODEL. With NO key configured, callers fall back to
 * a canned line so the app still works.
 */

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = {
  id: string;
  label: string;
  apiBase: string;
  apiKey: string;
  model: string;
};

function envKey(name: string): string {
  try {
    return (process.env[name] ?? "").trim();
  } catch {
    return "";
  }
}

export function selectProvider(): Provider | null {
  const genericKey = envKey("AI_API_KEY");
  const genericBase = envKey("AI_API_BASE");
  if (genericKey && genericBase) {
    return {
      id: "generic",
      label: envKey("AI_PROVIDER_NAME") || "Custom AI",
      apiBase: genericBase.replace(/\/+$/, ""),
      apiKey: genericKey,
      model: envKey("AI_MODEL") || "gpt-4o-mini",
    };
  }

  const xai = envKey("XAI_API_KEY");
  if (xai) {
    return {
      id: "xai",
      label: "xAI Grok",
      apiBase: "https://api.x.ai/v1",
      apiKey: xai,
      model: envKey("AI_MODEL") || "grok-3-mini",
    };
  }

  const groq = envKey("GROQ_API_KEY");
  if (groq) {
    return {
      id: "groq",
      label: "Groq",
      apiBase: "https://api.groq.com/openai/v1",
      apiKey: groq,
      model: envKey("AI_MODEL") || "llama-3.3-70b-versatile",
    };
  }

  const openrouter = envKey("OPENROUTER_API_KEY");
  if (openrouter) {
    return {
      id: "openrouter",
      label: "OpenRouter",
      apiBase: "https://openrouter.ai/api/v1",
      apiKey: openrouter,
      model: envKey("AI_MODEL") || "meta-llama/llama-3.3-70b-instruct:free",
    };
  }

  const gemini = envKey("GEMINI_API_KEY") || envKey("GOOGLE_AI_API_KEY");
  if (gemini) {
    return {
      id: "gemini",
      label: "Google Gemini",
      apiBase: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: gemini,
      model: envKey("AI_MODEL") || "gemini-2.5-flash",
    };
  }

  return null;
}

/** True when at least one chat provider is configured. */
export function aiConfigured(): boolean {
  return selectProvider() !== null;
}

/** Public, non-secret info about the active AI provider (for /api/config). */
export function aiPublicInfo() {
  const p = selectProvider();
  return { provider: p?.id ?? null, label: p?.label ?? null, model: p?.model ?? null };
}

/**
 * Call the configured chat model. Returns the assistant text (already trimmed).
 * Throws on network/HTTP errors so callers can fall back.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const provider = selectProvider();
  if (!provider) throw new Error("no-ai-key");

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? 15_000,
  );

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    };
    // OpenRouter likes these (optional, ignored elsewhere).
    if (provider.id === "openrouter") {
      headers["HTTP-Referer"] = "https://strut.app";
      headers["X-Title"] = "Strut";
    }

    const res = await fetch(`${provider.apiBase}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: opts.maxTokens ?? 200,
        temperature: opts.temperature ?? 1.0,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[ai] ${provider.id} ${res.status}`, detail.slice(0, 300));
      throw new Error(`ai-${provider.id}-${res.status}`);
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return (body.choices?.[0]?.message?.content ?? "").trim();
  } finally {
    clearTimeout(timer);
  }
}
