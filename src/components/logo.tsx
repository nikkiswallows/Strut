import { NAME } from "@/lib/brand";
import { AppMark } from "./graphics";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return <AppMark className={className} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-bold tracking-[0.22em] uppercase leading-none shimmer-text", className)}>
      {NAME}
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
