import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MultiChips, SingleChips } from "@/components/chips";
import { Decree } from "@/components/decree";
import { PhotoEditor } from "@/components/photo-editor";
import { decreeFor, judgeRole } from "@/lib/bnwo";
import { PhotoStrip } from "@/components/photo-viewer";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { signOutAndRedirect } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { queryClient } from "@/lib/query-client";
import { app } from "@/lib/http";
import { clearOnboardingDraft } from "@/lib/onboarding-draft";
import { fetchMyProfile, postProfile } from "@/lib/profile-api";
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
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMyProfile() });
  const identityTags = useQuery({
    queryKey: ["tags", "identity"],
    queryFn: () => app<string[]>("tags", { kind: "identity" }),
  });
  const pronounTags = useQuery({
    queryKey: ["tags", "pronoun"],
    queryFn: () => app<string[]>("tags", { kind: "pronoun" }),
  });
  const interestTags = useQuery({
    queryKey: ["tags", "interest"],
    queryFn: () => app<string[]>("tags", { kind: "interest" }),
  });
  const lookingTags = useQuery({
    queryKey: ["tags", "looking"],
    queryFn: () => app<string[]>("tags", { kind: "looking" }),
  });
  const p = me.data;
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [age, setAge] = useState("");
  const [hideAge, setHideAge] = useState(false);
  const [discreet, setDiscreet] = useState(false);
  const [location, setLocation] = useState("");
  const [identities, setIdentities] = useState<string[]>([]);
  const [pronouns, setPronouns] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBlurs, setPhotoBlurs] = useState<string[]>([]);
  const [birthDate, setBirthDate] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [heightCm, setHeightCm] = useState("");

  useEffect(() => {
    if (!p) return;
    setDisplayName(p.displayName);
    setHandle(p.handle);
    setAge(p.age ? String(p.age) : "");
    setHideAge(p.hideAge);
    setDiscreet(p.discreet);
    setLocation(p.location ?? "");
    setIdentities(p.identities);
    setPronouns(p.pronouns);
    setRole(p.role ?? "");
    setLookingFor(p.lookingFor);
    setPhotos(p.photos);
    setPhotoBlurs(p.photoBlurs ?? []);
    setBirthDate(p.birthDate ?? "");
    setBio(p.bio);
    setInterests(p.interests);
    setHeightCm(p.heightCm ? String(p.heightCm) : "");
  }, [p]);

  const save = useMutation({
    mutationFn: () =>
      postProfile({
        displayName,
        handle,
        age: age ? Number(age) : null,
        hideAge,
        discreet,
        location,
        identities,
        pronouns,
        role: judgeRole(identities, role).forced,
        lookingFor,
        photos,
        photoBlurs,
        // Sent so members from before DOB attestation can attest from the edit
        // form; the server ignores it once a birth date is on file (immutable).
        birthDate: birthDate || null,
        bio,
        interests,
        heightCm: heightCm ? Number(heightCm) : null,
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

  async function logout() {
    clearOnboardingDraft();
    try {
      await signOutAndRedirect("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-out failed. Try again.");
    }
  }

  if (me.isPending || !p) {
    return <div className="h-96 animate-pulse rounded-xl bg-surface" />;
  }

  const ageShown = shownAge(p);

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-accent uppercase">QOS · Your place</p>
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
          <Decree className="mt-4">{decreeFor(p.identities)}</Decree>
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
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => {
              void logout();
            }}
          >
            Log out
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
          {p && !p.birthDate ? (
            // Members from before DOB attestation have no birth date on file, and
            // the server refuses any save without one. Asked once, right here;
            // after the first save it's immutable and this field disappears.
            <Field
              label="Date of birth"
              hint="Asked once — Strut is 18+. It can't be changed after you save."
            >
              <Input
                type="date"
                required
                value={birthDate}
                max={new Date(Date.now() - 18 * 365.25 * 24 * 3600 * 1000)
                  .toISOString()
                  .slice(0, 10)}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </Field>
          ) : null}
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
          <MultiChips
            label="Identity"
            hint="Whiteboi / sissy / CD / femboy locks Bottom. Cuck locks Bottom or Side. Bull locks Top."
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
          <Field label="Bio">
            <Textarea value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <PhotoEditor
            photos={photos}
            blurs={photoBlurs}
            onChange={(nextPhotos, nextBlurs) => {
              setPhotos(nextPhotos);
              setPhotoBlurs(nextBlurs);
            }}
          />
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

      {!editing && <SafetyPanel />}
    </div>
  );
}

/**
 * Blocks, data portability and deletion.
 *
 * Presented as part of *my* profile rather than buried in settings: for this
 * audience the ability to make someone vanish — and to make yourself vanish —
 * is the feature that makes the rest of the app usable.
 */
function SafetyPanel() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const blocks = useQuery({
    queryKey: ["blocks"],
    queryFn: () => app<{ items: { blockedId: string; handle: string; displayName: string }[] }>("blocks"),
    enabled: open,
  });

  const unblock = useMutation({
    mutationFn: (blockedId: string) => app<{ ok: true }>("unblock", { blockedId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
      await queryClient.invalidateQueries({ queryKey: ["deck"] });
      toast.success("Unblocked.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not unblock."),
  });

  const wipe = useMutation({
    mutationFn: () =>
      fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "delete" }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Delete failed.");
        return r.json();
      }),
    onSuccess: () => {
      toast.success("Account deleted.");
      window.location.href = "/";
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed."),
  });

  const items = blocks.data?.items ?? [];

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-white/90">Safety &amp; privacy</span>
        <span className="text-xs text-white/40">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/10 px-4 py-4">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Blocked
            </h3>
            {blocks.isLoading && <p className="text-xs text-white/40">Loading…</p>}
            {!blocks.isLoading && items.length === 0 && (
              <p className="text-xs text-white/40">
                Nobody. Blocking is mutual — you both disappear from each other&apos;s
                deck, likes and messages.
              </p>
            )}
            <ul className="space-y-2">
              {items.map((b: { blockedId: string; handle: string }) => (
                <li
                  key={b.blockedId}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
                >
                  <span className="truncate text-sm text-white/80">
                    @{b.handle || "member"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={unblock.isPending}
                    onClick={() => unblock.mutate(b.blockedId)}
                  >
                    Unblock
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Your data
            </h3>
            <p className="text-xs text-white/45">
              Take everything Strut holds about you, or delete the account and its
              photos outright. Deletion is immediate and cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  window.open("/api/account", "_blank");
                }}
              >
                Download my data
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50">
              Delete account
            </h3>
            <p className="text-xs text-white/45">
              Removes your profile, photos, likes, posts and every message you have
              sent. Type <span className="font-mono text-white/70">DELETE</span> to
              confirm.
            </p>
            <div className="flex gap-2">
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="DELETE"
                className="max-w-40"
              />
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={confirm.trim().toLowerCase() !== "delete" || wipe.isPending}
                onClick={() => wipe.mutate()}
              >
                {wipe.isPending ? "Deleting…" : "Delete account"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
