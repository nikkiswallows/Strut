import { useEffect, type ReactNode } from "react";
import { authClient, getBearerToken } from "./client";
import { restoreSessionBearer, storeSessionBearer } from "@/lib/session-bearer";

/**
 * App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
 *
 *   <AuthProvider><Outlet /></AuthProvider>
 *
 * Pulls a session token out of the cookie (HTTP route) so server functions
 * can authenticate with a bearer on hosts that drop cookies on RPC.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    restoreSessionBearer();
    const fromSession = async () => {
      try {
        const { data } = await authClient.getSession();
        const token = (data as { session?: { token?: string } } | null)?.session?.token;
        if (token) storeSessionBearer(token);
      } catch {
        /* ignore */
      }
    };
    const fromCookie = async () => {
      if (getBearerToken()) return;
      try {
        const res = await fetch("/api/session/token", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as { token?: string } | null;
        if (payload?.token) storeSessionBearer(payload.token);
      } catch {
        /* ignore */
      }
    };
    void fromSession().then(fromCookie);
  }, []);
  return <>{children}</>;
}
