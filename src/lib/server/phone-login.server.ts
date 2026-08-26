import { getSql } from "@/lib/db";
import {
  cleanVerify,
  consumePhoneOtp,
  phoneEmail,
  phonePassword,
  type VerifyInput,
} from "./phone";

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

export async function completePhoneLogin(
  input: VerifyInput,
  request: Request,
): Promise<{ e164: string; token: string; isNew: boolean; cookies: string[] }> {
  const data = cleanVerify(input);
  await consumePhoneOtp(data.e164, data.code);
  const session = await createPhoneSession(data.e164, request);
  return {
    e164: data.e164,
    token: session.token,
    isNew: session.isNew,
    cookies: session.cookies,
  };
}
