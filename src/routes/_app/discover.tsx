import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProfileCard } from "@/components/profile-card";
import { Input } from "@/components/ui/input";
import { queryClient } from "@/lib/query-client";
import { listDiscover } from "@/lib/server/profiles";
import { toggleLike } from "@/lib/server/social";
import { IDENTITIES, LOOKING_FOR, type Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/discover")({ component: Discover });

function Discover() {
  const [identity, setIdentity] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");

  const profiles = useQuery({
    queryKey: ["discover", identity, lookingFor, q],
    queryFn: () => listDiscover({ data: { identity, lookingFor, q } }),
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

  return (
    <div>
      <div className="mb-5">
        <p className="text-xs tracking-[0.22em] text-subtle uppercase">Nearby</p>
        <h1 className="font-display text-4xl">Discover</h1>
      </div>

      <form
        className="relative mb-4"
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

      <div className="hide-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          label="All"
          active={!identity && !lookingFor}
          onClick={() => {
            setIdentity("");
            setLookingFor("");
          }}
        />
        {IDENTITIES.map((id) => (
          <FilterChip
            key={id}
            label={id}
            active={identity === id}
            onClick={() => setIdentity(identity === id ? "" : id)}
          />
        ))}
        {LOOKING_FOR.map((lf) => (
          <FilterChip
            key={lf}
            label={lf}
            active={lookingFor === lf}
            onClick={() => setLookingFor(lookingFor === lf ? "" : lf)}
          />
        ))}
      </div>

      {profiles.isError ? (
        <p className="py-16 text-center text-muted">Could not load people. Try again.</p>
      ) : profiles.isPending ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : (profiles.data ?? []).length === 0 ? (
        <p className="py-16 text-center text-muted">Nobody matches those filters yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {(profiles.data ?? []).map((p) => (
            <ProfileCard key={p.userId} profile={p} onLike={(prof) => like.mutate(prof)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-3.5 text-sm",
        active ? "bg-fg text-bg" : "bg-elevated text-muted",
      )}
    >
      {label}
    </button>
  );
}
