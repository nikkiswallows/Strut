# Strut

Dating for BNWO, cuckold, T-girls, sissies, trans women — and the men, women, couples, and groups who want them.

Walk in. Be seen.

Strut is a dating app: Discover nearby, feed, likes, matches, and private chat. Seed profiles write back in character. No paywalls.

## Sign in

- Email + password
- Google or X
- Phone (optional)

New accounts go through a short profile onboarding (name, identity, top/bottom/switch, optional ethnicity, photos, bio).

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

## Notes

- 18+ only
- Photos in `public/photos/`
- Auth is Better Auth (`/api/auth/*`)
- Seed chats use the xAI API when `XAI_API_KEY` is present
