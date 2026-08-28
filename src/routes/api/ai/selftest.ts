import { createFileRoute } from "@tanstack/react-router";
import { aiConfigured, aiSelfTest } from "@/lib/server/ai.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";

/**
 * Live AI wiring check. Requires a signed-in session — every call fires real
 * requests at every configured provider, so an unauthenticated endpoint is an
 * open AI-credit drain for anyone who finds the URL.
 */
export const Route = createFileRoute("/api/ai/selftest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUserFromRequest(request);
        if (!user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!aiConfigured()) {
          return Response.json(
            {
              configured: false,
              working: null,
              help: "No AI key set. Add GROQ_API_KEY (free), XAI_API_KEY, or OPENROUTER_API_KEY, then redeploy.",
            },
            { status: 200, headers: { "cache-control": "no-store" } },
          );
        }
        const report = await aiSelfTest();
        return Response.json(
          { configured: true, ...report },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
