import { useEffect, useMemo, useState } from "react";
import { Bbc, Crown, Heart, Lips, Spade } from "./graphics";

/**
 * BNWO confetti — no library, no emoji. Gold spades, crowns, hearts, lips and
 * BBC monogram chips rain from the top and burst from the center. Honors
 * prefers-reduced-motion (renders a single static burst instead of a storm).
 *
 * Usage: mount <Confetti fire={nonce} /> and bump `fire` to trigger a round.
 */

type Piece = {
  id: number;
  kind: "spade" | "crown" | "heart" | "lips" | "bbc" | "coin";
  left: number; // vw
  delay: number; // ms
  duration: number; // ms
  size: number; // px
  drift: number; // px
  spin: number; // deg
  gold: boolean;
};

function makeRain(count: number): Piece[] {
  const kinds: Piece["kind"][] = ["spade", "spade", "crown", "heart", "lips", "bbc", "coin", "spade"];
  return Array.from({ length: count }, (_, i) => {
    const size = 16 + Math.random() * 26;
    return {
      id: i,
      kind: kinds[Math.floor(Math.random() * kinds.length)]!,
      left: Math.random() * 100,
      delay: Math.random() * 700,
      duration: 2600 + Math.random() * 1800,
      size,
      drift: (Math.random() - 0.5) * 220,
      spin: (Math.random() - 0.5) * 1080,
      gold: Math.random() > 0.25,
    };
  });
}

type Burst = Piece & { bx: number; by: number };

function makeBurst(count: number): Burst[] {
  const kinds: Piece["kind"][] = ["spade", "crown", "heart", "bbc", "coin", "lips"];
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 140 + Math.random() * 260;
    return {
      id: 1000 + i,
      kind: kinds[Math.floor(Math.random() * kinds.length)]!,
      left: 50,
      delay: Math.random() * 120,
      duration: 900,
      size: 20 + Math.random() * 22,
      drift: 0,
      spin: (Math.random() - 0.5) * 720,
      gold: true,
      bx: Math.cos(angle) * dist,
      by: Math.sin(angle) * dist,
    };
  });
}

function Glyph({ kind, size, gold }: { kind: Piece["kind"]; size: number; gold: boolean }) {
  const cls = gold ? "text-accent" : "text-fg/80";
  const style = { width: size, height: size, filter: gold ? "drop-shadow(0 0 6px rgba(216,175,78,.55))" : undefined };
  switch (kind) {
    case "spade":
      return (
        <span style={style} className={cls}>
          <Spade className="size-full" />
        </span>
      );
    case "crown":
      return <span style={style} className={cls}><Crown className="size-full" /></span>;
    case "heart":
      return <span style={style} className={cls}><Heart className="size-full" /></span>;
    case "lips":
      return <span style={style} className={cls}><Lips className="size-full" /></span>;
    case "bbc":
      return (
        <span
          style={{
            width: size * 0.85,
            height: size * 1.35,
            filter: style.filter,
          }}
          className={cls}
        >
          <Bbc className="size-full" />
        </span>
      );
    case "coin":
      return (
        <span
          style={{
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
    const rain = makeRain(reduced ? 18 : 70);
    const burst = makeBurst(reduced ? 10 : 30);
    setPieces({ rain, burst });
    const t = window.setTimeout(() => setPieces(null), 4800);
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
          <Glyph kind={p.kind} size={p.size} gold={p.gold} />
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
          <Glyph kind={p.kind} size={p.size} gold={p.gold} />
        </span>
      ))}
    </div>
  );
}
