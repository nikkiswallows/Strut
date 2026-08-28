import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Heart, ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { app } from "@/lib/http";
import { fetchMyProfile } from "@/lib/profile-api";
import { queryClient } from "@/lib/query-client";
import type { FeedPost } from "@/lib/types";
import { uploadPhotoFile } from "@/lib/media";
import { cn, timeAgo } from "@/lib/utils";

export const Route = createFileRoute("/_app/feed")({ component: Feed });

function Feed() {
  const [body, setBody] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: () => fetchMyProfile() });
  const feed = useQuery({ queryKey: ["feed"], queryFn: () => app<FeedPost[]>("feed") });

  const post = useMutation({
    mutationFn: () => app("createPost", { body, photoUrl }),
    onSuccess: async () => {
      setBody("");
      setPhotoUrl(null);
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const like = useMutation({
    mutationFn: (id: number) => app("postLike", { postId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  async function onFile(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadPhotoFile(file);
      setPhotoUrl(uploaded.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload that photo.");
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-display text-4xl">The room</h1>
      <p className="mt-1 text-sm text-muted">
        Looks, cages, leftover filth. Whitebois on display. Wives after the king. Black first.
      </p>

      <form
        className="mt-6 rounded-xl border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          post.mutate();
        }}
      >
        <div className="flex gap-3">
          <Avatar src={me.data?.photos[0]} name={me.data?.displayName || ""} />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Cage on? QOS out? Kneeling for who tonight?"
            className="min-h-20 bg-elevated"
            maxLength={400}
          />
        </div>
        {photoUrl ? (
          <div className="relative mt-3 overflow-hidden rounded-lg">
            <img src={photoUrl} alt="" className="max-h-64 w-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => setPhotoUrl(null)}
              className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-bg/70 text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:bg-elevated hover:text-fg">
            <ImagePlus className="size-4" />
            Photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFile(e.target.files)}
            />
          </label>
          <Button type="submit" size="sm" disabled={!body.trim() || post.isPending}>
            Post
          </Button>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {(feed.data ?? []).map((item) => (
          <article key={item.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <Link to="/u/$handle" params={{ handle: item.author.handle }}>
                <Avatar src={item.author.photo} name={item.author.displayName} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/u/$handle"
                  params={{ handle: item.author.handle }}
                  className="font-medium hover:underline"
                >
                  {item.author.displayName}
                </Link>
                <p className="text-xs text-subtle">
                  @{item.author.handle} · {timeAgo(item.createdAt)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed">{item.body}</p>
            {item.photoUrl ? (
              <Photo
                src={item.photoUrl}
                alt=""
                className="mt-3 max-h-96 w-full rounded-lg object-cover"
              />
            ) : null}
            <button
              type="button"
              onClick={() => like.mutate(item.id)}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 text-sm",
                item.likedByMe ? "text-accent" : "text-muted",
              )}
            >
              <Heart className={cn("size-4", item.likedByMe && "fill-current")} />
              {item.likeCount}
            </button>
          </article>
        ))}
        {feed.isError ? (
          <div className="mt-6 py-10 text-center">
            <p className="text-muted">Could not load the feed.</p>
            <button
              type="button"
              onClick={() => void feed.refetch()}
              className="mt-4 h-11 rounded-full bg-elevated px-5 text-sm"
            >
              Try again
            </button>
          </div>
        ) : null}
        {!feed.isPending && !feed.isError && (feed.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            The Room is quiet. Post the look. Whitebois belong on display.
          </p>
        ) : null}
        {feed.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
