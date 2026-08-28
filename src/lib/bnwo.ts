export const KNEELERS = ["whiteboi", "sissy", "faggot", "fag", "crossdresser", "femboy"] as const;
export const CUCKS = ["cuck"] as const;
export const KINGS = ["bull"] as const;
export const WIVES = ["hotwife"] as const;

export type RoleVerdict = {
  ok: boolean;
  forced: string;
  allowed: string[];
  line: string | null;
};

function hasAny(identities: string[], list: readonly string[]) {
  const set = new Set(identities.map((s) => s.trim().toLowerCase()));
  return list.some((item) => set.has(item));
}

export function isKneeler(identities: string[]) {
  return hasAny(identities, KNEELERS);
}

export function isCuck(identities: string[]) {
  return hasAny(identities, CUCKS);
}

export function isKing(identities: string[]) {
  return hasAny(identities, KINGS);
}

export function isWife(identities: string[]) {
  return hasAny(identities, WIVES);
}

export function allowedRolesFor(identities: string[]): string[] {
  if (isKneeler(identities)) return ["Bottom"];
  if (isCuck(identities)) return ["Bottom", "Side"];
  if (isKing(identities)) return ["Top"];
  if (isWife(identities)) return ["Bottom", "Switch"];
  return ["Top", "Bottom", "Switch", "Side"];
}

const DENIAL: Record<string, (wanted: string) => string> = {
  kneeler: (wanted) =>
    wanted === "Top"
      ? "No, whiteboi. Tops are Black. You checked the collar — Bottom is the only honest answer. Wipe that off and kneel."
      : wanted === "Switch"
        ? "Switch? Cute. You don't get to flip into a man on weekends. Sissies and whitebois take it. Bottom. Stay there."
        : "Side is for men who won't admit they want it. You already did. Bottom only. Good girls don't negotiate the hole.",
  cuck: (wanted) =>
    wanted === "Top"
      ? "A cuck does not top. She takes Black. You hold the phone and the tissues. Bottom or Side. Pick one and stay soft."
      : "Switch would imply you still get a turn. You don't. She gets the king. You get cleanup. Bottom or Side.",
  king: (wanted) =>
    `Bulls don't ${wanted.toLowerCase()}. You walk in first. Top is the role. If you wanted to kneel you would have checked whiteboi.`,
  wife: (wanted) =>
    wanted === "Top"
      ? "Hotwives don't top the king, darling. You take Black. Bottom or Switch — Switch if you still play with the husband."
      : "Side is a polite way to sit out the breeding. You didn't join a waiting room. Bottom or Switch.",
};

export function judgeRole(identities: string[], role: string): RoleVerdict {
  const allowed = allowedRolesFor(identities);
  const current = role.trim() || allowed[0]!;
  if (allowed.includes(current)) {
    return { ok: true, forced: current, allowed, line: decreeFor(identities) };
  }
  const forced = allowed[0]!;
  let line: string;
  if (isKneeler(identities)) line = DENIAL.kneeler!(current);
  else if (isCuck(identities)) line = DENIAL.cuck!(current);
  else if (isKing(identities)) line = DENIAL.king!(current);
  else if (isWife(identities)) line = DENIAL.wife!(current);
  else line = `The order only allows ${allowed.join(" / ")} for what you checked.`;
  return { ok: false, forced, allowed, line };
}

export function decreeFor(identities: string[]): string | null {
  if (isKneeler(identities)) {
    return "Whitebois, sissies, faggots, CDs, femboys: Bottom only. BBC is the top. You are the hole.";
  }
  if (isCuck(identities)) {
    return "Cucks don't fuck. She takes Black. You watch, you lock, you clean. Bottom or Side.";
  }
  if (isKing(identities)) {
    return "Bulls walk in first. Top is not a preference here — it is the seat.";
  }
  if (isWife(identities)) {
    return "QOS on the finger. Bottom or Switch. The husband is furniture.";
  }
  return null;
}

export const LOOKING_BNWO = [
  "BBC",
  "Bulls",
  "To serve",
  "To be bred",
  "Cuckold",
  "Cleanup",
  "Chastity",
  "Hotwife nights",
] as const;

export const INTERESTS_BNWO = [
  "Cleanup",
  "Chastity",
  "SPH",
  "Hypno",
  "BBC Hypno",
  "Locked",
  "Sissy training",
  "Cuckoldress",
  "Interracial breeding",
  "Kneeling",
] as const;

export const BIO_PLACEHOLDER =
  "Say the quiet part: BBC, chastity, cleanup, breeding, who kneels, who watches, who cums in her.";

export const EMPTY = {
  discover: {
    nearby: "Nobody in range yet. Widen it. Kings don't hide in a five-mile cage.",
    kings: "No bulls in this radius. The Set will show. Keep the hole ready.",
    sissies: "No sissies on their knees nearby. Post a look in the Room so a king can find you.",
    whitebois: "No whitebois listed. If that's you, check Bottom and stop pretending.",
    trans: "No T-girls or trans women in range. The kings are still looking.",
    crossdressers: "No CDs nearby. Skirt on. Location on. Be seen.",
    femboys: "No femboys in range. Soft boys still have to show up.",
    women: "No wives in range. QOS girls don't stay indoor forever.",
    couples: "No cucks or couples nearby. He can drive. She can take it.",
    groups: "No groups in range. Packs move. Widen the radius.",
  },
  likesMatch: "No matches yet. Like a king who already wants the hole.",
  likesIn: "Nobody claimed you yet. Better photos. Clearer kneeling.",
  likesOut: "You haven't liked anyone. Point at a bull or a wife and mean it.",
  inbox: "No threads. Open a king and confess. Cleanup talk counts.",
  thread: "On your knees in the DMs. Beg, offer cleanup, say the cage size.",
  feed: "The Room is quiet. Post the look. Whitebois belong on display.",
};

export function discoverEmpty(tab: string) {
  return EMPTY.discover[tab as keyof typeof EMPTY.discover] ?? EMPTY.discover.nearby;
}

export function badgeFor(profile: { identities?: string[]; interests?: string[] }): string | null {
  const ids = (profile.identities ?? []).map((s) => s.toLowerCase());
  const ints = (profile.interests ?? []).map((s) => s.toLowerCase());
  if (ids.includes("bull")) return "KING";
  if (ids.includes("hotwife") || ints.includes("qos")) return "QOS";
  if (ids.includes("cuck") || ids.includes("couple")) return "CUCK";
  if (ids.includes("sissy")) return "SISSY";
  if (ids.includes("faggot") || ids.includes("fag")) return "FAG";
  if (ids.includes("whiteboi")) return "WHITEBOI";
  if (ints.includes("bnwo") || ints.includes("bbc")) return "BNWO";
  return null;
}
