import { RotateCcw, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatMiles } from "@/lib/geo";
import { badgeFor } from "@/lib/bnwo";
import { asPhotoList, identityLine, shownAge, type Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";
import { BadgePill, Spade } from "./graphics";

export function SwipeDeck({
  profiles,
  onSwipe,
  onUndo,
  onNeedMore,
  loadingMore,
  hasMore,
  emptyLabel,
}: {
  profiles: Profile[];
  onSwipe: (profile: Profile, direction: "like" | "pass") => void;
  onUndo?: (profile: Profile) => void;
  onNeedMore: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  emptyLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState<"left" | "right" | null>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const draggingRef = useRef(false);
  const velocityRef = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const settleTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    },
    [],
  );

  const current = useMemo(() => profiles[index] ?? null, [profiles, index]);
  const nextCard = useMemo(() => profiles[index + 1] ?? null, [profiles, index]);

  const photos = current ? asPhotoList(current.photos) : [];
  const blurs = current ? asPhotoList(current.photoBlurs) : [];
  const photoIndex = photos.length - 1 >= 0 ? photos.length - 1 : 0;
  const photo = photos[photoIndex];
  const photoBlur = blurs[photoIndex] ?? null;
  const age = current ? shownAge(current) : null;
  const badge = current ? badgeFor(current) : null;
  const distance = current ? formatMiles(current.distanceMiles) : null;

  const decide = useCallback(
    (direction: "like" | "pass", velocity = 0) => {
      if (!current) return;
      setGone(direction === "like" ? "right" : "left");
      setDragging(false);
      draggingRef.current = false;
      setIndex((i) => i + 1);
      onSwipe(current, direction);
      if (index + 1 >= profiles.length - 2) onNeedMore();
      settleTimer.current = window.setTimeout(() => {
        setGone(null);
        setX(0);
        setDragging(false);
      }, 240);
      void velocity;
    },
    [current, index, profiles.length, onSwipe, onNeedMore],
  );

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!current) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    lastX.current = e.clientX;
    lastTime.current = performance.now();
    velocityRef.current = 0;
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || !current) return;
    const now = performance.now();
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    const dt = Math.max(1, now - lastTime.current);
    velocityRef.current = (e.clientX - lastX.current) / dt;
    lastX.current = e.clientX;
    lastTime.current = now;
    setX(dx);
    e.preventDefault();
    void dy;
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || !current) return;
    draggingRef.current = false;
    setDragging(false);
    const dx = e.clientX - startX.current;
    const vx = velocityRef.current;
    if (dx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD) decide("like", vx);
    else if (dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) decide("pass", vx);
    else {
      setGone(null);
      setX(0);
    }
  }

  const key = current ? `${current.userId}-${index}` : "empty";

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

  const rotate = x / 18;
  const likeOpacity = Math.max(0, Math.min(1, x / SWIPE_THRESHOLD));
  const passOpacity = Math.max(0, Math.min(1, -x / SWIPE_THRESHOLD));
  const scale = 1 - Math.min(0.12, Math.abs(x) / 1400);
  const underScale = 0.94 + Math.min(0.06, Math.abs(x) / 2400);

  const isGone = gone !== null;
  const cardTransform =
    isGone && gone
      ? `translate3d(${gone === "right" ? 620 : -620}px, 0, 0) rotate(${gone === "right" ? 24 : -24}deg)`
      : `translate3d(${x}px, 0, 0) rotate(${rotate}deg) scale(${scale})`;

  return (
    <div className="relative mx-auto h-full w-full max-w-md">
      <div
        key={nextCard ? `under-${nextCard.userId}` : "under-empty"}
        className="absolute inset-0 rounded-3xl bg-surface"
        style={{
          transform: `scale(${underScale})`,
          transition: "transform 180ms ease-out",
        }}
      >
        {nextCard ? (
          <Photo
            src={asPhotoList(nextCard.photos)[0]}
            blurSrc={asPhotoList(nextCard.photoBlurs)[0] ?? null}
            alt={nextCard.displayName}
            name={nextCard.displayName}
            discreet={Boolean(nextCard.discreet)}
            className="absolute inset-0 size-full rounded-3xl object-cover opacity-80"
          />
        ) : null}
      </div>

      <div
        key={key}
        className="absolute inset-0 touch-none select-none overflow-hidden rounded-3xl bg-surface"
        style={{
          transform: cardTransform,
          transition: dragging && !isGone ? "none" : "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          willChange: "transform",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          draggingRef.current = false;
          setDragging(false);
          setX(0);
        }}
      >
        <Photo
          src={photo}
          blurSrc={photoBlur}
          alt={current?.displayName ?? ""}
          name={current?.displayName ?? ""}
          discreet={Boolean(current?.discreet)}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
        {badge ? (
          <BadgePill badge={badge} className="top-4 left-4 px-2.5 py-1 text-[10px]" iconClassName="size-3.5" />
        ) : null}
        <div
          className="absolute top-10 right-3 rounded-xl border-4 border-accent px-3 py-1 font-display text-2xl font-bold tracking-widest text-accent"
          style={{ opacity: likeOpacity, transform: "rotate(12deg)", textShadow: "0 0 18px rgba(216,175,78,.6)" }}
        >
          KNEEL
        </div>
        <div
          className="absolute top-10 left-3 rounded-xl border-4 border-[#c0492f] px-3 py-1 font-display text-2xl font-bold tracking-widest text-[#c0492f]"
          style={{ opacity: passOpacity, transform: "rotate(-12deg)" }}
        >
          PASS
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-5 pb-20">
          <p className="font-display text-[2.1rem] leading-tight text-fg sm:text-4xl">
            {current?.displayName}
            {age ? <span className="ml-2 font-sans text-lg text-muted sm:text-xl">{age}</span> : null}
          </p>
          <p className="mt-1 truncate text-[13px] text-muted sm:text-sm">
            {[current && identityLine(current), current?.role, distance, current?.location?.split(",")[0]]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {current?.bio ? (
            <p className="mt-1 line-clamp-2 text-[13px] text-subtle sm:text-sm">{current.bio}</p>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[4] flex items-center justify-center gap-5 sm:bottom-4 sm:gap-6">
        <button
          type="button"
          aria-label="Pass"
          onClick={() => decide("pass")}
          className="grid size-14 place-items-center rounded-full border border-border bg-surface/90 text-muted backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.9]"
        >
          <X className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Undo"
          onClick={() => {
            const previous = profiles[index - 1];
            if (previous) onUndo?.(previous);
            setIndex((i) => Math.max(0, i - 1));
            setGone(null);
            setX(0);
          }}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface/90 text-subtle backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.9]"
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Like — kneel"
          onClick={() => decide("like")}
          className="btn-gold grid size-14 place-items-center rounded-full shadow-gold active:scale-[0.9]"
        >
          <Spade className="size-7 text-accent-fg" />
        </button>
      </div>
    </div>
  );
}

const SWIPE_THRESHOLD = 72;
const VELOCITY_THRESHOLD = 0.55;
