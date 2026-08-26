import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";

export function PhotoViewer({
  photos,
  name,
  className,
}: {
  photos: string[];
  name: string;
  className?: string;
}) {
  const shots = photos.length ? photos : [null];
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const startX = useRef<number | null>(null);
  const current = shots[Math.min(index, shots.length - 1)];

  function go(next: number, direction: 1 | -1) {
    if (shots.length < 2) return;
    const wrapped = (next + shots.length) % shots.length;
    setDir(direction);
    setIndex(wrapped);
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-xl bg-surface", className)}
      onTouchStart={(e) => {
        startX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = startX.current;
        const end = e.changedTouches[0]?.clientX;
        startX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 36) return;
        go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      }}
    >
      <div className="relative aspect-[3/4]">
        <Photo
          key={`${index}-${dir}`}
          src={current}
          alt={name}
          name={name}
          className={cn(
            "absolute inset-0 size-full object-cover",
            dir === 1 ? "animate-photo-next" : "animate-photo-prev",
          )}
        />
      </div>
      {shots.length > 1 ? (
        <>
          <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
            {shots.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i, i > index ? 1 : -1)}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors duration-200",
                  i === index ? "bg-fg" : "bg-fg/30",
                )}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
          <div className="absolute inset-0 z-[1] flex">
            <button
              type="button"
              className="flex-1"
              onClick={() => go(index - 1, -1)}
              aria-label="Previous photo"
            />
            <button
              type="button"
              className="flex-1"
              onClick={() => go(index + 1, 1)}
              aria-label="Next photo"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function PhotoStrip({
  photos,
  name,
}: {
  photos: string[];
  name: string;
}) {
  const shots = photos.length ? photos : [null];
  return (
    <div className="hide-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto">
      {shots.map((src, i) => (
        <div
          key={i}
          className="relative aspect-[3/4] w-[86%] shrink-0 snap-center overflow-hidden rounded-xl bg-surface"
        >
          <Photo src={src} alt={name} name={name} className="absolute inset-0 size-full object-cover" />
        </div>
      ))}
    </div>
  );
}
