import { createFileRoute } from "@tanstack/react-router";
import { aiConfigured, aiSelfTest } from "@/lib/server/ai.server";

/**
 * Live AI wiring check. Open https://<your-domain>/api/ai/selftest in a browser.
 * It actually sends a short in-character message to every configured provider
 * and reports which model returns a usable reply (and the exact HTTP error for
 * any that don't). No secrets are returned. Safe to call after setting keys.
 */
export const Route = createFileRoute("/api/ai/selftest")({
  server: {
    handlers: {
      GET: async () => {
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
