import { createFileRoute } from "@tanstack/react-router";
import { callAuth } from "@/lib/auth/forward.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { publicOrigin } from "@/lib/auth/public-origin.server";
import { toE164, countryByIso, nationalDigits, isValidNational } from "@/lib/phone";

export const Route = createFileRoute("/api/phone/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            iso?: string;
            national?: string;
            code?: string;
          };
          const iso = body.iso?.trim().toUpperCase() ?? "";
          const country = countryByIso(iso);
          if (!country) throw new Error("Pick a country.");
          const national = nationalDigits(iso, body.national ?? "");
          if (!isValidNational(iso, national)) {
            throw new Error("Enter a valid mobile number.");
          }
          const phoneNumber = toE164(iso, national);
          const code = (body.code ?? "").replace(/\D/g, "");
          if (code.length !== 6) throw new Error("Enter the 6-digit code.");

          // Better Auth verifies the OTP, creates the user on first sign-in,
          // and sets the session cookie — we stream its Set-Cookie straight back.
          const res = await callAuth(
            request,
            "/api/auth/phone-number/verify",
            { phoneNumber, code },
            publicOrigin(request),
          );
          const json = (await res.json().catch(() => null)) as
            | { message?: string; token?: string; user?: { id?: string } }
            | null;
          if (!res.ok) {
            throw new Error(json?.message || "That code didn't work.");
          }

          // Build a response that carries Better Auth's session Set-Cookie
          // headers plus a tidy body the UI understands.
          const headers = new Headers({
            "content-type": "application/json",
            "cache-control": "no-store",
          });
          for (const cookie of res.headers.getSetCookie()) {
            headers.append("set-cookie", cookie);
          }
          const sessionReq = new Request(request.url, { headers: request.headers });
          const user = await getSessionUserFromRequest(sessionReq);
          return new Response(
            JSON.stringify({
              ok: true,
              e164: phoneNumber,
              userId: user?.id ?? json?.user?.id ?? null,
            }),
            { status: 200, headers },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not verify that code.";
          return Response.json(
            { error: message },
            {
              status: 400,
              headers: { "content-type": "application/json", "cache-control": "no-store" },
            },
          );
        }
      },
    },
  },
});
