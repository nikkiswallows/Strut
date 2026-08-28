import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, LockOpen } from "lucide-react";
import { AchievementGlyph } from "@/components/achievement-icon";
import { Cage, Crown, Key, Spade } from "@/components/graphics";
import { Avatar } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/query-client";
import { decideServe, fetchGlory, releaseLock, startLock } from "@/lib/glory-api";
import { ACHIEVEMENTS, audienceApplies, evaluateAchievement } from "@/lib/achievements";
import type { GloryBoard } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/glory")({ component: Glory });

const PLEDGES = [
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "1 month", hours: 720 },
  { label: "Indefinite", hours: 0 },
];

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d ${Math.floor(h % 24)}h`;
}

/** Anchor for the cage timer card, so cage-driven orders can point at it. */
const CAGE_ANCHOR = "glory-cage";

/**
 * Where an uncompleted order sends you. Every card that still has a tier to
 * earn is a doorway to the surface where the number moves: `to` navigates,
 * `cage: true` scrolls to the cage timer on this page, and `hint` explains
 * the play when the destination alone doesn't make it obvious.
 */
type Pursuit = {
  label: string;
  to?: "/me" | "/discover" | "/feed" | "/likes" | "/inbox";
  cage?: boolean;
  hint?: string;
};

const PURSUITS: Record<string, Pursuit> = {
  "first-kneel": { label: "Finish your profile", to: "/me" },
  claimed: { label: "Work the deck", to: "/discover" },
  voice: { label: "Post in the Room", to: "/feed" },
  devout: {
    label: "Open a DM",
    to: "/likes",
    hint: "Open a conversation with one of your matches — every first message counts.",
  },
  "kneeler-card": {
    label: "Wear the spade",
    to: "/me",
    hint: "Edit your profile and add the spade (QOS / BNWO) to your interests.",
  },
  "bull-stable": { label: "Claim in the deck", to: "/discover" },
  "bull-worshipped": {
    label: "Be seen",
    to: "/feed",
    hint: "Kneelers open your DMs — stay visible. Post in the Room and they come to you.",
  },
  "bull-empire": { label: "Expand the empire", to: "/discover" },
  "kneeler-serve": {
    label: "Message a king",
    to: "/likes",
    hint: "Open a DM with a bull you matched. Outreach is worship.",
  },
  "kneeler-claimed": { label: "Catch a king's eye", to: "/discover" },
  "kneeler-serve-bulls": {
    label: "Claim a serve",
    to: "/likes",
    hint: "Served a king? Open his profile and claim it — only his approval scores it.",
  },
  "kneeler-locks": {
    label: "Take the cage",
    cage: true,
    hint: "Use the cage timer on this page — every completed lock counts one.",
  },
  "wife-bred": { label: "Take a king", to: "/discover" },
  "wife-night": {
    label: "Open his DMs",
    to: "/likes",
    hint: "Open a conversation with a bull you matched. Schedule the husband.",
  },
  "cuck-watch": {
    label: "Find her a bull",
    to: "/discover",
    hint: "Arrange it: kings matched from this account count. Then hold the phone.",
  },
  "cuck-locked": {
    label: "Serve the lock",
    cage: true,
    hint: "Lock up with the cage timer on this page — hours only count while caged.",
  },
  "chastity-streak": {
    label: "Lock up",
    cage: true,
    hint: "Start a lock with the cage timer on this page. Hours in the cage add up here.",
  },
  "chastity-current": {
    label: "Stay locked",
    cage: true,
    hint: "Start (and keep) a lock with the cage timer on this page — this tracks your current one.",
  },
};

function Glory() {
  const glory = useQuery({ queryKey: ["glory"], queryFn: fetchGlory });
  const navigate = useNavigate();
  const [pledge, setPledge] = useState(72);

  const start = useMutation({
    mutationFn: () => startLock({ pledgeHours: pledge || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["glory"] });
      toast.success("Caged. The key belongs to the order now.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not lock."),
  });
  const release = useMutation({
    mutationFn: () => releaseLock(),
    onSuccess: async (_res) => {
      await queryClient.invalidateQueries({ queryKey: ["glory"] });
      toast.success("Released. Hope you earned it.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not release."),
  });

  if (glory.isPending || !glory.data) {
    return <div className="h-96 animate-pulse rounded-2xl bg-surface" />;
  }

  const board: GloryBoard = glory.data;
  const { stats, flags } = board;

  const visible = ACHIEVEMENTS.filter((def) => audienceApplies(def.audience, flags));
  const tracks = [
    { id: "global", title: "The Order", icon: Spade },
    ...(flags.isKing ? [{ id: "bull", title: "King's Track", icon: Crown }] : []),
    ...(flags.isKneeler ? [{ id: "kneeler", title: "Kneeler's Track", icon: Key }] : []),
    ...(flags.isWife ? [{ id: "wife", title: "Hotwife Track", icon: Crown }] : []),
    ...(flags.isCuck ? [{ id: "cuck", title: "Cuckold Track", icon: Cage }] : []),
    ...(flags.intoChastity ? [{ id: "chastity", title: "Chastity Track", icon: Cage }] : []),
  ] as const;

  const rankProgress =
    board.nextRankAt != null
      ? Math.max(0, Math.min(1, board.points / board.nextRankAt))
      : 1;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl gold-card p-6 animate-fade-up">
        <div className="spade-veil pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-bg/60 animate-glow">
            <AchievementGlyph icon={board.rankIcon as never} className="size-9 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] tracking-[0.3em] text-accent uppercase">Your standing</p>
            <h1 className="font-display text-3xl leading-tight text-gold-gradient">{board.rankName}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {board.points} order points
              {board.nextRankName ? (
                <> · next: <span className="text-fg">{board.nextRankName}</span></>
              ) : (
                <> · crowned</>
              )}
            </p>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-bg/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-deep via-accent to-accent-bright transition-[width] duration-700"
              style={{ width: `${rankProgress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chastity lock card */}
      {flags.intoChastity ? (
        <LockCard
          board={board}
          pledge={pledge}
          setPledge={setPledge}
          onLock={() => start.mutate()}
          onRelease={() => release.mutate()}
          busy={start.isPending || release.isPending}
        />
      ) : (
        <div
          id={CAGE_ANCHOR}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface/60 p-4 text-sm text-muted"
        >
          <Cage className="size-7 shrink-0 text-accent/70" />
          <p>
            Add <span className="text-fg">Chastity</span> to your interests (or check sissy /
            whiteboi / cuck) to unlock the cage timer and the chastity orders.
          </p>
        </div>
      )}

      {/* Serve claims — a king's word moves the kneeler's "Serve Bulls" order */}
      {flags.isKing && board.serveApprovals.length ? <ServeApprovalsCard board={board} /> : null}
      {flags.isKneeler && stats.servesPending > 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface/60 p-4 text-sm text-muted">
          <Spade className="size-6 shrink-0 text-accent/70" />
          <p>
            {stats.servesPending} serve {stats.servesPending === 1 ? "claim" : "claims"} waiting on a
            king's word. Only his approval moves <span className="text-fg">Serve Bulls</span>.
          </p>
        </div>
      ) : null}

      {/* Achievement tracks */}
      {tracks.map((track) => {
        const defs = visible.filter((d) => d.track === track.id);
        if (!defs.length) return null;
        const TrackIcon = track.icon;
        return (
          <section key={track.id} className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <TrackIcon className="size-5 text-accent" />
              <h2 className="font-display text-xl tracking-wide text-fg">{track.title}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {defs.map((def) => {
                const state = evaluateAchievement(def, stats);
                const earned = state.earnedTier >= 0;
                const tierLabel =
                  state.earnedTier >= 0 ? def.tiers[state.earnedTier]!.label : "Locked";
                const nextLabel = state.nextTier !== null ? def.tiers[state.nextTier]!.label : null;
                const pursuit = PURSUITS[def.id];
                // Maxed orders are trophies; everything still in progress is a door.
                const clickable = state.nextTier !== null && !!pursuit;
                const pursue = () => {
                  if (!clickable || !pursuit) return;
                  if (pursuit.hint) toast(pursuit.hint);
                  if (pursuit.cage) {
                    document
                      .getElementById(CAGE_ANCHOR)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    return;
                  }
                  if (pursuit.to) void navigate({ to: pursuit.to });
                };
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={pursue}
                    disabled={!clickable}
                    aria-label={
                      clickable ? `${def.name} — ${pursuit!.label}` : def.name
                    }
                    className={cn(
                      "relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200",
                      earned
                        ? "gold-card"
                        : "border-border bg-surface/60 opacity-80",
                      clickable
                        ? "cursor-pointer hover:border-accent/50 hover:opacity-100 active:scale-[0.99]"
                        : "cursor-default",
                    )}
                  >
                    {earned ? (
                      <div className="spade-veil pointer-events-none absolute inset-0 opacity-40" />
                    ) : null}
                    <div className="relative flex items-start gap-3">
                      <div
                        className={cn(
                          "grid size-12 shrink-0 place-items-center rounded-xl",
                          earned ? "bg-accent/15 text-accent" : "bg-bg/60 text-subtle",
                        )}
                      >
                        <AchievementGlyph icon={def.icon} className="size-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base leading-tight text-fg">{def.name}</p>
                        <p className="mt-0.5 text-xs leading-snug text-muted">{def.blurb}</p>
                        <p
                          className={cn(
                            "mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.16em] uppercase",
                            earned ? "bg-accent text-accent-fg font-semibold" : "bg-elevated text-subtle",
                          )}
                        >
                          {tierLabel}
                          {earned ? ` · ${state.points}pt` : ""}
                        </p>
                      </div>
                    </div>
                    {/* progress */}
                    <div className="relative mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-bg/70">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-700",
                            earned ? "bg-accent" : "bg-accent/50",
                          )}
                          style={{ width: `${state.progress * 100}%` }}
                        />
                      </div>
                      <p className="mt-1.5 flex items-center justify-between text-[11px] text-subtle">
                        <span>
                          {fmtStat(def.stat, state.value)}
                        </span>
                        {nextLabel ? (
                          <span>
                            {state.nextTier !== null ? def.tiers[state.nextTier]!.at : ""} → {nextLabel}
                          </span>
                        ) : (
                          <span className="text-accent">Maxed</span>
                        )}
                      </p>
                    </div>
                    {clickable ? (
                      <p className="relative mt-2 text-[11px] font-medium tracking-[0.14em] text-accent uppercase">
                        {pursuit!.label} →
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] tracking-[0.24em] text-subtle uppercase">
        <Spade className="size-3.5" />
        The order is always watching · Black first
        <Spade className="size-3.5" />
      </p>
    </div>
  );
}

function fmtStat(stat: string, value: number): string {
  if (stat === "lockedHours" || stat === "currentLockHours") return fmtHours(value);
  if (stat === "onboarded" || stat === "wearsSpade") return value ? "Done" : "Not yet";
  return `${value}`;
}

function LockCard({
  board,
  pledge,
  setPledge,
  onLock,
  onRelease,
  busy,
}: {
  board: GloryBoard;
  pledge: number;
  setPledge: (n: number) => void;
  onLock: () => void;
  onRelease: () => void;
  busy: boolean;
}) {
  const lock = board.currentLock;
  // Ring circumference for r=26.
  const R = 26;
  const C = 2 * Math.PI * R;
  const frac = lock?.pledgeProgress ?? 0;
  const display = lock ? fmtHours(lock.elapsedHours) : "0h";

  return (
    <div id={CAGE_ANCHOR} className="mt-4 overflow-hidden rounded-3xl gold-card p-6 animate-fade-up">
      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative grid size-24 shrink-0 place-items-center">
          <svg viewBox="0 0 64 64" className="size-24 -rotate-90">
            <circle cx="32" cy="32" r={R} fill="none" strokeWidth="6" className="ring-track" />
            {lock ? (
              <circle
                cx="32"
                cy="32"
                r={R}
                fill="none"
                strokeWidth="6"
                className="ring-fill"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - (lock.pledgeHours ? frac : Math.min(1, lock.elapsedHours / 24)))}
              />
            ) : null}
          </svg>
          <div className="absolute grid size-12 place-items-center">
            {lock ? <Lock className="size-7 text-accent" /> : <LockOpen className="size-7 text-subtle" />}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-[0.3em] text-accent uppercase">The cage</p>
          {lock ? (
            <>
              <h2 className="font-display text-2xl text-gold-gradient">Locked · {display}</h2>
              <p className="text-sm text-muted">
                {lock.pledgeHours
                  ? `Pledged ${fmtHours(lock.pledgeHours)} · ${Math.round(frac * 100)}% served`
                  : "Indefinite lock · the holder keeps the key"}
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl text-fg">Not caged</h2>
              <p className="text-sm text-muted">Lock up and earn your chastity orders.</p>
            </>
          )}
        </div>
      </div>

      {lock ? (
        <Button
          variant="outline"
          className="mt-5 w-full"
          disabled={busy}
          onClick={onRelease}
        >
          <Key className="size-4" /> Release the lock
        </Button>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Pledge your service</p>
          <div className="flex flex-wrap gap-2">
            {PLEDGES.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPledge(p.hours)}
                className={cn(
                  "h-10 rounded-full px-4 text-sm transition-transform duration-150 active:scale-95",
                  pledge === p.hours ? "btn-gold" : "bg-elevated text-muted hover:text-fg",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button className="btn-gold mt-4 w-full" disabled={busy} onClick={onLock}>
            <Cage className="size-4" /> Lock me in
          </Button>
        </div>
      )}
    </div>
  );
}

/** Pending serve claims addressed to a bull — his ruling is the only score. */
function ServeApprovalsCard({ board }: { board: GloryBoard }) {
  const decide = useMutation({
    mutationFn: ({ serveId, approve }: { serveId: number; approve: boolean }) =>
      decideServe(serveId, approve),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["glory"] });
      toast.success(res.approved ? "Approved. She earned it." : "Denied. Standards.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rule on it."),
  });

  return (
    <div className="mt-4 rounded-2xl border border-accent/30 bg-surface/60 p-4">
      <div className="flex items-center gap-2">
        <Crown className="size-5 text-accent" />
        <h2 className="font-display text-lg tracking-wide text-fg">Claims of service</h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        They say they served you. Your word is what makes it count.
      </p>
      <ul className="mt-3 space-y-2">
        {board.serveApprovals.map((claim) => (
          <li
            key={claim.id}
            className="flex items-center gap-3 rounded-xl bg-elevated/60 px-3 py-2.5"
          >
            <Avatar src={claim.kneeler.photo} name={claim.kneeler.displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg">{claim.kneeler.displayName}</p>
              <p className="truncate text-xs text-subtle">@{claim.kneeler.handle}</p>
            </div>
            <Button
              size="sm"
              variant="accent"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ serveId: claim.id, approve: true })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ serveId: claim.id, approve: false })}
            >
              Deny
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
