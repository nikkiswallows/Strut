import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M16 6.2c.4 0 6.6 7.2 6.6 11.4 0 2.4-1.7 4-3.8 4.2 1.1 1.6 1.8 3.2 2.4 4.2h-10.4c.6-1 1.3-2.6 2.4-4.2C10.1 21.6 8.4 20 8.4 17.6 8.4 13.4 15.6 6.2 16 6.2Z"
        fill="currentColor"
        className="text-accent-fg"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-medium tracking-[0.28em] uppercase leading-none", className)}>
      Strut
    </span>
  );
}

export function Logo({
  className,
  markClassName,
  wordClassName,
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-fg", className)}>
      <Mark className={cn("size-9", markClassName)} />
      <Wordmark className={cn("text-[1.85rem]", wordClassName)} />
    </span>
  );
}
