import { createFileRoute } from "@tanstack/react-router";
import { publicRuntimeConfig } from "@/lib/auth/runtime-config.server";

/** Public runtime config — which features/providers are wired (no secrets). */
export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(publicRuntimeConfig(), {
          headers: {
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
          },
        });
      },
    },
  },
});
