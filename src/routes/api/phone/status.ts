import { createFileRoute } from "@tanstack/react-router";
import { isProduction, smsConfigured } from "@/lib/env";
import { twilioDiagnostics } from "@/lib/auth/sms.server";

/**
 * Read-only wiring check for phone sign-in: `GET /api/phone/status`.
 *
 * Reports whether Twilio is configured and what the app *thinks* it will do,
 * with secrets redacted. It never sends a message and never reveals a token.
 * On a production deployment it only reports the booleans — the same posture
 * as /api/config — so it can't be used to fingerprint the Twilio account.
 */
export const Route = createFileRoute("/api/phone/status")({
  server: {
    handlers: {
      GET: async () => {
        const sms = smsConfigured();
        const gated = isProduction() && !sms;
        const diagnostics = twilioDiagnostics();

        return Response.json(
          {
            sms,
            production: isProduction(),
            gated,
            delivery: sms ? "sms" : "preview",
            message: sms
              ? "Phone sign-in is live: codes are delivered by SMS."
              : gated
                ? "Production without Twilio — phone sign-in is disabled (fail closed). Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER."
                : "Twilio not configured: codes are shown on screen (dev/preview only).",
            // Detail is useful while wiring things up and useless (or slightly
            // leaky) once live, so it is withheld in production.
            twilio: isProduction() ? undefined : diagnostics,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
