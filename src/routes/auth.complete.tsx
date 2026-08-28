import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Mark } from "@/components/logo";
import { useMembership } from "@/lib/auth/use-membership";
import { pathForMembership } from "@/lib/auth/membership";

export const Route = createFileRoute("/auth/complete")({
  component: AuthComplete,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});

function AuthComplete() {
  const { phase } = useMembership();
  if (phase === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="size-14 animate-pulse" />
      </div>
    );
  }
  return <Navigate to={pathForMembership(phase) ?? "/login"} />;
}
