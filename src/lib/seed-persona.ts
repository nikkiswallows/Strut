/**
 * Persona → profile-field logic, and the tolerant JSON parser that feeds it.
 *
 * Deliberately isomorphic and dependency-free (only `@/lib/types`), for two
 * reasons: it is the part of the seed generator with real logic in it, so it
 * should be unit-testable without a database or a network; and keeping it out
 * of a `.server` module means the admin UI could share these rules later
 * without dragging `pg` into the browser bundle.
 *
 * The governing principle: **the model proposes, these rules decide.** Every
 * function here exists because a language model got something wrong in a way
 * that produced a broken profile card.
 */
import {
  ETHNICITIES,
  IDENTITIES,
  INTERESTS,
  LOOKING_FOR,
  PRONOUNS,
  ROLES,
} from "./types.ts";

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

/** The assistant turn is prefilled with this, so replies start inside the object. */
export const JSON_PREFILL = "{";

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

/**
 * Every hint found in `text`, ordered by WHERE it appears, not by table order.
 *
 * Position matters because personas are written self-first: "white sissy
 * bottom, 27, wants a Black bull to own her". Scanning the table in priority
 * order returned `Bull` — the thing she is looking for — as her identity. The
 * first term in the sentence is the one describing the member.
 */
export function hintsIn(text: string, table: [RegExp, string][]): string[] {
  const hits: { at: number; value: string; rank: number }[] = [];
  table.forEach(([re, value], rank) => {
    const m = re.exec(text);
    if (m) hits.push({ at: m.index, value, rank });
  });
  hits.sort((a, b) => a.at - b.at || a.rank - b.rank);
  const out: string[] = [];
  for (const h of hits) if (!out.includes(h.value)) out.push(h.value);
  return out;
}

export function firstHint(text: string, table: [RegExp, string][]): string | null {
  return hintsIn(text, table)[0] ?? null;
}

/**
 * The part of the persona that describes the MEMBER, cut before the part that
 * describes what they want.
 *
 * "white sissy bottom, 27, San Diego, gym twink, obedient, wants a Black bull
 * to own her" produced a profile with identity `Bull` and role `Bottom` — an
 * incoherent card, and the single worst kind of bug here because it silently
 * files the member into the wrong discover tab. Everything after "wants" /
 * "looking for" / "seeking" / "into" is desire, not identity.
 */
const DESIRE_MARKER =
  /\b(wants?|wanting|looking for|looks for|seeks?|seeking|searching for|needs?|craves?|into|hunting for|hoping for|open to|worships?|serves?|obeys?|collects?|collecting|owns?|breeds?|breeding|dominates?|trains?|uses?|takes?|prefers?|likes?|loves?|enjoys?|here for|only sees?)\b/i;

export function selfSegment(persona: string): string {
  const m = DESIRE_MARKER.exec(persona);
  if (!m || m.index < 4) return persona;
  return persona.slice(0, m.index);
}

/** Explicit role words in the persona always beat identity inference. */
export function explicitRole(text: string): string | null {
  if (/\bswitch(?:es|y)?\b|\bvers\b/i.test(text)) return "Switch";
  if (/\bbottoms?\b|\bsub(?:missive|by)?\b|\bpillow princess\b|\bbreedable\b/i.test(text)) {
    return "Bottom";
  }
  if (/\btops?\b|\bdom(?:inant|me)?\b|\bdaddy\b|\balpha\b/i.test(text)) return "Top";
  if (/\bside\b/i.test(text)) return "Side";
  return null;
}

export function inferRole(identities: string[], persona: string, modelRole: string): string {
  const explicit = explicitRole(persona);
  if (explicit) return explicit;
  // Walk in order: the PRIMARY identity decides. Testing "any identity is a
  // top" first made ["Sissy", "Bull"] a Top.
  for (const identity of identities) {
    if (TOP_IDENTITIES.has(identity)) return "Top";
    if (BOTTOM_IDENTITIES.has(identity)) return "Bottom";
    if (SWITCH_IDENTITIES.has(identity)) return "Switch";
  }
  if ((ROLES as readonly string[]).includes(modelRole)) return modelRole;
  return "Switch";
}

/** Pronouns that match the identity when the model omitted or invented them. */
export function inferPronouns(identities: string[]): string[] {
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
export function inferLookingFor(role: string, identities: string[]): string[] {
  if (role === "Top" || identities.includes("Bull")) return ["Now", "Dates", "To be bred"];
  if (identities.includes("Hotwife")) return ["Bulls", "BBC", "Hotwife nights"];
  if (identities.includes("Cuck")) return ["Cuckold", "Cleanup", "Bulls"];
  return ["BBC", "Bulls", "To serve"];
}

/** Interests that read as on-theme rather than as an empty profile. */
export function inferInterests(role: string, identities: string[]): string[] {
  if (identities.includes("Bull") || role === "Top") {
    return ["BNWO", "Fitness", "Interracial", "Breeding", "Nights out"];
  }
  if (identities.includes("Hotwife")) return ["QOS", "BBC", "Hotwife", "Lingerie", "Nights out"];
  if (identities.includes("Cuck")) return ["Cuckold", "Cleanup", "BNWO", "Interracial"];
  return ["BNWO", "Feminization", "Lingerie", "Chastity", "Heels"];
}

/** "janine" -> "Janine". Models return lowercase display names surprisingly often. */
export function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

const HEIGHT_RE = /\b(\d)\s*(?:'|ft|feet)\s*(\d{1,2})?\b|\b(1[4-9]\d|2[0-2]\d)\s*cm\b/i;

export function inferHeight(text: string): number | null {
  const m = HEIGHT_RE.exec(text);
  if (!m) return null;
  if (m[3]) return Number(m[3]);
  const feet = Number(m[1]);
  const inches = Number(m[2] ?? 0);
  const cm = Math.round((feet * 12 + inches) * 2.54);
  return cm >= 130 && cm <= 225 ? cm : null;
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
/**
 * Remove a reasoning model's `<think>` monologue.
 *
 * Several of the strongest uncensored models on the Horde are reasoning models.
 * They emit their deliberation first, and with a 512-token ceiling that
 * deliberation IS the whole reply — the JSON never arrives. The prefill above
 * mostly prevents this; this is the belt to that pair of braces, including the
 * common case where the block is left unterminated by truncation.
 */
export function stripThinking(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/gi, " ");
  const open = out.search(/<think>/i);
  if (open >= 0) {
    const brace = out.indexOf("{", open);
    out = brace > open ? out.slice(brace) : out.slice(0, open);
  }
  return out.trim();
}

export function parseDraft(
  raw: string,
  persona: string,
): { draft: SeedDraft; fromProse: boolean } | null {
  const cleaned = stripThinking(raw);
  // The reply continues a prefilled `{`, so put it back when the model did not
  // echo one itself.
  const text = cleaned.includes("{") ? cleaned : `${JSON_PREFILL}${cleaned}`;
  const start = text.indexOf("{");
  if (start >= 0) {
    for (const candidate of jsonCandidates(text.slice(start))) {
      try {
        return {
          draft: coerceDraft(JSON.parse(candidate) as Record<string, unknown>, persona),
          fromProse: false,
        };
      } catch {
        /* try the next candidate */
      }
    }
  }

  // Last resort: the model ignored the format and wrote prose.
  //
  // This used to be a dead job ("model did not return usable JSON"), which is
  // the worst possible outcome — the operator waited out a queue and got
  // nothing back, even though the model produced perfectly usable bio text.
  // Instead: keep the prose as the bio and let the same keyword rules that
  // already correct the model's structured output derive every other field from
  // the persona. The result is a complete, editable draft rather than an error.
  const prose = cleanProse(text);
  if (prose.length < 40) return null;
  return { draft: coerceDraft({ bio: prose }, persona), fromProse: true };
}

/** Strip chat scaffolding and preamble so model prose can serve as a bio. */
export function cleanProse(text: string): string {
  return text
    .replace(/<\|im_(start|end)\|>/g, " ")
    .replace(/^\s*(assistant|system|user)\s*:?/i, "")
    // Only strip a preamble in the first ~200 chars, so the word "here" inside
    // a legitimate bio cannot eat the front of it.
    .replace(/^[^]{0,200}?(?:here(?:'s| is)[^\n]*:|```(?:json)?)/i, "")
    .replace(/```/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
}

/**
 * Candidate JSON strings to try, best-first, for a possibly-truncated reply.
 *
 * The model is told to put `bio` last precisely so that a truncation loses bio
 * text rather than structure — but the cut still lands mid-token, and simply
 * closing the open braces is not enough. A real observed failure:
 *
 *   … "lookingFor": ["Dates","Relationship","Bulls"], "interes
 *
 * Closing that yields `…, "interes"}` — a bare string where a member should be,
 * which is still invalid. So we also emit candidates truncated back to each of
 * the last few top-level commas, which drops the half-written member entirely
 * and recovers everything before it. That turns a dead generation into a
 * complete draft missing at most one field.
 */
export function jsonCandidates(raw: string): string[] {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  const cuts: number[] = [];

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
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
    else if (ch === "}" || ch === "]") stack.pop();
    else if (ch === "," && stack.length === 1) cuts.push(i);
  }

  const out: string[] = [];
  const closers = stack
    .map((c) => (c === "{" ? "}" : "]"))
    .reverse()
    .join("");

  // 1. The complete object, if the reply actually contained one.
  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace > 0) out.push(raw.slice(0, lastBrace + 1));
  // 2. Close whatever is still open.
  if (stack.length || inString) out.push((inString ? `${raw}"` : raw) + closers);
  // 3. Trim back to each of the last few complete top-level members.
  for (const cut of cuts.slice(-6).reverse()) out.push(`${raw.slice(0, cut)}}`);

  return out;
}

export function pickFrom(v: unknown, allowed: readonly string[], max: number): string[] {
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

  // Only the self-describing half of the persona may set identity, role or
  // ethnicity. The rest is what the member is looking for.
  const self = selfSegment(persona);
  const hay = `${self} ${str(raw.bio, 2000)}`;

  // An explicit role word in the persona is the strongest signal there is: the
  // operator typed it, so it outranks both the model and identity inference.
  const explicit = explicitRole(self);
  const coherent = (identity: string) =>
    explicit === "Bottom"
      ? !TOP_IDENTITIES.has(identity)
      : explicit === "Top"
        ? !BOTTOM_IDENTITIES.has(identity)
        : true;

  const personaHints = hintsIn(self, IDENTITY_HINTS).filter(coherent);
  let identities = pickFrom(raw.identities, IDENTITIES, 3).filter(coherent);

  if (personaHints.length) {
    // Persona first, then whatever the model added that does not contradict it.
    identities = [...personaHints, ...identities].slice(0, 3);
  } else if (!identities.length) {
    identities = [firstHint(hay, IDENTITY_HINTS) ?? "Questioning"].filter(coherent);
  }
  if (!identities.length) identities = [explicit === "Top" ? "Man" : "Questioning"];
  identities = [...new Set(identities)].slice(0, 3);

  const role = inferRole(identities, self, str(raw.role, 20));

  // Second coherence pass, now that the role is settled. A Bull who "collects
  // sissies" must not end up tagged Sissy as well: the desire-clause cut above
  // catches most of it, but a phrasing it misses would otherwise put the
  // scarcest cohort on the app into the wrong discover tab.
  //
  // Only ever narrows a multi-identity list — a single identity the operator
  // explicitly chose is never overruled.
  const contradicting =
    role === "Top" ? BOTTOM_IDENTITIES : role === "Bottom" ? TOP_IDENTITIES : null;
  if (contradicting && identities.length > 1) {
    const kept = identities.filter((i) => !contradicting.has(i));
    if (kept.length) identities = kept;
  }

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

  const displayName = titleCase(str(raw.displayName, 40)) || "Member";
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

