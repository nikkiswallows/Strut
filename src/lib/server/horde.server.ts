/**
 * AI Horde (KoboldAI Horde) client — a free, crowdsourced network of volunteer
 * GPUs running uncensored roleplay models (Cydonia, Skyfall, Magnum-class).
 * Unlike mainstream hosted APIs, these models do NOT refuse consensual adult
 * roleplay, which is exactly what this app needs.
 *
 * It is a QUEUED, async service: you submit a job and poll a status URL. That
 * maps perfectly to a fire-and-forget bot reply + client polling, and the
 * realistic delay (a model "typing") suits a dating app.
 *
 * Docs: https://aihorde.net/api/v2 (text generation). Keyless works but is
 * lowest queue priority; a free registered key (AIHORDE_API_KEY / HORDE_API_KEY
 * — both accepted) jumps way up in queue.
 */

const API_BASE = "https://aihorde.net/api/v2";
const CLIENT_AGENT = "Strut:1.0:contact@strut.app";

function apiKey(): string {
  return process.env.AIHORDE_API_KEY || process.env.HORDE_API_KEY || "0000000000";
}

export function hordeConfigured(): boolean {
  // Always "available" — keyless anonymous access works (just slow queue).
  return true;
}

// Uncensored roleplay models, best first. Ordered by a mix of quality,
// willingness (no refusals), and live availability/queue. The Horde routes a job
// to the FIRST model in the list that has a free worker, so listing several
// keeps replies flowing even when one model's workers are busy.
//
// These are living labels on a crowdsourced network (workers come and go), so
// we also fetch the live model list and prefer matches by keyword.
const HORDE_RP_MODELS = [
  "aphrodite/TheDrummer/Cydonia-24B-v4.3",
  "aphrodite/TheDrummer/Cydonia-24B-v4.1",
  "aphrodite/TheDrummer/Skyfall-31B-v4.2",
  "koboldcpp/Rocinante-X-12B",
  "koboldcpp/mini-magnum-12b-v1.1",
  "koboldcpp/L3-Super-Nova-RP-8B",
  "koboldcpp/Angelic_Eclipse-12B",
];

type HordeModel = { name: string; count?: number; eta?: number };

/** Fetch the live text-model list (online workers only). */
async function liveModels(): Promise<HordeModel[]> {
  try {
    const res = await fetch(`${API_BASE}/status/models?type=text`, {
      headers: { "Client-Agent": CLIENT_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as HordeModel[];
    return data.filter((m) => (m.count ?? 0) > 0);
  } catch {
    return [];
  }
}

// Keywords that mark a model as uncensored / RP-specialised (worker name often
// embeds the underlying model). Mainstream "instruct" base models we skip —
// those are the ones that refuse.
const RP_BAD = /(nemotron.*content.?safety|safety|guard|gpt-oss|gemma-4-31b-it(?!.*heretic)|llama-3.2-3b|pythia|cerebras|qwen3-0.6|qwen3.5-0.8|rwkv7|111m)/i;
const RP_GOOD = /(cydonia|skyfall|rocinante|magnum|super-nova|supernova|angelic_eclipse|heretic|uncensored|unslop|impish|bloodmoon|midnight|meromero|mythalion|pygmalion|stheno|l3.?35|sao10k)/i;

/**
 * Build the model list to request: curated ids that are actually online, then
 * any live RP models discovered, most-available first.
 */
async function resolveModels(): Promise<string[]> {
  const live = await liveModels();
  const byName = new Map(live.map((m) => [m.name.toLowerCase(), m]));
  const curated = HORDE_RP_MODELS.filter((id) => byName.has(id.toLowerCase()));

  const discovered = live
    .filter((m) => RP_GOOD.test(m.name) && !RP_BAD.test(m.name))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .map((m) => m.name);

  const merged: string[] = [];
  for (const id of [...curated, ...discovered]) {
    if (!merged.includes(id)) merged.push(id);
  }
  // Fallback: if nothing matched (unlikely), just ask for any online model.
  return merged.length ? merged.slice(0, 8) : live.slice(0, 5).map((m) => m.name);
}

/** Wrap chat messages into a ChatML prompt (most Horde RP models use this). */
function toChatML(messages: { role: "system" | "user" | "assistant"; content: string }[]): string {
  let prompt = "";
  for (const m of messages) {
    const role = m.role === "assistant" ? "assistant" : m.role;
    prompt += `<|im_start|>${role}\n${m.content}<|im_end|>\n`;
  }
  prompt += `<|im_start|>assistant\n`;
  return prompt;
}

export type HordeSubmit = { hordeId: string } | { error: string };

/** Submit an async text-generation job. Returns the Horde job id. */
export async function hordeSubmit(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { maxLength?: number } = {},
): Promise<HordeSubmit> {
  const models = await resolveModels();
  if (!models.length) return { error: "no horde models available" };
  try {
    const res = await fetch(`${API_BASE}/generate/text/async`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey(),
        "Client-Agent": CLIENT_AGENT,
      },
      body: JSON.stringify({
        prompt: toChatML(messages),
        params: {
          max_context_length: 2048,
          max_length: opts.maxLength ?? 220,
          temperature: 1.05,
          rep_penalty: 1.12,
          stop_sequence: ["<|im_end|>", "\nUser:", "\nuser:"],
        },
        models,
        n: 1,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json()) as { id?: string; message?: string };
    if (!res.ok || !data.id) {
      return { error: `horde submit ${res.status}: ${data.message ?? res.statusText}` };
    }
    return { hordeId: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "horde submit failed" };
  }
}

export type HordeStatus =
  | { done: false; queuePosition: number; processing: number }
  | { done: true; text: string; model: string }
  | { failed: true; error: string };

/** Poll a submitted job. Returns pending info or the finished text. */
export async function hordeCheck(hordeId: string): Promise<HordeStatus> {
  try {
    const res = await fetch(`${API_BASE}/generate/text/status/${hordeId}`, {
      headers: { apikey: apiKey(), "Client-Agent": CLIENT_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      // 404 = expired/unknown job; treat as failure so we fall back.
      if (res.status === 404) return { failed: true, error: "job not found (expired)" };
      return { failed: true, error: `status ${res.status}` };
    }
    const j = (await res.json()) as {
      done?: boolean;
      faulted?: boolean;
      is_possible?: boolean;
      queue_position?: number;
      processing?: number;
      generations?: { text?: string; model?: string }[];
      message?: string;
    };
    if (j.faulted) return { failed: true, error: j.message ?? "job faulted" };
    if (j.is_possible === false) return { failed: true, error: "no worker can fulfil this job" };
    if (j.done) {
      const g = j.generations?.[0];
      const text = (g?.text ?? "").replace(/<\|im_end\|>[\s\S]*$/g, "").trim();
      if (!text) return { failed: true, error: "empty generation" };
      return { done: true, text, model: g?.model ?? "horde" };
    }
    return { done: false, queuePosition: j.queue_position ?? 0, processing: j.processing ?? 0 };
  } catch (err) {
    // Network/timeout: stay pending (transient) — caller retries.
    return { done: false, queuePosition: -1, processing: 0 };
  }
}
