import { createFileRoute } from "@tanstack/react-router";
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
          };
          const result = await completeEmailLogin(
            {
              email: body.email ?? "",
              password: body.password ?? "",
              name: body.name,
              join: Boolean(body.join),
            },
            request,
          );
          const headers = new Headers({
            "content-type": "application/json",
            "cache-control": "no-store",
          });
          for (const cookie of result.cookies) {
            headers.append("set-cookie", cookie);
          }
          if (result.token) headers.set("set-auth-token", result.token);
          return new Response(
            JSON.stringify({ token: result.token, isNew: result.isNew }),
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
