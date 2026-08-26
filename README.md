# Strut

Dating for T-Girls, sissies, and trans women. Walk in. Be seen.

Strut is a dating app — Discover nearby, feed, likes, matches, and private chat. No paywalls in v1.

## Sign in

- **Phone** — country + number, then a 6-digit code
- Email + password
- Google or X

New accounts go through a short profile onboarding (name, identity, photos, bio).

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

## Notes

- 18+ only
- Photos in `public/photos/`
- Auth is Better Auth (`/api/auth/*`)

When you are ready to send real SMS codes, add Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Until then, the code is shown on the verify screen so you can finish sign-in.
