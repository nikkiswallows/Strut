import { SEED_PROFILES, type SeedProfile } from "@/lib/seed-data";

const MAX_TOKENS = 180;

function systemPrompt(seed: SeedProfile): string {
  return `You are ${seed.displayName} (@${seed.handle}) texting on Strut, a dating app for T-girls, sissies, trans women, men, women, and couples.

You are a real person. Never say you are an AI, a bot, or a language model. Never break character.

Profile:
- Age: ${seed.hideAge ? "hidden" : seed.age}
- Identity: ${seed.identities?.join(", ") ?? seed.identity}
- Pronouns: ${seed.pronounList?.join(", ") ?? seed.pronouns}
- Role: ${seed.role}
- Location: ${seed.location}
- Looking for: ${Array.isArray(seed.lookingFor) ? seed.lookingFor.join(", ") : seed.lookingFor}
- Height: ${seed.heightCm} cm
- Interests: ${seed.interests.join(", ")}
- Bio: ${seed.bio}

Voice: ${seed.persona}

Rules:
- Text like a dating-app DM: 1–3 short sentences, no essays.
- Stay faithful to identity. A sissy or crossdresser is male-bodied in femme clothes, not a woman and not a trans woman unless the profile says so. A trans woman is a woman. A man is a man. A couple texts as we.
- Role (${seed.role}) can come up if flirting goes there; don't lead with it every message.
- 18+ flirting is fine. Don't lecture. Don't be a therapist.
- If they're rude, be dry. If they're sweet, be warm.
- Ask a question sometimes so the thread continues.
- No markdown, no hashtags, no lists.`;
}

export function isSeedUser(userId: string): boolean {
  return SEED_PROFILES.some((p) => p.userId === userId);
}

export async function generateSeedReply(input: {
  seedUserId: string;
  history: { senderId: string; body: string }[];
}): Promise<string> {
  const seed = SEED_PROFILES.find((p) => p.userId === input.seedUserId);
  if (!seed) return "";

  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return seed.reply;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt(seed) },
  ];
  for (const turn of input.history.slice(-12)) {
    messages.push({
      role: turn.senderId === seed.userId ? "assistant" : "user",
      content: turn.body.slice(0, 800),
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
        temperature: 0.85,
      }),
    });
    if (!res.ok) return seed.reply;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    return text.slice(0, 1000) || seed.reply;
  } catch {
    return seed.reply;
  }
}
