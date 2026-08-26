import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("text-accent", className)} fill="none" aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M16 4.5C10.2 12.2 5.5 16.2 5.5 21.2c0 3.6 2.9 6.5 6.6 6.5 1 0 1.9-.2 2.7-.6-.4 1.5-1.2 3.2-2.3 4.4h7c-1.1-1.2-1.9-2.9-2.3-4.4.8.4 1.7.6 2.7.6 3.7 0 6.6-2.9 6.6-6.5 0-5-4.7-9-10.5-16.7Z"
        fill="currentColor"
        className="text-accent-fg"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-semibold tracking-[0.28em] uppercase leading-none", className)}>
      Strut
    </span>
  );
}

export function Kicker({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-xs tracking-[0.32em] text-accent uppercase", className)}>{children}</p>
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
      <span className="flex flex-col gap-0.5">
        <Wordmark className={cn("text-[1.7rem]", wordClassName)} />
        <span className="text-[9px] tracking-[0.42em] text-accent uppercase">BNWO</span>
      </span>
    </span>
  );
}
