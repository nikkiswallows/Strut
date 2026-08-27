/**
 * Dev/preview OTP stash (server-only, in-memory).
 *
 * When Twilio is NOT configured, the phone plugin's `sendOTP` callback stores
 * the code here so the `/api/phone/start` route can return it to the UI (the
 * code is shown on the verify screen). This is NEVER used in production, where
 * SMS delivery is real and no code is returned to the client.
 */
const TTL_MS = 5 * 60 * 1000;

type Entry = { code: string; expiresAt: number };

const store = new Map<string, Entry>();

export function stashDevOtp(phoneNumber: string, code: string): void {
  store.set(phoneNumber, { code, expiresAt: Date.now() + TTL_MS });
}

export function takeDevOtp(phoneNumber: string): string | null {
  const entry = store.get(phoneNumber);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(phoneNumber);
    return null;
  }
  return entry.code;
}
