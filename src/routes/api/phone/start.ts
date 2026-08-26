import { createFileRoute } from "@tanstack/react-router";
import { issuePhoneCode } from "@/lib/server/phone";

export const Route = createFileRoute("/api/phone/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { iso?: string; national?: string };
          const host = request.headers.get("x-forwarded-host") || new URL(request.url).host;
          const result = await issuePhoneCode(
            { iso: body.iso ?? "", national: body.national ?? "" },
            host,
          );
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not send a code.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
