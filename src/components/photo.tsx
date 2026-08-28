import { useState } from "react";
import { cn, initials } from "@/lib/utils";

/**
 * Discreet rendering — the safety-critical component in this app.
 *
 * A profile in discreet mode must NOT put its real photo in the page until the
 * viewer deliberately taps to reveal. The previous implementation rendered the
 * full-resolution image behind a CSS `blur-2xl` filter, which looked private
 * and wasn't: the image was downloaded, present in the DOM, and one
 * right-click ("Open Image in New Tab") or devtools class toggle away from
 * being seen clearly. For a closeted or married member that is a promise the
 * product did not keep.
 *
 * Now the hidden state renders `blurSrc` — a ~24px JPEG data URI generated in
 * the browser at upload time — or a generic silhouette when no placeholder
 * exists. The real URL is only written to an <img src> after the tap. There is
 * nothing to right-click, nothing in view-source, nothing in the network log
 * until the viewer opts in.
 *
 * A reveal lasts for the component's life only: glance at someone's phone
 * later and the profile is discreet again.
 */
export function Photo({
  src,
  blurSrc,
  alt,
  className,
  name,
  discreet = false,
}: {
  src?: string | null;
  /** Tiny data-URI placeholder used while discreet (falls back to a silhouette). */
  blurSrc?: string | null;
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

  // Hidden state. Note what is NOT here: `src`. The real photo is absent from
  // the markup entirely, so no amount of CSS editing brings it back.
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
        {blurSrc ? (
          <img
            src={blurSrc}
            alt=""
            aria-hidden
            draggable={false}
            className="size-full scale-110 object-cover blur-lg"
            loading="lazy"
          />
        ) : (
          // No placeholder (legacy upload): a neutral silhouette is still
          // infinitely better than shipping the real face.
          <span className="grid size-full place-items-center bg-elevated">
            <span className="font-display text-3xl text-subtle">
              {initials(name || alt)}
            </span>
          </span>
        )}
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
      // Deterrence only, and only for the revealed state — never the control.
      draggable={false}
    />
  );
}

export function Avatar({
  src,
  name,
  size = "md",
  discreet = false,
  blurSrc,
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  discreet?: boolean;
  blurSrc?: string | null;
}) {
  const dim = size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-10";
  return (
    <Photo
      src={src}
      blurSrc={blurSrc}
      alt={name}
      name={name}
      discreet={discreet}
      className={cn(dim, "shrink-0 rounded-full")}
    />
  );
}
