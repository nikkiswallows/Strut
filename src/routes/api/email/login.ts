import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import {
  durableSessionFromAuthToken,
  migrateProfile,
  sessionHeaders,
} from "@/lib/server/device-session.server";
import { completeEmailLogin } from "@/lib/server/phone-login.server";

export const Route = createFileRoute("/api/email/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            email?: string;
            password?: string;
            name?: string;
            join?: boolean;
            sessionToken?: string;
          };
          const priorUser = await userIdFromRequest(request, body.sessionToken);
          const result = await completeEmailLogin(
            {
              email: body.email ?? "",
              password: body.password ?? "",
              name: body.name,
              join: Boolean(body.join),
            },
            request,
          );
          const durable = await durableSessionFromAuthToken(request, result.token);
          if (priorUser) await migrateProfile(priorUser, durable.userId);
          const headers = sessionHeaders(durable.token);
          headers.set("content-type", "application/json");
          for (const cookie of result.cookies) {
            headers.append("set-cookie", cookie);
          }
          return new Response(
            JSON.stringify({
              token: durable.token,
              userId: durable.userId,
              isNew: result.isNew,
            }),
            { status: 200, headers },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not sign in.";
          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
