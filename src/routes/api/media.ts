import { createFileRoute } from "@tanstack/react-router";
import { isTrustedAppOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { cleanPhotoBlurs, storePhotoObject } from "@/lib/server/media.server";
import { rateLimit, sweepRateBuckets } from "@/lib/server/rate-limit";

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

          // Uploads write to paid Blob storage — cap per user per hour.
          sweepRateBuckets();
          if (!rateLimit(`media-upload:${user.id}`, 40, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many uploads. Try again in a little while." },
              { status: 429, headers: { "cache-control": "no-store" } },
            );
          }

          const contentType = request.headers.get("content-type") || "";
          let bytes: Uint8Array | null = null;
          let fileType = "image/jpeg";
          let blur = "";

          if (contentType.includes("application/json")) {
            const body = (await request.json()) as { image?: string; blur?: string };
            const parsed = body.image ? dataUrlToBytes(String(body.image)) : null;
            if (!parsed) return Response.json({ error: "Choose a photo." }, { status: 400 });
            bytes = parsed.bytes;
            fileType = parsed.contentType;
            // The discreet placeholder is generated in the browser. It must be a
            // small image data URI — never a remote URL, which would turn every
            // deck card containing it into a tracking pixel.
            if (typeof body.blur === "string") {
              [blur] = cleanPhotoBlurs([body.blur], 1);
            }
          } else {
            const form = await request.formData();
            const file = form.get("file");
            if (!(file instanceof File) || file.size === 0) {
              return Response.json({ error: "Choose a photo." }, { status: 400 });
            }
            bytes = new Uint8Array(await file.arrayBuffer());
            fileType = file.type || "image/jpeg";
            const rawBlur = form.get("blur");
            if (typeof rawBlur === "string") {
              [blur] = cleanPhotoBlurs([rawBlur], 1);
            }
          }

          const url = await storePhotoObject({
            userId: user.id,
            bytes,
            contentType: fileType,
          });
          return Response.json(
            { url, blur },
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
