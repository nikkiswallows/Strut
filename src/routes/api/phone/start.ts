import { createFileRoute } from "@tanstack/react-router";
import { callAuth } from "@/lib/auth/forward.server";
import { takeDevOtp } from "@/lib/auth/otp-dev.server";
import { publicOrigin } from "@/lib/auth/public-origin.server";
import { isProduction, smsConfigured } from "@/lib/env";
import { toE164, countryByIso, nationalDigits, isValidNational } from "@/lib/phone";
import {
  clientIp,
  cooldown,
  cooldownRemaining,
  rateLimit,
  sweepRateBuckets,
} from "@/lib/server/rate-limit";

/** Tinder-style resend cooldown, enforced here (not just in the UI). */
const RESEND_MS = 45_000;
/** Hard ceilings: SMS is metered money, so every send is rationed. */
const PER_NUMBER_PER_HOUR = 5;
const PER_IP_PER_HOUR = 20;
const PER_IP_PER_DAY = 60;

export const Route = createFileRoute("/api/phone/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const noStore = { "cache-control": "no-store" };
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

          // Fail closed: without Twilio there is no way to deliver a code, and
          // returning the code on screen in production would let anyone sign in
          // as any phone number.
          if (isProduction() && !smsConfigured()) {
            return Response.json(
              {
                error:
                  "Phone sign-in isn't available on this deployment yet. Use email or Google/X.",
              },
              { status: 400, headers: noStore },
            );
          }

          // ── Abuse limits ────────────────────────────────────────────────
          // An OTP endpoint is an open "send an SMS to anyone" button. Left
          // unmetered it becomes SMS pumping / toll fraud: an attacker scripts
          // a list of numbers and the operator pays per message. These limits
          // are deliberately per-number AND per-IP, because neither alone is
          // enough (rotate numbers behind one IP, or rotate IPs at one number).
          sweepRateBuckets();
          const ip = clientIp(request);
          if (!rateLimit(`otp:ip:h:${ip}`, PER_IP_PER_HOUR, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many requests. Try again later." },
              { status: 429, headers: noStore },
            );
          }
          if (!rateLimit(`otp:ip:d:${ip}`, PER_IP_PER_DAY, 24 * 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many requests today. Try again tomorrow." },
              { status: 429, headers: noStore },
            );
          }
          if (!rateLimit(`otp:num:${phoneNumber}`, PER_NUMBER_PER_HOUR, 60 * 60 * 1000)) {
            return Response.json(
              { error: "Too many codes to that number. Try again in an hour." },
              { status: 429, headers: noStore },
            );
          }

          // Server-side resend cooldown. The UI countdown is cosmetic; this is
          // the one that actually stops a script hammering one number.
          const gate = cooldown(`otp:cool:${phoneNumber}`, RESEND_MS);
          if (!gate.ok) {
            return Response.json(
              {
                error: `Wait ${gate.retryAfter}s before requesting another code.`,
                retryAfter: gate.retryAfter,
              },
              { status: 429, headers: noStore },
            );
          }

          // Better Auth's plugin mints the code and calls our sendOTP hook,
          // which either delivers via Twilio or throws (production, no Twilio).
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
            console.error("[phone] send-otp rejected:", res.status, json?.message);
            throw new Error(
              smsConfigured()
                ? "Could not send a text. Check the number and try again."
                : "Could not send a code.",
            );
          }

          // No Twilio configured: only ever surface the code outside production.
          const previewCode =
            !isProduction() && !smsConfigured() ? takeDevOtp(phoneNumber) : null;

          return Response.json(
            {
              ok: true,
              e164: phoneNumber,
              delivery: smsConfigured() ? "sms" : "preview",
              previewCode,
              expiresIn: 300,
              resendIn: cooldownRemaining(`otp:cool:${phoneNumber}`) || RESEND_MS / 1000,
              attemptsRemaining: 5,
            },
            { headers: noStore },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Could not send a code.";
          return Response.json({ error: message }, { status: 400, headers: noStore });
        }
      },
    },
  },
});
