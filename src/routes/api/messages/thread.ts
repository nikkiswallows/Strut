import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { getChat } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/thread")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const userId = user.id;
        const id = Number(new URL(request.url).searchParams.get("id"));
        if (!Number.isFinite(id)) return Response.json({ error: "Missing thread." }, { status: 400 });
        const thread = await getChat(userId, id);
        return Response.json({ thread }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
