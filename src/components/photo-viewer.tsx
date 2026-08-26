import { useRef, useState } from "react";
import { asPhotoList } from "@/lib/types";
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
  const shots = asPhotoList(photos);
  const list = shots.length ? shots : [null];
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const startX = useRef<number | null>(null);
  const safeIndex = Math.min(index, list.length - 1);
  const current = list[safeIndex];

  function go(next: number, direction: 1 | -1) {
    if (list.length < 2) return;
    const wrapped = (next + list.length) % list.length;
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
          key={`${safeIndex}-${dir}`}
          src={current}
          alt={name}
          name={name}
          className={cn(
            "absolute inset-0 size-full object-cover",
            dir === 1 ? "animate-photo-next" : "animate-photo-prev",
          )}
        />
      </div>
      {list.length > 1 ? (
        <>
          <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i, i > safeIndex ? 1 : -1)}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-200",
                  i === safeIndex ? "bg-fg" : "bg-fg/30",
                )}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
          <p className="absolute top-5 right-3 z-10 rounded-full bg-bg/55 px-2 py-0.5 text-[11px] text-fg backdrop-blur-sm">
            {safeIndex + 1}/{list.length}
          </p>
          <div className="absolute inset-0 z-[1] flex">
            <button
              type="button"
              className="flex-1"
              onClick={() => go(safeIndex - 1, -1)}
              aria-label="Previous photo"
            />
            <button
              type="button"
              className="flex-1"
              onClick={() => go(safeIndex + 1, 1)}
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
  const shots = asPhotoList(photos);
  const list = shots.length ? shots : [null];
  return (
    <div className="hide-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto">
      {list.map((src, i) => (
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
