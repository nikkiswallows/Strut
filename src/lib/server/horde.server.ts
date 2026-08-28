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

import { FALLBACK_HORDE_API_KEY } from "./secrets.server";

const API_BASE = "https://aihorde.net/api/v2";
const CLIENT_AGENT = "Strut:1.0:contact@strut.app";

/**
 * Key precedence: real env var → committed fallback (see secrets.server.ts and
 * the warning at the top of it) → `0000000000`, the documented anonymous key.
 *
 * The anonymous key still works but sits at the back of the queue — measured at
 * ~40 minutes for one 768×1024 image. A registered key is the difference
 * between a usable tool and an unusable one.
 */
function apiKey(): string {
  return (
    process.env.AIHORDE_API_KEY?.trim() ||
    process.env.HORDE_API_KEY?.trim() ||
    FALLBACK_HORDE_API_KEY ||
    "0000000000"
  );
}

/** True when a key better than the anonymous one is in play. */
export function hordeKeyed(): boolean {
  return apiKey() !== "0000000000";
}

type HordeAccount = { username: string; kudos: number; concurrency: number };
let accountCache: { at: number; value: HordeAccount | null } | null = null;

/**
 * The Horde account behind the current key — used by the admin console.
 *
 * Cached for a minute. This used to fire on every console refresh, which during
 * a generation meant one extra Horde request per poll, for information that
 * changes on the order of minutes.
 */
export async function hordeAccount(): Promise<HordeAccount | null> {
  if (accountCache && Date.now() - accountCache.at < 60_000) return accountCache.value;
  if (hordeCoolingDown() > 0) return accountCache?.value ?? null;
  try {
    const res = await fetch(`${API_BASE}/find_user`, {
      headers: { apikey: apiKey(), "Client-Agent": CLIENT_AGENT },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      username?: string;
      kudos?: number;
      concurrency?: number;
    };
    if (!j.username) return null;
    const value: HordeAccount = {
      username: j.username,
      kudos: Math.round(Number(j.kudos ?? 0)),
      concurrency: Number(j.concurrency ?? 0),
    };
    accountCache = { at: Date.now(), value };
    return value;
  } catch {
    return accountCache?.value ?? null;
  }
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

/**
 * Wrap chat messages into a ChatML prompt (most Horde RP models use this).
 *
 * `prefill` seeds the start of the assistant's turn. That is the reliable way to
 * stop a reasoning model from spending its whole output budget on a `<think>`
 * monologue: begin the reply for it (`{`) and it continues from there instead of
 * deliberating. Measured — Skyfall-31B burned all 512 tokens reasoning about a
 * persona and never reached the JSON.
 */
function toChatML(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  prefill = "",
): string {
  let prompt = "";
  for (const m of messages) {
    const role = m.role === "assistant" ? "assistant" : m.role;
    prompt += `<|im_start|>${role}\n${m.content}<|im_end|>\n`;
  }
  prompt += `<|im_start|>assistant\n${prefill}`;
  return prompt;
}

/**
 * HTTP statuses that mean "ask again later", not "this job is dead".
 *
 * The Horde rate-limits per IP. A 429 while polling says nothing about the job
 * — it is still queued on a volunteer GPU — so treating it as a failure (which
 * this client used to do) throws away a generation that was about to succeed
 * and burns the kudos that paid for it. Same for gateway/5xx blips.
 */
const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Global cool-off shared by every Horde call in the process.
 *
 * When the network says 429 it means "you, this IP, are asking too often" — so
 * the correct response is to stop asking for a while, across ALL jobs, not to
 * back off one job while five others keep hammering. `Retry-After` is honoured
 * when present, otherwise a 15 s floor.
 */
let cooldownUntil = 0;

export function hordeCoolingDown(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

function noteRateLimit(res: Response): void {
  const header = Number(res.headers.get("retry-after"));
  const waitMs = Number.isFinite(header) && header > 0 ? header * 1000 : 15_000;
  cooldownUntil = Math.max(cooldownUntil, Date.now() + Math.min(waitMs, 120_000));
}

export type HordeSubmit = { hordeId: string } | { error: string };

/** Submit an async text-generation job. Returns the Horde job id. */
export async function hordeSubmit(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { maxLength?: number; prefill?: string; temperature?: number } = {},
): Promise<HordeSubmit> {
  const cooling = hordeCoolingDown();
  if (cooling > 0) {
    return { error: `the Horde rate-limited us — try again in ${Math.ceil(cooling / 1000)}s` };
  }
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
        prompt: toChatML(messages, opts.prefill),
        params: {
          max_context_length: 2048,
          max_length: opts.maxLength ?? 220,
          // 1.05 suits chat replies. Structured output needs a cooler head:
          // at 1.05 the seed generator produced word salad ("gym sulfita
          // sista", "SLOW jeans") inside otherwise-valid JSON.
          temperature: opts.temperature ?? 1.05,
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
      if (res.status === 429) noteRateLimit(res);
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
  // Cooling off after a 429: do not spend the request, and do not report a
  // failure — the job is untouched and still queued.
  if (hordeCoolingDown() > 0) return { done: false, queuePosition: -1, processing: 0 };
  try {
    const res = await fetch(`${API_BASE}/generate/text/status/${hordeId}`, {
      headers: { apikey: apiKey(), "Client-Agent": CLIENT_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      // 404 = expired/unknown job; treat as failure so we fall back.
      if (res.status === 404) return { failed: true, error: "job not found (expired)" };
      if (TRANSIENT_STATUS.has(res.status)) {
        if (res.status === 429) noteRateLimit(res);
        // Stay pending: the job is still on the network, we just asked too soon.
        return { done: false, queuePosition: -1, processing: 0 };
      }
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

/* ────────────────────────────────────────────────────────────────────────────
 * IMAGE generation
 *
 * Same crowd, same key, different endpoint and a different model pool. Horde
 * censors exactly one thing horde-wide — CSAM — and otherwise defers to each
 * volunteer worker's own censorlist, which is why `censor_nsfw` is explicitly
 * false and `nsfw` true below.
 *
 * Three properties of this service shape the caller:
 *  • it is ASYNC — submit an id, poll it. Never a request/response round trip.
 *  • queue position is a function of kudos. Anonymous works but sits at the
 *    back (measured ~40 min); a free registered key jumps most of the way up.
 *  • a worker may still censor (`censored: true`), so the caller MUST surface
 *    that rather than silently shipping a black rectangle.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Photoreal, NSFW-capable image checkpoints, best-first.
 *
 * Ordering is empirical, not aspirational. The list used to lead with
 * `WAI-NSFW-illustrious-SDXL`, which is an ANIME checkpoint: it is popular and
 * has plenty of workers, so it won every routing decision and produced either
 * illustrations or — repeatedly — a solid black frame. A dating app needs
 * photographs, so the photoreal checkpoints lead and the anime ones are
 * excluded outright by IMG_BAD below.
 */
const HORDE_IMAGE_MODELS = [
  "ICBINP - I Can't Believe It's Not Photography",
  "ICBINP XL",
  "Realistic Vision",
  "CyberRealistic Pony",
  "Pony Realism",
  "AbsoluteReality",
  "Edge Of Realism",
  "Juggernaut XL",
  "BigASP",
  "Deliberate",
  "AlbedoBase XL (SDXL)",
];

/** Prefer photographic checkpoints when discovering live ones. */
const IMG_GOOD =
  /(realistic|realism|icbinp|photograph|photo|juggernaut|absolutereality|epic|deliberate|albedo|dreamshaper|bigasp|cyberrealistic)/i;
/**
 * Skip anime/illustration checkpoints and inpainting variants outright.
 *
 * `illustrious`, `noob`, `hentai`, `abyss`, `mistoon`, `animerge` and the WAI /
 * NTR families are all anime models. They are the most numerous thing on the
 * network, so without this they dominate every render.
 */
const IMG_BAD =
  /(inpaint|anime|animerge|hentai|furry|toon|comic|illustrious|noob|abyss|mistoon|grapefruit|flat-2d|\bwai\b|wai-|ntr |amponyxl|swampony|tunix|prefect|nova (anime|furry)|cute|3d|logo|tile)/i;

/** Live image models with at least one online worker, most-available first. */
export async function hordeImageModels(): Promise<HordeModel[]> {
  try {
    const res = await fetch(`${API_BASE}/status/models?type=image`, {
      headers: { "Client-Agent": CLIENT_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as HordeModel[];
    const live = data.filter((m) => (m.count ?? 0) > 0);
    const byName = new Map(live.map((m) => [m.name.toLowerCase(), m]));
    const curated = HORDE_IMAGE_MODELS.filter((id) => byName.has(id.toLowerCase())).map(
      (id) => byName.get(id.toLowerCase())!,
    );
    const discovered = live
      .filter((m) => IMG_GOOD.test(m.name) && !IMG_BAD.test(m.name))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    const merged: HordeModel[] = [];
    for (const m of [...curated, ...discovered]) {
      if (!merged.some((x) => x.name === m.name)) merged.push(m);
    }
    return merged.length ? merged.slice(0, 10) : live.slice(0, 5);
  } catch {
    return [];
  }
}

export type HordeImageSubmit = { hordeId: string; kudos: number } | { error: string };

/**
 * Queue one image. Portrait aspect by default — a dating profile photo is
 * vertical. `nsfw: true` declares intent, `censor_nsfw: false` asks the worker
 * not to blur it; neither is a guarantee, so check `censored` on the way out.
 */
export async function hordeSubmitImage(
  prompt: string,
  opts: {
    models?: string[];
    width?: number;
    height?: number;
    steps?: number;
    negativePrompt?: string;
    seed?: string;
  } = {},
): Promise<HordeImageSubmit> {
  const cooling = hordeCoolingDown();
  if (cooling > 0) {
    return { error: `the Horde rate-limited us — try again in ${Math.ceil(cooling / 1000)}s` };
  }
  const models = opts.models?.length ? opts.models : (await hordeImageModels()).map((m) => m.name);
  if (!models.length) return { error: "no horde image models online" };

  const width = opts.width ?? 768;
  const height = opts.height ?? 1024;
  const steps = opts.steps ?? 25;

  try {
    const res = await fetch(`${API_BASE}/generate/async`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey(),
        "Client-Agent": CLIENT_AGENT,
      },
      body: JSON.stringify({
        prompt,
        params: {
          n: 1,
          width,
          height,
          steps,
          cfg_scale: 7.0,
          sampler_name: "k_euler",
          karras: true,
          // Horde rejects a negative prompt on models that don't use one, so
          // only send it when we actually have one.
          ...(opts.negativePrompt ? { negative_prompt: opts.negativePrompt } : {}),
          ...(opts.seed ? { seed: opts.seed } : {}),
        },
        models,
        nsfw: true,
        censor_nsfw: false,
        slow_workers: true,
        // Return an R2 URL rather than a base64 blob — keeps the row small and
        // lets the UI render straight from the source.
        r2: true,
        shared: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json()) as {
      id?: string;
      kudos?: number;
      message?: string;
      errors?: Record<string, string>;
    };
    if (!res.ok || !data.id) {
      if (res.status === 429) noteRateLimit(res);
      const detail = data.errors ? JSON.stringify(data.errors) : (data.message ?? res.statusText);
      return { error: `horde image submit ${res.status}: ${detail}` };
    }
    return { hordeId: data.id, kudos: data.kudos ?? 0 };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "horde image submit failed" };
  }
}

export type HordeImageStatus =
  | { done: false; queuePosition: number; waitTime: number; processing: number }
  | { done: true; url: string; model: string; seed: string | null; censored: boolean }
  | { failed: true; error: string };

/** Poll an image job. `censored` is surfaced, never swallowed. */
export async function hordeCheckImage(hordeId: string): Promise<HordeImageStatus> {
  if (hordeCoolingDown() > 0) {
    return { done: false, queuePosition: -1, waitTime: 0, processing: 0 };
  }
  try {
    const res = await fetch(`${API_BASE}/generate/status/${hordeId}`, {
      headers: { apikey: apiKey(), "Client-Agent": CLIENT_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      if (res.status === 404) return { failed: true, error: "job not found (expired)" };
      if (TRANSIENT_STATUS.has(res.status)) {
        if (res.status === 429) noteRateLimit(res);
        return { done: false, queuePosition: -1, waitTime: 0, processing: 0 };
      }
      return { failed: true, error: `status ${res.status}` };
    }
    const j = (await res.json()) as {
      done?: boolean;
      faulted?: boolean;
      is_possible?: boolean;
      queue_position?: number;
      wait_time?: number;
      processing?: number;
      generations?: {
        img?: string;
        model?: string;
        seed?: string;
        censored?: boolean;
        state?: string;
      }[];
      message?: string;
    };
    if (j.faulted) return { failed: true, error: j.message ?? "job faulted" };
    if (j.is_possible === false) return { failed: true, error: "no worker can fulfil this job" };
    if (j.done) {
      const g = j.generations?.[0];
      if (!g?.img) return { failed: true, error: "empty generation" };
      // Workers that censor return a black image with white text. Treat that
      // as a soft failure and say so, rather than showing a black square.
      if (g.censored) {
        return { failed: true, error: "the worker censored this image" };
      }
      return {
        done: true,
        url: g.img,
        model: g.model ?? "horde",
        seed: g.seed ?? null,
        censored: false,
      };
    }
    return {
      done: false,
      queuePosition: j.queue_position ?? 0,
      waitTime: j.wait_time ?? 0,
      processing: j.processing ?? 0,
    };
  } catch (err) {
    // Transient network/timeout: stay pending so the caller retries.
    return { done: false, queuePosition: -1, waitTime: 0, processing: 0 };
  }
}
