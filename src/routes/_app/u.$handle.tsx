import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Heart, MessageCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PhotoViewer } from "@/components/photo-viewer";
import { Button } from "@/components/ui/button";
import { formatMiles } from "@/lib/geo";
import { queryClient } from "@/lib/query-client";
import { openConversation } from "@/lib/server/messages";
import { getMyProfile, getProfileForViewer } from "@/lib/server/profiles";
import { toggleFollow, toggleLike } from "@/lib/server/social";
import { identityLine, pronounLine, shownAge } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/u/$handle")({ component: ProfilePage });

function ProfilePage() {
  const { handle } = Route.useParams();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const profile = useQuery({
    queryKey: ["profile", handle],
    queryFn: () => getProfileForViewer({ data: handle }),
  });

  const like = useMutation({
    mutationFn: () => toggleLike({ data: profile.data!.userId }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["profile", handle] });
      await queryClient.invalidateQueries({ queryKey: ["likes"] });
      await queryClient.invalidateQueries({ queryKey: ["discover"] });
      if (res.matched) toast.success("It's a match.");
    },
  });
  const follow = useMutation({
    mutationFn: () => toggleFollow({ data: profile.data!.userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile", handle] }),
  });
  const message = useMutation({
    mutationFn: () => openConversation({ data: profile.data!.userId }),
    onSuccess: (res) => navigate({ to: "/inbox/$id", params: { id: String(res.id) } }),
    onError: (err: Error) => toast.error(err.message),
  });

  const p = profile.data;
  if (profile.isPending) {
    return <div className="mx-auto max-w-lg aspect-[3/4] animate-pulse rounded-xl bg-surface" />;
  }
  if (!p) {
    return <p className="py-20 text-center text-muted">This profile doesn't exist.</p>;
  }

  const mine = me.data?.userId === p.userId;
  const age = shownAge(p);
  const ident = identityLine(p);
  const pronouns = pronounLine(p);
  const distance = formatMiles(p.distanceMiles);

  return (
    <div className="mx-auto max-w-lg animate-fade-up">
      <PhotoViewer photos={p.photos} name={p.displayName} />
      {p.photos.length > 1 ? (
        <p className="mt-2 text-center text-[11px] tracking-wide text-subtle uppercase">
          Tap left or right to flip looks
        </p>
      ) : null}

      <div className="relative z-10 mt-5">
        <h1 className="font-display text-5xl leading-[0.92]">
          {p.displayName}
          {age ? <span className="ml-2 font-sans text-2xl text-muted">{age}</span> : null}
        </h1>
        <p className="mt-1 text-sm text-muted">
          @{p.handle}
          {ident ? ` · ${ident}` : ""}
          {pronouns ? ` · ${pronouns}` : ""}
        </p>
        {p.location ? (
          <p className="mt-1 text-sm text-muted">
            {p.location}
            {distance ? ` · ${distance}` : ""}
          </p>
        ) : null}
        {p.lookingFor ? (
          <p className="mt-3 inline-flex rounded-full bg-elevated px-3 py-1 text-xs text-muted">
            Looking for {p.lookingFor.toLowerCase()}
          </p>
        ) : null}
        {p.bio ? <p className="mt-4 text-[15px] leading-relaxed text-fg">{p.bio}</p> : null}
        {p.interests.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {p.interests.map((tag) => (
              <span key={tag} className="rounded-full bg-elevated px-3 py-1 text-xs text-muted">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {mine ? (
          <Link to="/me" className="mt-6 block">
            <Button variant="outline" className="w-full">
              Edit profile
            </Button>
          </Link>
        ) : (
          <div className="mt-6 flex gap-2">
            <Button
              className="flex-1"
              variant={p.likedByMe ? "accent" : "outline"}
              onClick={() => like.mutate()}
            >
              <Heart className={cn("size-4", p.likedByMe && "fill-current")} />
              {p.likedByMe ? "Liked" : "Like"}
            </Button>
            <Button className="flex-1" onClick={() => message.mutate()} disabled={message.isPending}>
              <MessageCircle className="size-4" />
              Message
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={p.following ? "Following" : "Follow"}
              onClick={() => follow.mutate()}
            >
              <UserPlus className={cn("size-4", p.following && "text-accent")} />
            </Button>
          </div>
        )}
        {p.matched ? (
          <p className="mt-3 text-center text-sm text-accent">You matched. Say something.</p>
        ) : null}
      </div>
    </div>
  );
}
