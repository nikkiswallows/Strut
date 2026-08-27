import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mark } from "@/components/logo";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { fetchMyProfile } from "@/lib/profile-api";
import { readLocalSession } from "@/lib/local-session";

export const Route = createFileRoute("/auth/complete")({
  component: AuthComplete,
});

function AuthComplete() {
  const { user, isPending } = useCurrentUserState();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMyProfile(),
    enabled: Boolean(user),
    retry: 1,
  });

  if (isPending || (user && me.isPending && !readLocalSession()?.onboarded && !me.data)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Mark className="size-14 animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (me.data?.onboarded || readLocalSession()?.onboarded) return <Navigate to="/discover" />;
  return <Navigate to="/onboarding" />;
}
