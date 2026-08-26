import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MultiChips, SingleChips } from "@/components/chips";
import { Logo } from "@/components/logo";
import { PhotoEditor } from "@/components/photo-editor";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { queryClient } from "@/lib/query-client";
import { listTags } from "@/lib/server/catalog";
import { getMyProfile, saveMyProfile } from "@/lib/server/profiles";
import { ETHNICITIES, IDENTITIES, INTERESTS, LOOKING_FOR, PRONOUNS, ROLES } from "@/lib/types";
import { cn, slugifyHandle } from "@/lib/utils";

function defaultPronouns(ids: string[]): string[] {
  const id = ids[0];
  if (!id) return [];
  if (id === "Bull" || id === "Man" || id === "Cuckold" || id === "Admirer") return ["he/him"];
  if (id === "Femboy") return ["he/they"];
  if (id === "Couple" || id === "Group") return ["they/them"];
  if (id === "Sissy" || id === "Crossdresser") return ["she/they"];
  return ["she/her"];
}

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });
  const identityTags = useQuery({
    queryKey: ["tags", "identity"],
    queryFn: () => listTags({ data: "identity" }),
    enabled: Boolean(user),
  });
  const pronounTags = useQuery({
    queryKey: ["tags", "pronoun"],
    queryFn: () => listTags({ data: "pronoun" }),
    enabled: Boolean(user),
  });
  const interestTags = useQuery({
    queryKey: ["tags", "interest"],
    queryFn: () => listTags({ data: "interest" }),
    enabled: Boolean(user),
  });
  const lookingTags = useQuery({
    queryKey: ["tags", "looking"],
    queryFn: () => listTags({ data: "looking" }),
    enabled: Boolean(user),
  });

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [age, setAge] = useState("24");
  const [hideAge, setHideAge] = useState(false);
  const [location, setLocation] = useState("");
  const [identities, setIdentities] = useState<string[]>([]);
  const [pronouns, setPronouns] = useState<string[]>([]);
  const [role, setRole] = useState("Switch");
  const [ethnicity, setEthnicity] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>(["Dates"]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [heightCm, setHeightCm] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || me.isPending) return;
    const name = me.data?.displayName || user?.displayName || "";
    if (name) {
      setDisplayName(name);
      setHandle(slugifyHandle(me.data?.handle || name));
    }
    if (me.data) {
      setAge(me.data.age ? String(me.data.age) : "24");
      setHideAge(me.data.hideAge);
      setLocation(me.data.location ?? "");
      setIdentities(me.data.identities.length ? me.data.identities : []);
      setPronouns(me.data.pronouns.length ? me.data.pronouns : []);
      setRole(me.data.role ?? "Switch");
      setEthnicity(me.data.ethnicity ?? "");
      setLookingFor(me.data.lookingFor.length ? me.data.lookingFor : ["Dates"]);
      setPhotos(me.data.photos.length ? me.data.photos : []);
      setBio(me.data.bio);
      setInterests(me.data.interests);
      setHeightCm(me.data.heightCm ? String(me.data.heightCm) : "");
    }
    setHydrated(true);
  }, [hydrated, me.data, me.isPending, user]);

  const save = useMutation({
    mutationFn: () =>
      saveMyProfile({
        data: {
          displayName,
          handle: handle.length >= 3 ? handle : slugifyHandle(displayName),
          age: Number(age) || 18,
          hideAge,
          location,
          identities,
          pronouns,
          role,
          ethnicity: ethnicity || null,
          lookingFor,
          photos,
          bio,
          interests,
          heightCm: heightCm ? Number(heightCm) : null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("You're on Strut.");
      navigate({ to: "/discover" });
    },
    onError: (err: Error) => {
      if (err.message === "Unauthorized") {
        toast.error("Session dropped. Sign in again and we'll pick this up.");
        void signOut("/login");
        return;
      }
      toast.error(err.message);
    },
  });

  if (isPending || me.isPending) {
    return <div className="min-h-dvh bg-bg" />;
  }
  if (!user) return <RedirectToSignIn />;
  if (me.data?.onboarded) return <Navigate to="/discover" />;

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
              onClick={() => {
                if (i <= step) setStep(i);
              }}
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
              <h1 className="font-display text-5xl leading-[0.92]">About you</h1>
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
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h1 className="font-display text-5xl leading-[0.92]">Identity</h1>
              <MultiChips
                label="Identity"
                hint="Sissy, T-girl, bull, hotwife, cuck, couple — pick what fits."
                options={identityTags.data ?? [...IDENTITIES]}
                value={identities}
                onChange={(next) => {
                  setIdentities(next);
                  if (pronouns.length === 0 && next[0]) setPronouns(defaultPronouns(next));
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
              <SingleChips label="Top / bottom / switch" options={[...ROLES]} value={role} onChange={setRole} />
              <div>
                <SingleChips
                  label="Ethnicity"
                  options={[...ETHNICITIES]}
                  value={ethnicity}
                  onChange={setEthnicity}
                  allowEmpty
                />
                <p className="mt-2 text-xs text-subtle">Optional. Tap again to clear.</p>
              </div>
              <MultiChips
                label="Looking for"
                hint="Pick as many as you want."
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
              <h1 className="font-display text-5xl leading-[0.92]">Put a face to it.</h1>
              <p className="text-sm text-muted">
                Your photos. Not someone else's. Main look sits large — drag the rest into order.
              </p>
              <PhotoEditor photos={photos} onChange={setPhotos} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h1 className="font-display text-5xl leading-[0.92]">Say it in a line.</h1>
              <Field label="Bio">
                <Textarea
                  value={bio}
                  maxLength={500}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Who you are when the lights go down."
                />
              </Field>
              <MultiChips
                label="Interests"
                hint="Add your own — BNWO, Cuckold, BBC…"
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
                if (step === 0) {
                  const nextHandle = handle.length >= 3 ? handle : slugifyHandle(displayName);
                  if (displayName.trim().length < 2 || nextHandle.length < 3) {
                    toast.error("Name and a handle, please.");
                    return;
                  }
                  if (nextHandle !== handle) setHandle(nextHandle);
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
            <Button
              className="flex-1"
              disabled={save.isPending}
              onClick={() => {
                const nextHandle = handle.length >= 3 ? handle : slugifyHandle(displayName);
                if (displayName.trim().length < 2 || nextHandle.length < 3) {
                  toast.error("Name and a handle, please.");
                  setStep(0);
                  return;
                }
                if (identities.length === 0) {
                  toast.error("Pick at least one identity.");
                  setStep(1);
                  return;
                }
                if (photos.length === 0) {
                  toast.error("Add at least one photo of you.");
                  setStep(2);
                  return;
                }
                if (nextHandle !== handle) setHandle(nextHandle);
                save.mutate();
              }}
            >
              {save.isPending ? "Saving…" : "Enter Strut"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
