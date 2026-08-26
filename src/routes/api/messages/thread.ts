import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { getChat } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/thread")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromRequest(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const id = Number(new URL(request.url).searchParams.get("id"));
        if (!Number.isFinite(id)) return Response.json({ error: "Missing thread." }, { status: 400 });
        const thread = await getChat(userId, id);
        return Response.json({ thread }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
