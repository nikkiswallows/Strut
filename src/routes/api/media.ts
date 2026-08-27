import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAppOrigin } from "@/lib/auth/isolation.server";
import { requireSession } from "@/lib/server/device-session.server";
import { storePhotoObject } from "@/lib/server/media.server";

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!isTrustedAppOrigin(request)) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
          const form = await request.formData();
          const sessionToken = String(form.get("sessionToken") ?? "");
          const session = await requireSession(request, sessionToken || null);
          const file = form.get("file");
          if (!(file instanceof File) || file.size === 0) {
            return Response.json({ error: "Choose a photo." }, { status: 400 });
          }
          const bytes = new Uint8Array(await file.arrayBuffer());
          const url = await storePhotoObject({
            userId: session.userId,
            bytes,
            contentType: file.type || "image/jpeg",
          });
          return Response.json({ url }, { headers: { "cache-control": "no-store" } });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not upload photo.";
          return Response.json(
            { error: message },
            { status: message === "Unauthorized" ? 401 : 400 },
          );
        }
      },
    },
  },
});
