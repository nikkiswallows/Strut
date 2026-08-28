/**
 * Admin seed-profile pipeline (server-only).
 *
 * Persona text → uncensored Horde text model → structured profile fields →
 * Horde image model → one photo → **human edit + approval** → real profile row.
 *
 * Design constraints, in the order they shaped the code:
 *
 *  1. Nothing is created without an explicit approve call. Drafts live in
 *     `seed_jobs`; a `profiles` row only appears on approval, and the operator
 *     can rewrite every field before that click.
 *  2. Every generated profile carries `is_ai = true` and full provenance in
 *     `ai_seed` (models, prompts, job ids, approver, timestamp, and whether a
 *     human edited the draft). That makes the whole synthetic cohort auditable
 *     and purgable in one statement.
 *  3. Horde is async and slow (seconds to tens of minutes depending on queue).
 *     Every step is submit-then-poll, never a blocking round trip.
 *  4. The model is not trusted to be consistent. It proposes; deterministic
 *     rules in `coerceDraft` decide. A "bull" is a Top, a "sissy" is a Bottom,
 *     and neither depends on a 12B parameter model remembering that.
 */
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { coordForLocation } from "@/lib/geo";
import { accountEvent } from "@/lib/server/audit";
import { storePhotoObject } from "@/lib/server/media.server";
import {
  hordeCheck,
  hordeCheckImage,
  hordeSubmit,
  hordeSubmitImage,
} from "@/lib/server/horde.server";
import {
  ETHNICITIES,
  IDENTITIES,
  INTERESTS,
  LOOKING_FOR,
  PRONOUNS,
  ROLES,
} from "@/lib/types";

export {
  adminEmails,
  adminEnabled,
  adminIds,
  ensureAdminAccount,
  ForbiddenError,
  isAdminUser,
} from "./admin-account.server";
import { ForbiddenError } from "./admin-account.server";

/** Assert a caller already checked by the route is present. */
export function assertActor(actorId: string | null | undefined): string {
  if (!actorId) throw new ForbiddenError("Not an admin.");
  return actorId;
}

/* ── shape of a generated persona ────────────────────────────────────────── */

export type SeedDraft = {
  handle: string;
  displayName: string;
  age: number;
  identities: string[];
  pronouns: string[];
  role: string;
  ethnicity: string;
  lookingFor: string[];
  interests: string[];
  location: string;
  heightCm: number | null;
  bio: string;
};

export type SeedJob = {
  id: number;
  persona: string;
  /** The edited draft when a human has touched it, else the model's own. */
  draft: SeedDraft | null;
  /** True when `draft` differs from what the model produced. */
  edited: boolean;
  status: "drafting" | "awaiting_review" | "approved" | "discarded" | "failed";
  textModel: string | null;
  imageModel: string | null;
  imagePrompt: string | null;
  imageUrl: string | null;
  imageCensored: boolean;
  error: string | null;
  createdUserId: string | null;
  createdAt: string;
  /** Progress hints straight from the Horde queue. */
  queuePosition: number | null;
  waitTime: number | null;
  stage: "text" | "image" | "review" | "done";
};

type Row = Record<string, unknown>;

/** Per-job transient queue info; not worth a column, useful in the UI. */
const progress = new Map<number, { queuePosition: number; waitTime: number; stage: string }>();

function toJob(r: Row): SeedJob {
  const id = Number(r.id);
  const model = (r.draft as SeedDraft | null) ?? null;
  const edited = (r.draft_edited as SeedDraft | null) ?? null;
  const status = String(r.status ?? "drafting") as SeedJob["status"];
  const p = progress.get(id);
  return {
    id,
    persona: String(r.persona ?? ""),
    draft: edited ?? model,
    edited: Boolean(edited),
    status,
    textModel: r.text_model ? String(r.text_model) : null,
    imageModel: r.image_model ? String(r.image_model) : null,
    imagePrompt: r.image_prompt ? String(r.image_prompt) : null,
    imageUrl: r.image_url ? String(r.image_url) : null,
    imageCensored: Boolean(r.image_censored),
    error: r.error ? String(r.error) : null,
    createdUserId: r.created_user_id ? String(r.created_user_id) : null,
    createdAt: String(r.created_at ?? ""),
    queuePosition: p?.queuePosition ?? null,
    waitTime: p?.waitTime ?? null,
    stage:
      status === "approved" || status === "discarded"
        ? "done"
        : status === "awaiting_review"
          ? "review"
          : r.image_horde_id
            ? "image"
            : "text",
  };
}

/* ── deterministic persona logic ─────────────────────────────────────────── */

/**
 * The app's own role semantics, encoded once.
 *
 * `bnwo.ts` treats Bull as the king role; the whole product is built on that
 * asymmetry. Leaving it to the language model produced sissies marked "Top"
 * roughly one generation in four, which then land in the wrong discover tab and
 * make the deck read as noise. So the model's answer is a *hint* and these
 * rules are the decision.
 */
const TOP_IDENTITIES = new Set(["Bull", "Man", "Admirer"]);
const BOTTOM_IDENTITIES = new Set([
  "Sissy",
  "Whiteboi",
  "Femboy",
  "Crossdresser",
  "T-Girl",
  "Trans woman",
  "Cuck",
  "Non-binary femme",
]);
const SWITCH_IDENTITIES = new Set(["Couple", "Group", "Genderfluid", "Questioning"]);

/** Keyword → identity. First match wins, so order is significance order. */
const IDENTITY_HINTS: [RegExp, string][] = [
  [/\bbull\b|\bbbc\b|\bblack (?:king|man|top|dom)\b|\bkings?\b/i, "Bull"],
  [/\bsissy|sissies\b/i, "Sissy"],
  [/\bwhite ?boi|whiteboy|beta (?:male|boy)\b/i, "Whiteboi"],
  [/\bfemboy\b/i, "Femboy"],
  [/\bcross ?dress|\bcd\b/i, "Crossdresser"],
  [/\bt-?girl|tgirl\b/i, "T-Girl"],
  [/\btrans ?(?:woman|femme|girl)\b/i, "Trans woman"],
  [/\bhot ?wife\b/i, "Hotwife"],
  [/\bcuck(?:old)?(?:ress)?\b/i, "Cuck"],
  [/\bqueen|\bwife\b|\bwoman\b|\bgirl\b/i, "Woman"],
  [/\bcouple\b/i, "Couple"],
  [/\bgroup\b/i, "Group"],
  [/\badmirer|\bwatcher\b/i, "Admirer"],
  [/\bnon-?binary\b/i, "Non-binary femme"],
  [/\bgender ?fluid\b/i, "Genderfluid"],
  [/\bcurious|questioning\b/i, "Questioning"],
  [/\bman\b|\bguy\b|\bmale\b/i, "Man"],
];

const ETHNICITY_HINTS: [RegExp, string][] = [
  [/\bblack\b|\bbbc\b|\bbull\b|\bafrican\b|\bebony\b/i, "Black"],
  [/\bwhite\b|\bcaucasian\b|\bsissy\b|\bwhite ?boi\b|\bsnow ?bunny\b/i, "White"],
  [/\blatina?\b|\bhispanic\b|\bmexican\b|\bcolombian\b/i, "Latina"],
  [/\basian\b|\bfilipin|\bkorean\b|\bjapanese\b|\bthai\b/i, "Asian"],
  [/\bmiddle ?eastern\b|\barab\b|\bpersian\b/i, "Middle Eastern"],
  [/\bindigenous\b|\bnative\b/i, "Indigenous"],
  [/\bmixed\b|\bbiracial\b/i, "Mixed"],
];

function firstHint(text: string, table: [RegExp, string][]): string | null {
  for (const [re, value] of table) if (re.test(text)) return value;
  return null;
}

/** Explicit role words in the persona always beat identity inference. */
function explicitRole(text: string): string | null {
  if (/\bswitch(?:es|y)?\b|\bvers\b/i.test(text)) return "Switch";
  if (/\bbottoms?\b|\bsub(?:missive|by)?\b|\bpillow princess\b|\bbreedable\b/i.test(text)) {
    return "Bottom";
  }
  if (/\btops?\b|\bdom(?:inant|me)?\b|\bdaddy\b|\balpha\b/i.test(text)) return "Top";
  if (/\bside\b/i.test(text)) return "Side";
  return null;
}

function inferRole(identities: string[], persona: string, modelRole: string): string {
  const explicit = explicitRole(persona);
  if (explicit) return explicit;
  if (identities.some((i) => TOP_IDENTITIES.has(i))) return "Top";
  if (identities.some((i) => BOTTOM_IDENTITIES.has(i))) return "Bottom";
  if (identities.some((i) => SWITCH_IDENTITIES.has(i))) return "Switch";
  if ((ROLES as readonly string[]).includes(modelRole)) return modelRole;
  return "Switch";
}

/** Pronouns that match the identity when the model omitted or invented them. */
function inferPronouns(identities: string[]): string[] {
  if (identities.some((i) => TOP_IDENTITIES.has(i))) return ["he/him"];
  if (identities.some((i) => ["Sissy", "T-Girl", "Trans woman", "Hotwife", "Woman"].includes(i))) {
    return ["she/her"];
  }
  if (identities.includes("Femboy") || identities.includes("Crossdresser")) return ["he/they"];
  if (identities.includes("Non-binary femme") || identities.includes("Genderfluid")) {
    return ["they/them"];
  }
  return ["he/him"];
}

/** A "looking for" set that is coherent with the role, when the model's isn't. */
function inferLookingFor(role: string, identities: string[]): string[] {
  if (role === "Top" || identities.includes("Bull")) return ["Now", "Dates", "To be bred"];
  if (identities.includes("Hotwife")) return ["Bulls", "BBC", "Hotwife nights"];
  if (identities.includes("Cuck")) return ["Cuckold", "Cleanup", "Bulls"];
  return ["BBC", "Bulls", "To serve"];
}

/** Interests that read as on-theme rather than as an empty profile. */
function inferInterests(role: string, identities: string[]): string[] {
  if (identities.includes("Bull") || role === "Top") {
    return ["BNWO", "Fitness", "Interracial", "Breeding", "Nights out"];
  }
  if (identities.includes("Hotwife")) return ["QOS", "BBC", "Hotwife", "Lingerie", "Nights out"];
  if (identities.includes("Cuck")) return ["Cuckold", "Cleanup", "BNWO", "Interracial"];
  return ["BNWO", "Feminization", "Lingerie", "Chastity", "Heels"];
}

const HEIGHT_RE = /\b(\d)\s*(?:'|ft|feet)\s*(\d{1,2})?\b|\b(1[4-9]\d|2[0-2]\d)\s*cm\b/i;

function inferHeight(text: string): number | null {
  const m = HEIGHT_RE.exec(text);
  if (!m) return null;
  if (m[3]) return Number(m[3]);
  const feet = Number(m[1]);
  const inches = Number(m[2] ?? 0);
  const cm = Math.round((feet * 12 + inches) * 2.54);
  return cm >= 130 && cm <= 225 ? cm : null;
}

/* ── prompt construction ─────────────────────────────────────────────────── */

/**
 * The system prompt that turns a free-text persona into structured JSON.
 *
 * Constraining the output to the app's real vocabularies matters: the chips in
 * `src/lib/types.ts` are what the UI renders and what the Kings/Men tabs filter
 * on, so free-form model output would silently produce unfilterable profiles.
 *
 * `bio` is asked for last and long on purpose — it is the field that sells the
 * profile, and putting it at the end of the object means a truncated generation
 * loses the tail of the bio rather than a structural field.
 */
function systemPrompt(): string {
  return `You write fictional adult dating profiles for a niche interracial dating app (BNWO).
The operator describes a persona; you invent one believable, specific, unmistakably ADULT member.
Every person you describe is over 18. Never write anything sexual involving a minor.

House vocabulary (use it, do not invent terms):
- A "bull" is a dominant Black top. A "sissy", "whiteboi" or "femboy" is a submissive bottom.
- A "hotwife" is a woman with a partner's blessing to see bulls. A "cuck" is her partner.
- Be explicit, confident and specific. Do not be coy, clinical or apologetic.

Reply with STRICT JSON and nothing else, exactly these keys in this order:
{"handle":"lowercase_no_spaces_max24","displayName":"1-3 words","age":INTEGER_18_TO_65,
 "identities":[...],"pronouns":[...],"role":"","ethnicity":"","location":"City, ST",
 "heightCm":INTEGER_OR_NULL,"lookingFor":[...],"interests":[...],
 "bio":"6 to 9 sentences, first person, present tense, vivid and specific"}

Allowed identities: ${IDENTITIES.join(", ")}
Allowed pronouns: ${PRONOUNS.join(", ")}
Allowed role: ${ROLES.join(", ")}
Allowed ethnicity: ${ETHNICITIES.join(", ")}
Allowed lookingFor: ${LOOKING_FOR.join(", ")}
Allowed interests: ${INTERESTS.join(", ")}

Pick 1-3 identities, 1-2 pronouns, exactly 1 role, exactly 1 ethnicity, 2-4 lookingFor, 4-6 interests.
The bio must be LONG and DETAILED: what they look like, what they do on a weeknight, what they
want here, how they want to be approached, and one concrete personal detail nobody else would write.
No hashtags, no emoji, no quotation marks inside the bio. JSON only.`;
}

/**
 * Image prompt derived from the persona and the drafted fields.
 *
 * Deliberately framed as ordinary amateur photography — these are meant to read
 * as profile photos, not as renderings. The negative terms keep the common SD
 * failure modes (extra limbs, watermarks, cartoon shading) out.
 */
export function imagePromptFor(persona: string, draft: SeedDraft | null): string {
  if (!draft) {
    return `amateur smartphone selfie of an adult, ${persona}, candid, natural light, looking at camera, realistic skin texture, vertical portrait`;
  }
  const descriptors = [
    `${draft.age} year old`,
    draft.ethnicity ? draft.ethnicity.toLowerCase() : "",
    draft.identities.join(" ").toLowerCase() || "adult",
  ]
    .filter(Boolean)
    .join(" ");
  return [
    `amateur smartphone selfie photograph of a ${descriptors},`,
    "solo, candid, bright natural daylight from a window, well lit, looking at camera,",
    "shallow depth of field, realistic skin texture, visible pores, unretouched,",
    "vertical portrait framing, head and shoulders, everyday clothing,",
    draft.location ? `${draft.location} apartment interior background,` : "",
    "shot on phone camera, slight motion blur, 2020s",
  ]
    .filter(Boolean)
    .join(" ");
}

const NEGATIVE =
  "child, teenager, minor, underage, school, cartoon, anime, 3d render, illustration, " +
  "painting, drawing, cgi, doll, extra limbs, extra fingers, deformed hands, watermark, " +
  "text, signature, logo, blurry, low quality, jpeg artifacts, multiple people, collage";

/* ── step 1: start a draft (text) ────────────────────────────────────────── */

export async function startSeedJob(
  actorId: string,
  personaRaw: string,
): Promise<{ id: number } | { error: string }> {
  assertActor(actorId);
  const persona = personaRaw.trim().slice(0, 500);
  if (persona.length < 3) return { error: "Describe the persona in a few words." };

  const sql = await getSql();
  const submitted = await hordeSubmit(
    [
      { role: "system", content: systemPrompt() },
      { role: "user", content: `Persona: ${persona}\n\nJSON:` },
    ],
    // 512 is a HARD ceiling, not a preference: above it the Horde refuses the
    // job unless the account already holds the full kudos cost up front
    //   "for requests over 512 tokens, the client needs to already have the
    //    required kudos. This request requires 1180.95 kudos to fulfil."
    // At 512 or below the cost is deferred and a low-balance account still gets
    // served. 512 tokens is comfortably enough for the structural fields plus a
    // 6-9 sentence bio, which is why the bio is the LAST key in the object.
    { maxLength: 512 },
  );
  if ("error" in submitted) return { error: submitted.error };

  const rows = await sql.query<Row>(
    `insert into seed_jobs (persona, text_horde_id, status, created_by)
     values ($1, $2, 'drafting', $3) returning id`,
    [persona, submitted.hordeId, actorId],
  );
  return { id: Number(rows[0]!.id) };
}

/* ── step 2: poll — advance text → image → awaiting_review ───────────────── */

/**
 * Called repeatedly by the UI. Each call advances the job as far as it can:
 * text done → parse → queue image; image done → awaiting_review.
 */
export async function pollSeedJob(
  actorId: string,
  jobId: number,
): Promise<SeedJob | { error: string }> {
  assertActor(actorId);
  const sql = await getSql();
  const rows = await sql.query<Row>(`select * from seed_jobs where id = $1`, [jobId]);
  const row = rows[0];
  if (!row) return { error: "No such job." };

  const status = String(row.status);

  if (status === "drafting" && row.text_horde_id && !row.image_horde_id) {
    const t = await hordeCheck(String(row.text_horde_id));
    if ("failed" in t) {
      await sql.query(
        `update seed_jobs set status='failed', error=$2, updated_at=now() where id=$1`,
        [jobId, t.error.slice(0, 400)],
      );
    } else if ("done" in t && t.done) {
      const draft = parseDraft(t.text, String(row.persona));
      if (!draft) {
        await sql.query(
          `update seed_jobs set status='failed', error='model did not return usable JSON', updated_at=now() where id=$1`,
          [jobId],
        );
      } else {
        await queueImage(jobId, String(row.persona), draft, t.model);
      }
    } else {
      progress.set(jobId, {
        queuePosition: t.queuePosition,
        waitTime: 0,
        stage: "text",
      });
    }
  }

  if (status !== "approved" && status !== "discarded" && row.image_horde_id && !row.image_url) {
    const i = await hordeCheckImage(String(row.image_horde_id));
    if ("failed" in i) {
      // A censored image is recoverable: keep the draft, let the admin retry.
      await sql.query(
        `update seed_jobs set status='failed', error=$2, updated_at=now() where id=$1`,
        [jobId, i.error.slice(0, 400)],
      );
    } else if ("done" in i && i.done) {
      progress.delete(jobId);
      const stored = await persistHordeImage(i.url);
      if ("error" in stored) {
        await sql.query(
          `update seed_jobs set status='failed', error=$2, image_censored=$3, updated_at=now() where id=$1`,
          [jobId, stored.error.slice(0, 400), Boolean(stored.censored)],
        );
      } else {
        await sql.query(
          `update seed_jobs set image_url=$2, image_model=$3, status='awaiting_review',
           error=null, image_censored=false, updated_at=now() where id=$1`,
          [jobId, stored.url, i.model],
        );
      }
    } else {
      progress.set(jobId, {
        queuePosition: i.queuePosition,
        waitTime: i.waitTime,
        stage: "image",
      });
    }
  }

  const fresh = await sql.query<Row>(`select * from seed_jobs where id = $1`, [jobId]);
  return toJob(fresh[0]!);
}

/**
 * Download the render and store it on OUR side, immediately.
 *
 * Two reasons this is not optional.
 *
 *  1. **The Horde's R2 URL is presigned and expires in 30 minutes**
 *     (`X-Amz-Expires=1800`). Writing it onto a profile would produce a card
 *     that renders for half an hour and then 403s forever. Measured, not
 *     assumed — it is right there in the query string.
 *  2. It is a third-party host, so it fails `isAllowedPhotoUrl` (the
 *     tracking-pixel allowlist) and would be rejected on any later profile save.
 *
 * Blank-frame detection rides along here. A volunteer worker that declines a
 * prompt returns a solid black frame WITHOUT setting `censored`, and a solid
 * 512×768 WebP compresses to about 1.1 KB where a real photo is 30–120 KB. A
 * byte-size floor catches it with no image decoder in the loop.
 */
const BLANK_IMAGE_BYTES = 6_000;

async function persistHordeImage(
  url: string,
): Promise<{ url: string } | { error: string; censored?: boolean }> {
  let bytes: Uint8Array;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { error: `could not download the render (${res.status})` };
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    return { error: err instanceof Error ? err.message : "could not download the render" };
  }
  if (bytes.byteLength < BLANK_IMAGE_BYTES) {
    return {
      error: "the worker returned a blank frame (it censored the prompt) — re-roll the photo",
      censored: true,
    };
  }
  try {
    return { url: await storePhotoObject({ userId: "seed", bytes }) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "could not store the render" };
  }
}

async function queueImage(
  jobId: number,
  persona: string,
  draft: SeedDraft,
  textModel: string,
): Promise<void> {
  const sql = await getSql();
  const prompt = imagePromptFor(persona, draft);
  const img = await hordeSubmitImage(prompt, {
    negativePrompt: NEGATIVE,
    // 512×768 at 22 steps: a 2:3 portrait that fills a profile card, measured at
    // 7 kudos and a short queue. Bigger renders cost several times that and, on
    // a low-balance account, sit behind everything else on the network.
    width: 512,
    height: 768,
    steps: 22,
  });
  if ("error" in img) {
    await sql.query(
      `update seed_jobs set draft=$2, text_model=$3, image_prompt=$4, status='failed',
       error=$5, updated_at=now() where id=$1`,
      [jobId, JSON.stringify(draft), textModel, prompt, img.error.slice(0, 400)],
    );
    return;
  }
  await sql.query(
    `update seed_jobs set draft=$2, text_model=$3, image_horde_id=$4,
     image_prompt=$5, error=null, updated_at=now() where id=$1`,
    [jobId, JSON.stringify(draft), textModel, img.hordeId, prompt],
  );
}

/** Re-queue just the photo for a draft whose image failed or was censored. */
export async function retrySeedImage(
  actorId: string,
  jobId: number,
): Promise<{ ok: true } | { error: string }> {
  assertActor(actorId);
  const sql = await getSql();
  const rows = await sql.query<Row>(`select * from seed_jobs where id = $1`, [jobId]);
  const row = rows[0];
  if (!row) return { error: "No such job." };
  const draft = ((row.draft_edited as SeedDraft | null) ?? (row.draft as SeedDraft | null)) ?? null;
  if (!draft) return { error: "There is no draft to illustrate yet." };
  await sql.query(
    `update seed_jobs set image_url=null, image_horde_id=null, status='drafting',
     error=null, updated_at=now() where id=$1`,
    [jobId],
  );
  await queueImage(jobId, String(row.persona), draft, String(row.text_model ?? "horde"));
  return { ok: true };
}

/* ── parsing / coercion ──────────────────────────────────────────────────── */

/**
 * Extract the JSON object from a model reply.
 *
 * Small models pad output with preamble despite instructions, and a long bio
 * plus a hard token limit means the object is sometimes cut off mid-string. So:
 * scan for the outermost braces, and if that will not parse, close the string
 * and the object and try once more. Recovering a truncated bio is far better
 * than throwing away a generation that cost real queue time.
 */
export function parseDraft(text: string, persona: string): SeedDraft | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const candidates = [text.slice(start, text.lastIndexOf("}") + 1), repairJson(text.slice(start))];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return coerceDraft(JSON.parse(candidate) as Record<string, unknown>, persona);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/** Close an unterminated string / array / object so a truncated reply parses. */
function repairJson(raw: string): string | null {
  let out = "";
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  for (const ch of raw) {
    out += ch;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    if (ch === "}" || ch === "]") stack.pop();
  }
  if (!stack.length && !inString) return null;
  if (inString) out += '"';
  // Drop a dangling `"key":` with no value before closing.
  out = out.replace(/,\s*"[^"]*"\s*:\s*$/, "").replace(/,\s*$/, "");
  while (stack.length) out += stack.pop() === "{" ? "}" : "]";
  return out;
}

function pickFrom(v: unknown, allowed: readonly string[], max: number): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const byLower = new Map(allowed.map((a) => [a.toLowerCase(), a]));
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const hit = byLower.get(raw.trim().toLowerCase());
    if (hit && !out.includes(hit)) out.push(hit);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Turn whatever the model said into a valid, coherent draft.
 *
 * This is the layer that makes the tool reliable. Anything the model got wrong,
 * omitted, or invented is replaced by a rule derived from the persona text.
 */
export function coerceDraft(raw: Record<string, unknown>, persona: string): SeedDraft {
  const str = (v: unknown, max: number) =>
    (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, max);

  const hay = `${persona} ${str(raw.bio, 2000)} ${(Array.isArray(raw.identities) ? raw.identities : []).join(" ")}`;

  let identities = pickFrom(raw.identities, IDENTITIES, 3);
  if (!identities.length) {
    const hinted = firstHint(hay, IDENTITY_HINTS);
    identities = hinted ? [hinted] : ["Questioning"];
  } else {
    // The persona wins on the primary identity — the operator typed it.
    const hinted = firstHint(persona, IDENTITY_HINTS);
    if (hinted && !identities.includes(hinted)) identities = [hinted, ...identities].slice(0, 3);
  }

  const role = inferRole(identities, persona, str(raw.role, 20));

  const pronouns = pickFrom(raw.pronouns, PRONOUNS, 2);
  const ethnicity =
    pickFrom(raw.ethnicity, ETHNICITIES, 1)[0] ??
    firstHint(hay, ETHNICITY_HINTS) ??
    (identities.includes("Bull") ? "Black" : "White");

  const lookingFor = pickFrom(raw.lookingFor, LOOKING_FOR, 4);
  const interests = pickFrom(raw.interests, INTERESTS, 6);

  const ageRaw = Number(raw.age);
  const age = Number.isFinite(ageRaw) ? Math.min(65, Math.max(18, Math.round(ageRaw))) : 30;

  const heightRaw = Number(raw.heightCm);
  const heightCm =
    Number.isFinite(heightRaw) && heightRaw >= 130 && heightRaw <= 225
      ? Math.round(heightRaw)
      // Models routinely write the height into the bio prose and leave the
      // field null, so scan both.
      : inferHeight(persona) ?? inferHeight(str(raw.bio, 2000));

  const displayName = str(raw.displayName, 40) || "Member";
  const handle =
    str(raw.handle, 40)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 24) ||
    `${displayName.toLowerCase().replace(/[^a-z0-9]/g, "")}${Math.floor(Math.random() * 900 + 100)}`.slice(
      0,
      24,
    );

  return {
    handle,
    displayName,
    age,
    identities,
    pronouns: pronouns.length ? pronouns : inferPronouns(identities),
    role,
    ethnicity,
    lookingFor: lookingFor.length ? lookingFor : inferLookingFor(role, identities),
    interests: interests.length >= 2 ? interests : inferInterests(role, identities),
    location: str(raw.location, 60) || "Los Angeles, CA",
    heightCm,
    // 1800 chars: enough for a genuinely long bio, short of anything that would
    // blow out a profile card.
    bio: str(raw.bio, 1800),
  };
}

/* ── step 2b: operator edits the draft ───────────────────────────────────── */

export async function updateSeedDraft(
  actorId: string,
  jobId: number,
  patch: Record<string, unknown>,
): Promise<SeedJob | { error: string }> {
  assertActor(actorId);
  const sql = await getSql();
  const rows = await sql.query<Row>(`select * from seed_jobs where id = $1`, [jobId]);
  const row = rows[0];
  if (!row) return { error: "No such job." };
  if (String(row.status) === "approved") return { error: "Already approved." };

  const current =
    ((row.draft_edited as SeedDraft | null) ?? (row.draft as SeedDraft | null)) ?? null;
  if (!current) return { error: "There is no draft to edit yet." };

  // Coerce the merged object through the same validator the model output goes
  // through, so a hand edit cannot introduce an unrenderable field either.
  const merged = coerceDraft(
    { ...(current as unknown as Record<string, unknown>), ...patch },
    String(row.persona),
  );
  // …except the role and identities, which the operator is explicitly allowed
  // to override; inference exists to fix the model, not to overrule a human.
  if (typeof patch.role === "string" && (ROLES as readonly string[]).includes(patch.role)) {
    merged.role = patch.role;
  }
  if (Array.isArray(patch.identities)) {
    const chosen = pickFrom(patch.identities, IDENTITIES, 3);
    if (chosen.length) merged.identities = chosen;
  }

  await sql.query(`update seed_jobs set draft_edited=$2, updated_at=now() where id=$1`, [
    jobId,
    JSON.stringify(merged),
  ]);
  const fresh = await sql.query<Row>(`select * from seed_jobs where id = $1`, [jobId]);
  return toJob(fresh[0]!);
}

/* ── step 3: approve → create the real profile ───────────────────────────── */

export async function approveSeedJob(
  actorId: string,
  jobId: number,
): Promise<{ userId: string; handle: string } | { error: string }> {
  assertActor(actorId);
  const sql = await getSql();
  const rows = await sql.query<Row>(`select * from seed_jobs where id = $1`, [jobId]);
  const row = rows[0];
  if (!row) return { error: "No such job." };
  if (String(row.status) === "approved") return { error: "Already approved." };
  if (!row.image_url) return { error: "This draft has no photo yet." };

  const edited = (row.draft_edited as SeedDraft | null) ?? null;
  const draft = edited ?? (row.draft as SeedDraft | null);
  if (!draft) return { error: "This draft is not ready yet." };

  const handle = await uniqueHandle(draft.handle);
  const userId = `seed-${randomUUID()}`;
  const provenance = {
    generator: "ai-horde",
    textModel: row.text_model ?? null,
    imageModel: row.image_model ?? null,
    persona: String(row.persona),
    imagePrompt: row.image_prompt ?? null,
    seedJobId: jobId,
    humanEdited: Boolean(edited),
    approvedBy: actorId,
    approvedAt: new Date().toISOString(),
  };

  // A synthetic auth row keeps every existing foreign key and query happy —
  // the profile is indistinguishable from a real one everywhere except the
  // is_ai flag, which is exactly the point.
  await sql.query(
    `insert into "user" ("id","name","email","emailVerified","image","createdAt","updatedAt")
     values ($1,$2,$3,false,null,now(),now())
     on conflict ("id") do nothing`,
    [userId, draft.displayName, `${userId}@seed.invalid`],
  );

  const coord = coordForLocation(draft.location);
  const birthDate = new Date(Date.now() - draft.age * 365.25 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  // Column-for-column the same shape `saveProfile` writes, including the legacy
  // singular mirrors (`identity`, `pronouns`, `looking_for`) that older rows and
  // the discover fallbacks still read.
  await sql.query(
    `insert into profiles (
       user_id, handle, display_name, age, identity, pronouns, bio, location, ethnicity,
       looking_for, looking_for_list, photos, interests, height_cm, onboarded, last_active,
       identities, pronoun_list, hide_age, discreet, lat, lng, role,
       birth_date, age_attested_at, photo_blurs, is_ai, ai_seed, suspended
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,true,now(),
       $15::jsonb,$16::jsonb,false,false,$17,$18,$19,
       $20::date,now(),'[]'::jsonb,true,$21::jsonb,false
     )
     on conflict (user_id) do update set
       handle = excluded.handle,
       display_name = excluded.display_name,
       age = excluded.age,
       identity = excluded.identity,
       pronouns = excluded.pronouns,
       bio = excluded.bio,
       location = excluded.location,
       ethnicity = excluded.ethnicity,
       looking_for = excluded.looking_for,
       looking_for_list = excluded.looking_for_list,
       photos = excluded.photos,
       interests = excluded.interests,
       height_cm = excluded.height_cm,
       identities = excluded.identities,
       pronoun_list = excluded.pronoun_list,
       lat = excluded.lat,
       lng = excluded.lng,
       role = excluded.role,
       is_ai = true,
       ai_seed = excluded.ai_seed,
       onboarded = true,
       last_active = now()`,
    [
      userId,
      handle,
      draft.displayName,
      draft.age,
      draft.identities[0] ?? null,
      draft.pronouns[0] ?? null,
      draft.bio,
      draft.location,
      draft.ethnicity || null,
      draft.lookingFor[0] ?? null,
      JSON.stringify(draft.lookingFor),
      JSON.stringify([String(row.image_url)]),
      JSON.stringify(draft.interests),
      draft.heightCm,
      JSON.stringify(draft.identities),
      JSON.stringify(draft.pronouns),
      coord?.lat ?? null,
      coord?.lng ?? null,
      draft.role || null,
      birthDate,
      JSON.stringify(provenance),
    ],
  );

  await sql.query(
    `update seed_jobs set status='approved', created_user_id=$2, updated_at=now() where id=$1`,
    [jobId, userId],
  );
  await accountEvent(actorId, "seed_create", { jobId, userId, handle, humanEdited: !!edited });

  return { userId, handle };
}

/** `profiles.handle` is unique; a model will happily reuse "blackking". */
async function uniqueHandle(base: string): Promise<string> {
  const sql = await getSql();
  const root = (base || "member").slice(0, 20);
  for (let i = 0; i < 25; i++) {
    const candidate = i === 0 ? root : `${root}${Math.floor(Math.random() * 9000 + 1000)}`.slice(0, 24);
    const taken = await sql.query(`select 1 from profiles where handle = $1`, [candidate]);
    if (!taken.length) return candidate;
  }
  return `member${Date.now().toString(36)}`.slice(0, 24);
}

/* ── listing / suspension / deletion ─────────────────────────────────────── */

export async function listSeedJobs(actorId: string, limit = 30): Promise<SeedJob[]> {
  assertActor(actorId);
  const sql = await getSql();
  const rows = await sql.query<Row>(
    `select * from seed_jobs where status <> 'discarded' order by id desc limit $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map(toJob);
}

export async function discardSeedJob(actorId: string, jobId: number): Promise<{ ok: true }> {
  assertActor(actorId);
  const sql = await getSql();
  await sql.query(`update seed_jobs set status='discarded', updated_at=now() where id=$1`, [jobId]);
  return { ok: true };
}

export type AdminProfileRow = {
  userId: string;
  handle: string;
  displayName: string;
  age: number | null;
  location: string | null;
  role: string | null;
  identities: string[];
  isAi: boolean;
  isSeed: boolean;
  suspended: boolean;
  photo: string | null;
  bio: string;
  createdAt: string | null;
};

export async function listProfiles(actorId: string, limit = 200): Promise<AdminProfileRow[]> {
  assertActor(actorId);
  const sql = await getSql();
  const rows = await sql.query<Row>(
    `select user_id, handle, display_name, age, location, role, identities, is_ai, is_seed,
            suspended, photos, bio, created_at
     from profiles
     order by is_ai desc, created_at desc nulls last
     limit $1`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((r) => {
    const photos = parseList(r.photos);
    return {
      userId: String(r.user_id),
      handle: String(r.handle ?? ""),
      displayName: String(r.display_name ?? ""),
      age: r.age == null ? null : Number(r.age),
      location: r.location ? String(r.location) : null,
      role: r.role ? String(r.role) : null,
      identities: parseList(r.identities),
      isAi: truthy(r.is_ai),
      isSeed: truthy(r.is_seed),
      suspended: truthy(r.suspended),
      photo: photos[0] ?? null,
      bio: String(r.bio ?? ""),
      createdAt: r.created_at ? String(r.created_at) : null,
    };
  });
}

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === "t" || v === "true";
}

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Take a profile out of circulation without destroying it.
 *
 * The reversible half of moderation. Suspension is enforced in SQL on every
 * read path (see `profiles.ts`), so a suspended member disappears from decks,
 * grids, search and the public landing strip immediately.
 */
export async function setProfileSuspended(
  actorId: string,
  userId: string,
  suspended: boolean,
): Promise<{ ok: true }> {
  assertActor(actorId);
  const sql = await getSql();
  await sql.query(
    `update profiles
     set suspended = $2,
         suspended_at = case when $2 then now() else null end,
         suspended_by = case when $2 then $3 else null end
     where user_id = $1`,
    [userId, suspended, actorId],
  );
  await accountEvent(actorId, suspended ? "suspend" : "unsuspend", { targetUserId: userId });
  return { ok: true };
}

/** Delete one profile outright, seed or real. */
export async function deleteProfile(actorId: string, userId: string): Promise<{ ok: true }> {
  assertActor(actorId);
  const sql = await getSql();
  await sql.query(
    `delete from messages where conversation_id in
       (select id from conversations where user_a = $1 or user_b = $1)`,
    [userId],
  );
  await sql.query(`delete from conversations where user_a = $1 or user_b = $1`, [userId]);
  for (const [table, a, b] of [
    ["likes", "from_user_id", "to_user_id"],
    ["follows", "follower_id", "following_id"],
    ["swipes", "user_id", "target_id"],
    ["blocks", "blocker_id", "blocked_id"],
    ["reports", "reporter_id", "reported_id"],
  ] as const) {
    await sql.query(`delete from ${table} where ${a} = $1 or ${b} = $1`, [userId]);
  }
  await sql.query(`delete from post_likes where user_id = $1`, [userId]);
  await sql.query(
    `delete from post_likes where post_id in (select id from posts where user_id = $1)`,
    [userId],
  );
  await sql.query(`delete from posts where user_id = $1`, [userId]);
  await sql.query(`delete from bot_jobs where seed_user_id = $1`, [userId]).catch(() => {});
  await sql.query(`delete from profiles where user_id = $1`, [userId]);
  await sql.query(`delete from session where "userId" = $1`, [userId]).catch(() => {});
  await sql.query(`delete from account where "userId" = $1`, [userId]).catch(() => {});
  await sql.query(`delete from "user" where id = $1`, [userId]).catch(() => {});
  await accountEvent(actorId, "delete", { purgedUserId: userId });
  return { ok: true };
}

/**
 * Remove every generated profile in one statement.
 *
 * This is the exit ramp: run it before production and the synthetic cohort is
 * gone, provenance rows and all.
 */
export async function purgeAiProfiles(actorId: string): Promise<{ removed: number }> {
  assertActor(actorId);
  const sql = await getSql();
  const rows = await sql.query<{ user_id: string }>(`select user_id from profiles where is_ai`);
  for (const r of rows) await deleteProfile(actorId, String(r.user_id));
  await sql.query(`delete from seed_jobs where status <> 'drafting'`).catch(() => {});
  await accountEvent(actorId, "seed_purge", { removed: rows.length });
  return { removed: rows.length };
}
