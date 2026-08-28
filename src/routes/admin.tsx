import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { http } from "@/lib/http";
import { queryClient } from "@/lib/query-client";
import {
  ETHNICITIES,
  IDENTITIES,
  INTERESTS,
  LOOKING_FOR,
  PRONOUNS,
  ROLES,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Admin control panel — sign-in, seed-profile generation, profile management.
 *
 * The flow is deliberately gated: you describe a persona, an uncensored Horde
 * text model writes the profile, a Horde image model renders ONE photo, and
 * then it sits in the review queue until you either edit-and-approve it or
 * delete it. Nothing reaches a member's deck without that click.
 *
 * Everything generated carries `is_ai = true` plus full provenance, and
 * "Purge generated" removes the entire synthetic cohort in one action. Run that
 * before any production deploy.
 */

type SeedDraft = {
  handle: string;
  displayName: string;
  age: number;
  identities: string[];
  pronouns: string[];
  role: string;
  ethnicity: string;
  lookingFor: string[];
  interests: string[];
  location: string;
  heightCm: number | null;
  bio: string;
};

type SeedJob = {
  id: number;
  persona: string;
  draft: SeedDraft | null;
  edited: boolean;
  status: "drafting" | "awaiting_review" | "approved" | "discarded" | "failed";
  textModel: string | null;
  imageModel: string | null;
  imageUrl: string | null;
  error: string | null;
  createdUserId: string | null;
  queuePosition: number | null;
  waitTime: number | null;
  stage: "text" | "image" | "review" | "done";
};

type ProfileRow = {
  userId: string;
  handle: string;
  displayName: string;
  age: number | null;
  location: string | null;
  role: string | null;
  identities: string[];
  isAi: boolean;
  isSeed: boolean;
  suspended: boolean;
  photo: string | null;
  bio: string;
  createdAt: string | null;
};

type AdminState = {
  jobs: SeedJob[];
  profiles: ProfileRow[];
  horde: { username: string; kudos: number; concurrency: number } | null;
  fallbacks: { horde: boolean; adminEmail: boolean; adminPassword: boolean };
};

type WhoAmI = {
  signedIn: boolean;
  isAdmin: boolean;
  email: string | null;
  name: string | null;
};

const adminPost = <T,>(body: Record<string, unknown>) => http<T>("/api/admin", body);

export const Route = createFileRoute("/admin")({ component: AdminPage });

/* ── shell ───────────────────────────────────────────────────────────────── */

function AdminPage() {
  const who = useQuery({
    queryKey: ["admin", "whoami"],
    queryFn: () => http<WhoAmI>("/api/admin?what=whoami"),
    retry: false,
  });

  if (who.isLoading) {
    return (
      <Shell>
        <p className="text-sm text-muted">Loading…</p>
      </Shell>
    );
  }

  if (who.error || !who.data?.isAdmin) {
    return <AdminLogin onSignedIn={() => void who.refetch()} />;
  }

  return <AdminConsole who={who.data} />;
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-fg">Strut control panel</h1>
          <p className="text-xs text-subtle">
            Cold-start tooling. Every generated profile is flagged{" "}
            <span className="font-mono">is_ai</span> with full provenance and can be purged in one
            action — do that before production.
          </p>
        </div>
        {right}
      </header>
      {children}
    </main>
  );
}

/* ── sign in ─────────────────────────────────────────────────────────────── */

function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await authClient.signIn.email({ email: email.trim(), password });
      if (error) throw new Error(error.message ?? "Invalid email or password.");
      const me = await http<WhoAmI>("/api/admin?what=whoami");
      if (!me.isAdmin) {
        await authClient.signOut().catch(() => {});
        throw new Error("That account is not an administrator.");
      }
      toast.success("Signed in.");
      onSignedIn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <form
        onSubmit={submit}
        className="mx-auto w-full max-w-sm space-y-4 rounded-2xl border border-border bg-elevated/40 p-5"
      >
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-fg">Administrator sign-in</h2>
          <p className="text-xs text-subtle">
            This console can create, suspend and permanently delete member profiles.
          </p>
        </div>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@admin.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <Button
          type="submit"
          className="w-full"
          disabled={busy || !email.trim() || password.length < 4}
        >
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Shell>
  );
}

/* ── console ─────────────────────────────────────────────────────────────── */

function AdminConsole({ who }: { who: WhoAmI }) {
  const [tab, setTab] = useState<"generate" | "profiles">("generate");

  const state = useQuery({
    queryKey: ["admin", "state"],
    queryFn: () => http<AdminState>("/api/admin"),
  });

  const jobs = useMemo(() => state.data?.jobs ?? [], [state.data]);
  const profiles = state.data?.profiles ?? [];
  const pending = jobs.some((j) => j.status === "drafting");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "state"] });

  // Horde is a queue: drafts advance on its schedule, not ours. Poll each
  // pending job individually — the poll call is what actually ADVANCES the job
  // server-side, so a plain list refetch would never move anything along.
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const tick = async () => {
      for (const job of jobs.filter((j) => j.status === "drafting")) {
        if (cancelled) return;
        await adminPost<SeedJob>({ op: "job", jobId: job.id }).catch(() => null);
      }
      if (!cancelled) void refresh();
    };
    void tick();
    const t = setInterval(() => void tick(), 7000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pending, jobs]);

  async function logout() {
    await authClient.signOut().catch(() => {});
    queryClient.clear();
    window.location.href = "/admin";
  }

  return (
    <Shell
      right={
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-subtle sm:inline">{who.email}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      }
    >
      <FallbackWarning state={state.data} />

      <nav className="flex gap-2">
        {(
          [
            ["generate", `Generate${jobs.length ? ` (${jobs.length})` : ""}`],
            ["profiles", `Profiles (${profiles.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-9 rounded-full px-4 text-sm transition-colors",
              tab === id ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {state.isLoading && <p className="text-sm text-muted">Loading…</p>}

      {tab === "generate" ? (
        <GenerateTab jobs={jobs} horde={state.data?.horde ?? null} onChanged={refresh} />
      ) : (
        <ProfilesTab profiles={profiles} meId={null} onChanged={refresh} />
      )}
    </Shell>
  );
}

function FallbackWarning({ state }: { state: AdminState | undefined }) {
  const f = state?.fallbacks;
  if (!f || (!f.horde && !f.adminPassword)) return null;
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-fg/80">
      <p className="font-semibold text-fg">Running on committed fallback credentials.</p>
      <p className="mt-1">
        {f.adminPassword && "The admin password is a literal in the repository. "}
        {f.horde && "The AI Horde API key is a literal in the repository. "}
        Set <span className="font-mono">ADMIN_PASSWORD</span> and{" "}
        <span className="font-mono">AIHORDE_API_KEY</span> as environment variables and delete the
        literals in <span className="font-mono">src/lib/server/secrets.server.ts</span>, or rotate
        both once testing is done.
      </p>
    </div>
  );
}

/* ── generate tab ────────────────────────────────────────────────────────── */

const PRESETS = [
  "Black bull, 29, Atlanta, gym rat, dominant and direct, wants sissies who obey",
  "white sissy bottom, 32, Orange County, married and discreet, locked in chastity",
  "Latina hotwife, 36, Miami, husband watches, only sees bulls",
  "white cuck, 44, Dallas, cleans up after, worships his wife's bull",
  "T-girl bottom, 26, Brooklyn, artist, new to BNWO and curious",
];

function GenerateTab({
  jobs,
  horde,
  onChanged,
}: {
  jobs: SeedJob[];
  horde: AdminState["horde"];
  onChanged: () => void;
}) {
  const [persona, setPersona] = useState("");

  const generate = useMutation({
    mutationFn: (p: string) => adminPost<{ id: number }>({ op: "seed", persona: p }),
    onSuccess: () => {
      setPersona("");
      toast.success("Queued. Writing the persona, then rendering the photo…");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not queue it."),
  });

  const queue = jobs.filter((j) => j.status !== "approved");
  const done = jobs.filter((j) => j.status === "approved");

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Generate a profile
        </h2>
        <Field
          label="Persona prompt"
          hint="Plain language. The model fills every profile field and writes the bio from this; a bull is read as a Top, a sissy as a Bottom."
        >
          <Textarea
            value={persona}
            maxLength={500}
            rows={3}
            placeholder="white sissy bottom, 32, Orange County, married and discreet, loves being told what to do"
            onChange={(e) => setPersona(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={persona.trim().length < 3 || generate.isPending}
            onClick={() => generate.mutate(persona.trim())}
          >
            {generate.isPending ? "Queueing…" : "Generate profile"}
          </Button>
          {PRESETS.map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPersona(p)}
            >
              {p.split(",")[0]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-subtle">
          Runs on the volunteer AI Horde network — one text job then one image job, anywhere from
          under a minute to many minutes depending on queue depth.
          {horde
            ? ` Signed in as ${horde.username} · ${horde.kudos} kudos · ${horde.concurrency} concurrent jobs.`
            : " No Horde account resolved — running anonymous, expect a long queue."}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Review queue</h2>
        {queue.length === 0 && <p className="text-sm text-subtle">Nothing queued.</p>}
        <ul className="space-y-4">
          {queue.map((job) => (
            <JobCard key={job.id} job={job} onChanged={onChanged} />
          ))}
        </ul>
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Recently approved
          </h2>
          <ul className="space-y-1 text-xs text-subtle">
            {done.map((j) => (
              <li key={j.id}>
                #{j.id} · {j.draft?.displayName ?? "—"} (@{j.draft?.handle ?? "—"}) — live
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const STATUS_LABEL: Record<SeedJob["status"], string> = {
  drafting: "generating",
  awaiting_review: "ready for review",
  approved: "approved",
  discarded: "discarded",
  failed: "failed",
};

function JobCard({ job, onChanged }: { job: SeedJob; onChanged: () => void }) {
  const [draft, setDraft] = useState<SeedDraft | null>(job.draft);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Adopt server state whenever the job advances, unless the operator has
  // unsaved edits in front of them — clobbering typing is worse than staleness.
  useEffect(() => {
    if (!dirty) setDraft(job.draft);
  }, [job.draft, dirty]);

  const set = <K extends keyof SeedDraft>(key: K, value: SeedDraft[K]) => {
    setDirty(true);
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const save = useMutation({
    mutationFn: () => adminPost<SeedJob>({ op: "editDraft", jobId: job.id, draft }),
    onSuccess: (j) => {
      setDirty(false);
      setDraft(j.draft);
      toast.success("Edits saved to the draft.");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  const act = useMutation({
    mutationFn: async (op: "approve" | "discard" | "retryImage") => {
      if (op === "approve" && dirty) {
        await adminPost<SeedJob>({ op: "editDraft", jobId: job.id, draft });
      }
      return adminPost<{ ok?: true; userId?: string; handle?: string }>({ op, jobId: job.id });
    },
    onSuccess: (d, op) => {
      setDirty(false);
      setConfirmDelete(false);
      toast.success(
        op === "approve"
          ? `Created @${d.handle ?? "member"} — live in the deck.`
          : op === "discard"
            ? "Draft deleted."
            : "Re-queued the photo.",
      );
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "That failed."),
  });

  const busy = act.isPending || save.isPending;
  const ready = job.status === "awaiting_review";

  return (
    <li className="rounded-2xl border border-border bg-elevated/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm text-fg/90">{job.persona}</p>
          <p className="text-xs text-subtle">
            #{job.id} · {STATUS_LABEL[job.status]}
            {job.status === "drafting" &&
              ` · ${job.stage === "image" ? "rendering photo" : "writing profile"}${
                job.queuePosition && job.queuePosition > 0 ? ` · queue #${job.queuePosition}` : ""
              }${job.waitTime ? ` · ~${Math.ceil(job.waitTime / 60)} min` : ""}`}
            {job.textModel ? ` · text: ${job.textModel.split("/").pop()}` : ""}
            {job.imageModel ? ` · image: ${job.imageModel}` : ""}
            {job.edited ? " · edited" : ""}
          </p>
          {job.error && <p className="text-xs text-danger">{job.error}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0 space-y-2">
          <div className="h-64 w-44 overflow-hidden rounded-xl bg-black/40">
            {job.imageUrl ? (
              <img src={job.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-subtle">
                {job.status === "drafting" ? "rendering…" : "no photo"}
              </div>
            )}
          </div>
          {job.draft && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => act.mutate("retryImage")}
            >
              Re-roll photo
            </Button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!draft ? (
            <p className="text-xs text-subtle">
              {job.status === "failed" ? "No draft was produced." : "Writing the profile…"}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Display name">
                  <Input
                    value={draft.displayName}
                    onChange={(e) => set("displayName", e.target.value)}
                  />
                </Field>
                <Field label="Handle">
                  <Input
                    value={draft.handle}
                    onChange={(e) =>
                      set("handle", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                  />
                </Field>
                <Field label="Age">
                  <Input
                    type="number"
                    min={18}
                    max={65}
                    value={draft.age}
                    onChange={(e) => set("age", Number(e.target.value) || 18)}
                  />
                </Field>
                <Field label="Location">
                  <Input
                    value={draft.location}
                    onChange={(e) => set("location", e.target.value)}
                  />
                </Field>
                <Field label="Height (cm)">
                  <Input
                    type="number"
                    min={130}
                    max={225}
                    value={draft.heightCm ?? ""}
                    onChange={(e) =>
                      set("heightCm", e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Ethnicity">
                  <Picker
                    options={[...ETHNICITIES]}
                    value={draft.ethnicity ? [draft.ethnicity] : []}
                    max={1}
                    onChange={(v) => set("ethnicity", v[0] ?? "")}
                  />
                </Field>
              </div>

              <Labelled label="Role">
                <Picker
                  options={[...ROLES]}
                  value={draft.role ? [draft.role] : []}
                  max={1}
                  onChange={(v) => set("role", v[0] ?? "")}
                />
              </Labelled>
              <Labelled label="Identities">
                <Picker
                  options={[...IDENTITIES]}
                  value={draft.identities}
                  max={3}
                  onChange={(v) => set("identities", v)}
                />
              </Labelled>
              <Labelled label="Pronouns">
                <Picker
                  options={[...PRONOUNS]}
                  value={draft.pronouns}
                  max={2}
                  onChange={(v) => set("pronouns", v)}
                />
              </Labelled>
              <Labelled label="Looking for">
                <Picker
                  options={[...LOOKING_FOR]}
                  value={draft.lookingFor}
                  max={4}
                  onChange={(v) => set("lookingFor", v)}
                />
              </Labelled>
              <Labelled label="Interests">
                <Picker
                  options={[...INTERESTS]}
                  value={draft.interests}
                  max={6}
                  onChange={(v) => set("interests", v)}
                />
              </Labelled>

              <Field label={`Bio (${draft.bio.length} chars)`}>
                <Textarea
                  rows={8}
                  value={draft.bio}
                  maxLength={1800}
                  onChange={(e) => set("bio", e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          disabled={!ready || busy || !draft}
          onClick={() => act.mutate("approve")}
        >
          {act.isPending ? "Working…" : "Approve & publish"}
        </Button>
        <Button
          type="button"
          variant="subtle"
          disabled={!dirty || busy}
          onClick={() => save.mutate()}
        >
          {dirty ? "Save edits" : "Saved"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-subtle">Delete this draft?</span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => act.mutate("discard")}
              >
                Yes, delete
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              Delete draft
            </Button>
          )}
        </div>
      </div>
      {!ready && job.status === "drafting" && (
        <p className="mt-2 text-xs text-subtle">
          Approve unlocks once the photo lands. Edit the fields meanwhile — your changes are kept.
        </p>
      )}
    </li>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      {children}
    </div>
  );
}

function Picker({
  options,
  value,
  max,
  onChange,
}: {
  options: string[];
  value: string[];
  max: number;
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (on) return onChange(value.filter((v) => v !== opt));
              if (max === 1) return onChange([opt]);
              if (value.length >= max) return toast.error(`Pick up to ${max}.`);
              onChange([...value, opt]);
            }}
            className={cn(
              "h-8 rounded-full px-3 text-xs transition-colors",
              on ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ── profiles tab ────────────────────────────────────────────────────────── */

function ProfilesTab({
  profiles,
  meId,
  onChanged,
}: {
  profiles: ProfileRow[];
  meId: string | null;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "ai" | "suspended">("all");
  const [confirmPurge, setConfirmPurge] = useState("");

  const purge = useMutation({
    mutationFn: () => adminPost<{ removed: number }>({ op: "purgeAi" }),
    onSuccess: (d) => {
      toast.success(`Removed ${d.removed} generated profile${d.removed === 1 ? "" : "s"}.`);
      setConfirmPurge("");
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Purge failed."),
  });

  const needle = q.trim().toLowerCase();
  const shown = profiles.filter((p) => {
    if (only === "ai" && !p.isAi) return false;
    if (only === "suspended" && !p.suspended) return false;
    if (!needle) return true;
    return (
      p.handle.toLowerCase().includes(needle) ||
      p.displayName.toLowerCase().includes(needle) ||
      (p.location ?? "").toLowerCase().includes(needle)
    );
  });
  const aiCount = profiles.filter((p) => p.isAi).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, handle, city…"
          className="h-9 max-w-xs"
        />
        {(["all", "ai", "suspended"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setOnly(id)}
            className={cn(
              "h-9 rounded-full px-3.5 text-xs transition-colors",
              only === id ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
            )}
          >
            {id === "all" ? `All (${profiles.length})` : id === "ai" ? `Generated (${aiCount})` : "Suspended"}
          </button>
        ))}
        {aiCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Input
              value={confirmPurge}
              onChange={(e) => setConfirmPurge(e.target.value)}
              placeholder="type PURGE"
              className="h-9 w-32"
            />
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={confirmPurge.trim() !== "PURGE" || purge.isPending}
              onClick={() => purge.mutate()}
            >
              {purge.isPending ? "Purging…" : `Purge ${aiCount} generated`}
            </Button>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {shown.map((p) => (
          <ProfileRowItem key={p.userId} profile={p} meId={meId} onChanged={onChanged} />
        ))}
        {shown.length === 0 && <li className="text-sm text-subtle">Nothing matches.</li>}
      </ul>
    </section>
  );
}

function ProfileRowItem({
  profile: p,
  meId,
  onChanged,
}: {
  profile: ProfileRow;
  meId: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminPost<{ ok: true }>(body),
    onSuccess: () => {
      setConfirming(false);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "That failed."),
  });

  const isMe = meId === p.userId;

  return (
    <li className="rounded-xl border border-border bg-elevated/30">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-black/40">
            {p.photo && <img src={p.photo} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-fg/90">
              {p.displayName} <span className="text-subtle">@{p.handle || "—"}</span>
              {p.age ? <span className="text-subtle"> · {p.age}</span> : null}
            </p>
            <p className="truncate text-[11px] text-subtle">
              {[p.location, p.role, p.identities.join(" · ")].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {p.isAi && <Tag tone="accent">AI</Tag>}
          {p.isSeed && !p.isAi && <Tag>seed</Tag>}
          {p.suspended && <Tag tone="danger">suspended</Tag>}
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {p.bio && <p className="whitespace-pre-wrap text-xs text-muted">{p.bio}</p>}
          <p className="font-mono text-[11px] text-subtle">{p.userId}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={p.suspended ? "primary" : "outline"}
              disabled={act.isPending || isMe}
              onClick={() =>
                act.mutate({ op: "suspend", userId: p.userId, suspended: !p.suspended })
              }
            >
              {p.suspended ? "Resume profile" : "Suspend / pause"}
            </Button>
            {confirming ? (
              <>
                <span className="text-xs text-subtle">
                  Permanently delete {p.displayName} and all their messages?
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ op: "deleteProfile", userId: p.userId })}
                >
                  Yes, delete
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={act.isPending || isMe}
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
            )}
            <a
              href={`/u/${p.handle}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-muted underline underline-offset-2 hover:text-fg"
            >
              View profile
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "danger";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
        tone === "accent" && "bg-accent/20 text-accent",
        tone === "danger" && "bg-danger/20 text-danger",
        tone === "muted" && "bg-elevated text-subtle",
      )}
    >
      {children}
    </span>
  );
}
