import { Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatMiles } from "@/lib/geo";
import { identityLine, shownAge, type Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";

export function ProfileCard({
  profile,
  onLike,
  layout = "grid",
}: {
  profile: Profile;
  onLike?: (profile: Profile) => void;
  layout?: "grid" | "feed";
}) {
  const photo = profile.photos[0];
  const age = shownAge(profile);
  const distance = formatMiles(profile.distanceMiles);
  const ident = identityLine(profile);
  const feed = layout === "feed";

  return (
    <article
      className={cn(
        "group relative overflow-hidden bg-surface transition-transform duration-150 ease-out",
        feed ? "rounded-2xl" : "rounded-xl",
      )}
    >
      <Link to="/u/$handle" params={{ handle: profile.handle }} className="block">
        <div className={cn("relative overflow-hidden", feed ? "aspect-[4/5]" : "aspect-[3/4]")}>
          <Photo
            src={photo}
            alt={profile.displayName}
            name={profile.displayName}
            className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
          <div className={cn("absolute inset-x-0 bottom-0", feed ? "p-4" : "p-3")}>
            <p className={cn("leading-tight text-fg", feed ? "font-display text-3xl" : "font-display text-xl")}>
              {profile.displayName}
              {age ? (
                <span className={cn("ml-1.5 font-sans text-muted", feed ? "text-base" : "text-sm")}>
                  {age}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {[ident, distance ?? profile.location?.split(",")[0] ?? "Nearby"]
                .filter(Boolean)
                .join(" · ")}
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
            "absolute top-2.5 right-2.5 grid size-11 place-items-center rounded-full backdrop-blur-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
            profile.likedByMe
              ? "bg-accent text-accent-fg"
              : "bg-bg/45 text-fg hover:bg-bg/70",
          )}
        >
          <Heart className={cn("size-4 transition-transform duration-150", profile.likedByMe && "fill-current scale-110")} />
        </button>
      ) : null}
    </article>
  );
}
