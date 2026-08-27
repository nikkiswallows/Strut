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

## Notes

- 18+ only
- Seed photos in `public/photos/`
- User photos upload through `/api/media` to Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Profiles and feed store URLs only.
- Auth is Better Auth (`/api/auth/*`)
- Seed chats use the xAI API when `XAI_API_KEY` is present
- Brand: black / ivory / gold. Queen of spades. Cinzel + Outfit.

When you are ready to send real SMS codes, add Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`). Until then, the code is shown on the verify screen so you can finish sign-in.
