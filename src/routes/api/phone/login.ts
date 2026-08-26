import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import {
  durableSessionFromAuthToken,
  migrateProfile,
  sessionCookie,
} from "@/lib/server/device-session.server";
import { completePhoneLogin } from "@/lib/server/phone-login.server";

export const Route = createFileRoute("/api/phone/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            iso?: string;
            national?: string;
            code?: string;
            sessionToken?: string;
          };
          const priorUser = await userIdFromRequest(request, body.sessionToken);
          const result = await completePhoneLogin(
            {
              iso: body.iso ?? "",
              national: body.national ?? "",
              code: body.code ?? "",
            },
            request,
          );
          const durable = await durableSessionFromAuthToken(request, result.token);
          if (priorUser) await migrateProfile(priorUser, durable.userId);
          const headers = new Headers({
            "content-type": "application/json",
            "cache-control": "no-store",
          });
          for (const cookie of result.cookies) {
            headers.append("set-cookie", cookie);
          }
          headers.set("set-auth-token", durable.token);
          headers.append("set-cookie", sessionCookie(durable.token));
          return new Response(
            JSON.stringify({
              e164: result.e164,
              token: durable.token,
              userId: durable.userId,
              isNew: result.isNew,
            }),
            { status: 200, headers },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not verify that code.";
          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
