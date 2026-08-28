/**
 * End-to-end smoke test against a running dev server.
 *   node scripts/smoke.mjs [baseUrl]
 * Exercises: signup -> session -> profile save -> discover -> deck -> swipe
 * -> open chat -> send message. Prints PASS/FAIL per step.
 */
const BASE = process.argv[2] ?? "http://127.0.0.1:8080";
const stamp = Date.now();
const email = `smoke${stamp}@strut.test`;
const password = "supersecret123";

let cookie = "";
let pass = 0;
let fail = 0;

function jar(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const pair = c.split(";")[0];
    if (!pair) continue;
    const [name] = pair.split("=");
    cookie = cookie
      .split("; ")
      .filter((x) => x && !x.startsWith(`${name}=`))
      .concat(pair)
      .join("; ");
  }
}

function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function req(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  jar(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { res, json, text };
}

console.log(`\n== Strut smoke test against ${BASE} ==\n`);

// 1. health
{
  const { res, text } = await req("/api/health");
  check("GET /api/health", res.ok, `${res.status} ${text.slice(0, 120)}`);
}

// 2. sign up
{
  const { res, json, text } = await req("/api/auth/sign-up/email", {
    method: "POST",
    body: JSON.stringify({ email, password, name: "Smoke Tester" }),
  });
  check("POST sign-up/email", res.ok && !!json?.user?.id, `${res.status} ${text.slice(0, 200)}`);
}

// 3. session resolves
let me = null;
{
  const { res, json } = await req("/api/auth/get-session");
  me = json?.user ?? null;
  check("GET get-session", res.ok && !!me?.id, JSON.stringify(json).slice(0, 200));
}

// 4. save profile
{
  const { res, json, text } = await req("/api/profile", {
    method: "POST",
    body: JSON.stringify({
      handle: `smoke${stamp}`,
      displayName: "Smoke Tester",
      age: 30,
      hideAge: false,
      discreet: false,
      identities: ["Whiteboi", "Sissy"],
      pronouns: ["he/him"],
      role: "Top",
      bio: "smoke test bio",
      location: "Costa Mesa, CA",
      ethnicity: "White",
      lookingFor: ["BBC"],
      photos: ["/photos/seed/aria.jpg"],
      interests: ["BNWO"],
      heightCm: 175,
    }),
  });
  check("POST /api/profile", res.ok && !!json?.handle, `${res.status} ${text.slice(0, 200)}`);
  if (json?.role) check("role enforced (whiteboi forced to Bottom)", json.role === "Bottom", json.role);
  if (json?.lat != null) check("geo resolved from location", typeof json.lat === "number", String(json.lat));
}

// 5. discover
let firstTarget = null;
{
  const { res, json, text } = await req("/api/app", {
    method: "POST",
    body: JSON.stringify({ op: "discover", tab: "nearby", miles: 100 }),
  });
  const items = json?.data?.items ?? [];
  check("POST /api/app discover", res.ok && items.length > 0, `${res.status} ${text.slice(0, 200)}`);
  firstTarget = items[0]?.userId ?? null;
  check("discover returns nextCursor shape", "nextCursor" in (json?.data ?? {}), JSON.stringify(json?.data?.nextCursor));
}

// 6. deck + swipe
{
  const { res, json, text } = await req("/api/app", {
    method: "POST",
    body: JSON.stringify({ op: "deck", tab: "nearby", miles: 100, limit: 10 }),
  });
  const items = json?.data?.items ?? [];
  check("POST /api/app deck", res.ok && items.length > 0, `${res.status} ${text.slice(0, 200)}`);
  const target = items[0]?.userId;
  if (target) {
    const sw = await req("/api/app", {
      method: "POST",
      body: JSON.stringify({ op: "swipe", targetId: target, direction: "like" }),
    });
    check("POST swipe like", sw.res.ok && sw.json?.data?.ok === true, `${sw.res.status} ${sw.text.slice(0, 160)}`);

    const again = await req("/api/app", {
      method: "POST",
      body: JSON.stringify({ op: "deck", tab: "nearby", miles: 100, limit: 10 }),
    });
    const still = (again.json?.data?.items ?? []).some((i) => i.userId === target);
    check("swiped profile excluded from deck", !still, "target reappeared in deck");
  }
}

// 7. open chat + send
if (firstTarget) {
  const opened = await req("/api/messages/open", {
    method: "POST",
    body: JSON.stringify({ userId: firstTarget }),
  });
  const convId = opened.json?.data?.id ?? opened.json?.id ?? null;
  check("POST /api/messages/open", opened.res.ok && !!convId, `${opened.res.status} ${opened.text.slice(0, 160)}`);

  if (convId) {
    const sent = await req("/api/messages/send", {
      method: "POST",
      body: JSON.stringify({ conversationId: convId, body: "hey, smoke test" }),
    });
    check("POST /api/messages/send", sent.res.ok && sent.json?.ok === true, `${sent.res.status} ${sent.text.slice(0, 160)}`);

    const thread = await req(`/api/messages/thread?conversationId=${convId}`);
    const msgs = thread.json?.data?.messages ?? thread.json?.messages ?? [];
    check("GET /api/messages/thread returns the message", msgs.length >= 1, JSON.stringify(thread.json).slice(0, 200));
  }
}

// 8. authz: unauthenticated access must 401
{
  const saved = cookie;
  cookie = "";
  const a = await req("/api/app", { method: "POST", body: JSON.stringify({ op: "likes" }) });
  check("unauth /api/app -> 401", a.res.status === 401, String(a.res.status));
  const b = await req("/api/profile");
  check("unauth GET /api/profile -> 401", b.res.status === 401, String(b.res.status));
  const c = await req("/api/messages/list");
  check("unauth /api/messages/list -> 401", c.res.status === 401, String(c.res.status));
  cookie = saved;
}

// 9. cross-origin POST must be refused
{
  const res = await fetch(`${BASE}/api/app`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example.com", cookie },
    body: JSON.stringify({ op: "likes" }),
  });
  check("cross-origin POST /api/app -> 403", res.status === 403, String(res.status));
}

// 10. feed
{
  const { res, json, text } = await req("/api/app", { method: "POST", body: JSON.stringify({ op: "feed" }) });
  check("POST /api/app feed", res.ok && Array.isArray(json?.data), `${res.status} ${text.slice(0, 160)}`);
}

console.log(`\n== ${pass} passed, ${fail} failed ==\n`);
process.exit(fail ? 1 : 0);
