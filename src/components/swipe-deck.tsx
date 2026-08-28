import { Heart, RotateCcw, X } from "lucide-react";
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
import { Photo } from "./photo";

/**
 * A Tinder-style one-card-at-a-time deck.
 *
 * Interaction is tuned to feel native:
 *  - the card follows the finger 1:1 (no transition during a drag),
 *  - a fast flick decides even if it never crosses the pixel threshold,
 *  - the card flies out from where it was released, not from center,
 *  - the next card sits underneath and scales in as you drag across,
 *  - decisions are double-safe: an in-drag release and a button tap both work.
 */
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
  /**
   * Undo the previous decision. Must call back to the server: the decision was
   * already recorded (and, for a like, already mirrored into `likes`), so
   * rewinding the local index alone would show a card the member has in fact
   * already liked — and swiping again would produce a false match.
   */
  onUndo?: (profile: Profile) => void;
  onNeedMore: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  emptyLabel: string;
}) {
  const [index, setIndex] = useState(0);
  // x is the live horizontal offset (0 = rest). settled = the card will animate
  // back to rest; gone = the card is flying out toward a decision.
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState<"left" | "right" | null>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const draggingRef = useRef(false);
  const velocityRef = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  // Held so the fly-out timer can be cancelled on unmount: a pending
  // setTimeout that fires after teardown tries to setState on a dead component.
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
  // Use the last photo so the top card reads "full"; fall back to first.
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
      // After the fly-out, settle back to rest for the next card.
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
    // Velocity: horizontal px per ms over the last sample.
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
    // Decide on threshold OR velocity (a fast flick flies a short drag out).
    if (dx > SWIPE_THRESHOLD || vx > VELOCITY_THRESHOLD) decide("like", vx);
    else if (dx < -SWIPE_THRESHOLD || vx < -VELOCITY_THRESHOLD) decide("pass", vx);
    else {
      setGone(null);
      setX(0);
    }
  }

  // Reset the deck position whenever the card set itself changes (e.g. filters).
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
  // Scale feedback: the card shrinks slightly as you drag away; the next card
  // grows in underneath so the stack looks alive.
  const scale = 1 - Math.min(0.12, Math.abs(x) / 1400);
  const underScale = 0.94 + Math.min(0.06, Math.abs(x) / 2400);

  // Two different transform "modes":
  //   - dragging: follow the finger exactly, NO transition (native feel).
  //   - gone:     animate the fly-out off-screen with a short ease.
  //   - rest/settle: animate back to center.
  const isGone = gone !== null;
  const cardTransform =
    isGone && gone
      ? `translate3d(${gone === "right" ? 620 : -620}px, 0, 0) rotate(${gone === "right" ? 24 : -24}deg)`
      : `translate3d(${x}px, 0, 0) rotate(${rotate}deg) scale(${scale})`;

  return (
    <div className="relative mx-auto h-full w-full max-w-md">
      {/* Underneath card (next in the deck) */}
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

      {/* Top card */}
      <div
        key={key}
        className="absolute inset-0 touch-none select-none overflow-hidden rounded-3xl bg-surface"
        style={{
          transform: cardTransform,
          // No transition while the finger is down — this is what makes the card
          // follow 1:1 instead of lagging behind. Only animate on fly-out/settle.
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
          <span className="absolute top-4 left-4 z-[3] rounded-full border border-accent/50 bg-bg/70 px-2.5 py-0.5 text-[10px] tracking-[0.18em] text-accent uppercase backdrop-blur-sm">
            {badge}
          </span>
        ) : null}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-5">
          <p className="font-display text-4xl leading-tight text-fg">
            {current?.displayName}
            {age ? <span className="ml-2 font-sans text-xl text-muted">{age}</span> : null}
          </p>
          <p className="mt-1 truncate text-sm text-muted">
            {[current && identityLine(current), current?.role, distance, current?.location?.split(",")[0]]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {current?.bio ? (
            <p className="mt-1 line-clamp-2 text-sm text-subtle">{current.bio}</p>
          ) : null}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-4 z-[4] flex items-center justify-center gap-6">
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
              // The card at index - 1 is the one just decided on. Tell the
              // server first so the deck and the database agree; the local
              // rewind alone is what made Undo lie.
              const previous = profiles[index - 1];
              if (previous) onUndo?.(previous);
              setIndex((i) => Math.max(0, i - 1));
              setGone(null);
              setX(0);
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

const SWIPE_THRESHOLD = 72;
const VELOCITY_THRESHOLD = 0.55; // px/ms — a quick flick triggers a decision
