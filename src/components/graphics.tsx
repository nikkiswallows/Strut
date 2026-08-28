import { cn } from "@/lib/utils";

/**
 * The graphics kit — all hand-drawn SVG, gold on black, no emoji, no external
 * assets. These are the visual vocabulary of the club: the spade, the crown,
 * the chastity cage, the BBC monogram, the QOS ring, lips, and the badge medallion.
 * They scale crisply to any size and take `className` for color/size.
 */

type IconProps = { className?: string };

/** The Queen-of-Spades mark — the single most recognizable signal in the room. */
export function Spade({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="currentColor" aria-hidden>
      <path d="M16 3.2C10.4 10.6 5.8 14.5 5.8 19.4c0 3.5 2.8 6.3 6.3 6.3 1 0 1.9-.2 2.6-.6-.4 1.4-1.1 3-2.2 4.2h7c-1.1-1.2-1.8-2.8-2.2-4.2.7.4 1.6.6 2.6.6 3.5 0 6.3-2.8 6.3-6.3 0-4.9-4.6-8.8-10.2-16.2Z" />
    </svg>
  );
}

/** A king's crown — for bulls / tops / the Set. */
export function Crown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="currentColor" aria-hidden>
      <path d="M4 24.5 3 9.2c0-.9 1-1.4 1.7-.8L10 12.8l4.8-7.1c.5-.7 1.5-.7 2 0L22 12.8l5.3-4.4c.7-.6 1.7-.1 1.7.8l-1 15.3H4Zm1.4 2.2h21.2c.5 0 .9.4.9.9v.9c0 .5-.4.9-.9.9H5.4c-.5 0-.9-.4-.9-.9v-.9c0-.5.4-.9.9-.9Z" />
    </svg>
  );
}

/**
 * A chastity cage — the lock + shield device. Used for sissy/whiteboi/cuck
 * badges and the "locked" reward track. Drawn as a shield with a lock body.
 */
export function Cage({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="none" aria-hidden>
      {/* shield body */}
      <path
        d="M16 3.5 27 7.5v8.2c0 7-4.7 11.4-11 13.3C9.7 27.1 5 22.7 5 15.7V7.5l11-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* lock shackle */}
      <path
        d="M12.5 14.5v-2.2a3.5 3.5 0 0 1 7 0v2.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* lock body */}
      <rect x="10.5" y="14.2" width="11" height="9" rx="2" fill="currentColor" />
      <circle cx="16" cy="18.2" r="1.6" fill="#0a0907" />
      <rect x="15.4" y="19" width="1.2" height="2.6" rx="0.6" fill="#0a0907" />
    </svg>
  );
}

/** A padlock (simpler than the cage; for the lock timer / states). */
export function Lock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="none" aria-hidden>
      <rect x="7" y="14" width="18" height="13" rx="3" fill="currentColor" />
      <path
        d="M11 14v-3a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="20" r="2" fill="#0a0907" />
      <rect x="15.2" y="21" width="1.6" height="3.4" rx="0.8" fill="#0a0907" />
    </svg>
  );
}

/** A key — release / unlock / holder-of-the-key. */
export function Key({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="currentColor" aria-hidden>
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="11" cy="11" r="2.2" />
      <path d="M16 16 28 28" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M23 23l2.4-2.4M26 26l2.4-2.4" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** BBC monogram chip — the three letters set in the display serif, inside a slab. Kept for legacy. */
export function BbcChip({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 32" className={cn("text-accent", className)} aria-hidden>
      <rect x="1" y="1" width="46" height="30" rx="6" fill="currentColor" />
      <text
        x="24"
        y="21.5"
        textAnchor="middle"
        fontFamily="Cinzel, Georgia, serif"
        fontWeight="700"
        fontSize="14"
        letterSpacing="1.5"
        fill="#0a0907"
      >
        BBC
      </text>
    </svg>
  );
}

/**
 * BBC — actual graphic, not just letters. A gold spade-topped scepter:
 * spade = glans/crown, shaft + twin base. Reads as BBC at confetti size,
 * stays tasteful (no photoreal texture, no explicit detail) and on-brand.
 * This is what the match confetti uses.
 */
export function Bbc({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 40" className={cn("text-accent", className)} fill="currentColor" aria-hidden>
      {/* spade tip = glans */}
      <path d="M12 1.5C8.2 6.2 4.8 8.8 4.8 12.2c0 2.3 1.7 4 3.9 4 .6 0 1.2-.1 1.7-.4-.3.9-.8 1.9-1.5 2.7h6.2c-.7-.8-1.2-1.8-1.5-2.7.5.3 1.1.4 1.7.4 2.2 0 3.9-1.7 3.9-4C19.2 8.8 15.8 6.2 12 1.5Z" />
      {/* shaft */}
      <rect x="9.6" y="18.2" width="4.8" height="13.2" rx="2.4" />
      {/* twin base — abstract, soft */}
      <g opacity="0.95">
        <circle cx="8.6" cy="34.2" r="3.6" />
        <circle cx="15.4" cy="34.2" r="3.6" />
        <rect x="8.6" y="31" width="6.8" height="3.5" rx="1.2" />
      </g>
    </svg>
  );
}

/** Lips — for wives / breeding / the QOS mouth. */
export function Lips({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="currentColor" aria-hidden>
      <path d="M2 16c3.2-4.6 7.6-7 14-7s10.8 2.4 14 7c-3.2 4.6-7.6 7-14 7S5.2 20.6 2 16Z" />
      <path
        d="M6 15.5c3.6 1.6 8 2.4 10 2.4s6.4-.8 10-2.4c-1 1.4-1 1.9 0 2.6-3.8 1-8 1.4-10 1.4s-6.2-.4-10-1.4c1-.7 1-1.2 0-2.6Z"
        fill="#0a0907"
        fillOpacity="0.25"
      />
    </svg>
  );
}

/** A simple heart — matches / claimed. */
export function Heart({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="currentColor" aria-hidden>
      <path d="M16 28S3.5 20.4 3.5 11.9C3.5 7.4 7 4.5 10.6 4.5c2.4 0 4.4 1.2 5.4 3 1-1.8 3-3 5.4-3 3.6 0 7.1 2.9 7.1 7.4C28.5 20.4 16 28 16 28Z" />
    </svg>
  );
}

/** Flame — hot streak / breeding / hype. */
export function Flame({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="currentColor" aria-hidden>
      <path d="M16 2.5c.6 4-2 6.2-4 8.4-2 2.2-3.5 4.2-3.5 7.4A7.5 7.5 0 0 0 16 26a7.5 7.5 0 0 0 7.5-7.7c0-4.2-3-6.8-4.6-9.3-.9 1.6-2 2.4-3 2.6.6-2.4.1-5.6.1-9.1Z" />
      <path d="M16 26a4 4 0 0 1-4-4.2c0-2 1.2-3.3 2.4-4.6.3 1.4 1.2 2 2 2.6-.2-1.6.2-3 1-4.3 1.4 1.8 2.6 3.3 2.6 6.3A4 4 0 0 1 16 26Z" fill="#0a0907" fillOpacity="0.35" />
    </svg>
  );
}

/** A medal / award rosette — used for tier ranks. */
export function Medal({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="none" aria-hidden>
      <path d="M11 4 7.5 15M21 4l3.5 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="20" r="8" fill="currentColor" />
      <path
        d="M16 15.5l1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.6-2.9 1.6.6-3.1-2.3-2.2 3.2-.4 1.4-2.9Z"
        fill="#0a0907"
      />
    </svg>
  );
}

/** The full app mark: a gold slab with the spade cut out of it (the old logo shape). */
export function AppMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M16 4.5C10.2 12.2 5.5 16.2 5.5 21.2c0 3.6 2.9 6.5 6.6 6.5 1 0 1.9-.2 2.7-.6-.4 1.5-1.2 3.2-2.3 4.4h7c-1.1-1.2-1.9-2.9-2.3-4.4.8.4 1.7.6 2.7.6 3.7 0 6.6-2.9 6.6-6.5 0-5-4.7-9-10.5-16.7Z"
        fill="#0a0907"
      />
    </svg>
  );
}

/**
 * The map from the in-app role badge string (KING/QOS/CUCK/SISSY/WHITEBOI/BNWO)
 * to the graphic that represents it. Returns null for unknown badges.
 */
export function badgeGraphic(badge: string | null): { Icon: (p: IconProps) => React.ReactElement; label: string } | null {
  switch (badge) {
    case "KING":
      return { Icon: Crown, label: "King" };
    case "QOS":
      return { Icon: Spade, label: "QOS" };
    case "CUCK":
      return { Icon: Cage, label: "Cuck" };
    case "SISSY":
      return { Icon: Lips, label: "Sissy" };
    case "WHITEBOI":
      return { Icon: Lock, label: "Whiteboi" };
    case "BNWO":
      return { Icon: Spade, label: "BNWO" };
    default:
      return null;
  }
}

/** The gold role badge pill used on cards and the swipe deck. */
export function BadgePill({
  badge,
  className,
  iconClassName,
}: {
  badge: string | null;
  className?: string;
  iconClassName?: string;
}) {
  if (!badge) return null;
  const g = badgeGraphic(badge);
  const GlyphIcon = g?.Icon ?? Spade;
  return (
    <span
      className={cn(
        "absolute top-3 left-3 z-[3] inline-flex items-center gap-1 rounded-full border border-accent/60 bg-bg/70 px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-accent uppercase backdrop-blur-sm",
        className,
      )}
    >
      <GlyphIcon className={cn("size-3", iconClassName)} />
      {badge}
    </span>
  );
}
