import { Link } from "@tanstack/react-router";
import { MessageCircle, X } from "lucide-react";
import { useEffect } from "react";
import { Confetti } from "./confetti";
import { Photo } from "./photo";
import { Crown, Spade } from "./graphics";
import type { Profile } from "@/lib/types";
import { asPhotoList } from "@/lib/types";

/**
 * The match moment — the loudest screen in the club. Full-screen takeover with
 * spade/BBC confetti, the two photos pulled together, and the BNWO decree for
 * the match. Bump `fire` (via <Confetti/>) each time a new match lands.
 */
export function MatchCelebration({
  match,
  mePhoto,
  meName,
  fire,
  onClose,
  onMessage,
}: {
  match: Profile | null;
  mePhoto?: string | null;
  meName?: string;
  fire: number;
  onClose: () => void;
  onMessage?: (otherUserId: string) => void | Promise<void>;
}) {
  useEffect(() => {
    if (!match) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [match, onClose]);

  if (!match) return null;

  const theirPhoto = asPhotoList(match.photos)[0];
  const isKing = match.identities?.some((i) => i.toLowerCase() === "bull");

  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden match-overlay px-6 text-center">
      <Confetti fire={fire} />

      <button
        type="button"
        aria-label="Close celebration"
        onClick={onClose}
        className="absolute top-[max(1.25rem,calc(env(safe-area-inset-top)+0.5rem))] right-5 z-[71] grid size-11 place-items-center rounded-full bg-elevated/80 text-muted transition-transform duration-150 active:scale-90"
      >
        <X className="size-5" />
      </button>

      {/* Crown / spade floating marks */}
      <Crown className="absolute top-[12%] left-[10%] size-12 text-accent/30 animate-float-slow" />
      <Spade className="absolute bottom-[14%] right-[10%] size-14 text-accent/25 animate-float-slow" />
      <Spade className="absolute top-[20%] right-[14%] size-8 text-accent/20 animate-spin-slow" />

      <div className="relative z-10 w-full max-w-md animate-pop-in">
        <p className="shimmer-text font-display text-sm tracking-[0.4em] uppercase">It's the Set</p>
        <h2 className="mt-2 font-display text-6xl leading-none sm:text-7xl">
          <span className="text-gold-gradient">MATCHED</span>
        </h2>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
          <Spade className="size-4 text-accent" />
          {isKing
            ? "A king claimed you. Kneel, then speak."
            : "The order approves. Say it like your profile does."}
          <Spade className="size-4 text-accent" />
        </p>

        {/* The two photos drawn together */}
        <div className="relative mx-auto mt-9 flex h-56 items-center justify-center">
          <div className="animate-slide-left absolute left-[14%] size-44 overflow-hidden rounded-3xl border-2 border-accent/60 shadow-soft sm:left-[10%]">
            <Photo
              src={mePhoto}
              name={meName ?? "You"}
              alt={meName ?? "You"}
              className="size-full object-cover"
            />
          </div>
          <div className="animate-slide-right absolute right-[14%] size-44 overflow-hidden rounded-3xl border-2 border-accent match-ring sm:right-[10%]">
            <Photo
              src={theirPhoto}
              name={match.displayName}
              alt={match.displayName}
              className="size-full object-cover"
            />
          </div>
          <div className="relative z-10 grid size-16 place-items-center rounded-full btn-gold animate-heartbeat">
            <Spade className="size-8 text-accent-fg" />
          </div>
        </div>

        <p className="mt-6 font-display text-3xl text-fg">
          {meName ? `${meName} × ` : ""}
          {match.displayName}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => onMessage?.(match.userId)}
            className="btn-gold inline-flex h-13 items-center justify-center gap-2 rounded-full px-8 py-3.5 text-base"
          >
            <MessageCircle className="size-5" />
            Serve in the DMs
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-border bg-elevated/70 px-8 py-3.5 text-base text-muted transition-colors duration-150 hover:text-fg active:scale-[0.97]"
          >
            Keep swiping
          </button>
        </div>

        <Link
          to="/glory"
          onClick={onClose}
          className="mt-4 inline-block text-xs tracking-[0.24em] text-accent/80 uppercase underline-offset-4 hover:underline"
        >
          Check your standing in the order
        </Link>
      </div>
    </div>
  );
}
