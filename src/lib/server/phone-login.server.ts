import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { planEmailLogin } from "@/lib/auth/email-login-plan";
import { publicOrigin } from "@/lib/auth/public-origin.server";
import { userIdFromRequest } from "@/lib/auth/session-from-request.server";
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
  const origin = publicOrigin(request);
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

  const signInRecovering = async (userId?: string | null) => {
    try {
      return await signIn();
    } catch (err) {
      const id =
        userId ||
        (
          await sql.query<{ id: string }>(`select id from "user" where lower(email) = $1 limit 1`, [
            email,
          ])
        )[0]?.id;
      if (!id) throw err;
      await attachPassword(id, password);
      return signIn();
    }
  };

  if (existing[0]) {
    const signed = await signInRecovering(existing[0].user_id);
    token = signed.token;
    cookies = signed.cookies;
  } else {
    try {
      const signed = await signUp();
      token = signed.token;
      cookies = signed.cookies;
      isNew = true;
    } catch {
      const signed = await signInRecovering(null);
      token = signed.token;
      cookies = signed.cookies;
      isNew = false;
    }
  }

  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${token}`);
  for (const cookie of cookies) {
    const match = cookie.match(/^([^;=]+)=([^;]+)/);
    if (match) {
      const existingCookie = headers.get("cookie") ?? "";
      headers.set(
        "cookie",
        existingCookie ? `${existingCookie}; ${match[1]}=${match[2]}` : `${match[1]}=${match[2]}`,
      );
    }
  }
  const userId = await userIdFromRequest(new Request(request.url, { headers }), token);
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

async function lookupEmailAccount(email: string): Promise<{
  userId: string | null;
  name: string | null;
  hasPassword: boolean;
  onboarded: boolean;
}> {
  const sql = await getSql();
  const users = await sql.query<{ id: string; name: string | null }>(
    `select id, name from "user" where lower(email) = $1 limit 1`,
    [email],
  );
  const user = users[0];
  if (!user) return { userId: null, name: null, hasPassword: false, onboarded: false };
  const accounts = await sql.query<{ password: string | null }>(
    `select password from account where "userId" = $1 and "providerId" = 'credential'`,
    [user.id],
  );
  const profiles = await sql.query<{ onboarded: boolean }>(
    `select onboarded from profiles where user_id = $1`,
    [user.id],
  );
  return {
    userId: user.id,
    name: user.name,
    hasPassword: accounts.some((row) => Boolean(row.password)),
    onboarded: Boolean(profiles[0]?.onboarded),
  };
}

async function hashCredentialPassword(password: string): Promise<string> {
  const { auth } = await import("@/lib/auth/server");
  const ctx = await auth.$context;
  if (ctx.password && typeof ctx.password.hash === "function") {
    return ctx.password.hash(password);
  }
  const { hashPassword } = await import("better-auth/crypto");
  return hashPassword(password);
}

async function attachPassword(userId: string, password: string): Promise<void> {
  const hash = await hashCredentialPassword(password);
  const sql = await getSql();
  const existing = await sql.query<{ id: string }>(
    `select id from account where "userId" = $1 and "providerId" = 'credential' limit 1`,
    [userId],
  );
  if (existing[0]) {
    await sql.query(`update account set password = $1, "updatedAt" = now() where id = $2`, [
      hash,
      existing[0].id,
    ]);
    return;
  }
  await sql.query(
    `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     values ($1, $2, 'credential', $3, $4, now(), now())`,
    [randomUUID(), userId, userId, hash],
  );
}

export async function completeEmailLogin(
  input: { email: string; password: string; name?: string; join: boolean },
  request: Request,
): Promise<{ token: string; isNew: boolean; cookies: string[] }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const name = input.name?.trim() || email.split("@")[0] || "Member";
  if (!email.includes("@")) throw new Error("Enter a valid email.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const account = await lookupEmailAccount(email);
  const plan = planEmailLogin(input.join, {
    exists: Boolean(account.userId),
    hasPassword: account.hasPassword,
    onboarded: account.onboarded,
  });

  if (plan === "unknown") {
    throw new Error("No account with that email. Tap Create a profile.");
  }
  if (plan === "needs-join") {
    throw new Error("This email doesn’t have a password yet. Tap Create a profile and set one.");
  }

  if (plan === "signup") {
    const signed = await betterAuthEmail(request, { email, password, name, signUp: true });
    return { ...signed, isNew: true };
  }

  if (plan === "attach" && account.userId) {
    await attachPassword(account.userId, password);
    const signed = await betterAuthEmail(request, {
      email,
      password,
      name: name || account.name || "Member",
      signUp: false,
    });
    return { ...signed, isNew: !account.onboarded };
  }

  try {
    const signed = await betterAuthEmail(request, {
      email,
      password,
      name: name || account.name || "Member",
      signUp: false,
    });
    return { ...signed, isNew: false };
  } catch {
    throw new Error("Invalid email or password");
  }
}
