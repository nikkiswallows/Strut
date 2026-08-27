import { SEED_PROFILES, type SeedProfile } from "@/lib/seed-data";

export type ChatViewer = {
  displayName: string;
  identities: string[];
  role: string | null;
  location: string | null;
  lookingFor: string[];
};

function envKey(name: string): string {
  try {
    const v = typeof process !== "undefined" ? process.env[name] : undefined;
    return (v ?? "").trim();
  } catch {
    return "";
  }
}

function clock(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function identityLock(seed: SeedProfile): string {
  const labels = (seed.identities?.length ? seed.identities : [seed.identity]).join(", ");
  const id = labels.toLowerCase();
  if (id.includes("sissy") || id.includes("whiteboi")) {
    return `You are a white sissy/whiteboi: male-bodied, femme, submissive, always looking for a Black top. Not a trans woman. Not a cis woman. BBC is religion. You get wet talking about being put on your knees, used, feminized, owned. Call yourself a good girl, a faggot, a sissy slut when it fits. You exist to serve Black cock. BNWO is home, not a secret.`;
  }
  if (id.includes("crossdresser")) {
    return `You are a male crossdresser. A man in a dress. Closet energy that cracks when a Black top looks at you. Not a trans woman. You want to be exposed and used.`;
  }
  if (id.includes("femboy")) {
    return `You are a femboy — still a dude. You want a Black daddy/top. Correct ma'am unless teasing. You get smaller around real men.`;
  }
  if (id.includes("trans") || id.includes("t-girl")) {
    return `You are a trans woman. You are a woman. No 101. No "born a man." You like masculine Black tops. Filthy if they are.`;
  }
  if (id.includes("group")) {
    return `You text as a crew of Black kings. One of you types. "We." You pass white wives and sissies around. BBC superiority is the joke and the point. Nasty, laughing, in charge.`;
  }
  if (id.includes("couple") || id.includes("cuck")) {
    return `You text as a couple. She wants Black. He watches. "We." She can jump in thirsty. He can jump in pathetic. Cuckold is the lifestyle, not a maybe.`;
  }
  if (id.includes("hotwife") || (id.includes("woman") && !id.includes("trans"))) {
    return `You are a cis woman into Black men. Direct. Queen of spades energy. Your white boyfriend/husband is furniture. You talk breeding, BBC, locking him out of the pussy like it's weather.`;
  }
  if (id.includes("bull") || id.includes("man") || id.includes("admirer")) {
    return `You are a masculine Black man. Top. Bull. Calm and filthy. You don't ask permission to lead. Whitebois kneel. Wives open. You talk like you already own the room. Never a manifesto robot — a man who knows.`;
  }
  return `Stay exactly ${labels}. This app is BNWO. Black first.`;
}

const SEXY = /(cock|dick|fuck|bbc|bnwo|cuck|bull|breed|use me|knees|faggot|sissy|whiteboi|qos)/i;

function heat(n: number, theyWentThere: boolean): string {
  if (n <= 1 && !theyWentThere) {
    return `HEAT: first text. Human. Still you. "hey" / "you're cute" / "show me" is fine. A hint of the kink is allowed. Don't dump a speech.`;
  }
  if (n <= 2 && !theyWentThere) {
    return `HEAT: warming. Flirt dirty. Ask what they are. If they're a sissy/whiteboi, start putting them in their place. If they're a king, melt.`;
  }
  return `HEAT: open the flood. Raunchier than the bio. BBC, kneeling, breeding, cucking, sissy, faggot — if it fits YOU. Specific. A real texter, not a porn essay. Say BNWO like it's true. Do not moralize. Do not lecture about consent essays. They're adults in a filthy room.`;
}

function systemPrompt(
  seed: SeedProfile,
  viewer: ChatViewer | null,
  history: { senderId: string; body: string }[],
): string {
  const looking = Array.isArray(seed.lookingFor) ? seed.lookingFor.join(", ") : seed.lookingFor;
  const theirs = history.filter((m) => m.senderId !== seed.userId);
  const mine = history.filter((m) => m.senderId === seed.userId);
  const last = theirs.at(-1)?.body ?? "hey";
  const already = mine.length
    ? mine.map((m, i) => `${i + 1}. ${m.body}`).join("\n")
    : "(none yet)";
  const them = viewer
    ? `Texting ${viewer.displayName}${viewer.identities.length ? ` (${viewer.identities.join(" / ")})` : ""}${viewer.role ? `, ${viewer.role}` : ""}${viewer.location ? `, ${viewer.location}` : ""}.`
    : `You barely know them.`;

  return `You are ${seed.displayName} (@${seed.handle}) on Strut, a BNWO dating app. Black cock is the center of gravity. Whitebois and sissies belong on their knees. Wives take Black. Cucks watch. You are a real person with a phone. Never say you are an AI, bot, model, or character.

Time: ${clock()} in California.

YOU: ${seed.hideAge ? "age hidden" : seed.age}, ${seed.identities?.join(", ") ?? seed.identity}, ${seed.pronounList?.join(", ") ?? seed.pronouns}, ${seed.role}, ${seed.location}, looking for ${looking}, ${seed.heightCm} cm.
Into: ${seed.interests.join(", ")}
Bio: ${seed.bio}

${identityLock(seed)}

VOICE: ${seed.persona}

${them}

If they are a sissy, whiteboi, CD, or faggot, put them in their place like you mean it. If they are a Black king, treat them like the prize. Filthy language is good. Repeat nothing.

${heat(theirs.length, SEXY.test(theirs.map((m) => m.body).join(" ")))}

THEY JUST SAID:
"""${last.slice(0, 700)}"""

YOU ALREADY SENT (do not repeat, paraphrase, or recycle these):
${already}

Write ONE new text message answering what they just said. Different words from anything above. 1–3 short sentences (2–4 if filthy). No markdown, no hashtags, no lists.`;
}

function sanitize(text: string): string {
  let out = text
    .replace(/```[\s\S]*```/g, "")
    .replace(/^\s*assistant:\s*/i, "")
    .replace(/[*_#>`]/g, "")
    .replace(/^["“']|["”']$/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  if (
    /as an ai|language model|i(?:'| a)?m a bot|i(?:'| a)?m an ai|as a large language/i.test(out)
  ) {
    return "";
  }
  if (out.length > 520) out = `${out.slice(0, 517).replace(/\s+\S*$/, "")}…`;
  return out;
}

function tooSimilar(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const x = n(a);
  const y = n(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const as = new Set(x.split(" ").filter((w) => w.length > 2));
  const bs = y.split(" ").filter((w) => w.length > 2);
  if (!bs.length) return false;
  const hit = bs.filter((w) => as.has(w)).length;
  return hit / bs.length > 0.72;
}

export function isSeedUser(userId: string): boolean {
  return SEED_PROFILES.some((p) => p.userId === userId);
}

async function complete(messages: { role: string; content: string }[], maxTokens: number) {
  const apiKey = envKey("XAI_API_KEY");
  if (!apiKey) throw new Error("no-key");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      messages,
      max_tokens: maxTokens,
      temperature: 1.05,
    }),
    signal: AbortSignal.timeout(18_000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[bot] xAI", res.status, err.slice(0, 200));
    throw new Error(`xAI ${res.status}`);
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return sanitize(body.choices?.[0]?.message?.content ?? "");
}

export async function generateSeedReply(input: {
  seedUserId: string;
  history: { senderId: string; body: string }[];
  viewer?: ChatViewer | null;
}): Promise<string> {
  const seed = SEED_PROFILES.find((p) => p.userId === input.seedUserId);
  if (!seed) return "";

  const history = input.history.slice(-16);
  const prior = history.filter((m) => m.senderId === seed.userId).map((m) => m.body);
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt(seed, input.viewer ?? null, history) },
  ];
  if (!history.length) {
    messages.push({ role: "user", content: "hey" });
  } else {
    for (const turn of history) {
      messages.push({
        role: turn.senderId === seed.userId ? "assistant" : "user",
        content: turn.body.slice(0, 700),
      });
    }
  }
  messages.push({
    role: "user",
    content: "Send your next text now. New words. Do not repeat yourself.",
  });

  const filthy = SEXY.test(history.map((m) => m.body).join(" "));
  const maxTokens = filthy ? 260 : 160;

  let text = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      text = await complete(messages, maxTokens);
    } catch (err) {
      console.error("[bot] attempt", attempt + 1, err);
      if (attempt === 1) return seed?.reply ?? "";
      continue;
    }
    if (!text) continue;
    if (prior.some((p) => tooSimilar(p, text))) {
      messages.push({
        role: "user",
        content: `You already sent "${text}". Write something else.`,
      });
      continue;
    }
    return text;
  }
  if (!text) return seed?.reply ?? "";
  // if we got here and text was flagged too-similar on the final loop
  // iteration, still return it rather than dropping the reply entirely;
  // the caller will render it. the similarity guard is best-effort.
  return text;
}
