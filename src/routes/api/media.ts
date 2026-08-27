import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAppOrigin } from "@/lib/auth/isolation.server";
import { requireSession, sessionHeaders } from "@/lib/server/device-session.server";
import { storePhotoObject } from "@/lib/server/media.server";

function dataUrlToBytes(image: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(image.trim());
  if (!match) return null;
  const contentType = match[1]!;
  const binary = Buffer.from(match[2]!, "base64");
  if (!binary.byteLength) return null;
  return { bytes: new Uint8Array(binary), contentType };
}

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!isTrustedAppOrigin(request)) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
          const contentType = request.headers.get("content-type") || "";
          let extraToken: string | null = null;
          let bytes: Uint8Array | null = null;
          let fileType = "image/jpeg";

          try {
            extraToken = new URL(request.url).searchParams.get("sessionToken");
          } catch {
            /* ignore */
          }

          if (contentType.includes("application/json")) {
            const body = (await request.json()) as {
              image?: string;
              sessionToken?: string | null;
            };
            extraToken = (body.sessionToken && String(body.sessionToken)) || extraToken;
            const parsed = body.image ? dataUrlToBytes(String(body.image)) : null;
            if (!parsed) {
              return Response.json({ error: "Choose a photo." }, { status: 400 });
            }
            bytes = parsed.bytes;
            fileType = parsed.contentType;
          } else {
            const form = await request.formData();
            extraToken = String(form.get("sessionToken") ?? "") || extraToken;
            const file = form.get("file");
            if (!(file instanceof File) || file.size === 0) {
              return Response.json({ error: "Choose a photo." }, { status: 400 });
            }
            bytes = new Uint8Array(await file.arrayBuffer());
            fileType = file.type || "image/jpeg";
          }

          const session = await requireSession(request, extraToken);
          const url = await storePhotoObject({
            userId: session.userId,
            bytes,
            contentType: fileType,
          });
          const headers = sessionHeaders(session.token);
          headers.set("content-type", "application/json");
          return new Response(JSON.stringify({ url }), { status: 200, headers });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not upload photo.";
          return Response.json(
            { error: message === "Unauthorized" ? "Sign in again to add photos." : message },
            { status: message === "Unauthorized" ? 401 : 400 },
          );
        }
      },
    },
  },
});
