import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M10.2 11.6c0-2.4 2.1-4.1 5.4-4.1 3.1 0 5.2 1.5 5.6 3.7h-2.6c-.3-1-.9-1.6-3-1.6-1.7 0-2.6.7-2.6 1.7 0 .9.7 1.4 2.8 1.8l1.6.3c3.3.7 5.2 2.1 5.2 4.7 0 2.8-2.4 4.6-6.1 4.6-3.6 0-5.9-1.8-6.3-4.3h2.7c.3 1.2 1.3 2.1 3.6 2.1 2 0 3.3-.8 3.3-2.1 0-1.1-.8-1.6-3.1-2.1l-1.6-.3c-3.1-.7-4.9-2.1-4.9-4.7Z"
        fill="currentColor"
        className="text-accent-fg"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-medium tracking-[0.28em] uppercase leading-none",
        className,
      )}
    >
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

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3", className)}>
      <Logo markClassName="size-12" wordClassName="text-5xl tracking-[0.32em]" />
      <p className="text-xs tracking-[0.32em] text-accent uppercase">Walk in. Be seen.</p>
    </div>
  );
}
