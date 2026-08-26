import { cn, initials } from "@/lib/utils";

export function Photo({
  src,
  alt,
  className,
  name,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  name?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "grid place-items-center bg-elevated text-muted font-display text-2xl",
          className,
        )}
        aria-label={alt}
      >
        {initials(name || alt)}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={cn("object-cover", className)}
      loading="lazy"
    />
  );
}

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-10";
  return (
    <Photo
      src={src}
      alt={name}
      name={name}
      className={cn(dim, "shrink-0 rounded-full")}
    />
  );
}
