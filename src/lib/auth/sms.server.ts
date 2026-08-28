/**
 * Twilio SMS delivery for phone OTP (server-only).
 *
 * Configured via TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
 * (or TWILIO_MESSAGING_SERVICE_SID). When unset, callers fall back to the dev
 * code path (code shown in the UI) — which production refuses to do.
 *
 * Notes that matter in production:
 *  - Every request is time-boxed. An untimed outbound fetch from a serverless
 *    function holds the invocation open until the platform kills it.
 *  - Twilio's own error detail is logged server-side but never shown to the
 *    client: it can distinguish "unverified number" from "invalid number",
 *    which is exactly the account-enumeration signal an attacker wants.
 *  - `TWILIO_API_BASE` exists so the endpoint can be pointed at a Twilio edge
 *    (some accounts are provisioned on api.*.twilio.com) or at a local mock
 *    for testing. Defaults to the public API.
 */
import { env, smsConfigured, twilioApiBase } from "@/lib/env";

const DEFAULT_TIMEOUT_MS = 10_000;

export type SmsResult = { ok: true; sid: string | null } | { ok: false; reason: string };

/**
 * Send the OTP text. Callers should treat a failure as "do not reveal why".
 * Returns a result instead of throwing so the route can decide how much to say.
 */
export async function deliverSmsOtp(to: string, code: string): Promise<SmsResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM_NUMBER");
  const messagingServiceSid = env("TWILIO_MESSAGING_SERVICE_SID");

  if (!sid || !token || !smsConfigured()) {
    return { ok: false, reason: "Twilio credentials are incomplete." };
  }
  if (!from && !messagingServiceSid) {
    return { ok: false, reason: "Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID." };
  }

  const body = `Strut code: ${code}. It expires in 5 minutes. Never share this code.`;
  const url = `${twilioApiBase()}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const basic = Buffer.from(`${sid}:${token}`).toString("base64");

  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service takes precedence when both are set: it handles sender
  // selection, opt-out keywords (STOP) and per-country routing for you.
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else form.set("From", from!);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // Logged for operators, never surfaced (see the note above).
      console.error(
        "[twilio] send failed",
        res.status,
        detail.replace(/\s+/g, " ").slice(0, 300),
      );
      return { ok: false, reason: "twilio_rejected" };
    }

    const payload = (await res.json().catch(() => null)) as { sid?: string } | null;
    return { ok: true, sid: payload?.sid ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[twilio] request failed:", message);
    return { ok: false, reason: "twilio_unreachable" };
  }
}

/**
 * Read-only wiring check for /api/phone/status and the deploy diagnostics.
 * Never sends a message and never reveals the auth token.
 */
export function twilioDiagnostics() {
  const sid = env("TWILIO_ACCOUNT_SID");
  return {
    configured: smsConfigured(),
    accountSid: sid ? `${sid.slice(0, 6)}…${sid.slice(-4)}` : null,
    hasAuthToken: Boolean(env("TWILIO_AUTH_TOKEN")),
    fromNumber: env("TWILIO_FROM_NUMBER") ?? null,
    messagingService: env("TWILIO_MESSAGING_SERVICE_SID") ? "set" : null,
    base: twilioApiBase(),
  };
}
