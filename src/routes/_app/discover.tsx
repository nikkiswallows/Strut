import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileCard } from "@/components/profile-card";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/query-client";
import { listDiscover } from "@/lib/server/profiles";
import { toggleLike } from "@/lib/server/social";
import { DISCOVER_TABS, LOOKING_FOR, MILE_STOPS, type DiscoverTab, type Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/discover")({ component: Discover });

function Discover() {
  const [tab, setTab] = useState<DiscoverTab>("nearby");
  const [miles, setMiles] = useState(50);
  const [lookingFor, setLookingFor] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const profiles = useQuery({
    queryKey: ["discover", tab, miles, lookingFor, q],
    queryFn: () => listDiscover({ data: { tab, miles, lookingFor, q } }),
  });

  const like = useMutation({
    mutationFn: (p: Profile) => toggleLike({ data: p.userId }),
    onSuccess: (res, p) => {
      void queryClient.invalidateQueries({ queryKey: ["discover"] });
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      if (res.matched) toast.success(`You and ${p.displayName} matched.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const milesLabel = miles >= 500 ? "Any distance" : `Within ${miles} mi`;
  const activeTab = DISCOVER_TABS.find((t) => t.id === tab) ?? DISCOVER_TABS[0]!;

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.28em] text-accent uppercase">Strut</p>
          <h1 className="font-display text-5xl leading-[0.9]">Discover</h1>
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-elevated px-4 text-sm text-muted transition-transform duration-150 ease-out hover:text-fg active:scale-[0.96]"
        >
          <SlidersHorizontal className="size-4" />
          {milesLabel}
        </button>
      </div>

      <form
        className="relative mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draft.trim());
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search names, cities…"
          className="pl-10"
        />
      </form>

      <div className="sticky top-14 z-10 -mx-4 mb-4 border-b border-border bg-bg/95 px-4 backdrop-blur-md lg:top-0">
        <div className="hide-scrollbar flex gap-1 overflow-x-auto">
          {DISCOVER_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative h-12 shrink-0 px-3.5 text-sm font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.96]",
                  active ? "text-fg" : "text-subtle hover:text-muted",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent transition-transform duration-200 origin-center",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {lookingFor ? (
        <p className="mb-3 text-xs text-subtle">
          {activeTab.label} · looking for {lookingFor.toLowerCase()} · {milesLabel}
        </p>
      ) : null}

      {profiles.isError ? (
        <p className="py-16 text-center text-muted">Could not load people. Try again.</p>
      ) : profiles.isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : (profiles.data ?? []).length === 0 ? (
        <p className="py-16 text-center text-muted">
          Nobody in {activeTab.label.toLowerCase()} within this distance yet. Widen the radius.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 stagger-in">
          {(profiles.data ?? []).map((p) => (
            <ProfileCard key={p.userId} profile={p} layout="feed" onLike={(prof) => like.mutate(prof)} />
          ))}
        </div>
      )}

      {filtersOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-overlay"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-sheet-up">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-2xl">Filters</p>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="grid size-10 place-items-center rounded-full bg-elevated transition-transform duration-150 ease-out active:scale-[0.96]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Distance</p>
            <div className="flex flex-wrap gap-2">
              {MILE_STOPS.map((stop) => (
                <button
                  key={stop}
                  type="button"
                  onClick={() => setMiles(stop)}
                  className={cn(
                    "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                    miles === stop ? "bg-fg text-bg" : "bg-elevated text-muted",
                  )}
                >
                  {stop >= 500 ? "Any" : `${stop} mi`}
                </button>
              ))}
            </div>
            <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              Looking for
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLookingFor("")}
                className={cn(
                  "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                  !lookingFor ? "bg-fg text-bg" : "bg-elevated text-muted",
                )}
              >
                Anyone
              </button>
              {LOOKING_FOR.map((lf) => (
                <button
                  key={lf}
                  type="button"
                  onClick={() => setLookingFor(lookingFor === lf ? "" : lf)}
                  className={cn(
                    "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                    lookingFor === lf ? "bg-fg text-bg" : "bg-elevated text-muted",
                  )}
                >
                  {lf}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-6 h-12 w-full rounded-lg bg-fg text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              Show people
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
