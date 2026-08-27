import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAppOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { storePhotoObject } from "@/lib/server/media.server";

function dataUrlToBytes(image: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(
    image.trim(),
  );
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
          const user = await getSessionUserFromRequest(request);
          if (!user) {
            return Response.json(
              { error: "Sign in again to add photos." },
              { status: 401 },
            );
          }

          const contentType = request.headers.get("content-type") || "";
          let bytes: Uint8Array | null = null;
          let fileType = "image/jpeg";

          if (contentType.includes("application/json")) {
            const body = (await request.json()) as { image?: string };
            const parsed = body.image ? dataUrlToBytes(String(body.image)) : null;
            if (!parsed) return Response.json({ error: "Choose a photo." }, { status: 400 });
            bytes = parsed.bytes;
            fileType = parsed.contentType;
          } else {
            const form = await request.formData();
            const file = form.get("file");
            if (!(file instanceof File) || file.size === 0) {
              return Response.json({ error: "Choose a photo." }, { status: 400 });
            }
            bytes = new Uint8Array(await file.arrayBuffer());
            fileType = file.type || "image/jpeg";
          }

          const url = await storePhotoObject({
            userId: user.id,
            bytes,
            contentType: fileType,
          });
          return Response.json(
            { url },
            {
              status: 200,
              headers: { "content-type": "application/json", "cache-control": "no-store" },
            },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not upload photo.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
