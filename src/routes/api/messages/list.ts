import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { listChats } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const userId = user.id;
        const conversations = await listChats(userId);
        return Response.json({ conversations }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
