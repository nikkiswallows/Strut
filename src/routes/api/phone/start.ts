import { createFileRoute } from "@tanstack/react-router";
import { callAuth } from "@/lib/auth/forward.server";
import { takeDevOtp } from "@/lib/auth/otp-dev.server";
import { publicOrigin } from "@/lib/auth/public-origin.server";
import { smsConfigured } from "@/lib/env";
import { toE164, countryByIso, nationalDigits, isValidNational } from "@/lib/phone";

export const Route = createFileRoute("/api/phone/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            iso?: string;
            national?: string;
          };
          const iso = body.iso?.trim().toUpperCase() ?? "";
          const country = countryByIso(iso);
          if (!country) throw new Error("Pick a country.");
          const national = nationalDigits(iso, body.national ?? "");
          if (!isValidNational(iso, national)) {
            throw new Error("Enter a valid mobile number.");
          }
          const phoneNumber = toE164(iso, national);

          const res = await callAuth(
            request,
            "/api/auth/phone-number/send-otp",
            { phoneNumber },
            publicOrigin(request),
          );
          const json = (await res.json().catch(() => null)) as
            | { message?: string; code?: string }
            | null;
          if (!res.ok) {
            throw new Error(json?.message || "Could not send a code.");
          }

          // No Twilio: surface the code so the verify screen can show it.
          const previewCode = smsConfigured() ? null : takeDevOtp(phoneNumber);
          return Response.json(
            {
              ok: true,
              e164: phoneNumber,
              delivery: smsConfigured() ? "sms" : "preview",
              previewCode,
              expiresIn: 300,
              resendIn: 45,
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not send a code.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
