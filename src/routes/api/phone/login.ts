import { createFileRoute } from "@tanstack/react-router";
import { completePhoneLogin } from "@/lib/server/phone";

export const Route = createFileRoute("/api/phone/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { iso?: string; national?: string; code?: string };
          const result = await completePhoneLogin(
            {
              iso: body.iso ?? "",
              national: body.national ?? "",
              code: body.code ?? "",
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
            JSON.stringify({
              e164: result.e164,
              token: result.token,
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
