import { useId } from "react";
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

/* ── Realistic confetti pieces ─────────────────────────────────────────────
 * These are the hand-drawn "figure" pieces for the match confetti: an
 * anatomically-proportioned BBC and a chastity cage, rendered with gradients
 * so they read as realistic at any size (they are tinted fills, not
 * currentColor). `tone` selects the palette: three skin tones for the BBC,
 * steel or gold for the cage. ids are uniquified per instance so several
 * pieces can be on screen at once.
 */

const COCK_TONES = [
  {
    skin: [
      { o: 0, c: "#2a160c" },
      { o: 0.28, c: "#4a2c1a" },
      { o: 0.55, c: "#6b4226" },
      { o: 0.78, c: "#7d5230" },
      { o: 1, c: "#452818" },
    ],
    glans: [
      { o: 0, c: "#8a5a33" },
      { o: 0.55, c: "#6b4226" },
      { o: 1, c: "#4a2c1a" },
    ],
  },
  {
    skin: [
      { o: 0, c: "#4a2c17" },
      { o: 0.28, c: "#6f4526" },
      { o: 0.55, c: "#8a5a33" },
      { o: 0.78, c: "#9c6a3e" },
      { o: 1, c: "#5c3a20" },
    ],
    glans: [
      { o: 0, c: "#a5754a" },
      { o: 0.55, c: "#8a5a33" },
      { o: 1, c: "#5c3a20" },
    ],
  },
  {
    skin: [
      { o: 0, c: "#33190d" },
      { o: 0.28, c: "#5c3a20" },
      { o: 0.55, c: "#7a4b28" },
      { o: 0.78, c: "#8a5832" },
      { o: 1, c: "#4a2c1a" },
    ],
    glans: [
      { o: 0, c: "#a06c3f" },
      { o: 0.55, c: "#81542f" },
      { o: 1, c: "#5c3a20" },
    ],
  },
] as const;

/** A realistic BBC — flared corona, glans, tapered shaft, bulging balls. */
export function Cock({ className, tone = 0 }: IconProps & { tone?: 0 | 1 | 2 }) {
  const gid = useId().replace(/:/g, "");
  const t = COCK_TONES[tone] ?? COCK_TONES[0]!;
  return (
    <svg viewBox="0 0 36 60" className={cn(className)} aria-hidden>
      <defs>
        <linearGradient id={`cskin-${gid}`} x1="0" y1="0" x2="1" y2="0">
          {t.skin.map((s, i) => (
            <stop key={i} offset={s.o} stopColor={s.c} />
          ))}
        </linearGradient>
        <radialGradient id={`cglans-${gid}`} cx="0.5" cy="0.26" r="0.8">
          {t.glans.map((s, i) => (
            <stop key={i} offset={s.o} stopColor={s.c} />
          ))}
        </radialGradient>
      </defs>
      {/* silhouette */}
      <path
        fill={`url(#cskin-${gid})`}
        d="M18 2C22.8 2.6 25.6 5.6 25.6 9.4C25.6 11.6 24.8 12.8 23.4 13.6C26.6 14.6 27.8 16.4 27.8 18.2C27.8 19.8 26.6 20.9 24.8 21.3C24.6 26 24.3 33 24 40C23.9 43.6 23 45.8 21.4 47C27 47.8 28.4 51.8 25.8 54.6C24.2 55.9 21.6 56 19.4 55C18.7 54.6 18 54.1 18 53.4C18 54.1 17.3 54.6 16.6 55C14.4 56 11.8 55.9 10.2 54.6C7.6 51.8 9 47.8 14.6 47C13 45.8 12.1 43.6 12 40C11.7 33 11.4 26 11.2 21.3C9.4 20.9 8.2 19.8 8.2 18.2C8.2 16.4 9.4 14.6 12.6 13.6C11.2 12.8 10.4 11.6 10.4 9.4C10.4 5.6 13.2 2.6 18 2Z"
      />
      {/* glans cap */}
      <path
        fill={`url(#cglans-${gid})`}
        opacity="0.92"
        d="M10.4 9.4C10.4 5.6 13.2 2.6 18 2C22.8 2.6 25.6 5.6 25.6 9.4C25.6 11.4 24.9 12.5 23.6 13.3C20.6 11.9 15.4 11.9 12.4 13.3C11.1 12.5 10.4 11.4 10.4 9.4Z"
      />
      {/* corona rim */}
      <path
        d="M10.6 14.2 C13.2 15.9 22.8 15.9 25.4 14.2"
        stroke="#33190d"
        strokeWidth="1.2"
        fill="none"
        opacity="0.7"
        strokeLinecap="round"
      />
      {/* veins */}
      <path
        d="M23 22 C23.3 28 22.9 34 22.4 38.5"
        stroke="#33190d"
        strokeWidth="0.9"
        fill="none"
        opacity="0.5"
        strokeLinecap="round"
      />
      <path
        d="M13.2 23.5 C12.9 29 13.1 33 13.5 36.5"
        stroke="#33190d"
        strokeWidth="0.8"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />
      {/* ball shading */}
      <path
        d="M25.8 54.6 C24.2 55.9 21.6 56 19.4 55 C21.9 52.6 23.6 49.6 24.4 47.6 C26.9 48.9 27.3 51.9 25.8 54.6 Z"
        fill="#2a160c"
        opacity="0.55"
      />
      <path
        d="M10.2 54.6 C8.2 51.9 8.8 49 11.3 47.9 C12.4 50.5 13.6 52.7 15 54.4 C14.1 55.2 12.3 55.6 10.2 54.6 Z"
        fill="#2a160c"
        opacity="0.45"
      />
      {/* glans shine */}
      <ellipse
        cx="16.4"
        cy="5.8"
        rx="2.2"
        ry="1.4"
        fill="#ffffff"
        opacity="0.2"
        transform="rotate(-18 16.4 5.8)"
      />
    </svg>
  );
}

const CAGE_TONES = [
  {
    tube: [
      { o: 0, c: "#8f9aa4" },
      { o: 0.3, c: "#d6dde3" },
      { o: 0.55, c: "#eef2f5" },
      { o: 0.8, c: "#aeb8c1" },
      { o: 1, c: "#7d8891" },
    ],
    ring: [
      { o: 0, c: "#dde3e8" },
      { o: 0.5, c: "#9aa4ad" },
      { o: 1, c: "#6f7981" },
    ],
    slit: "#232a30",
    keyhole: "#20262b",
    highlight: "#ffffff",
  },
  {
    tube: [
      { o: 0, c: "#8a6d2a" },
      { o: 0.3, c: "#d9b64f" },
      { o: 0.55, c: "#f2d98a" },
      { o: 0.8, c: "#c9a24a" },
      { o: 1, c: "#7d5f22" },
    ],
    ring: [
      { o: 0, c: "#e8cd7a" },
      { o: 0.5, c: "#c9a24a" },
      { o: 1, c: "#8a6d2a" },
    ],
    slit: "#3a2f14",
    keyhole: "#2a2410",
    highlight: "#fff6d8",
  },
] as const;

/** A realistic chastity cage — base ring, perforated tube, tip slot, padlock. */
export function ChastityCage({ className, tone = 0 }: IconProps & { tone?: 0 | 1 }) {
  const gid = useId().replace(/:/g, "");
  const t = CAGE_TONES[tone] ?? CAGE_TONES[0]!;
  return (
    <svg viewBox="0 0 52 44" className={cn(className)} aria-hidden>
      <defs>
        <linearGradient id={`ctube-${gid}`} x1="0" y1="0" x2="1" y2="0">
          {t.tube.map((s, i) => (
            <stop key={i} offset={s.o} stopColor={s.c} />
          ))}
        </linearGradient>
        <linearGradient id={`cring-${gid}`} x1="0" y1="0" x2="0" y2="1">
          {t.ring.map((s, i) => (
            <stop key={i} offset={s.o} stopColor={s.c} />
          ))}
        </linearGradient>
      </defs>
      {/* base ring */}
      <circle cx="13" cy="22" r="10" fill="none" stroke={`url(#cring-${gid})`} strokeWidth="4.6" />
      {/* cage tube */}
      <path
        fill={`url(#ctube-${gid})`}
        d="M23 13.2C30 11.6 38 12 43.5 14C46.4 15 48 16.9 48.6 19.1C49.2 21.3 48.6 23.4 46.9 24.7C45.6 25.6 44 26 42.8 25.7C36.5 27.3 28.5 27.6 23 27.2C23 27.2 23 13.2 23 13.2Z"
      />
      {/* tube highlight */}
      <path
        d="M24 15.4 C30 13.9 37.6 14.2 43 16.1"
        stroke={t.highlight}
        strokeWidth="1.4"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />
      {/* perforations */}
      <g stroke={t.slit} strokeWidth="1.5" strokeLinecap="round" opacity="0.9">
        <path d="M26.2 16.4 C26 20 26 23.4 26.4 25.6" />
        <path d="M29.8 16.1 C29.5 19.8 29.5 23.2 30 25.8" />
        <path d="M33.4 16 C33.1 19.9 33.1 23.3 33.6 26" />
        <path d="M37 16.2 C36.7 20 36.8 23.3 37.2 26" />
        <path d="M40.4 16.8 C40.1 20.3 40.2 23.4 40.6 25.4" />
      </g>
      {/* tip opening */}
      <ellipse cx="46.3" cy="19.9" rx="1.15" ry="3.4" fill={t.slit} opacity="0.85" />
      <path
        d="M46.3 16.5 L46.3 23.3"
        stroke={t.highlight}
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      {/* lock shackle */}
      <path
        d="M8.6 27.4 V23.6 a4.4 4.4 0 0 1 8.8 0 v3.8"
        stroke={`url(#cring-${gid})`}
        strokeWidth="2.3"
        fill="none"
        strokeLinecap="round"
      />
      {/* lock body */}
      <rect x="6.8" y="27.2" width="12.4" height="8.8" rx="2" fill={`url(#cring-${gid})`} />
      <rect x="6.8" y="27.2" width="12.4" height="3.4" rx="1.6" fill={t.highlight} opacity="0.18" />
      {/* keyhole */}
      <circle cx="13" cy="31" r="1.5" fill={t.keyhole} />
      <rect x="12.45" y="31.6" width="1.1" height="2.6" rx="0.55" fill={t.keyhole} />
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
