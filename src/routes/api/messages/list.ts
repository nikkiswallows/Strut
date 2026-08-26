import { createFileRoute } from "@tanstack/react-router";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
import { listChats } from "@/lib/server/chat.server";

export const Route = createFileRoute("/api/messages/list")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await userIdFromRequest(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const conversations = await listChats(userId);
        return Response.json({ conversations }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
