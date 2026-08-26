import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

export const Route = createFileRoute("/api/session/token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        const token = session?.session?.token ?? null;
        const headers = new Headers({
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        if (token) headers.set("set-auth-token", token);
        return new Response(JSON.stringify({ token, userId: session?.user?.id ?? null }), {
          status: 200,
          headers,
        });
      },
    },
  },
});
