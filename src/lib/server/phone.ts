import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import {
  countryByIso,
  isValidNational,
  nationalDigits,
  toE164,
} from "@/lib/phone";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_MS = 45 * 1000;
const MAX_SENDS = 4;
const MAX_ATTEMPTS = 5;

type SendInput = { iso: string; national: string };
type VerifyInput = { iso: string; national: string; code: string };

function cleanSend(input: SendInput): { iso: string; e164: string } {
  const iso = input.iso?.trim().toUpperCase() ?? "";
  const country = countryByIso(iso);
  if (!country) throw new Error("Pick a country.");
  const national = nationalDigits(iso, input.national ?? "");
  if (!isValidNational(iso, national)) {
    throw new Error("Enter a valid mobile number.");
  }
  return { iso, e164: toE164(iso, national) };
}

function cleanVerify(input: VerifyInput): { iso: string; e164: string; code: string } {
  const { iso, e164 } = cleanSend(input);
  const code = (input.code ?? "").replace(/\D/g, "");
  if (code.length !== 6) throw new Error("Enter the 6-digit code.");
  return { iso, e164, code };
}

function pepper(): string {
  return (
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.GROK_AUTH_CLIENT_SECRET?.trim() ||
    "strut-phone-preview"
  );
}

async function hashOtp(e164: string, code: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", pepper()).update(`otp:${e164}:${code}`).digest("hex");
}

function phoneEmail(e164: string): string {
  return `${e164.replace(/\D/g, "")}@phone.strut.app`;
}

async function phonePassword(e164: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", pepper()).update(`strut.phone.v1:${e164}`).digest("base64url");
}

async function generateOtp(): Promise<string> {
  const { randomInt } = await import("node:crypto");
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function hashesMatch(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual } = await import("node:crypto");
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

type OtpRow = {
  id: number;
  code_hash: string;
  attempts: number;
  expires_at: string;
  created_at: string;
};

async function deliverSms(to: string, code: string, host: string): Promise<"sms" | "preview"> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!sid || !token || !from) return "preview";

  const domain = host.replace(/:\d+$/, "");
  const body = `Strut code: ${code}. Expires in 5 minutes.\n\n@${domain} #${code}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  if (!res.ok) throw new Error("Could not send the text. Try again in a moment.");
  return "sms";
}

export const sendPhoneCode = createServerFn({ method: "POST" })
  .validator((input: SendInput) => cleanSend(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const recent = await sql.query<{ n: number }>(
      `select count(*)::int as n from phone_otps
       where phone_e164 = $1 and created_at > now() - interval '10 minutes'`,
      [data.e164],
    );
    if ((recent[0]?.n ?? 0) >= MAX_SENDS) {
      throw new Error("Too many codes. Wait a few minutes and try again.");
    }

    const last = await sql.query<{ created_at: string }>(
      `select created_at from phone_otps
       where phone_e164 = $1
       order by created_at desc
       limit 1`,
      [data.e164],
    );
    if (last[0]) {
      const age = Date.now() - new Date(last[0].created_at).getTime();
      if (age >= 0 && age < RESEND_MS) {
        const wait = Math.ceil((RESEND_MS - age) / 1000);
        throw new Error(`Wait ${wait}s before requesting another code.`);
      }
    }

    const code = await generateOtp();
    const codeHash = await hashOtp(data.e164, code);
    const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();

    await sql.query(`delete from phone_otps where phone_e164 = $1 and expires_at < now()`, [
      data.e164,
    ]);
    await sql.query(
      `insert into phone_otps (phone_e164, code_hash, expires_at) values ($1, $2, $3)`,
      [data.e164, codeHash, expires],
    );

    let host = "strut.app";
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      if (req) host = new URL(req.url).host;
    } catch {
      /* keep fallback host */
    }

    const delivery = await deliverSms(data.e164, code, host);
    return {
      e164: data.e164,
      delivery,
      expiresIn: 300,
      resendIn: Math.floor(RESEND_MS / 1000),
      previewCode: delivery === "preview" ? code : null,
    };
  });

async function applySetCookies(cookies: string[]): Promise<void> {
  if (cookies.length === 0) return;
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    const { parseSetCookieHeader, toCookieOptions } = await import("better-auth/cookies");
    for (const raw of cookies) {
      const parsed = parseSetCookieHeader(raw);
      for (const [name, attr] of parsed) {
        if (!attr.value) continue;
        const options = toCookieOptions(attr);
        setCookie(name, attr.value, {
          path: options.path ?? "/",
          httpOnly: options.httpOnly ?? true,
          secure: options.secure ?? true,
          sameSite: options.sameSite ?? "lax",
          maxAge: options.maxAge,
          expires: options.expires,
        });
      }
    }
  } catch {
    /* HTTP route copies Set-Cookie itself */
  }
}

function authForwardHeaders(request: Request, origin: string): Headers {
  const headers = new Headers({
    "content-type": "application/json",
    origin,
    referer: request.headers.get("referer") || `${origin}/`,
  });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  for (const key of ["host", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-for", "user-agent"]) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

async function betterAuthEmail(
  request: Request,
  opts: { email: string; password: string; name: string; signUp: boolean },
): Promise<{ token: string; cookies: string[] }> {
  const { auth } = await import("@/lib/auth/server");
  const origin =
    request.headers.get("origin") ||
    (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return "http://localhost:8080";
      }
    })();
  const path = opts.signUp ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email";
  const body = opts.signUp
    ? JSON.stringify({ email: opts.email, password: opts.password, name: opts.name, rememberMe: true })
    : JSON.stringify({ email: opts.email, password: opts.password, rememberMe: true });
  const res = await auth.handler(
    new Request(`${origin}${path}`, {
      method: "POST",
      headers: authForwardHeaders(request, origin),
      body,
    }),
  );
  const cookies = res.headers.getSetCookie();
  const json = (await res.json().catch(() => null)) as
    | { token?: string; user?: { id?: string }; message?: string }
    | null;
  if (!res.ok) {
    throw new Error(json?.message || "Could not sign in.");
  }
  const token = json?.token || res.headers.get("set-auth-token") || "";
  if (!token) throw new Error("Could not sign in.");
  return { token, cookies };
}

async function createPhoneSession(
  e164: string,
  request: Request,
): Promise<{ token: string; isNew: boolean; cookies: string[] }> {
  const email = phoneEmail(e164);
  const password = await phonePassword(e164);
  const name = `Member ${e164.slice(-4)}`;

  const sql = await getSql();
  const existing = await sql.query<{ user_id: string }>(
    `select user_id from phone_identities where phone_e164 = $1`,
    [e164],
  );

  const signIn = () => betterAuthEmail(request, { email, password, name, signUp: false });
  const signUp = () => betterAuthEmail(request, { email, password, name, signUp: true });

  let token: string;
  let cookies: string[] = [];
  let isNew = !existing[0];

  if (existing[0]) {
    const signed = await signIn();
    token = signed.token;
    cookies = signed.cookies;
  } else {
    try {
      const signed = await signUp();
      token = signed.token;
      cookies = signed.cookies;
      isNew = true;
    } catch {
      const signed = await signIn();
      token = signed.token;
      cookies = signed.cookies;
      isNew = false;
    }
  }

  const { auth } = await import("@/lib/auth/server");
  const session = await auth.api.getSession({
    headers: (() => {
      const next = new Headers(request.headers);
      next.set("Authorization", `Bearer ${token}`);
      return next;
    })(),
  });
  const userId = session?.user?.id;
  if (!userId) throw new Error("Could not create your account.");

  await sql.query(
    `insert into phone_identities (phone_e164, user_id)
     values ($1, $2)
     on conflict (phone_e164) do nothing`,
    [e164, userId],
  );

  await applySetCookies(cookies);
  return { token, isNew, cookies };
}

async function consumePhoneOtp(e164: string, code: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql.query<OtpRow>(
    `select id, code_hash, attempts, expires_at, created_at
     from phone_otps
     where phone_e164 = $1
     order by created_at desc
     limit 1`,
    [e164],
  );
  const row = rows[0];
  if (!row) throw new Error("Request a new code first.");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await sql.query(`delete from phone_otps where id = $1`, [row.id]);
    throw new Error("That code expired. Request a new one.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await sql.query(`delete from phone_otps where id = $1`, [row.id]);
    throw new Error("Too many tries. Request a new code.");
  }

  const expected = await hashOtp(e164, code);
  const ok = await hashesMatch(expected, row.code_hash);
  if (!ok) {
    await sql.query(`update phone_otps set attempts = attempts + 1 where id = $1`, [row.id]);
    const left = MAX_ATTEMPTS - row.attempts - 1;
    throw new Error(
      left > 0
        ? `That code doesn't match. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "Too many tries. Request a new code.",
    );
  }

  await sql.query(`delete from phone_otps where phone_e164 = $1`, [e164]);
}

async function finishPhoneLogin(
  e164: string,
  code: string,
  request: Request,
): Promise<{ e164: string; token: string; isNew: boolean; cookies: string[] }> {
  await consumePhoneOtp(e164, code);
  const session = await createPhoneSession(e164, request);
  return {
    e164,
    token: session.token,
    isNew: session.isNew,
    cookies: session.cookies,
  };
}

export async function completePhoneLogin(
  input: VerifyInput,
  request: Request,
): Promise<{ e164: string; token: string; isNew: boolean; cookies: string[] }> {
  const data = cleanVerify(input);
  return finishPhoneLogin(data.e164, data.code, request);
}

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .validator((input: VerifyInput) => cleanVerify(input))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) throw new Error("Could not start a session.");
    const session = await finishPhoneLogin(data.e164, data.code, request);
    return {
      e164: session.e164,
      token: session.token,
      isNew: session.isNew,
    };
  });
