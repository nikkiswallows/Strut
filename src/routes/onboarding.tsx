import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MultiChips, SingleChips } from "@/components/chips";
import { Decree } from "@/components/decree";
import { Logo } from "@/components/logo";
import { PhotoEditor } from "@/components/photo-editor";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { BIO_PLACEHOLDER, decreeFor, judgeRole } from "@/lib/bnwo";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useMembership } from "@/lib/auth/use-membership";
import { clearOnboardingDraft, readOnboardingDraft, writeOnboardingDraft } from "@/lib/onboarding-draft";
import { queryClient } from "@/lib/query-client";
import { app } from "@/lib/http";
import { fetchMyProfile, postProfile } from "@/lib/profile-api";
import { ETHNICITIES, IDENTITIES, INTERESTS, LOOKING_FOR, PRONOUNS, ROLES } from "@/lib/types";
import { cn, slugifyHandle } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { phase, user, profile } = useMembership();
  const navigate = useNavigate();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMyProfile(),
    enabled: Boolean(user),
  });
  const identityTags = useQuery({
    queryKey: ["tags", "identity"],
    queryFn: () => app<string[]>("tags", { kind: "identity" }),
    enabled: Boolean(user),
  });
  const pronounTags = useQuery({
    queryKey: ["tags", "pronoun"],
    queryFn: () => app<string[]>("tags", { kind: "pronoun" }),
    enabled: Boolean(user),
  });
  const interestTags = useQuery({
    queryKey: ["tags", "interest"],
    queryFn: () => app<string[]>("tags", { kind: "interest" }),
    enabled: Boolean(user),
  });
  const lookingTags = useQuery({
    queryKey: ["tags", "looking"],
    queryFn: () => app<string[]>("tags", { kind: "looking" }),
    enabled: Boolean(user),
  });

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [age, setAge] = useState("24");
  const [hideAge, setHideAge] = useState(false);
  const [discreet, setDiscreet] = useState(false);
  const [location, setLocation] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [identities, setIdentities] = useState<string[]>(["T-Girl"]);
  const [pronouns, setPronouns] = useState<string[]>(["she/her"]);
  const [role, setRole] = useState("Switch");
  const [lookingFor, setLookingFor] = useState<string[]>(["Dates"]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [heightCm, setHeightCm] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || me.isPending) return;
    const draft = readOnboardingDraft();
    const name = me.data?.displayName || profile?.displayName || user?.displayName || draft?.displayName || "";
    if (name) {
      setDisplayName(name);
      setHandle(slugifyHandle(me.data?.handle || draft?.handle || name));
    }
    if (me.data) {
      setAge(me.data.age ? String(me.data.age) : draft?.age || "24");
      setHideAge(me.data.hideAge);
      setDiscreet(me.data.discreet);
      setLocation(me.data.location ?? draft?.location ?? "");
      setEthnicity(me.data.ethnicity ?? draft?.ethnicity ?? "");
      setIdentities(me.data.identities.length ? me.data.identities : draft?.identities?.length ? draft.identities : ["T-Girl"]);
      setPronouns(me.data.pronouns.length ? me.data.pronouns : draft?.pronouns?.length ? draft.pronouns : ["she/her"]);
      setRole(me.data.role ?? draft?.role ?? "Switch");
      setLookingFor(me.data.lookingFor.length ? me.data.lookingFor : draft?.lookingFor?.length ? draft.lookingFor : ["Dates"]);
      setPhotos(me.data.photos.length ? me.data.photos : draft?.photos ?? []);
      setBio(me.data.bio || draft?.bio || "");
      setInterests(me.data.interests.length ? me.data.interests : draft?.interests ?? []);
      setHeightCm(me.data.heightCm ? String(me.data.heightCm) : draft?.heightCm ?? "");
    } else if (draft) {
      setAge(draft.age);
      setHideAge(draft.hideAge);
      setDiscreet(Boolean(draft.discreet));
      setLocation(draft.location);
      setEthnicity(draft.ethnicity ?? "");
      setIdentities(draft.identities.length ? draft.identities : ["T-Girl"]);
      setPronouns(draft.pronouns.length ? draft.pronouns : ["she/her"]);
      setRole(draft.role);
      setLookingFor(draft.lookingFor.length ? draft.lookingFor : ["Dates"]);
      setPhotos(draft.photos);
      setBio(draft.bio);
      setInterests(draft.interests);
      setHeightCm(draft.heightCm);
      setStep(draft.step);
    }
    setHydrated(true);
  }, [hydrated, me.data, me.isPending, user]);

  useEffect(() => {
    if (!hydrated) return;
    writeOnboardingDraft({
      step,
      displayName,
      handle,
      age,
      hideAge,
      discreet,
      location,
      ethnicity,
      identities,
      pronouns,
      role,
      lookingFor,
      photos,
      bio,
      interests,
      heightCm,
    });
  }, [
    hydrated,
    step,
    displayName,
    handle,
    age,
    hideAge,
    discreet,
    location,
    ethnicity,
    identities,
    pronouns,
    role,
    lookingFor,
    photos,
    bio,
    interests,
    heightCm,
  ]);

  const save = useMutation({
    mutationFn: async () => {
      const base = {
        displayName,
        handle: handle.length >= 3 ? handle : slugifyHandle(displayName),
        age: Number(age) || 18,
        hideAge,
        discreet,
        location,
        ethnicity: ethnicity || null,
        identities,
        pronouns,
        role: judgeRole(identities, role).forced,
        lookingFor,
        bio,
        interests,
        heightCm: heightCm ? Number(heightCm) : null,
      };
      return postProfile({ ...base, photos });
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(["me"], saved);
      clearOnboardingDraft();
      toast.success("You're in the order.");
      navigate({ to: "/discover" });
    },
    onError: (err: Error) => {
      writeOnboardingDraft({
        step,
        displayName,
        handle,
        age,
        hideAge,
        discreet,
        location,
        ethnicity,
        identities,
        pronouns,
        role,
        lookingFor,
        photos,
        bio,
        interests,
        heightCm,
      });
      toast.error(err.message || "Could not save your profile.");
    },
  });

  if (phase === "loading") {
    return <div className="min-h-dvh bg-bg" />;
  }
  if (phase === "guest" || !user) return <RedirectToSignIn />;
  if (phase === "member") return <Navigate to="/discover" />;

  const steps = ["You", "Identity", "Looks", "Voice"];

  return (
    <div className="min-h-dvh bg-bg px-5 py-8">
      <div className="mx-auto max-w-lg">
        <Logo markClassName="size-10" />
        <div className="mt-8 flex gap-2">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className="flex-1 transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <span
                className={cn(
                  "block h-1 rounded-full transition-colors duration-200",
                  i <= step ? "bg-accent" : "bg-elevated",
                )}
              />
              <span className="mt-2 block text-[10px] tracking-wide text-subtle uppercase">{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 animate-fade-up" key={step}>
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="font-display text-5xl leading-[0.92]">Name the slut.</h1>
              <Field label="Display name">
                <Input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value);
                    if (!handle || handle === slugifyHandle(displayName)) {
                      setHandle(slugifyHandle(e.target.value));
                    }
                  }}
                  placeholder="Nikki"
                  autoComplete="name"
                />
              </Field>
              <Field label="Handle" hint="Letters, numbers, periods, underscore.">
                <Input
                  value={handle}
                  onChange={(e) => setHandle(slugifyHandle(e.target.value))}
                  placeholder="nikki.s"
                  autoComplete="username"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age">
                  <Input
                    type="number"
                    min={18}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Costa Mesa, CA"
                  />
                </Field>
              </div>
              <Field label="Height (cm)" hint="Optional.">
                <Input
                  type="number"
                  min={120}
                  max={220}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="175"
                  inputMode="numeric"
                />
              </Field>
              <button
                type="button"
                onClick={() => setHideAge((v) => !v)}
                className={cn(
                  "h-11 w-full rounded-lg px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                  hideAge ? "bg-fg text-bg" : "bg-elevated text-muted",
                )}
              >
                {hideAge ? "Age hidden on your profile" : "Do not show my age"}
              </button>
              <button
                type="button"
                onClick={() => setDiscreet((v) => !v)}
                className={cn(
                  "h-11 w-full rounded-lg px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                  discreet ? "bg-fg text-bg" : "bg-elevated text-muted",
                )}
              >
                {discreet
                  ? "Photos blurred until someone taps"
                  : "Blur my photos (discreet)"}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h1 className="font-display text-5xl leading-[0.92]">What are you to the order?</h1>
              <MultiChips
                label="Identity"
                hint="Sissy, whiteboi, king, wife, cuck, T-girl, couple — or type your own. Whiteboi / sissy locks you to Bottom."
                options={identityTags.data ?? [...IDENTITIES]}
                value={identities}
                onChange={(next) => {
                  setIdentities(next);
                  const verdict = judgeRole(next, role);
                  if (verdict.forced !== role) {
                    setRole(verdict.forced);
                    if (verdict.line) toast.message(verdict.line);
                  }
                }}
                kind="identity"
              />
              <MultiChips
                label="Pronouns"
                options={pronounTags.data ?? [...PRONOUNS]}
                value={pronouns}
                onChange={setPronouns}
                kind="pronoun"
                max={6}
              />
              <SingleChips
                label="Ethnicity"
                hint="The order reads this first — kings, wives, sissies all filter on it."
                options={[...ETHNICITIES]}
                value={ethnicity}
                onChange={setEthnicity}
              />
              <SingleChips
                label="Top / bottom / switch"
                options={[...ROLES]}
                value={role}
                allowed={judgeRole(identities, role).allowed}
                onChange={setRole}
                onDenied={(opt) => {
                  const verdict = judgeRole(identities, opt);
                  setRole(verdict.forced);
                  toast.message(verdict.line ?? "That role is not for what you checked.");
                }}
              />
              <Decree>{decreeFor(identities)}</Decree>
              <MultiChips
                label="Looking for"
                hint="BBC, bulls, cleanup, chastity, breeding — say it."
                options={lookingTags.data ?? [...LOOKING_FOR]}
                value={lookingFor}
                onChange={setLookingFor}
                kind="looking"
                max={8}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h1 className="font-display text-5xl leading-[0.92]">Show him.</h1>
              <p className="text-sm text-muted">
                Your photos. Not someone else's. Main look sits large — drag the rest into order.
              </p>
              <PhotoEditor photos={photos} onChange={setPhotos} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h1 className="font-display text-5xl leading-[0.92]">Say it. No guessing.</h1>
              <Field label="Bio">
                <Textarea
                  value={bio}
                  maxLength={500}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={BIO_PLACEHOLDER}
                />
              </Field>
              <MultiChips
                label="Interests"
                hint="BNWO, QOS, BBC, Cuckold, Breeding, Cleanup, Chastity, Hypno…"
                options={interestTags.data ?? [...INTERESTS]}
                value={interests}
                onChange={setInterests}
                kind="interest"
                max={16}
              />
            </div>
          )}
        </div>

        <div className="mt-10 flex gap-3">
          {step > 0 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              className="flex-1"
              onClick={() => {
                if (step === 0 && (displayName.trim().length < 2 || handle.length < 3)) {
                  toast.error("Name and a handle, please.");
                  return;
                }
                if (step === 1 && identities.length === 0) {
                  toast.error("Pick at least one identity.");
                  return;
                }
                if (step === 2 && photos.length === 0) {
                  toast.error("Add at least one photo of you.");
                  return;
                }
                setStep(step + 1);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Enter the order"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
