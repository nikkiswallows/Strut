# Strut — Architecture & Deployment

This document describes how accounts, authentication, profiles, and media are
stored and served, and what to configure for production. It reflects the auth
rewrite that replaced the previous broker-federation + parallel-token design
with a single, standard, scalable identity layer.

---

## 1. Accounts & authentication

There is **one** identity layer: self-hosted [Better Auth](https://better-auth.com)
at same-origin `/api/auth/*`, backed by Postgres.

| Method | How | Endpoint |
| --- | --- | --- |
| Email + password | Better Auth `emailAndPassword` (scrypt-hashed) | `/api/auth/sign-up/email`, `/api/auth/sign-in/email` |
| Phone (Tinder-style OTP) | Better Auth `phoneNumber` plugin — 6-digit code, Twilio SMS in prod, on-screen code in dev | `/api/phone/start` → `/api/phone/login` |
| Google | Direct OAuth 2.0 (app's own Google client) | `/api/auth/callback/google` |
| X / Twitter | Direct OAuth 2.0 (app's own X client) | `/api/auth/callback/twitter` |

### Sessions

- A session is a row in the `session` table, presented to browsers as a single
  **HttpOnly, Secure, SameSite=Lax** cookie (`better-auth.session_token`). The
  cookie is set automatically by `/api/auth/*` and rides along on every
  same-origin request — there is **no token in localStorage and no manual
  bearer plumbing on the web**.
- `SameSite=Lax` is correct for a first-party SPA and is what every major
  consumer app (including Tinder) uses. The old `SameSite=None` + duplicate
  `stk_`-token + localStorage workarounds only existed to serve an embedded
  cross-origin preview iframe; they are removed.
- The **bearer** plugin is also enabled, so a future native iOS/Android app can
  authenticate with `Authorization: Bearer <token>` with no further changes.
- Every protected route resolves the caller through one helper —
  `getSessionUserFromRequest(request)` (route handlers) or `getSessionUser()` /
  `requireUserId()` / `authMiddleware` (server functions) — both in
  `src/lib/auth/session.server.ts`. Never trust a client-supplied user id.
- CSRF: mutating requests must be same-origin (`isTrustedAppOrigin`) and pass
  Better Auth's origin check. `trustedOrigins` is derived per request so Vercel
  preview aliases and custom domains always match.

### Why the old setup didn't work

The previous app federated Google/X to a sandbox-only auth broker
(`auth.grok.me`) whose preview OAuth client only accepts `*.grok-sandbox.com`
callbacks, so Google/X could **never** complete on a real Vercel deployment.
On top of that there were three competing session systems (broker cookies,
hand-rolled `stk_` tokens in the `session` table, and localStorage bearer
tokens) fighting to decide "who is logged in" — the source of the repeated
iPhone/Vercel logouts. All three are collapsed into the single Better Auth
session above.

---

## 2. Data model (Postgres)

All tables are created by ordered SQL files in [`migrations/`](./migrations).
Migrations run automatically:

- **Production** (`DATABASE_URL` set): `npm run build` → `db:migrate` applies
  pending files in a transaction each Vercel deploy, tracked in `_migrations`.
- **Local/preview**: the embedded PGlite database applies the same files at
  startup.

Key tables:

- `user` / `account` / `session` / `verification` — Better Auth identity.
  `account` holds credential (password hash) and OAuth (Google/X) links; the
  phone plugin adds `user.phoneNumber` / `phoneNumberVerified`.
- `profiles` — one row per user (the dating profile: handle, display name,
  photos, identity/role, location `lat/lng`, etc.).
- `likes`, `follows`, `posts`, `post_likes` — social graph & feed.
- `conversations`, `messages` — 1:1 chat (seed/bot replies included).
- `media` — records of uploaded blobs.
- `phone_otps`, `phone_identities` — legacy from the old flow, retained (harmless).

### Scaling to Tinder size

The schema uses `text` ids, indexed foreign keys, JSONB for list fields, and
indexes on hot lookups (`session.userId`, `account(providerId, accountId)`,
`likes.to_user_id`, `profiles.last_active`, geo columns). At Tinder scale you
would additionally:

1. **Database**: start on Neon Postgres (serverless, pooled). Move the
   swipes/likes hot path and messages to sharded/managed clusters; keep Postgres
   for identity and profiles. Read replicas for feed/discover.
2. **Sessions**: Better Auth reads sessions from Postgres with a short signed
   cookie cache. At extreme QPS, put a Redis/KeyDB store in front (or Better
   Auth's Redis adapter) for session lookups.
3. **Geo/discover**: replace in-memory distance math with PostGIS + a geo index,
   or a dedicated geo service (Redis GEO / tile38).
4. **Media**: Vercel Blob + CDN (below).
5. **Messaging**: the current Postgres chat is fine for launch; at scale move to
   a fan-out service (Redis pub/sub → WebSockets/push).

---

## 3. Media (photos) — the Vercel Blob answer

**You do NOT need multiple Vercel Blob stores to scale.** One Vercel Blob store
handles this architecture to very high volume:

- Uploads go from the server to Blob (`put("photos/<userId>/…")`).
- Every read is served by the **Blob CDN** — photos never proxy through the app
  or database, so the app's bandwidth and DB are not in the media hot path.
- Keys are content/user-addressed and immutable (`cacheControlMaxAge: 1 year`).

Create **one** Blob store and set `BLOB_READ_WRITE_TOKEN`. Only add a second
store if you want to (a) separate media *types* (photos vs. video) into different
buckets/policies, or (b) meet a regional-residency requirement. When you add
video, raise `MAX_BYTES` in `src/lib/server/media.server.ts` and consider
uploading directly from the browser to Blob (client token) instead of proxying
through the function.

With no token, local dev stores small images as data URLs so PGlite still works;
production refuses uploads until Blob is configured.

---

## 4. Configuration (Vercel)

Set these in **Vercel → Project → Environment Variables** (see
[`.env.example`](./.env.example)):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ prod | Postgres connection string (pooled) |
| `BETTER_AUTH_SECRET` | ✅ prod | Session signing secret (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | recommended | Canonical https origin (custom domain) |
| `BLOB_READ_WRITE_TOKEN` | for uploads | Vercel Blob store token |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google sign-in |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` | optional | X sign-in |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | optional | Real SMS; otherwise codes show on screen |

**OAuth redirect URIs** to register in each provider console:

- Google: `https://<your-domain>/api/auth/callback/google`
- X: `https://<your-domain>/api/auth/callback/twitter`

Deploy: push to `main` (Vercel runs `npm run build`, which builds and migrates
the database automatically). Node 22+ is required (`engines.node`).

---

## 5. Route map

- `POST /api/auth/*` — Better Auth (sign-in/up, session, sign-out, OAuth,
  `phone-number/send-otp`, `phone-number/verify`).
- `POST /api/phone/start`, `POST /api/phone/login` — friendly phone OTP wrappers
  (return a dev preview code; proxy to the Better Auth plugin and stream the
  session cookie back).
- `GET/POST /api/profile` — the signed-in user's profile.
- `POST /api/app` — app ops (`discover`, `view`, `like`, `follow`, `likes`,
  `feed`, `createPost`, `postLike`, `tags`, `addTag`).
- `GET/POST /api/messages/*` — `list`, `thread`, `open`, `send`, `reply`.
- `POST /api/media` — photo upload → Vercel Blob URL.

---

## 6. Seed chat AI

Seeded profiles answer in their own persona (`src/lib/seed-data.ts`, each seed
has a `persona` voice and identity). Replies are generated server-side by
`src/lib/server/bot.ts` → `src/lib/server/ai.server.ts`, which calls an
**OpenAI-compatible** chat model. With no key configured it falls back to short
rotating canned lines.

The provider is auto-selected from whichever key is present (first match wins):

1. `AI_API_KEY` + `AI_API_BASE` (+`AI_MODEL`) — any compatible gateway/self-hosted model.
2. `XAI_API_KEY` — **xAI Grok** (`grok-3-mini`); paid but cheap and the least
   likely to refuse this app's explicit content.
3. `GROQ_API_KEY` — **Groq**, free tier, very fast (`llama-3.3-70b-versatile`). *Recommended free start.*
4. `OPENROUTER_API_KEY` — **OpenRouter**, has free models.
5. `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` — **Google Gemini**, free; note it
   filters explicit content most aggressively.

Override any default model with `AI_MODEL`. The active provider is reported by
`GET /api/config` (`ai` field) so you can confirm wiring without secrets. Free
tier to start; switch to Grok/OpenRouter paid or your own endpoint at scale.

Free key: sign up at **console.groq.com** → API Keys → Create → add `GROQ_API_KEY`
in Vercel → redeploy.
