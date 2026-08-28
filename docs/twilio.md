# Wiring up phone sign-in (Twilio)

Everything on the **code** side of phone sign-in is done:

- `POST /api/phone/start` — normalises the number, rate-limits (10/hr per IP, 5/hr
  per number), hashes the code, sends it via Twilio
- `POST /api/phone/login` — verifies the code (6/hr per number), creates/looks up
  the account, issues the Better Auth session
- `GET /api/phone/status` — read-only wiring check, secrets redacted
- In production with no Twilio credentials the routes **fail closed**: they refuse
  to hand out a code rather than leaking it into the UI

What's left is credentials and a phone number — steps only you can do. Follow
this in order; it's about 15 minutes plus Twilio's verification wait.

---

## Step 1 — Get your Account SID and Auth Token

1. Go to **<https://console.twilio.com>** and sign in.
2. On the main dashboard, under **Account Info**, you'll see:
   - **Account SID** — starts with `AC…`
   - **Auth Token** — click the eye icon to reveal it
3. Copy both. The Auth Token is shown once per session; if you lose it, click
   the circular-arrow icon to rotate it (rotating invalidates the old one
   immediately).

> **For a brand-new trial account:** Twilio trial accounts can only send SMS to
> *verified* phone numbers. Add your own number under
> **Develop → Phone Numbers → Manage → Verified Caller IDs** before testing, or
> upgrade the account (see Step 2).

## Step 2 — Buy an SMS-capable phone number

1. **Phone Numbers → Manage → Buy a number**.
2. Check the **SMS** capability box and pick your country. For the US, tick
   **Voice** too if you ever want calls — it costs little and is a pain to add later.
3. Pick a number and buy it. Trial credit covers this.
4. Copy it **in E.164 format**: `+15551234567` — leading `+`, country code, no
   spaces, no dashes.

> **US long-code / A2P 10DLC notice.** If you bought a **US** 10-digit number,
> Twilio requires **A2P 10DLC registration** before it will deliver
> application-to-person SMS to US carriers. Unregistered traffic is filtered,
> and this is by far the most common reason "it works in the console but not in
> my app."
>
> In the console: **Messaging → Regulatory Compliance → A2P 10DLC**. You'll
> register a **Brand** (your legal entity — sole proprietor is fine, you'll need
> an EIN or SSN for identity verification) and a **Campaign** (pick
> *Authentication / 2FA* — it has the cheapest fees and the least friction).
> Approval is usually instant-to-a-day. Toll-free numbers have a separate,
> slower verification path.
>
> **Faster alternative:** buy a **non-US** number, or use a **Messaging
> Service** with an alpha sender / short code. For a pre-launch app with US
> users, just do the 10DLC registration — it's a one-time form.

## Step 3 — (Recommended) create a Messaging Service

Optional but worth the 60 seconds. A Messaging Service handles sender selection,
`STOP`/`HELP` opt-out keywords, and per-country routing for you — all things you
otherwise have to build.

1. **Messaging → Services → Create Messaging Service**
2. Name it `Strut`, set the use case to **Authentication / OTP**
3. Add your number to the **Sender Pool**
4. Copy the **Messaging Service SID** — starts with `MG…`

If you do this, set `TWILIO_MESSAGING_SERVICE_SID` **instead of**
`TWILIO_FROM_NUMBER`. The code prefers the Messaging Service when both are set.

## Step 4 — Set the environment variables in Vercel

**Vercel → your Strut project → Settings → Environment Variables.** Add each of
the three (or four) below, and tick **Production** *and* **Preview** (so your
preview deploys behave like prod):

| Variable | Value | Example |
| --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Account SID from Step 1 | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Auth Token from Step 1 | `a1b2c3d4…` |
| `TWILIO_FROM_NUMBER` | E.164 number from Step 2 | `+15551234567` |
| `TWILIO_MESSAGING_SERVICE_SID` | *(Step 3 alternative)* | `MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

Also confirm these are already set (they're required for any production deploy):

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` — must be your canonical https origin, e.g.
  `https://strut.app`. Sessions break if this doesn't match the domain you visit.
- `BLOB_READ_WRITE_TOKEN`

> **A note on tokens:** don't paste your Auth Token into chat, a support ticket,
> or a screenshot. It's a bearer credential against a billable account.

## Step 5 — Redeploy

Environment variables only apply to **new** deployments.

**Vercel → Deployments → ⋯ → Redeploy** (or `git push` to `main`).

## Step 6 — Verify it's actually live

Hit these three URLs on your production domain:

```bash
curl -s https://YOUR_DOMAIN/api/phone/status | jq
```

You want:

```json
{ "sms": true, "production": true, "gated": false, "delivery": "sms" }
```

If `"sms": false`, one of the three vars is missing or has a stray space — check
for trailing whitespace when you pasted, which is the usual culprit.

```bash
curl -s https://YOUR_DOMAIN/api/health | jq
```

Confirm the config block reports SMS as on.

Then do a real end-to-end test with your own phone:
**Sign in → Phone → enter your number → you should get a text within ~5 seconds.**
If the code arrives, phone login/register is done.

## Step 7 — Put a spend cap on it (do this before launch)

Strut rate-limits phone starts (10/hr per IP, 5/hr per number) and verifies
(6/hr per number), which stops casual abuse. It does **not** stop a distributed
SMS-pumping attack, where a bot hits your signup form with thousands of
real numbers to farm the per-message fees. Twilio's own guardrails are the
backstop:

1. **Twilio → Admin → Account Settings → Usage Triggers → Create**
   - Trigger: `Daily Spend`, value `10`, unit `USD`
   - Action: disable the messaging service (or email you)
2. Also set a **Messaging Geo-Permissions** allowlist under
   **Messaging → Settings → Geo Permissions** for only the countries you
   actually serve. Most SMS-pumping traffic comes from countries you're not
   targeting.
3. Turn on **Twilio Verify Fraud Guard / SMS Pumping Protection** if it's
   available on your account.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `"gated": true` in `/api/phone/status` | Production with no Twilio creds — routes are deliberately disabled |
| Code never arrives, no error | US A2P 10DLC not registered (Step 2), or the number is on a carrier Twilio can't reach |
| Works for your number only | Trial account — add verified caller IDs, or upgrade |
| `30034` / "Message blocked" in Vercel logs | Sending to an unverified number on a trial account |
| `30007` / "Carrier violation" | A2P 10DLC filtering |
| `21610` / "Recipient has opted out" | They texted STOP. Twilio will not deliver again until they opt back in |
| `20003` / "Authenticate" | Bad Account SID or Auth Token |
| `21211` / "Invalid 'To' number" | Number isn't in E.164 (`+15551234567`) |

Server logs print the Twilio error code under `[twilio] send failed`. Those codes
are **never** shown to the client on purpose — Twilio's errors distinguish
"invalid number" from "blocked number" from "wrong carrier," which is exactly the
account-enumeration signal you don't want to hand an attacker.

---

## Local / preview behaviour

With no Twilio credentials set, dev and preview deployments show the OTP code
**on screen** on the verify step, so you can keep building without the account.
Production refuses to do this — `isProduction() && !smsConfigured()` makes
`/api/phone/start` return an error instead of a code. That's intentional: the
dev shortcut must never be reachable on a live domain.
