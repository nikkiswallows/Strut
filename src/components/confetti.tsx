import { useEffect, useMemo, useState } from "react";
import { ChastityCage, Cock, Crown, Heart, Lips, Spade } from "./graphics";

/**
 * BNWO confetti — no library, no emoji. Realistic BBCs, chastity cages and gold
 * spades rain from the top and burst from the center, with crowns, hearts, lips
 * and coins as the festive accents. Honors prefers-reduced-motion (renders a
 * short, sparse burst instead of a storm).
 *
 * Design notes:
 * - The figure pieces (BBC, cage) are larger and fewer than the ornaments so
 *   each one stays legible while it falls.
 * - Figures only tilt (±120°) instead of tumbling — a piece that spins 3 full
 *   turns during a 3s fall never reads as anything.
 * - Every glyph wrapper is display:block with explicit px sizes; inline spans
 *   ignore width/height and would let the SVGs blow up to viewport scale.
 *
 * Usage: mount <Confetti fire={nonce} /> and bump `fire` to trigger a round.
 */

type Kind = "spade" | "crown" | "heart" | "lips" | "cock" | "cage" | "coin";

const FIGURES: ReadonlySet<Kind> = new Set(["cock", "cage"]);

type Piece = {
  id: number;
  kind: Kind;
  /** Palette variant for the figure pieces (skin tone / cage metal). */
  tone?: number;
  left: number; // vw
  delay: number; // ms
  duration: number; // ms
  size: number; // px (height for figures)
  drift: number; // px
  spin: number; // deg
  gold: boolean;
};

function toneFor(kind: Kind): number | undefined {
  if (kind === "cock") return Math.floor(Math.random() * 3);
  if (kind === "cage") return Math.random() > 0.5 ? 1 : 0;
  return undefined;
}

function makeRain(count: number): Piece[] {
  const kinds: Kind[] = [
    "spade", "cock", "cage", "spade", "cock", "cage",
    "crown", "cock", "spade", "heart", "cage", "lips", "coin", "spade", "cock",
  ];
  return Array.from({ length: count }, (_, i) => {
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    const figure = FIGURES.has(kind);
    return {
      id: i,
      kind,
      tone: toneFor(kind),
      left: Math.random() * 100,
      delay: Math.random() * 900,
      duration: 3000 + Math.random() * 1600,
      size: figure ? 46 + Math.random() * 26 : 14 + Math.random() * 16,
      drift: (Math.random() - 0.5) * (figure ? 120 : 220),
      spin: figure ? (Math.random() - 0.5) * 240 : (Math.random() - 0.5) * 1080,
      gold: !figure && Math.random() > 0.25,
    };
  });
}

type Burst = Piece & { bx: number; by: number };

function makeBurst(count: number): Burst[] {
  const kinds: Kind[] = [
    "spade", "cock", "cage", "crown", "cock", "spade", "coin", "cage", "lips", "heart",
  ];
  return Array.from({ length: count }, (_, i) => {
    const kind = kinds[Math.floor(Math.random() * kinds.length)]!;
    const figure = FIGURES.has(kind);
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 140 + Math.random() * 260;
    return {
      id: 1000 + i,
      kind,
      tone: toneFor(kind),
      left: 50,
      delay: Math.random() * 120,
      duration: 900,
      size: figure ? 40 + Math.random() * 20 : 16 + Math.random() * 14,
      drift: 0,
      spin: figure ? (Math.random() - 0.5) * 200 : (Math.random() - 0.5) * 720,
      gold: !figure,
      bx: Math.cos(angle) * dist,
      by: Math.sin(angle) * dist,
    };
  });
}

function Glyph({
  kind,
  size,
  gold,
  tone,
}: {
  kind: Kind;
  size: number;
  gold: boolean;
  tone?: number;
}) {
  const cls = gold ? "text-accent" : "text-fg/80";
  const style: React.CSSProperties = {
    display: "block",
    width: size,
    height: size,
    filter: gold ? "drop-shadow(0 0 6px rgba(216,175,78,.55))" : undefined,
  };
  const figureStyle: React.CSSProperties = {
    display: "block",
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,.5))",
  };
  switch (kind) {
    case "spade":
      return (
        <span style={style} className={cls}>
          <Spade className="block size-full" />
        </span>
      );
    case "crown":
      return <span style={style} className={cls}><Crown className="block size-full" /></span>;
    case "heart":
      return <span style={style} className={cls}><Heart className="block size-full" /></span>;
    case "lips":
      return <span style={style} className={cls}><Lips className="block size-full" /></span>;
    case "cock":
      return (
        <span style={{ ...figureStyle, width: Math.round(size * 0.48), height: size }}>
          <Cock className="block size-full" tone={(tone ?? 0) as 0 | 1 | 2} />
        </span>
      );
    case "cage":
      return (
        <span style={{ ...figureStyle, width: Math.round(size * 1.39), height: size }}>
          <ChastityCage className="block size-full" tone={(tone ?? 0) as 0 | 1} />
        </span>
      );
    case "coin":
      return (
        <span
          style={{
            display: "block",
            width: size * 0.5,
            height: size * 0.9,
            borderRadius: 2,
            background: gold ? "linear-gradient(180deg,#f5d67e,#9a7420)" : "#f3ead7",
            boxShadow: gold ? "0 0 8px rgba(216,175,78,.6)" : undefined,
          }}
        />
      );
  }
}

export function Confetti({ fire }: { fire: number }) {
  const [pieces, setPieces] = useState<{ rain: Piece[]; burst: Burst[] } | null>(null);

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (!fire) return;
    const rain = makeRain(reduced ? 12 : 42);
    const burst = makeBurst(reduced ? 8 : 20);
    setPieces({ rain, burst });
    const t = window.setTimeout(() => setPieces(null), 5200);
    return () => window.clearTimeout(t);
  }, [fire, reduced]);

  if (!pieces) return null;

  return (
    <div className="confetti-layer" aria-hidden>
      {pieces.rain.map((p) => (
        <span
          key={`r-${p.id}`}
          className="confetti-piece"
          style={{
            left: `${p.left}vw`,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.duration}ms`,
            ["--drift" as string]: `${p.drift}px`,
            ["--spin" as string]: `${p.spin}deg`,
          }}
        >
          <Glyph kind={p.kind} size={p.size} gold={p.gold} tone={p.tone} />
        </span>
      ))}
      {pieces.burst.map((p) => (
        <span
          key={`b-${p.id}`}
          className="confetti-burst-piece"
          style={{
            animationDelay: `${p.delay}ms`,
            ["--bx" as string]: `${p.bx}px`,
            ["--by" as string]: `${p.by}px`,
            ["--spin" as string]: `${p.spin}deg`,
          }}
        >
          <Glyph kind={p.kind} size={p.size} gold={p.gold} tone={p.tone} />
        </span>
      ))}
    </div>
  );
}
