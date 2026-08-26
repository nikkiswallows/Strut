import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { queryClient } from "@/lib/query-client";
import { STARTER_LOOKS } from "@/lib/seed-data";
import { getMyProfile, saveMyProfile } from "@/lib/server/profiles";
import { IDENTITIES, INTERESTS, LOOKING_FOR, PRONOUNS } from "@/lib/types";
import { cn, fileToJpegDataUrl, slugifyHandle } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    enabled: Boolean(user),
  });

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [age, setAge] = useState("24");
  const [location, setLocation] = useState("Costa Mesa, CA");
  const [identity, setIdentity] = useState("Trans woman");
  const [pronouns, setPronouns] = useState("she/her");
  const [lookingFor, setLookingFor] = useState("Dating");
  const [photos, setPhotos] = useState<string[]>(STARTER_LOOKS);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>(["Fashion", "Nights out"]);
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
      setLocation(me.data.location ?? "Costa Mesa, CA");
      setIdentity(me.data.identity ?? "Trans woman");
      setPronouns(me.data.pronouns ?? "she/her");
      setLookingFor(me.data.lookingFor ?? "Dating");
      setPhotos(me.data.photos.length ? me.data.photos : STARTER_LOOKS);
      setBio(me.data.bio);
      setInterests(me.data.interests.length ? me.data.interests : ["Fashion", "Nights out"]);
    }
    setHydrated(true);
  }, [hydrated, me.data, me.isPending, user]);

  const save = useMutation({
    mutationFn: () =>
      saveMyProfile({
        data: {
          displayName,
          handle,
          age: Number(age) || 18,
          location,
          identity,
          pronouns,
          lookingFor,
          photos,
          bio,
          interests,
          heightCm: null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("You're on Strut.");
      navigate({ to: "/discover" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isPending || me.isPending) {
    return <div className="min-h-dvh bg-bg" />;
  }
  if (!user) return <RedirectToSignIn />;
  if (me.data?.onboarded) return <Navigate to="/discover" />;

  const steps = ["You", "Identity", "Looks", "Voice"];

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const next = [...photos];
    for (const file of Array.from(list).slice(0, 8 - next.length)) {
      try {
        next.push(await fileToJpegDataUrl(file));
      } catch {
        toast.error("Could not read that photo.");
      }
    }
    setPhotos(next.slice(0, 8));
  }

  return (
    <div className="min-h-dvh bg-bg px-5 py-8">
      <div className="mx-auto max-w-lg">
        <Logo />
        <div className="mt-8 flex gap-2">
          {steps.map((label, i) => (
            <button key={label} type="button" onClick={() => setStep(i)} className="flex-1">
              <span
                className={cn("block h-1 rounded-full", i <= step ? "bg-accent" : "bg-elevated")}
              />
              <span className="mt-2 block text-[10px] tracking-wide text-subtle uppercase">
                {label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-8">
          {step === 0 && (
            <div className="space-y-4">
              <h1 className="font-display text-4xl">First, who are we meeting?</h1>
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
                />
              </Field>
              <Field label="Handle" hint="Letters, numbers, underscore.">
                <Input
                  value={handle}
                  onChange={(e) => setHandle(slugifyHandle(e.target.value))}
                  placeholder="nikki"
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
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h1 className="font-display text-4xl">How do you show up?</h1>
              <ChipGroup label="Identity" options={[...IDENTITIES]} value={identity} onChange={setIdentity} />
              <ChipGroup label="Pronouns" options={[...PRONOUNS]} value={pronouns} onChange={setPronouns} />
              <ChipGroup
                label="Looking for"
                options={[...LOOKING_FOR]}
                value={lookingFor}
                onChange={setLookingFor}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h1 className="font-display text-4xl">Put a face to it.</h1>
              <p className="text-sm text-muted">
                Your looks are already in. Tap to drop one, or add more of your own.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((src, i) => (
                  <button
                    key={`${i}-${src.slice(0, 24)}`}
                    type="button"
                    className="relative aspect-[3/4] overflow-hidden rounded-lg"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                  >
                    <Photo src={src} alt="" className="size-full" />
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-bg/70 px-2 py-0.5 text-[10px]">
                      Remove
                    </span>
                  </button>
                ))}
                {photos.length < 8 ? (
                  <label className="grid aspect-[3/4] cursor-pointer place-items-center rounded-lg border border-dashed border-border text-xs text-muted">
                    Add photo
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => void onFiles(e.target.files)}
                    />
                  </label>
                ) : null}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setPhotos(STARTER_LOOKS)}>
                Reset to saved looks
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h1 className="font-display text-4xl">Say it in a line.</h1>
              <Field label="Bio">
                <Textarea
                  value={bio}
                  maxLength={500}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Who you are when the lights go down."
                />
              </Field>
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                  Interests
                </p>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((tag) => {
                    const on = interests.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setInterests(
                            on ? interests.filter((t) => t !== tag) : [...interests, tag].slice(0, 8),
                          )
                        }
                        className={cn(
                          "h-9 rounded-full px-3.5 text-sm",
                          on ? "bg-fg text-bg" : "bg-elevated text-muted",
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
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
                if (step === 2 && photos.length === 0) {
                  toast.error("Add at least one photo.");
                  return;
                }
                setStep(step + 1);
              }}
            >
              Continue
            </Button>
          ) : (
            <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Enter Strut"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "h-9 rounded-full px-3.5 text-sm",
              value === opt ? "bg-fg text-bg" : "bg-elevated text-muted",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
