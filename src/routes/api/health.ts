import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  productionConfigProblem,
  publicRuntimeConfig,
} from "@/lib/auth/runtime-config.server";

/**
 * Deployment health check. Unauthenticated and safe to hit directly or wire to a
 * monitor. Returns:
 *   - 200 when the database is reachable and production config is healthy
 *   - 503 with a `problem` message when a required production env var is missing
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const config = publicRuntimeConfig();
        const problem = productionConfigProblem();
        let dbOk = false;
        try {
          const sql = await getSql();
          await sql.query("select 1");
          dbOk = true;
        } catch (err) {
          console.error("[health] database check failed:", err);
        }
        const healthy = dbOk && !problem;
        return Response.json(
          {
            ok: healthy,
            db: dbOk,
            config,
            problem: problem ?? null,
          },
          {
            status: healthy ? 200 : 503,
            headers: { "cache-control": "no-store" },
          },
        );
      },
    },
  },
});
