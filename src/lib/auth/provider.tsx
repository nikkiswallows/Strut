import { useEffect, type ReactNode } from "react";
import { authClient, getBearerToken } from "./client";
import { restoreSessionBearer } from "@/lib/session-bearer";
import { readLocalSession, writeLocalSession } from "@/lib/local-session";

/**
 * Mount once at the root. Recovers a durable session from cookies or a stored
 * bearer so Google/X redirects and hard reloads stay signed in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    restoreSessionBearer();
    const recover = async () => {
      try {
        const { data } = await authClient.getSession();
        const token =
          (data as { session?: { token?: string } } | null)?.session?.token || getBearerToken();
        const userId = (data as { user?: { id?: string; name?: string | null } } | null)?.user?.id;
        if (token && userId) {
          writeLocalSession({
            token,
            userId,
            name: (data as { user?: { name?: string | null } } | null)?.user?.name ?? null,
            onboarded: readLocalSession()?.onboarded,
          });
          return;
        }
      } catch {
        /* fall through to HTTP */
      }
      try {
        const token = getBearerToken();
        const res = await fetch("/api/session/token", {
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            accept: "application/json",
            ...(token ? { authorization: `Bearer ${token}`, "x-strut-session": token } : {}),
          },
        });
        const payload = (await res.json().catch(() => null)) as {
          token?: string | null;
          userId?: string | null;
          name?: string | null;
          onboarded?: boolean | null;
        } | null;
        if (payload?.token && payload.userId) {
          writeLocalSession({
            token: payload.token,
            userId: payload.userId,
            name: payload.name ?? null,
            onboarded: payload.onboarded ?? readLocalSession()?.onboarded,
          });
        }
      } catch {
        /* ignore */
      }
    };
    void recover();
  }, []);
  return <>{children}</>;
}
