/**
 * Twilio SMS delivery for phone OTP (server-only).
 *
 * Configured via TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER.
 * When unset, callers fall back to the dev code path (code shown in the UI).
 */
import { env, smsConfigured } from "@/lib/env";

export async function deliverSmsOtp(to: string, code: string): Promise<void> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const from = env("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from || !smsConfigured()) {
    throw new Error("SMS is not configured.");
  }
  const body = `Strut code: ${code}. It expires in 5 minutes.`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    sid,
  )}/Messages.json`;
  const basic = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[auth] Twilio send failed", res.status, detail.slice(0, 300));
    throw new Error("Could not send the text. Try again in a moment.");
  }
}
