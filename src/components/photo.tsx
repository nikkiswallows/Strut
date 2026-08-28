import { useState } from "react";
import { cn, initials } from "@/lib/utils";

/**
 * Discreet rendering: photos render blurred with a small hint chip until the
 * viewer taps to reveal. Used for profiles that opted into discreet mode
 * (closeted/married users) in the deck, grids, and lists. A reveal lasts for
 * the component's life only — nothing persists, so glancing at someone's
 * phone never outs a member.
 */
export function Photo({
  src,
  alt,
  className,
  name,
  discreet = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  name?: string;
  discreet?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  if (!src) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-elevated text-muted font-display text-2xl",
          className,
        )}
        aria-label={alt}
      >
        {initials(name || alt)}
      </div>
    );
  }

  // Hidden state: the button takes over the caller's layout classes so the
  // blurred photo occupies exactly the box the real photo would have.
  if (discreet && !revealed) {
    return (
      <button
        type="button"
        onClick={(e) => {
          // Reveal without triggering a parent card's tap action (photo cycle,
          // profile open).
          e.stopPropagation();
          e.preventDefault();
          setRevealed(true);
        }}
        className={cn("relative block overflow-hidden", className)}
        aria-label="Discreet photo — tap to reveal"
      >
        <img
          src={src}
          alt=""
          className="size-full scale-105 object-cover blur-2xl"
          loading="lazy"
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-full border border-fg/30 bg-bg/60 px-3 py-1 text-[11px] tracking-[0.14em] text-fg uppercase backdrop-blur-sm">
            Discreet · tap
          </span>
        </span>
      </button>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      loading="lazy"
    />
  );
}

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-10";
  return (
    <Photo
      src={src}
      alt={name}
      name={name}
      className={cn(dim, "shrink-0 rounded-full")}
    />
  );
}
