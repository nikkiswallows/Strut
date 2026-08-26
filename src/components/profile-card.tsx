import { Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";

export function ProfileCard({
  profile,
  onLike,
  compact = false,
}: {
  profile: Profile;
  onLike?: (profile: Profile) => void;
  compact?: boolean;
}) {
  const photo = profile.photos[0];
  return (
    <article className="group relative overflow-hidden rounded-xl bg-surface">
      <Link to="/u/$handle" params={{ handle: profile.handle }} className="block">
        <div className={cn("relative overflow-hidden", compact ? "aspect-[3/4]" : "aspect-[3/4]")}>
          <Photo
            src={photo}
            alt={profile.displayName}
            name={profile.displayName}
            className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="font-display text-xl leading-tight text-fg">
              {profile.displayName}
              {profile.age ? (
                <span className="ml-1 font-sans text-sm text-muted">{profile.age}</span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {profile.identity ? `${profile.identity} · ` : ""}
              {profile.location ?? "Nearby"}
            </p>
          </div>
        </div>
      </Link>
      {onLike ? (
        <button
          type="button"
          aria-label={profile.likedByMe ? "Unlike" : "Like"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLike(profile);
          }}
          className={cn(
            "absolute top-2.5 right-2.5 grid size-10 place-items-center rounded-full backdrop-blur-sm transition-colors duration-150",
            profile.likedByMe
              ? "bg-accent text-accent-fg"
              : "bg-bg/45 text-fg hover:bg-bg/70",
          )}
        >
          <Heart className={cn("size-4", profile.likedByMe && "fill-current")} />
        </button>
      ) : null}
    </article>
  );
}
