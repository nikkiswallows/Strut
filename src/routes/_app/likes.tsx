import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ProfileCard } from "@/components/profile-card";
import { queryClient } from "@/lib/query-client";
import { app } from "@/lib/http";
import type { LikeBundle, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/likes")({ component: Likes });

function Likes() {
  const [tab, setTab] = useState<"matches" | "incoming" | "outgoing">("matches");
  const likes = useQuery({ queryKey: ["likes"], queryFn: () => app<LikeBundle>("likes") });
  const like = useMutation({
    mutationFn: (p: Profile) => app("like", { userId: p.userId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["likes"] });
      void queryClient.invalidateQueries({ queryKey: ["discover"] });
    },
  });

  const data = likes.data;
  const lists = {
    matches: data?.matches ?? [],
    incoming: data?.incoming ?? [],
    outgoing: data?.outgoing ?? [],
  };
  const active = lists[tab];

  return (
    <div>
      <h1 className="font-display text-4xl">Claimed</h1>
      <p className="mt-1 text-sm text-muted">Who you knelt for. Who bred her. Mutual likes are matches.</p>
      <div className="mt-5 flex gap-1 rounded-full bg-elevated p-1">
        {(
          [
            ["matches", "Matches"],
            ["incoming", "Liked you"],
            ["outgoing", "You liked"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-full py-2 text-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
              tab === key ? "bg-fg text-bg" : "text-muted",
            )}
          >
            {label}
            <span className="ml-1 text-xs opacity-70">{lists[key].length}</span>
          </button>
        ))}
      </div>
      {likes.isPending ? (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <p className="py-16 text-center text-muted">
          {tab === "matches"
            ? "No matches yet. Like a king who already wants the hole."
            : tab === "incoming"
              ? "Nobody claimed you yet. Better photos. Clearer kneeling."
              : "You haven't liked anyone. Point at a bull or a wife and mean it."}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {active.map((p) => (
            <ProfileCard
              key={p.userId}
              profile={p}
              onLike={tab === "incoming" ? (prof) => like.mutate(prof) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
