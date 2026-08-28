import { Heart, RotateCcw, X } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatMiles } from "@/lib/geo";
import { badgeFor } from "@/lib/bnwo";
import { asPhotoList, identityLine, shownAge, type Profile } from "@/lib/types";
import { Photo } from "./photo";

const SWIPE_THRESHOLD = 90; // px of horizontal drag to trigger a decision

/**
 * A Tinder-style one-card-at-a-time deck. Swipe right → like, left → pass
 * (drag or buttons / arrow keys). Cards advance with a quick fly-out, and the
 * parent is asked for more when it runs low. `key` from the parent should change
 * when the filter set changes so the deck restarts cleanly.
 */
export function SwipeDeck({
  profiles,
  onSwipe,
  onNeedMore,
  loadingMore,
  hasMore,
  emptyLabel,
}: {
  profiles: Profile[];
  onSwipe: (profile: Profile, direction: "like" | "pass") => void;
  onNeedMore: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  emptyLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ x: number; active: boolean; done?: "left" | "right" }>({
    x: 0,
    active: false,
  });
  const startX = useRef(0);

  const current = useMemo(() => profiles[index] ?? null, [profiles, index]);
  const photos = current ? asPhotoList(current.photos) : [];
  const photo = photos[photos.length - 1] ?? photos[0];
  const age = current ? shownAge(current) : null;
  const badge = current ? badgeFor(current) : null;
  const distance = current ? formatMiles(current.distanceMiles) : null;

  const reset = () => setDrag({ x: 0, active: false });

  function decide(direction: "like" | "pass") {
    if (!current) return;
    setDrag({ x: 0, active: false, done: direction === "like" ? "right" : "left" });
    setIndex((i) => i + 1);
    onSwipe(current, direction);
    if (index + 1 >= profiles.length - 2) onNeedMore();
    // clear the fly-out after the next card settles
    setTimeout(reset, 260);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!current) return;
    startX.current = e.clientX;
    setDrag({ x: 0, active: true });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.active || !current) return;
    setDrag((d) => ({ ...d, x: e.clientX - startX.current }));
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.active || !current) return;
    const dx = e.clientX - startX.current;
    if (dx > SWIPE_THRESHOLD) decide("like");
    else if (dx < -SWIPE_THRESHOLD) decide("pass");
    else reset();
  }

  if (index >= profiles.length) {
    return (
      <div className="py-20 text-center">
        {loadingMore ? (
          <p className="text-sm text-muted">Getting more of the order…</p>
        ) : hasMore ? (
          <button
            type="button"
            onClick={onNeedMore}
            className="h-11 rounded-full bg-elevated px-5 text-sm text-muted transition-transform duration-150 ease-out hover:text-fg active:scale-[0.96]"
          >
            Load more
          </button>
        ) : (
          <p className="text-sm text-muted">{emptyLabel}</p>
        )}
      </div>
    );
  }

  const rotate = drag.x / 22;
  const likeOpacity = Math.max(0, Math.min(1, drag.x / SWIPE_THRESHOLD));
  const passOpacity = Math.max(0, Math.min(1, -drag.x / SWIPE_THRESHOLD));

  return (
    <div className="relative mx-auto max-w-sm">
      <div
        key={current ? `${current.userId}-${index}` : "empty"}
        className="relative aspect-[4/5] touch-none select-none overflow-hidden rounded-3xl bg-surface transition-transform duration-200 ease-out"
        style={{
          transform: drag.done
            ? `translateX(${drag.done === "right" ? 420 : -420}px) rotate(${
                drag.done === "right" ? 18 : -18
              }deg)`
            : `translate(${drag.x}px, 0) rotate(${rotate}deg)`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => drag.active && reset()}
      >
        <Photo
          src={photo}
          alt={current?.displayName ?? ""}
          name={current?.displayName ?? ""}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
        {badge ? (
          <span className="absolute top-4 left-4 z-[3] rounded-full border border-accent/50 bg-bg/70 px-2.5 py-0.5 text-[10px] tracking-[0.18em] text-accent uppercase backdrop-blur-sm">
            {badge}
          </span>
        ) : null}
        {/* decision labels */}
        <div
          className="absolute top-8 right-4 rounded-xl border-2 border-[#3fb96b] px-3 py-1 text-lg font-bold tracking-widest text-[#3fb96b]"
          style={{ opacity: likeOpacity, transform: "rotate(12deg)" }}
        >
          Like
        </div>
        <div
          className="absolute top-8 left-4 rounded-xl border-2 border-red-500 px-3 py-1 text-lg font-bold tracking-widest text-red-500"
          style={{ opacity: passOpacity, transform: "rotate(-12deg)" }}
        >
          Pass
        </div>
        <div className="absolute inset-x-0 bottom-0 z-[2] p-5">
          <p className="font-display text-4xl leading-tight text-fg">
            {current?.displayName}
            {age ? <span className="ml-2 font-sans text-xl text-muted">{age}</span> : null}
          </p>
          <p className="mt-1 truncate text-sm text-muted">
            {[current && identityLine(current), current?.role, distance, current?.location?.split(",")[0], current?.bio]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label="Pass"
          onClick={() => decide("pass")}
          className="grid size-14 place-items-center rounded-full border border-border bg-surface text-muted transition-transform duration-150 ease-out active:scale-[0.9]"
        >
          <X className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Undo"
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1));
            reset();
          }}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface text-subtle transition-transform duration-150 ease-out active:scale-[0.9]"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Like"
          onClick={() => decide("like")}
          className="grid size-14 place-items-center rounded-full bg-accent text-accent-fg transition-transform duration-150 ease-out active:scale-[0.9]"
        >
          <Heart className="size-5 fill-current" />
        </button>
      </div>
    </div>
  );
}
