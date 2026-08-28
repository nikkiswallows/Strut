import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Grid2x2, Layers, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProfileCard } from "@/components/profile-card";
import { SwipeDeck } from "@/components/swipe-deck";
import { MatchCelebration } from "@/components/match-celebration";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/query-client";
import { app } from "@/lib/http";
import { useMembership } from "@/lib/auth/use-membership";
import { postOpenChat } from "@/lib/messages-api";
import {
  DISCOVER_TABS,
  ETHNICITIES,
  LOOKING_FOR,
  MILE_STOPS,
  ROLES,
  type DiscoverTab,
  type Profile,
} from "@/lib/types";
import { discoverEmpty } from "@/lib/bnwo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/discover")({ component: Discover });

type DiscoverPage = { items: Profile[]; nextCursor: string | null };

function Discover() {
  const { profile: meProfile } = useMembership();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Profile | null>(null);
  const [matchFire, setMatchFire] = useState(0);
  const [tab, setTab] = useState<DiscoverTab>("nearby");
  const [miles, setMiles] = useState(100);
  const [lookingFor, setLookingFor] = useState("");
  const [role, setRole] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<"grid" | "deck">("deck");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const queryKey = ["discover", tab, miles, lookingFor, role, q, ethnicity] as const;
  const profiles = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      app<DiscoverPage>("discover", {
        tab,
        miles,
        lookingFor,
        role,
        ethnicity,
        q,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(
    () => (profiles.data?.pages ?? []).flatMap((p) => p.items),
    [profiles.data],
  );
  const hasNext = Boolean(profiles.hasNextPage);

  useEffect(() => {
    if (!hasNext || profiles.isFetchingNextPage) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void profiles.fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, profiles.isFetchingNextPage, profiles]);

  const like = useMutation({
    mutationFn: (p: Profile) => app<{ liked: boolean; matched: boolean }>("like", { userId: p.userId }),
    onMutate: async (p) => {
      await queryClient.cancelQueries({ queryKey: ["discover"] });
      const key = queryKey;
      const prev = queryClient.getQueryData<{ pages: DiscoverPage[]; pageParams: unknown[] }>(key);
      if (prev) {
        queryClient.setQueryData(key, {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            items: page.items.map((row) =>
              row.userId === p.userId
                ? { ...row, likedByMe: !row.likedByMe, matched: !row.likedByMe && Boolean(row.likesMe) }
                : row,
            ),
          })),
        });
      }
      return { prev, key };
    },
    onSuccess: (res, p) => {
      void queryClient.invalidateQueries({ queryKey: ["discover"] });
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["glory"] });
      if (res.matched) {
        setMatch(p);
        setMatchFire((n) => n + 1);
      }
    },
    onError: (err: Error, _p, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(ctx.key, ctx.prev);
      toast.error(err.message);
    },
  });

  const deckQueryKey = ["deck", tab, miles, lookingFor, role, q, ethnicity] as const;
  const deck = useInfiniteQuery({
    queryKey: deckQueryKey,
    queryFn: ({ pageParam }) =>
      app<DiscoverPage>("deck", {
        tab,
        miles,
        lookingFor,
        role,
        ethnicity,
        q,
        cursor: pageParam ?? undefined,
        limit: 40,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: mode === "deck",
    placeholderData: keepPreviousData,
  });
  const deckRows = useMemo(
    () => (deck.data?.pages ?? []).flatMap((p) => p.items),
    [deck.data],
  );

  const swipe = useMutation({
    mutationFn: ({ targetId, direction }: { targetId: string; direction: "like" | "pass" }) =>
      app<{ ok: true; matched: boolean }>("swipe", { targetId, direction }),
    onSuccess: (res, { direction, targetId }) => {
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["discover"] });
      void queryClient.invalidateQueries({ queryKey: ["glory"] });
      if (direction === "like" && res.matched) {
        const matchedProfile = deckRows.find((r) => r.userId === targetId);
        if (matchedProfile) {
          setMatch(matchedProfile);
          setMatchFire((n) => n + 1);
        } else {
          toast.success("You matched.");
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const undo = useMutation({
    mutationFn: ({ targetId }: { targetId: string }) =>
      app<{ ok: true; undone: boolean }>("undo", { targetId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const milesLabel = miles >= 500 ? "Any distance" : `Within ${miles} mi`;
  const activeTab = DISCOVER_TABS.find((t) => t.id === tab) ?? DISCOVER_TABS[0]!;
  const filterBits = useMemo(
    () => [activeTab.label, lookingFor && `looking for ${lookingFor.toLowerCase()}`, ethnicity, role, milesLabel].filter(Boolean),
    [activeTab.label, lookingFor, ethnicity, role, milesLabel],
  );

  return (
    <div
      className={cn(
        "flex flex-col",
        // Deck mode claims the full viewport (below the app header) so the deck
        // can flex-fill the leftover space and the action buttons stay above
        // the bottom nav. Grid mode keeps the normal scrollable min-height.
        mode === "deck" ? "h-[calc(100dvh-4.5rem-env(safe-area-inset-top))] lg:h-auto" : "min-h-[calc(100dvh-8rem)]",
      )}
    >
      {/* Header block — compact on mobile so tabs don't get clipped */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.28em] text-accent uppercase">BNWO · Kings first</p>
          <h1 className="font-display text-[2.6rem] leading-[0.9] sm:text-5xl">The order</h1>
          <p className="mt-1 max-w-[32ch] text-[13px] leading-snug text-muted sm:text-sm">
            Bulls. Sissies. Wives. Cucks. Whitebois already on Bottom.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-full bg-elevated p-1">
            <button
              type="button"
              aria-label="Deck view"
              onClick={() => setMode("deck")}
              className={cn(
                "grid size-9 place-items-center rounded-full transition-transform duration-150 ease-out active:scale-[0.96]",
                mode === "deck" ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              <Layers className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setMode("grid")}
              className={cn(
                "grid size-9 place-items-center rounded-full transition-transform duration-150 ease-out active:scale-[0.96]",
                mode === "grid" ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              <Grid2x2 className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-elevated px-4 text-[13px] text-muted transition-transform duration-150 ease-out hover:text-fg active:scale-[0.96] sm:h-11 sm:text-sm"
          >
            <SlidersHorizontal className="size-4" />
            {milesLabel}
          </button>
        </div>
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
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value.trim()) setQ("");
          }}
          placeholder="Search names, cities…"
          className="pl-10"
        />
      </form>

      {/* Sticky tabs — offset matches the header height plus the iOS status bar */}
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-4 mb-3 border-b border-border bg-bg/95 px-4 backdrop-blur-md lg:top-0">
        <div className="hide-scrollbar flex gap-1 overflow-x-auto py-0.5">
          {DISCOVER_TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "relative h-11 shrink-0 px-3.5 text-[13px] font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.96] sm:h-12 sm:text-sm",
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

      {lookingFor || role || ethnicity ? (
        <p className="mb-3 text-xs text-subtle">{filterBits.join(" · ")}</p>
      ) : null}

      {mode === "deck" ? (
        <div className="-mx-4 flex min-h-0 flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:-mx-0">
          {deck.isError && deckRows.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted">Could not load the deck.</p>
              <button
                type="button"
                onClick={() => void deck.refetch()}
                className="mt-4 h-11 rounded-full bg-elevated px-5 text-sm text-fg transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                Try again
              </button>
            </div>
          ) : deck.isPending && deckRows.length === 0 ? (
            <div className="flex-1 animate-pulse rounded-3xl bg-surface" />
          ) : (
            <div className="relative min-h-0 flex-1 lg:h-[min(68vh,680px)] lg:flex-none">
              {/* The deck fills the leftover space between the tabs and the bottom
                  nav, so the pass/like/undo buttons are always on screen. */}
              <div className="absolute inset-0 lg:static lg:h-full">
                <SwipeDeck
                  key={`${tab}|${miles}|${lookingFor}|${role}|${ethnicity}|${q}`}
                  profiles={deckRows}
                  onSwipe={(profile, direction) => swipe.mutate({ targetId: profile.userId, direction })}
                  onUndo={(profile) => undo.mutate({ targetId: profile.userId })}
                  onOpenProfile={(profile) =>
                    void navigate({ to: "/u/$handle", params: { handle: profile.handle } })
                  }
                  onNeedMore={() => {
                    if (deck.hasNextPage && !deck.isFetchingNextPage) void deck.fetchNextPage();
                  }}
                  loadingMore={deck.isFetchingNextPage}
                  hasMore={Boolean(deck.hasNextPage)}
                  emptyLabel="No one to kneel for yet. Widen it."
                />
              </div>
            </div>
          )}
        </div>
      ) : profiles.isError && !rows.length && /unauthorized/i.test(profiles.error instanceof Error ? profiles.error.message : "") ? (
        <Navigate to="/login" />
      ) : profiles.isError && !rows.length ? (
        <div className="py-16 text-center">
          <p className="text-muted">Could not load people.</p>
          <button
            type="button"
            onClick={() => void profiles.refetch()}
            className="mt-4 h-11 rounded-full bg-elevated px-5 text-sm text-fg transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            Try again
          </button>
        </div>
      ) : profiles.isPending && !rows.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-muted">{discoverEmpty(tab)}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 stagger-in">
            {rows.map((p) => (
              <ProfileCard key={p.userId} profile={p} layout="feed" onLike={(prof) => like.mutate(prof)} />
            ))}
          </div>
          <div ref={sentinelRef} className="py-6 text-center">
            {profiles.isFetchingNextPage ? (
              <p className="text-sm text-subtle">Loading more…</p>
            ) : hasNext ? (
              <button
                type="button"
                onClick={() => void profiles.fetchNextPage()}
                className="h-11 rounded-full bg-elevated px-5 text-sm text-muted transition-transform duration-150 ease-out hover:text-fg active:scale-[0.96]"
              >
                Load more
              </button>
            ) : (
              <p className="text-sm text-subtle">The order thins out here.</p>
            )}
          </div>
        </>
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
            <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">Looking for</p>
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
            <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">Ethnicity</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEthnicity("")}
                className={cn(
                  "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                  !ethnicity ? "bg-fg text-bg" : "bg-elevated text-muted",
                )}
              >
                Any
              </button>
              {ETHNICITIES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEthnicity(ethnicity === e ? "" : e)}
                  className={cn(
                    "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                    ethnicity === e ? "bg-fg text-bg" : "bg-elevated text-muted",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              Top / bottom / switch
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRole("")}
                className={cn(
                  "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                  !role ? "bg-fg text-bg" : "bg-elevated text-muted",
                )}
              >
                Any
              </button>
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(role === r ? "" : r)}
                  className={cn(
                    "h-10 rounded-full px-3.5 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
                    role === r ? "bg-fg text-bg" : "bg-elevated text-muted",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="mt-6 h-12 w-full rounded-lg bg-fg text-sm font-medium text-bg transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              Serve the order
            </button>
          </div>
        </div>
      ) : null}

      <MatchCelebration
        match={match}
        mePhoto={meProfile?.photos?.[0]}
        meName={meProfile?.displayName}
        fire={matchFire}
        onClose={() => setMatch(null)}
        onMessage={async (otherUserId) => {
          try {
            const { id } = await postOpenChat(otherUserId);
            setMatch(null);
            await navigate({ to: "/inbox/$id", params: { id: String(id) } });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not open the chat.");
          }
        }}
      />
    </div>
  );
}
