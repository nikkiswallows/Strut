# Strut

**BNWO dating.** Black first. Kneel second.

Strut is the room for Black superiority, Queen of Spades, sissy feminization, whitebois, cuckold couples, and breeding white wives. T-girls and trans women who want kings are in it. Men who lead are in it. If you wanted a general dating app, you are in the wrong place.

Walk in. Serve. Be seen.

## Who it’s for

- **Black kings / bulls / tops** — you walk in first
- **Sissies & whitebois** — femme, submissive, looking for a real man
- **White wives / hotwives** — QOS, interracial, breeding
- **Cucks** — he watches, she takes Black
- **T-girls / trans women** — who want the same energy
- **Couples and groups** who already know the rules

This is not subtle. Profiles say BNWO, BBC, QOS, cuckold, feminization, breeding out loud.

## Product

Discover nearby, feed, likes, matches, private chat. Seed profiles write back in character. No paywalls. Top / bottom / switch on every profile. Identity is multi-select (sissy, whiteboi, hotwife, bull, cuck, trans, couple, group, or your own).

## Sign in

- Phone — country + number, then a 6-digit code
- Email + password
- Google or X

New accounts go through a short profile onboarding (name, identity, top/bottom/switch, photos, bio).

Profiles, likes, and messages save to your account.

## Develop

```bash
npm install
npm run dev
```

Requires Node 22. The app expects a database:

- Local / preview: embedded PGLite (automatic)
- Production: set `DATABASE_URL` (Postgres). Schema is in `migrations/`.

```bash
npm run typecheck
npm run build
```

## Architecture & deploy

Accounts and auth use self-hosted **Better Auth** at `/api/auth/*` with a single
standard session (HttpOnly, Secure, SameSite=Lax cookie; bearer tokens available
for future native apps):

- **Email + password** and **Google / X** sign-in, plus **passwordless phone
  OTP** (Tinder-style).
- All routes resolve the user from the Better Auth session — no parallel token
  tables, no localStorage tokens.
- Postgres in production (`DATABASE_URL`), embedded PGlite locally; migrations in
  `migrations/` apply automatically on deploy.
- Photos upload through `/api/media` to **Vercel Blob** (one store is enough —
  reads are CDN-served); profiles/feed store URLs only.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** (engineering) and **[STRATEGY.md](./STRATEGY.md)**
(market, acquisition, monetization, compliance and Tinder-scale data plan), and copy
**[`.env.example`](./.env.example)**
for the full env-var list. Quick deploy checklist:

1. Create a Postgres DB (e.g. Neon) and set `DATABASE_URL`.
2. Set `BETTER_AUTH_SECRET` (`openssl rand -hex 32`) and `BETTER_AUTH_URL`.
3. Create one Vercel Blob store and set `BLOB_READ_WRITE_TOKEN`.
4. (Optional) Google/X OAuth clients — redirect to
   `<APP_URL>/api/auth/callback/google` and `.../callback/twitter`.
5. (Optional) Twilio for real SMS. The on-screen code is dev/preview-only —
   production refuses phone sign-in when SMS isn't configured.

## Notes

- 18+ only
- Seed photos in `public/photos/`
- Phone sign-in: add Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_FROM_NUMBER`) for real texts. The on-screen code is a **dev/preview-only**
  affordance — production refuses phone sign-in (400) when SMS isn't configured, so
  codes can never leak to the client.
- Seed chats use the xAI API when `XAI_API_KEY` is present
- Brand: black / ivory / gold. Queen of spades. Cinzel + Outfit.
