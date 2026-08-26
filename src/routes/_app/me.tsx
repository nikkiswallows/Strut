import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { queryClient } from "@/lib/query-client";
import { STARTER_LOOKS } from "@/lib/seed-data";
import { getMyProfile, saveMyProfile } from "@/lib/server/profiles";
import { IDENTITIES, INTERESTS, LOOKING_FOR, PRONOUNS } from "@/lib/types";
import { cn, fileToJpegDataUrl, slugifyHandle } from "@/lib/utils";

export const Route = createFileRoute("/_app/me")({ component: Me });

function Me() {
  const user = useCurrentUser();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const p = me.data;
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [identity, setIdentity] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    if (!p) return;
    setDisplayName(p.displayName);
    setHandle(p.handle);
    setAge(p.age ? String(p.age) : "");
    setLocation(p.location ?? "");
    setIdentity(p.identity ?? "");
    setPronouns(p.pronouns ?? "");
    setLookingFor(p.lookingFor ?? "");
    setPhotos(p.photos);
    setBio(p.bio);
    setInterests(p.interests);
  }, [p]);

  const save = useMutation({
    mutationFn: () =>
      saveMyProfile({
        data: {
          displayName,
          handle,
          age: age ? Number(age) : null,
          location,
          identity,
          pronouns,
          lookingFor,
          photos,
          bio,
          interests,
          heightCm: p?.heightCm ?? null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setEditing(false);
      toast.success("Profile updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const next = [...photos];
    for (const file of Array.from(list).slice(0, 8 - next.length)) {
      next.push(await fileToJpegDataUrl(file));
    }
    setPhotos(next.slice(0, 8));
  }

  if (me.isPending || !p) {
    return <div className="h-96 animate-pulse rounded-xl bg-surface" />;
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">You</h1>
          <p className="text-sm text-muted">{user?.primaryEmail}</p>
        </div>
        <UserButton />
      </div>

      {!editing ? (
        <>
          <Link to="/u/$handle" params={{ handle: p.handle }} className="mt-6 block">
            <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
              {(p.photos.length ? p.photos : [null]).slice(0, 3).map((src, i) => (
                <div key={i} className="relative aspect-[3/4]">
                  <Photo
                    src={src}
                    alt=""
                    name={p.displayName}
                    className="absolute inset-0 size-full object-cover"
                  />
                </div>
              ))}
            </div>
          </Link>
          <h2 className="mt-5 font-display text-3xl">
            {p.displayName}
            {p.age ? <span className="ml-2 font-sans text-xl text-muted">{p.age}</span> : null}
          </h2>
          <p className="text-sm text-muted">
            @{p.handle}
            {p.identity ? ` · ${p.identity}` : ""}
            {p.pronouns ? ` · ${p.pronouns}` : ""}
          </p>
          {p.location ? <p className="mt-1 text-sm text-muted">{p.location}</p> : null}
          {p.lookingFor ? (
            <p className="mt-3 inline-flex rounded-full bg-elevated px-3 py-1 text-xs text-muted">
              Looking for {p.lookingFor.toLowerCase()}
            </p>
          ) : null}
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
        </>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </Field>
          <Field label="Handle">
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
          <ChipSelect label="Identity" options={[...IDENTITIES]} value={identity} onChange={setIdentity} />
          <ChipSelect label="Pronouns" options={[...PRONOUNS]} value={pronouns} onChange={setPronouns} />
          <ChipSelect
            label="Looking for"
            options={[...LOOKING_FOR]}
            value={lookingFor}
            onChange={setLookingFor}
          />
          <Field label="Bio">
            <Textarea value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((src, i) => (
              <button
                key={i}
                type="button"
                className="relative aspect-[3/4] overflow-hidden rounded-lg"
                onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
              >
                <Photo src={src} alt="" className="absolute inset-0 size-full object-cover" />
              </button>
            ))}
            {photos.length < 8 ? (
              <label className="grid aspect-[3/4] cursor-pointer place-items-center rounded-lg border border-dashed border-border text-xs text-muted">
                Add
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
          <Button type="button" variant="outline" className="w-full" onClick={() => setPhotos(STARTER_LOOKS)}>
            Use my saved looks
          </Button>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((tag) => {
              const on = interests.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setInterests(on ? interests.filter((t) => t !== tag) : [...interests, tag].slice(0, 8))
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
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={save.isPending}>
              Save
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ChipSelect({
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
