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
 * Hand-drawn "figure" pieces for the match confetti: an anatomically
 * proportioned BBC and a bar-style chastity cage, shaded with gradients so
 * they read clearly at confetti size. `tone` selects the palette: three skin
 * tones for the BBC, steel or gold for the cage. Gradient ids are uniquified
 * per instance so many pieces can be on screen at once.
 */

const COCK_TONES = [
  {
    // deep ebony
    shaft: ["#2a150a", "#432310", "#5c341b", "#6b3f22", "#452510", "#241106"],
    glans: ["#361a0c", "#523017", "#5f381e", "#2e160a"],
    ballA: ["#5c351c", "#432310", "#241106"],
    ballB: ["#54301a", "#3d2010", "#200f06"],
    vein: "#26100a",
    veinHi: "#7a4c2b",
    hi: "#84552f",
    sheen: "#a06c42",
  },
  {
    // chocolate
    shaft: ["#3d2212", "#5c3319", "#7a4a26", "#8a5730", "#5f3519", "#361d0e"],
    glans: ["#4a2413", "#6d3d20", "#7d4a29", "#42200f"],
    ballA: ["#7a4a28", "#5c3418", "#33190b"],
    ballB: ["#71431f", "#542f14", "#2e1609"],
    vein: "#33180a",
    veinHi: "#96613a",
    hi: "#a5714a",
    sheen: "#c58a55",
  },
  {
    // warm mahogany
    shaft: ["#4a2818", "#6e3f22", "#8f5a30", "#a2683a", "#71431f", "#402012"],
    glans: ["#5a2f18", "#7c4826", "#8e5630", "#4c2814"],
    ballA: ["#8a5730", "#6b3d1e", "#3d2010"],
    ballB: ["#7f4e28", "#623718", "#361b0c"],
    vein: "#3a1c0c",
    veinHi: "#ab7448",
    hi: "#b97f4f",
    sheen: "#d29a63",
  },
] as const;

const SHAFT_OFFSETS = [0, 0.22, 0.45, 0.62, 0.8, 1] as const;
const GLANS_OFFSETS = [0, 0.4, 0.6, 1] as const;
const BALL_OFFSETS = [0, 0.6, 1] as const;

/** A realistic BBC — flared glans, curved tapered shaft, full balls. */
export function Cock({ className, tone = 0 }: IconProps & { tone?: 0 | 1 | 2 }) {
  const gid = useId().replace(/:/g, "");
  const t = COCK_TONES[tone] ?? COCK_TONES[0]!;
  return (
    <svg viewBox="0 0 44 92" className={cn(className)} aria-hidden>
      <defs>
        <linearGradient id={`cskin-${gid}`} x1="0" y1="0" x2="1" y2="0">
          {t.shaft.map((c, i) => (
            <stop key={i} offset={SHAFT_OFFSETS[i]} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={`cglans-${gid}`} x1="0" y1="0" x2="1" y2="0">
          {t.glans.map((c, i) => (
            <stop key={i} offset={GLANS_OFFSETS[i]} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id={`cballa-${gid}`} cx="0.38" cy="0.32" r="0.85">
          {t.ballA.map((c, i) => (
            <stop key={i} offset={BALL_OFFSETS[i]} stopColor={c} />
          ))}
        </radialGradient>
        <radialGradient id={`cballb-${gid}`} cx="0.42" cy="0.3" r="0.85">
          {t.ballB.map((c, i) => (
            <stop key={i} offset={BALL_OFFSETS[i]} stopColor={c} />
          ))}
        </radialGradient>
      </defs>

      {/* balls (behind shaft) */}
      <ellipse cx="13.5" cy="76" rx="11" ry="13" fill={`url(#cballa-${gid})`} />
      <ellipse cx="29.5" cy="77.5" rx="10.5" ry="12" fill={`url(#cballb-${gid})`} />
      <path d="M21.6 67 C22.3 71.5 22.5 78 21.9 85.5" stroke={t.vein} strokeWidth="1.1" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d="M8 72 C10 74.5 9.5 79 11 82" stroke={t.vein} strokeWidth="0.7" fill="none" opacity="0.45" />
      <path d="M33 73 C31.7 76 32.5 80 31 83" stroke={t.vein} strokeWidth="0.7" fill="none" opacity="0.45" />

      {/* shaft */}
      <path
        fill={`url(#cskin-${gid})`}
        d="M13.8 21.5 C13 30 12.6 44 13 56 C13.2 62 13.6 66.5 14.2 69.5 C16.5 71.5 27.5 71.5 29.8 69.5 C30.4 66.5 30.9 62 31.1 56 C31.5 44 31 30 30.1 21.5 C25.5 19.6 18.4 19.6 13.8 21.5 Z"
      />

      {/* corona under-shadow */}
      <path
        d="M12.9 21.4 C17 23.6 27 23.6 31 21.4 C30.6 23 29.8 23.8 28.6 24.3 C24.6 25.8 19.4 25.8 15.4 24.3 C14.2 23.8 13.3 23 12.9 21.4 Z"
        fill="#200e05"
        opacity="0.55"
      />

      {/* glans — helmet, flared wider than the shaft */}
      <path
        fill={`url(#cglans-${gid})`}
        d="M22 1.6 C26.6 1.6 30.4 5.2 31.6 10.2 C32.4 13.6 32.6 17.4 31.9 20.3 C31.5 21.9 30.3 22.6 28.6 22.1 C24.5 20.9 19.5 20.9 15.4 22.1 C13.7 22.6 12.5 21.9 12.1 20.3 C11.4 17.4 11.6 13.6 12.4 10.2 C13.6 5.2 17.4 1.6 22 1.6 Z"
      />
      {/* meatus */}
      <path d="M22 3.4 C22.35 4.6 22.35 6.2 22 7.6" stroke="#1d0d05" strokeWidth="0.9" fill="none" opacity="0.75" strokeLinecap="round" />
      {/* glans sheen */}
      <ellipse cx="17.8" cy="7.4" rx="2.6" ry="4.2" fill={t.sheen} opacity="0.28" transform="rotate(-16 17.8 7.4)" />

      {/* dorsal vein with branch */}
      <path
        d="M18.6 25.5 C17.4 31 19.2 36.5 18 42.5 C17.2 47.5 18.4 53.5 17.6 59.5 C17.3 62.5 17.8 65.5 18.2 67.5"
        stroke={t.vein}
        strokeWidth="1.2"
        fill="none"
        opacity="0.38"
        strokeLinecap="round"
      />
      <path
        d="M19.2 25.8 C18 31.3 19.8 36.8 18.6 42.8 C17.8 47.8 19 53.8 18.2 59.8"
        stroke={t.veinHi}
        strokeWidth="0.55"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />
      <path d="M17.9 41 C20.5 44 21.5 48.5 21.2 52" stroke={t.vein} strokeWidth="0.85" fill="none" opacity="0.32" strokeLinecap="round" />
      <path d="M27.4 28 C28.4 34 27.6 42 28.2 50 C28.5 54 28 58 27.6 61.5" stroke={t.vein} strokeWidth="0.9" fill="none" opacity="0.3" strokeLinecap="round" />

      {/* shaft highlight */}
      <path d="M15.6 26 C14.9 36 14.7 52 15.4 65" stroke={t.hi} strokeWidth="1.6" fill="none" opacity="0.35" strokeLinecap="round" />

      {/* shadow where shaft meets balls */}
      <path d="M14.2 69.3 C17 71.4 27 71.4 29.8 69.3 C28.5 72 15.6 72 14.2 69.3 Z" fill="#1c0c04" opacity="0.6" />

      {/* ball highlights */}
      <ellipse cx="10.5" cy="71.5" rx="3.4" ry="2.4" fill={t.sheen} opacity="0.26" transform="rotate(-24 10.5 71.5)" />
      <ellipse cx="27.6" cy="73" rx="2.8" ry="2" fill={t.sheen} opacity="0.24" transform="rotate(18 27.6 73)" />
    </svg>
  );
}

const CAGE_TONES = [
  {
    // polished steel + brass lock
    bar: ["#f4f7fa", "#c8d1d8", "#939fa9", "#6a757d", "#a2adb5"],
    ring: ["#eef2f5", "#a8b2ba", "#5d666d"],
    lock: ["#e8c76a", "#c9a244", "#8a6a24"],
    shackle: "#aeb7be",
    keyhole: "#3a2c0d",
    interior: "#171c20",
    hi: "#ffffff",
  },
  {
    // gold
    bar: ["#f7e7ae", "#e3c46a", "#c39c3e", "#8f6f26", "#d4b258"],
    ring: ["#f2e0a0", "#cfa94e", "#8a6d2a"],
    lock: ["#f2d98a", "#c9a24a", "#8a6d2a"],
    shackle: "#c9ab52",
    keyhole: "#2a2410",
    interior: "#1c160a",
    hi: "#fff6d8",
  },
] as const;

const BAR_OFFSETS = [0, 0.35, 0.6, 0.85, 1] as const;
const RING_OFFSETS = [0, 0.5, 1] as const;

/** A realistic chastity cage — base ring, curved bar cage, brass padlock. */
export function ChastityCage({ className, tone = 0 }: IconProps & { tone?: 0 | 1 }) {
  const gid = useId().replace(/:/g, "");
  const t = CAGE_TONES[tone] ?? CAGE_TONES[0]!;
  return (
    <svg viewBox="0 0 64 46" className={cn(className)} aria-hidden>
      <defs>
        <linearGradient id={`cgbar-${gid}`} x1="0" y1="0" x2="0" y2="1">
          {t.bar.map((c, i) => (
            <stop key={i} offset={BAR_OFFSETS[i]} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={`cgring-${gid}`} x1="0" y1="0" x2="1" y2="1">
          {t.ring.map((c, i) => (
            <stop key={i} offset={RING_OFFSETS[i]} stopColor={c} />
          ))}
        </linearGradient>
        <linearGradient id={`cglock-${gid}`} x1="0" y1="0" x2="0" y2="1">
          {t.lock.map((c, i) => (
            <stop key={i} offset={RING_OFFSETS[i]} stopColor={c} />
          ))}
        </linearGradient>
      </defs>

      {/* dark interior so the cage reads as an enclosure */}
      <path
        d="M22 12.5 C34 9.5 46 11 54.5 17.5 C59.5 21 59.7 26.5 55 30 C46 35.5 34 36.5 22 33.5 C20 30 20 16 22 12.5 Z"
        fill={t.interior}
        opacity="0.55"
      />

      {/* base ring */}
      <ellipse cx="14" cy="23" rx="12.5" ry="14.5" fill="none" stroke={`url(#cgring-${gid})`} strokeWidth="5.4" />
      <ellipse
        cx="14"
        cy="23"
        rx="12.5"
        ry="14.5"
        fill="none"
        stroke={t.hi}
        strokeWidth="1.1"
        opacity="0.55"
        strokeDasharray="14 60"
        strokeDashoffset="-6"
      />

      {/* circumferential rings */}
      <ellipse cx="29" cy="23" rx="2.6" ry="10.3" fill="none" stroke={`url(#cgbar-${gid})`} strokeWidth="2" transform="rotate(4 29 23)" />
      <ellipse cx="39" cy="23.2" rx="2.4" ry="9.9" fill="none" stroke={`url(#cgbar-${gid})`} strokeWidth="2" transform="rotate(8 39 23.2)" />
      <ellipse cx="48.5" cy="23.4" rx="2.2" ry="8.6" fill="none" stroke={`url(#cgbar-${gid})`} strokeWidth="2" transform="rotate(12 48.5 23.4)" />

      {/* longitudinal bars */}
      <path d="M22 12.5 C34 9.5 46 11 54.5 17.5" stroke={`url(#cgbar-${gid})`} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <path d="M22 33.5 C34 36.5 46 35.5 55 30" stroke={`url(#cgbar-${gid})`} strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <path d="M23.5 24.5 C35 26.8 46 26.2 56.2 23.8" stroke={`url(#cgbar-${gid})`} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* rounded closed tip */}
      <path d="M54.5 17.5 C59.5 21 59.7 26.5 55 30" stroke={`url(#cgbar-${gid})`} strokeWidth="3.4" fill="none" strokeLinecap="round" />

      {/* bar highlights */}
      <path d="M24 12.2 C33 10 43 10.8 51 15.5" stroke={t.hi} strokeWidth="0.9" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M25.5 24.8 C35 26.6 45 26.1 54 24" stroke={t.hi} strokeWidth="0.7" fill="none" opacity="0.4" strokeLinecap="round" />

      {/* padlock at the ring/cage junction */}
      <path
        d="M21.2 7.6 C21.2 4.4 26.8 4.4 26.8 7.6 L26.8 10.6 L24.9 10.6 L24.9 8 C24.9 6.4 23.1 6.4 23.1 8 L23.1 10.6 L21.2 10.6 Z"
        fill={t.shackle}
      />
      <rect x="19.6" y="10.2" width="8.8" height="7.6" rx="1.8" fill={`url(#cglock-${gid})`} />
      <circle cx="24" cy="13.2" r="1.25" fill={t.keyhole} />
      <rect x="23.55" y="13.7" width="0.9" height="2.3" rx="0.45" fill={t.keyhole} />
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
    case "FAG":
      return { Icon: Flame, label: "Fag" };
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
