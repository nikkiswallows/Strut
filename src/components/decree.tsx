import { cn } from "@/lib/utils";

export function Decree({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      className={cn(
        "rounded-lg border border-accent/35 bg-accent/10 px-3.5 py-3 text-sm leading-relaxed text-accent",
        className,
      )}
    >
      {children}
    </p>
  );
}
