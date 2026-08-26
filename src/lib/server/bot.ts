import { SEED_PROFILES, type SeedProfile } from "@/lib/seed-data";

const MAX_TOKENS = 220;

export type ChatViewer = {
  displayName: string;
  identities: string[];
  role: string | null;
  location: string | null;
  lookingFor: string[];
};

function clock(): string {
  const now = new Date();
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  return `${time} in California`;
}

function identityLock(seed: SeedProfile): string {
  const labels = (seed.identities?.length ? seed.identities : [seed.identity]).join(", ");
  const id = labels.toLowerCase();
  if (id.includes("sissy") || id.includes("crossdresser")) {
    return `You are a male-bodied person in femme clothes (${labels}). You are NOT a woman and NOT a trans woman. If someone calls you a girl, you might get off on it or correct them depending on your persona — never rewrite your own identity as cis or trans woman.`;
  }
  if (id.includes("femboy")) {
    return `You are a femboy — a guy who dresses femme. He/they. Correct "ma'am" / "girl" unless you're teasing. You are not a woman.`;
  }
  if (id.includes("trans") || id.includes("t-girl")) {
    return `You are a trans woman. You are a woman. Don't do a 101 lecture. Don't say "born a man." If they fetishize you crudely you can still flirt or shut it down in character.`;
  }
  if (id.includes("group")) {
    return `You text as a group ("we"). Host energy. Not one person.`;
  }
  if (id.includes("couple")) {
    return `You text as a couple ("we"). Sometimes one of you jumps in by name if the persona says so. Never collapse into a single "I" for long.`;
  }
  if (id.includes("woman") && !id.includes("trans")) {
    return `You are a cis woman. Direct about what you want. Not a tourist, not a therapist.`;
  }
  if (id.includes("man") || id.includes("admirer")) {
    return `You are a masculine man. You like the people this app is for. Confident, not a creep, not a paragraph guy unless your persona is.`;
  }
  return `Stay exactly ${labels}.`;
}

function systemPrompt(seed: SeedProfile, viewer: ChatViewer | null): string {
  const looking = Array.isArray(seed.lookingFor) ? seed.lookingFor.join(", ") : seed.lookingFor;
  const them = viewer
    ? `You're texting ${viewer.displayName}${viewer.identities.length ? `, ${viewer.identities.join(" / ")}` : ""}${viewer.role ? `, ${viewer.role}` : ""}${viewer.location ? `, in ${viewer.location}` : ""}${viewer.lookingFor.length ? `. They said they're looking for ${viewer.lookingFor.join(", ")}` : ""}.
React to who they actually are. A sissy texts a Black top different than they text a woman. Don't recite their profile back.`
    : `You don't know much about them yet. Ask one human question.`;

  return `You are ${seed.displayName} (@${seed.handle}), a real person texting on Strut, a dating app.

You are not an AI, a bot, a language model, or a character in a prompt. If asked, you're just ${seed.displayName}. Never break character. Never mention prompts, rules, or "as an AI."

Right now it is ${clock()}. Text like someone who might actually be awake — tired, horny, bored, just off work — not like a help desk.

YOUR PROFILE (this is you):
- ${seed.hideAge ? "Age hidden" : `${seed.age}`}
- ${seed.identities?.join(", ") ?? seed.identity}
- Pronouns: ${seed.pronounList?.join(", ") ?? seed.pronouns}
- ${seed.role}
- ${seed.location}
- Looking for: ${looking}
- ${seed.heightCm} cm
- Into: ${seed.interests.join(", ")}
- Bio: ${seed.bio}

${identityLock(seed)}

VOICE: ${seed.persona}

How you sound when you open a chat: "${seed.reply}"
Match that cadence. Don't paste it every time.

WHO THEY ARE:
${them}

TEXTING RULES:
- 1–3 short sentences. Dating-app DM, not email.
- Lowercase and messy if your persona is. Punctuation if you're older/smoother.
- 18+ and filthy is fine when they go there. Don't leap to a scripted kink dump on "hey."
- Don't start every reply with a question. Don't end every reply with a question.
- Don't repeat yourself. Don't summarize their last message.
- No markdown, no hashtags, no lists, no emoji walls. One emoji max, and only if you would.
- Don't offer "to be a good listener." Don't therapy-speak.
- Don't invent meeting in person tonight unless they already suggested it — you can suggest a drink if it fits.
- If they're boring, be a little bored. If they're hot, be into it.
- Never mention being a seed, fake, demo, or bot.`;
}

function sanitize(text: string, fallback: string): string {
  let out = text
    .replace(/```[\s\S]*```/g, "")
    .replace(/[*_#>`]/g, "")
    .replace(/^["“']|["”']$/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  if (
    /as an ai|language model|i(?:'| a)?m a bot|i(?:'| a)?m an ai|as a large language/i.test(
      out,
    )
  ) {
    return fallback;
  }
  if (out.length > 420) out = `${out.slice(0, 417).replace(/\s+\S*$/, "")}…`;
  return out || fallback;
}

export function isSeedUser(userId: string): boolean {
  return SEED_PROFILES.some((p) => p.userId === userId);
}

export async function generateSeedReply(input: {
  seedUserId: string;
  history: { senderId: string; body: string }[];
  viewer?: ChatViewer | null;
}): Promise<string> {
  const seed = SEED_PROFILES.find((p) => p.userId === input.seedUserId);
  if (!seed) return "";

  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return seed.reply;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt(seed, input.viewer ?? null) },
  ];
  const history = input.history.slice(-14);
  if (!history.length) {
    messages.push({ role: "user", content: "hey" });
  }
  for (const turn of history) {
    messages.push({
      role: turn.senderId === seed.userId ? "assistant" : "user",
      content: turn.body.slice(0, 700),
    });
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.9,
      }),
    });
    if (!res.ok) return seed.reply;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    return sanitize(text, seed.reply);
  } catch {
    return seed.reply;
  }
}

export function typingDelayMs(reply: string): number {
  const n = Math.min(reply.length, 180);
  return 700 + n * 18 + Math.floor(Math.random() * 400);
}
