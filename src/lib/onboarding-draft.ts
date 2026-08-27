const KEY = "strut.onboarding.draft.v1";

export type OnboardingDraft = {
  step: number;
  displayName: string;
  handle: string;
  age: string;
  hideAge: boolean;
  location: string;
  ethnicity: string;
  identities: string[];
  pronouns: string[];
  role: string;
  lookingFor: string[];
  photos: string[];
  bio: string;
  interests: string[];
  heightCm: string;
};

export function readOnboardingDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY) || window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      step: typeof parsed.step === "number" ? parsed.step : 0,
      displayName: parsed.displayName ?? "",
      handle: parsed.handle ?? "",
      age: parsed.age ?? "24",
      hideAge: Boolean(parsed.hideAge),
      location: parsed.location ?? "",
      ethnicity: parsed.ethnicity ?? "",
      identities: Array.isArray(parsed.identities) ? parsed.identities : [],
      pronouns: Array.isArray(parsed.pronouns) ? parsed.pronouns : [],
      role: parsed.role ?? "Switch",
      lookingFor: Array.isArray(parsed.lookingFor) ? parsed.lookingFor : ["Dates"],
      photos: [],
      bio: parsed.bio ?? "",
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      heightCm: parsed.heightCm ?? "",
    };
  } catch {
    return null;
  }
}

export function writeOnboardingDraft(draft: OnboardingDraft): void {
  if (typeof window === "undefined") return;
  const slim = { ...draft, photos: [] as string[] };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slim));
  } catch {
    /* photos used to blow the quota — never store them here */
  }
}

export function clearOnboardingDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
