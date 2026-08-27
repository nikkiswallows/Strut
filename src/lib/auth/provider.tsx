import { useEffect, type ReactNode } from "react";
import { authClient } from "./client";
import { restoreSessionBearer } from "@/lib/session-bearer";
import { refreshLocalSession } from "@/lib/session-client";

/**
 * Mount once at the root. Recovers a durable DB-backed session from cookies or
 * a stored bearer so Google/X redirects and hard reloads stay signed in.
 * Always goes through `/api/session/token` — never persist Better Auth's raw
 * cookie token alone, or iPhone profile POSTs 401 after OAuth.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    restoreSessionBearer();
    const recover = async () => {
      try {
        await authClient.getSession();
      } catch {
        /* HTTP recover still runs */
      }
      await refreshLocalSession();
    };
    void recover();
  }, []);
  return <>{children}</>;
}
