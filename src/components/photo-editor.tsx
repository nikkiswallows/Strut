import { GripVertical, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn, fileToJpegDataUrl, moveItem } from "@/lib/utils";
import { Photo } from "./photo";

export function PhotoEditor({
  photos,
  onChange,
  max = 8,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const start = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null);
  const main = photos[0];

  function promote(index: number) {
    if (index <= 0) return;
    onChange(moveItem(photos, index, 0));
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    onChange(moveItem(photos, from, to));
  }

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const next = [...photos];
    for (const file of Array.from(list).slice(0, max - next.length)) {
      try {
        next.push(await fileToJpegDataUrl(file));
      } catch {
        toast.error("Could not read that photo.");
      }
    }
    onChange(next.slice(0, max));
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-surface">
        <div className="relative aspect-[3/4] sm:aspect-[4/5]">
          <Photo src={main} alt="Main photo" className="absolute inset-0 size-full" />
          {main ? (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-bg/70 px-2.5 py-1 text-[10px] font-medium tracking-wide text-fg uppercase backdrop-blur-sm">
              <Star className="size-3 fill-current" />
              Main
            </span>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted">
              Add a photo to start
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-subtle">Hold and drag to reorder. Tap a look to make it main.</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((src, i) => (
          <div
            key={`${src.slice(0, 24)}-${i}`}
            draggable
            onDragStart={() => {
              setDragFrom(i);
              start.current = { index: i, x: 0, y: 0, moved: true };
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom != null) reorder(dragFrom, i);
              setDragFrom(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setOver(null);
            }}
            onPointerDown={(e) => {
              start.current = { index: i, x: e.clientX, y: e.clientY, moved: false };
            }}
            onPointerMove={(e) => {
              const s = start.current;
              if (!s || s.index !== i) return;
              if (Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) > 12) s.moved = true;
            }}
            onPointerUp={() => {
              const s = start.current;
              start.current = null;
              if (!s) return;
              if (!s.moved) promote(i);
            }}
            className={cn(
              "relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-surface transition-transform duration-150 ease-out active:scale-[0.96]",
              over === i && dragFrom != null && dragFrom !== i ? "ring-2 ring-accent" : "",
              i === 0 ? "ring-2 ring-fg/80" : "",
            )}
          >
            <Photo src={src} alt="" className="size-full pointer-events-none" />
            <span className="pointer-events-none absolute top-1 left-1 text-fg/80">
              <GripVertical className="size-3.5" />
            </span>
            <button
              type="button"
              aria-label="Remove photo"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-bg/70 text-fg transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        {photos.length < max ? (
          <label className="grid h-24 w-20 shrink-0 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-[11px] text-muted transition-transform duration-150 ease-out active:scale-[0.96]">
            Add
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
