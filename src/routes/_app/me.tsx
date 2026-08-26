import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MultiChips, SingleChips } from "@/components/chips";
import { PhotoEditor } from "@/components/photo-editor";
import { PhotoStrip } from "@/components/photo-viewer";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { queryClient } from "@/lib/query-client";
import { listTags } from "@/lib/server/catalog";
import { getMyProfile, saveMyProfile } from "@/lib/server/profiles";
import {
  IDENTITIES,
  identityLine,
  INTERESTS,
  LOOKING_FOR,
  lookingLine,
  pronounLine,
  PRONOUNS,
  ROLES,
  shownAge,
} from "@/lib/types";
import { cn, slugifyHandle } from "@/lib/utils";

export const Route = createFileRoute("/_app/me")({ component: Me });

function Me() {
  const user = useCurrentUser();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const identityTags = useQuery({
    queryKey: ["tags", "identity"],
    queryFn: () => listTags({ data: "identity" }),
  });
  const pronounTags = useQuery({
    queryKey: ["tags", "pronoun"],
    queryFn: () => listTags({ data: "pronoun" }),
  });
  const interestTags = useQuery({
    queryKey: ["tags", "interest"],
    queryFn: () => listTags({ data: "interest" }),
  });
  const lookingTags = useQuery({
    queryKey: ["tags", "looking"],
    queryFn: () => listTags({ data: "looking" }),
  });
  const p = me.data;
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [age, setAge] = useState("");
  const [hideAge, setHideAge] = useState(false);
  const [location, setLocation] = useState("");
  const [identities, setIdentities] = useState<string[]>([]);
  const [pronouns, setPronouns] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [heightCm, setHeightCm] = useState("");

  useEffect(() => {
    if (!p) return;
    setDisplayName(p.displayName);
    setHandle(p.handle);
    setAge(p.age ? String(p.age) : "");
    setHideAge(p.hideAge);
    setLocation(p.location ?? "");
    setIdentities(p.identities);
    setPronouns(p.pronouns);
    setRole(p.role ?? "");
    setLookingFor(p.lookingFor);
    setPhotos(p.photos);
    setBio(p.bio);
    setInterests(p.interests);
    setHeightCm(p.heightCm ? String(p.heightCm) : "");
  }, [p]);

  const save = useMutation({
    mutationFn: () =>
      saveMyProfile({
        data: {
          displayName,
          handle,
          age: age ? Number(age) : null,
          hideAge,
          location,
          identities,
          pronouns,
          role,
          lookingFor,
          photos,
          bio,
          interests,
          heightCm: heightCm ? Number(heightCm) : null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setEditing(false);
      toast.success("Profile saved.");
    },
    onError: (err: Error) => {
      toast.error(
        err.message === "Unauthorized"
          ? "Session dropped. Sign in again, then save."
          : err.message,
      );
    },
  });

  if (me.isPending || !p) {
    return <div className="h-96 animate-pulse rounded-xl bg-surface" />;
  }

  const ageShown = shownAge(p);

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-accent uppercase">QOS · Profile</p>
          <h1 className="font-display text-5xl leading-[0.92]">You</h1>
          <p className="text-sm text-muted">{user?.primaryEmail}</p>
        </div>
        <UserButton />
      </div>

      {!editing ? (
        <div className="mt-6 animate-fade-up">
          <PhotoStrip photos={p.photos} name={p.displayName} />
          {p.photos.length > 1 ? (
            <p className="mt-2 text-center text-[11px] tracking-wide text-subtle uppercase">
              Scroll your looks
            </p>
          ) : null}
          <h2 className="mt-5 font-display text-4xl">
            {p.displayName}
            {ageShown ? <span className="ml-2 font-sans text-xl text-muted">{ageShown}</span> : null}
          </h2>
          <p className="text-sm text-muted">
            @{p.handle}
            {identityLine(p) ? ` · ${identityLine(p)}` : ""}
            {pronounLine(p) ? ` · ${pronounLine(p)}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.role ? (
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-fg">
                {p.role}
              </span>
            ) : null}
            {lookingLine(p) ? (
              <span className="rounded-full bg-elevated px-3 py-1 text-xs text-muted">
                {lookingLine(p)}
              </span>
            ) : null}
            {p.heightCm ? (
              <span className="rounded-full bg-elevated px-3 py-1 text-xs text-muted">{p.heightCm} cm</span>
            ) : null}
          </div>
          {p.location ? <p className="mt-2 text-sm text-muted">{p.location}</p> : null}
          {p.bio ? <p className="mt-3 leading-relaxed">{p.bio}</p> : null}
          {p.interests.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {p.interests.map((tag) => (
                <span key={tag} className="rounded-full bg-elevated px-3 py-1 text-xs text-muted">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <Button className="mt-6 w-full" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4 animate-fade-up"
          onSubmit={(e) => {
            e.preventDefault();
            if (photos.length === 0) {
              toast.error("Add at least one photo of you.");
              return;
            }
            save.mutate();
          }}
        >
          <Field label="Name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Handle" hint="Letters, numbers, periods, underscore.">
            <Input value={handle} onChange={(e) => setHandle(slugifyHandle(e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Age">
              <Input type="number" min={18} value={age} onChange={(e) => setAge(e.target.value)} />
            </Field>
            <Field label="City">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
          </div>
          <Field label="Height (cm)">
            <Input
              type="number"
              min={120}
              max={220}
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
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
          <MultiChips
            label="Identity"
            options={identityTags.data ?? [...IDENTITIES]}
            value={identities}
            onChange={setIdentities}
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
          <MultiChips
            label="Looking for"
            hint="Pick as many as you want."
            options={lookingTags.data ?? [...LOOKING_FOR]}
            value={lookingFor}
            onChange={setLookingFor}
            kind="looking"
            max={8}
          />
          <Field label="Bio">
            <Textarea value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <PhotoEditor photos={photos} onChange={setPhotos} />
          <MultiChips
            label="Interests"
            options={interestTags.data ?? [...INTERESTS]}
            value={interests}
            onChange={setInterests}
            kind="interest"
            max={16}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
