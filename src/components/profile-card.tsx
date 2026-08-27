import { Heart } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, type MouseEvent } from "react";
import { formatMiles } from "@/lib/geo";
import { badgeFor } from "@/lib/bnwo";
import { asPhotoList, identityLine, shownAge, type Profile } from "@/lib/types";
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
  const photos = asPhotoList(profile.photos);
  const [index, setIndex] = useState(0);
  const photo = photos[Math.min(index, Math.max(photos.length - 1, 0))];
  const age = shownAge(profile);
  const distance = formatMiles(profile.distanceMiles);
  const ident = identityLine(profile);
  const feed = layout === "feed";
  const count = photos.length;
  const badge = badgeFor(profile);

  function cycle(next: number, event: MouseEvent) {
    if (count < 2) return;
    event.preventDefault();
    event.stopPropagation();
    setIndex((next + count) % count);
  }

  return (
    <article
      className={cn(
        "group relative overflow-hidden bg-surface transition-transform duration-150 ease-out",
        feed ? "rounded-2xl" : "rounded-xl",
      )}
    >
      <div className={cn("relative overflow-hidden", feed ? "aspect-[4/5]" : "aspect-[3/4]")}>
        <Photo
          src={photo}
          alt={profile.displayName}
          name={profile.displayName}
          className="absolute inset-0 size-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
        {badge ? (
          <span className="absolute top-3 left-3 z-[3] rounded-full border border-accent/50 bg-bg/70 px-2 py-0.5 text-[10px] tracking-[0.18em] text-accent uppercase backdrop-blur-sm">
            {badge}
          </span>
        ) : null}
        {count > 1 ? (
          <>
            <div className="absolute inset-x-4 top-3 z-10 flex gap-1 pr-12">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={cn("h-0.5 flex-1 rounded-full", i === index ? "bg-fg" : "bg-fg/30")}
                />
              ))}
            </div>
            <div className="absolute inset-0 z-[1] flex">
              <button
                type="button"
                className="w-1/3"
                aria-label="Previous photo"
                onClick={(e) => cycle(index - 1, e)}
              />
              <Link
                to="/u/$handle"
                params={{ handle: profile.handle }}
                className="flex-1"
                aria-label={`Open ${profile.displayName}`}
              />
              <button
                type="button"
                className="w-1/3"
                aria-label="Next photo"
                onClick={(e) => cycle(index + 1, e)}
              />
            </div>
          </>
        ) : (
          <Link
            to="/u/$handle"
            params={{ handle: profile.handle }}
            className="absolute inset-0 z-[1]"
            aria-label={`Open ${profile.displayName}`}
          />
        )}
        <Link
          to="/u/$handle"
          params={{ handle: profile.handle }}
          className={cn("absolute inset-x-0 bottom-0 z-[2]", feed ? "p-4" : "p-3")}
        >
          <p className={cn("leading-tight text-fg", feed ? "font-display text-3xl" : "font-display text-xl")}>
            {profile.displayName}
            {age ? (
              <span className={cn("ml-1.5 font-sans text-muted", feed ? "text-base" : "text-sm")}>
                {age}
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {[ident, profile.role, distance ?? profile.location?.split(",")[0] ?? "Nearby"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Link>
      </div>
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
            "absolute top-2.5 right-2.5 z-[3] grid size-11 place-items-center rounded-full backdrop-blur-sm transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.96]",
            profile.likedByMe ? "bg-accent text-accent-fg" : "bg-bg/45 text-fg hover:bg-bg/70",
          )}
        >
          <Heart
            className={cn("size-4 transition-transform duration-150", profile.likedByMe && "fill-current scale-110")}
          />
        </button>
      ) : null}
    </article>
  );
}
