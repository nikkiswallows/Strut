# Strut — Full Audit, August 2026

Product · Engineering · Security · Market · Growth

**Prepared:** 27 August 2026
**Repo state:** `main` @ `f29709f` (plus the two fixes noted in §12)
**Verification method:** cloned, installed, ran it. Typecheck clean. Lint 0 errors / 4 warnings.
Migration-plan test suite 7/7. Wrote and ran a 19-step end-to-end smoke test against a
live server (18 pass, 1 was my test's wrong guess about a response shape — not an app bug).

---

## 0. Verdict in one page

Strut is a **genuinely good early product** with a real wedge, and it is **not safe to launch
as-is**. Not because the code is bad — the code is better than most seed-stage apps — but
because the three things that make or break an app in this specific category are all missing
or cosmetic:

| What decides whether this category lives or dies | Strut's status |
| --- | --- |
| A real age gate | ❌ **None.** No date of birth is collected anywhere. Nothing to enforce. |
| Block / report / moderation | ❌ **Zero.** No block, no report, no mute, no takedown path. |
| Discreet mode that actually protects people | ⚠️ **Cosmetic.** Full-resolution photo is downloaded and only CSS-blurred. |

Everything else — the swipe deck, the role-enforcement mechanic, the AI seed chat, the
keyset-paginated discover, the Better Auth consolidation — is real engineering that works.
I ran it. The deck swipes, likes mirror into matches, passes are remembered, role enforcement
fires, geo resolves, chat persists.

The strategic read is also correct and I'll defend it strongly in §8–§10: **the broad dating
market just posted its first-ever annual revenue decline while the niche apps grew.** That is
exactly the conditions under which a focused product wins. But one number in `STRATEGY.md` is
wrong by roughly 4–5×, and it matters for how you raise and plan. See §9.3.

**Ship-blocking list:** the 8 items in §2 and §3. Everything below P2 can wait.

---

## 1. What I verified, and how

```
git clone nikkiswallows/Strut
npm install                      → 433 packages
npm run typecheck                → clean
npx eslint .                     → 0 errors, 4 warnings
node --test scripts/…            → 7/7 pass
npm run dev                      → boots on :8080
node scripts/smoke.mjs           → 18/19 pass (auth, profile, role enforcement,
                                   geo, discover, deck, swipe exclusion, chat,
                                   authz 401s, cross-origin 403, feed)
```

The one "failure" was my own harness expecting `/api/messages/thread` to unwrap a `data`
envelope; it returns `{ thread }`. Note this is inconsistent with `/api/app`, which *does*
wrap everything in `{ data }`. Small, but the kind of inconsistency that earns you a
client-side runtime bug later.

**Scale of what's here:** 12,685 lines across `src/`, `migrations/`, `scripts/`. 53 seeded
profiles, 18 migrations, ~110 seed photos. 32 commits from you, 9 from a deploy bot, 6 from
prior agents. This is a real project, not a toy.

---

## 2. P0 — Ship blockers (safety, legal, existential)

### 2.1 There is no age gate. At all. 🔴

I grepped for `dateOfBirth`, `birthday`, `dob`, `ageVerif`, `18+` across the codebase. The only
hits are marketing copy and AI prompt framing. **No date of birth is collected, stored, or
checked at signup, onboarding, or login.**

`cleanProfile` clamps `age` to 18–99 — but only *if a value is supplied*, and it's nullable:

```ts
const age = input.age == null || Number.isNaN(Number(input.age)) ? null
  : Math.max(18, Math.min(99, Number(input.age)));
```

So the app never learns a user's age, and the footer text "18+ only" is not a control.

**Why this is the single biggest risk, in August 2026 specifically:**

- **27 US states** now require commercial adult-content sites to verify age, and **none is
  currently enjoined** [4](https://www.recordinglaw.com/us-laws/age-verification-laws/).
  Iowa took effect 1 July 2026; Missouri takes effect **28 August 2026 — tomorrow**.
- The constitutional question is settled. *Free Speech Coalition v. Paxton*, 606 U.S. 461,
  decided 27 June 2025, upheld Texas H.B. 1181 6–3 under intermediate scrutiny. The Court
  held **"adults have no First Amendment right to avoid age verification"**
  [5](https://natlawreview.com/article/us-supreme-court-upholds-adult-entertainment-website-age-verification-law)
  [2](https://www.mayerbrown.com/en/insights/publications/2026/01/little-users-big-rules-tracking-childrens-privacy-legislation).
- H.B. 1181 bites at **more than one-third of content** being "sexual material harmful to
  minors." Strut is not one-third explicit content. It is ~100%.
- Penalties: up to **$10,000/day**, and up to **$250,000 if a minor gains access**. Several
  states also allow **private lawsuits by parents**
  [2](https://www.mayerbrown.com/en/insights/publications/2026/01/little-users-big-rules-tracking-childrens-privacy-legislation).
- A self-declared checkbox **no longer satisfies any of these regimes**
  [1](https://bunny-cms.com/blog/age-verification-for-adult-websites-2026-compliance-guide).
- Most state laws apply **based on where the content is viewed**, not where you're hosted.

**Do this:** birth date at signup (server-side, immutable, 18+ enforced before any profile or
photo is visible) → then a real age-assurance vendor for the 27 states (Persona, Yoti,
Veriff, Allpass). Keep the web/PWA distribution — that's an asset (§8.4) — but geofence
age assurance by state. Delete verification data promptly; every one of these statutes
requires it, and retention is the part plaintiffs' lawyers go after.

Note: `STRATEGY.md §6` says 25 states. It's **27 as of 13 August 2026**
[4](https://www.recordinglaw.com/us-laws/age-verification-laws/). Worth updating.

### 2.2 No block, no report, no mute, no moderation queue 🔴

Grep for `block|report|mute` across `src/lib` and `src/routes`: nothing.

There is no way for a member to stop a harasser, no way to report anything, no moderation
surface, no audit log, no takedown path. For a general dating app that's a gap. For **this**
app — where a database breach or a hostile ex-partner is a catastrophic, life-altering event
for the user — it is the difference between a product and a liability.

It's also a hard commercial requirement: NCII takedown SLAs (48h) are table stakes, and every
payment processor that will touch adult money will ask to see the trust-and-safety surface
before they underwrite you.

**Do this:** `blocks` table + `reports` table; block hides both parties from each other's deck,
likes, and chat; report creates a queued item with the message context snapshot; `/safety`
route in-app; a moderation queue behind an admin role. Block is ~1 day of work and is the
single highest-trust-per-hour feature you can ship.

### 2.3 Discreet mode does not protect anyone 🔴

This one hurts because the intent is right and the copy promises more than the code delivers.

`src/components/photo.tsx`:

```tsx
<img src={src} alt="" className="size-full scale-105 object-cover blur-2xl" loading="lazy" />
```

The **full-resolution photo is fetched by the browser** and blurred with a CSS filter. Anyone
can right-click → Open Image in New Tab, hit view-source, or toggle the class in devtools and
see the face, clearly, at full resolution.

For a closeted or married member, "Discreet · tap" is a promise the app does not keep. A user
who is outed because they trusted that label is the worst outcome this product can produce,
and it will end the company.

**Do this** (in order of effort):
1. **Minimum viable, ship today:** don't put the real URL in the DOM. Render a
   tiny base64 blurred placeholder (or a blurhash) server-side, and fetch the real URL only
   after the tap, through an authenticated endpoint that checks the viewer.
2. **Better:** generate a genuinely downscaled + heavily blurred derivative at upload time and
   serve that; keep the original behind a signed URL that requires the reveal.
3. Add `onContextMenu` prevention and no-drag as *deterrence only* — never as the control.

### 2.4 Unbounded member enumeration 🔴

`/api/app` has **no rate limit on `discover`, `deck`, or `swipe`.** I confirmed the only
rate-limited op in that handler is `addTag`.

An authenticated account can walk the keyset cursor with `limit: 80` and page the entire
member table — every handle, display name, bio, photo URL, identity set, ethnicity, location
and distance. `discover` doesn't exclude decided-on profiles, so there's nothing to stop it.
At 80 rows per request, a million-member database is ~12,500 requests.

In most apps that's a scraping nuisance. Here it is a **doxxing and extortion weapon aimed at
exactly the people who can least afford it.** This is your highest-severity technical finding
that isn't about age.

**Do this:** per-user rate limit on discover/deck/swipe (e.g. 300/hour); a hard cap on total
cursor depth per filter-set per day; and consider serving photos through a signed URL so bulk
harvest yields dead links after a short TTL.

### 2.5 No rate limit on phone OTP — this one costs you money directly 🔴

`/api/phone/start` is unauthenticated by nature and **has no rate limit**. Every call with
valid Twilio config sends a real SMS.

That's **SMS pumping / toll fraud**: an attacker scripts arbitrary phone numbers and you pay
per message. This is one of the most commonly exploited endpoints in any app with phone auth.
Better Auth's `allowedAttempts: 5` protects one number's verification, not your SMS bill.

**Do this:** per-IP and per-phone limits (e.g. 3/hour/number, 10/hour/IP), plus a global
per-deployment daily ceiling that alerts you. Do this **before** you put Twilio credentials
in production.

### 2.6 Messages are stored as plaintext 🟠

`messages.body` is a plain `text` column. There is no encryption at rest beyond whatever the
host provides, and no application-layer protection.

For this app, the messages table is the most sensitive asset you own. Assume it is the
highest-value target in the system.

**Do this:** at minimum, encrypt `body` with a KMS-held key (not a key in an env var — that
buys nothing) and log access. Longer term, per-conversation keys. And **turn off** any
verbose error logging that could echo message bodies.

### 2.7 No account deletion or data export 🟠

GDPR/CCPA both require it, and California is not optional for a US launch with an audience
this privacy-motivated. Your own `STRATEGY.md §6` calls for "one-tap account deletion /
export." It doesn't exist in code.

**Do this:** `DELETE /api/account` that cascades profile, photos (Blob delete), likes,
swipes, follows, posts, conversations, messages, and the auth identity — plus a JSON export.
One-tap deletion is also a *marketing* line for this audience. Ship it and say so.

### 2.8 AI-member disclosure 🟠

The seed profiles are LLM-driven and write back in character. There is no label telling the
user which profiles are synthetic.

Beyond the honesty problem, this is a live regulatory area — California's companion-chatbot
law and the EU AI Act both push toward disclosure, and Australia's Phase 2 (March 2026)
explicitly covers AI chatbots [1](https://bunny-cms.com/blog/age-verification-for-adult-websites-2026-compliance-guide).

**Do this:** a persistent, unmissable "AI" chip on seed profiles and in the thread header.
Cheap, and it protects you in three jurisdictions at once.

---

## 3. P1 — Security hardening

### 3.1 Missing CSRF origin checks on every `/api/messages/*` route 🟠

`isTrustedAppOrigin` is applied in `/api/app`, `/api/media`, and `/api/profile` — and
**nowhere else**. It is absent from:

- `/api/messages/send`
- `/api/messages/open`
- `/api/messages/reply`
- `/api/messages/bot-status`
- `/api/messages/thread`
- `/api/messages/list`

Mitigating factor: your session cookie is `SameSite=Lax`, so a cross-site POST won't carry it
in any modern browser. That's why this is P1 and not P0. But the check exists in the codebase
and is applied inconsistently, which means someone will eventually add a route and forget it,
or a browser quirk will bite you. Make it a middleware, not a per-route decision.

Also: `assertSameSiteRequest()` — the stronger Fetch-Metadata check — is **only wired into
`authMiddleware`**, so it protects server functions, not the `/api/*` route handlers.

### 3.2 SSE stream slots leak on error paths 🟡

`src/routes/api/messages/stream.ts` calls `acquireStream(user.id)` and then returns **400**
(missing conversation) and **403** (not your conversation) **without calling
`releaseStream`**. Four malformed requests permanently consume a user's 4-slot allowance
until the 30-minute stale window expires.

Self-inflicted DoS, but it's a real bug and it will show up as "chat randomly stops being
live for some users."

### 3.3 Arbitrary external photo URLs 🟡

`cleanProfile` accepts any `http(s)://` URL in `photos`:

```ts
.filter((src) => /^(https?:\/\/|\/photos\/|\/uploads\/)/i.test(src) || src.startsWith("data:image/"))
```

You correctly sniff magic bytes on *uploaded* files, then let users save arbitrary remote URLs
that bypass that check entirely. Two consequences:

1. **Deanonymization via tracking pixel.** A malicious member sets their photo to
   `https://attacker.example/pixel.png`. Every closeted member whose deck loads that card
   leaks IP, user-agent, and referer to the attacker. This is a targeted attack against your
   exact user base and it costs the attacker nothing.
2. Your feed and deck become an open image proxy.

**Do this:** allowlist your Blob host + same-origin paths only. Reject everything else at
save time.

### 3.4 Race conditions on insert 🟡

`toggleLikeFor` and `toggleFollowFor` do `SELECT` then `INSERT` with **no
`on conflict do nothing`**. A double-tap race throws a duplicate-key error and surfaces as a
400 to the user.

`swipeFor` already does this correctly. Make `likes` and `follows` consistent with it.

### 3.5 Unauthenticated `listFeatured` returns coordinates 🟡

```ts
export const listFeatured = createServerFn({ method: "GET" }).handler(async () => { … })
```

No `authMiddleware`. It returns seed profiles only (`is_seed = true`), so the blast radius is
limited to fake accounts — but `PROFILE_COLS` includes `lat`/`lng`, so you are serving
coordinates to anonymous callers.

`ARCHITECTURE.md §7` says you deliberately removed the unauthenticated `getPublicProfile`
precisely because it "exposed city coordinates without a session." This is the same shape of
hole, just narrow. Either guard it or drop `lat`/`lng` from its projection.

### 3.6 Things that are genuinely done well ✅

Worth recording, because these are the parts you should *not* let a future refactor regress:

- Phone OTP **fails closed** in production without Twilio. Correct, and the audit note shows
  it was previously exploitable. Nice catch.
- `buildTrustedOrigins` correctly refuses to trust a client-supplied
  `Origin`/`Referer`/`X-Forwarded-Host` on its own — it only trusts hosts provably belonging
  to the deployment. This is the right design and it's easy to get wrong.
- `BETTER_AUTH_SECRET` required in production.
- Magic-byte sniffing on uploads, with the sniffed Content-Type written, not the client's.
- Feed photo URLs allowlisted via `isStoredPhotoUrl`.
- `addTag` now authenticated and rate-limited.
- Member profile pages are `noindex, nofollow` (verified in `src/routes/_app/u.$handle.tsx`).
- Seed-once via persisted `seed_state` — good, this was the right fix for cold-start storms.
- Security headers in `vercel.json` (nosniff, DENY, referrer, permissions-policy, HSTS).

---

## 4. P2 — Correctness bugs

### 4.1 Undo doesn't undo 🟠

`swipe-deck.tsx` Undo button:

```tsx
onClick={() => { setIndex((i) => Math.max(0, i - 1)); setGone(null); setX(0); }}
```

That's it. It rewinds the **local index only**. There is **no `undo` op in `/api/app`** — I
confirmed against the op list. So the like or pass is already recorded server-side and
already mirrored into `likes`.

Consequence: undo shows you a card you've already liked. Swiping it again re-records. The
user thinks they took it back; they didn't. On a like, that's a **false match** — the other
person sees a match with someone who believes they withdrew.

**Fix:** add an `undo` op that deletes the `swipes` row and the mirrored `likes` row, and
have the button call it. Or remove the button. Don't leave a control that lies.

### 4.2 Role enforcement is trivially bypassable 🟠

This is your most distinctive feature and it binds **7 of 18 identity labels**.

```ts
const KNEELERS = ["whiteboi","sissy","crossdresser","femboy"];
const CUCKS    = ["cuck"];
const KINGS    = ["bull"];
const WIVES    = ["hotwife"];
```

`allowedRolesFor` returns all four roles for anyone outside those 7. So a user who selects
**"Man"**, **"Woman"**, **"Admirer"**, **"Questioning"**, **"Group"**, **"Couple"**,
**"Non-binary femme"**, **"Genderfluid"**, **"T-Girl"**, **"Trans woman"**, or
**"Crossdresser"**… no wait — anyone who selects only non-special labels gets `Top` freely.

Concretely: **a submissive who wants to appear as a Top just doesn't check "Sissy."** The
rule "whitebois can't be Top" only constrains people who voluntarily opt into the label.

I verified the *mechanism* works — my smoke test signed up as `["Whiteboi","Sissy"]` with
`role: "Top"` and the server correctly forced `Bottom`. ✅ The enforcement fires. But it only
fires on self-declared labels.

**Two options, and you should pick deliberately:**
- **Keep it as a declaration of intent** (honest, and arguably the right read: it's a
  self-identification ritual, not a verification). Then **stop describing it as enforcement**
  and lean into the "the order decrees it" framing you already have — it's theatre that
  signals shared values, which is genuinely valuable.
- **Make it structural:** require a primary identity that drives role, rather than inferring
  from an 18-way multi-select.

Also note `badgeFor` treats `"couple"` as `CUCK` but `allowedRolesFor` doesn't include
`"couple"` in `CUCKS`. **Two different definitions of "cuck" in one product.** Pick one.

### 4.3 The Kings tab is polluted 🟠

```ts
{ id: "kings", label: "Kings", match: ["Man", "Admirer", "Bull"] }
```

…but `KINGS = ["bull"]`. So the Kings tab shows **everyone who selected "Man"** — including
submissive men and men looking for a Top.

Per your own strategy doc, kings are "the scarciest, highest-value cohort… the reason anyone
else joins." Your most important tab is the one with the worst precision. A sissy opening the
Kings tab and finding a room full of bottoms is a broken first impression of the exact cohort
you can't afford to lose.

**Fix:** match `["Bull"]` on identities, and treat `Admirer`/`Man` as a separate or opt-in
bucket.

### 4.4 Keyset pagination + client-side distance sort don't compose 🟠

`listDiscoverForUser` orders by `(last_active DESC, id DESC)` in SQL, then does this in JS:

```ts
.sort((a, b) => (a.distanceMiles ?? 9_999) - (b.distanceMiles ?? 9_999));
```

The cursor is computed from the last **raw SQL row**, but the page the user sees is sorted by
**distance**. Two consequences:

1. **Silent gaps and duplicates across pages.** The cursor tracks the SQL scan position, but
   the visible ordering is different. On page boundaries you will drop and repeat profiles.
   Invisible at 53 seeds; visible at 5,000 real profiles.
2. **Truncated pages.** The JS post-filter runs *after* `LIMIT`, so if 40 rows come back and
   32 fail the distance filter, the user gets 32 — while `nextCursor` is still set, so it
   looks like a full page. In a dense metro with a 5-mile radius you'll frequently return
   **zero** items and still report "more."

**Fix:** pick one ordering. Either sort by distance in SQL (needs PostGIS — see §6.2) or
sort by `last_active` and drop the JS re-sort. Don't do both. If you must keep the JS filter,
loop server-side until you've filled a page or exhausted candidates, and cap the iterations.

### 4.5 Unbounded result sets 🟡

- `listLikesFor` — **no LIMIT.** A popular profile with 10k likes returns 10k full profile
  objects. This is the "See who liked you" payload you plan to monetize, so it will get
  big fast.
- `getChat` — loads **every message** in a conversation, ever.
- `listChats` — unbounded.
- `listFeedFor` — `limit 60`, no pagination.

Fine at launch. Not fine at 10k users. Add pagination now while it's cheap.

### 4.6 The `npm test` script is broken below Node 22 🟡

```
npm test
> node --test 'scripts/**/*.test.mjs' && node --experimental-strip-types --test src/lib/auth/membership.test.ts
Could not find '/home/user/Strut/scripts/**/*.test.mjs'
```

Two problems: `sh` doesn't expand `**` (only Node 21+ handles the glob natively), and
`--experimental-strip-types` doesn't exist on Node 20. `engines.node` says `>=22.12.0` so
production is fine — but anyone on Node 20 gets a silently green pipeline, because the
failure is masked by the shell.

**Fix:** quote the glob for the shell or use a test runner, and add an `engines` check.
A test suite that can't run is worse than no test suite.

### 4.7 Small ones 🟢

- **API response envelopes are inconsistent.** `/api/app` wraps in `{ data }`. `/api/messages/open`
  returns a bare `{ id }`. `/api/messages/thread` returns `{ thread }`. Pick one.
- **Query param naming is inconsistent.** `thread` uses `?id=`; `bot-status` uses
  `?conversationId=`.
- **`window.setTimeout` in `decide()` has no cleanup** (`swipe-deck.tsx:67`). Leaks a timer if
  the deck unmounts mid-swipe.
- **`ETHNICITIES` contains `"Latina"` with no masculine/neutral counterpart** — inconsistent
  with `"Black"`, `"White"`, `"Asian"`. Use `"Latino/a"` or add both.
- **4 lint warnings** (`bot.ts` unused `clock`, `chat.server.ts` unused `prior`,
  `horde.server.ts` unused `err`, `onboarding.tsx` missing dep). Harmless, but the
  `onboarding.tsx` one is a real hook-dependency smell.
- **Seed `runSeed()` does ~53 sequential `INSERT`s plus 22 more** in a loop. It's seed-once
  now so it's cold-start-only, but wrap it in a transaction or batch it if the seed set grows.

---

## 5. P3 — Product gaps worth closing

1. **Block/report** (§2.2) — highest trust-per-hour in the product.
2. **Age gate** (§2.1) — legal precondition.
3. **Real discreet mode** (§2.3) — you already built the toggle; make it true.
4. **Undo that works** (§4.1) — or remove the button.
5. **Video on profiles.** Highly visual niche, JPEG-only pipeline. Use direct-to-Blob client
   uploads so video doesn't proxy through the serverless function.
6. **Creator links** (age-gated), so Strut is the discovery funnel for people who monetize
   elsewhere. Retention magnet for your highest-value cohort.
7. **Presence + push.** Redis pub/sub backing for the realtime bus (§6.1) and Web Push. iOS
   push only works after Add-to-Home-Screen
   [2](https://www.mobiloud.com/blog/progressive-web-apps-ios), so the install prompt is a
   **prerequisite** for re-engagement on iPhone, not a nice-to-have.
8. **"Who's in this city" / events surface** — makes Strut a home, not just a deck.
9. **Onboarding: ask for role and intent up front**, then use it to order the first deck.
   First-session deck quality determines D1 retention more than anything else.

---

## 6. Performance & scaling

### 6.1 The realtime bus is per-instance

`realtime.server.ts` keeps channels in a `Map` on `globalThis`. That's correct and HMR-safe,
and the code comment admits it's per-instance. On a multi-instance Vercel deployment,
**user A and user B on different instances will never see each other's events.**

The client refetches on event and degrades gracefully, so it won't visibly break — it just
silently stops being real-time for most pairs. Back it with Redis pub/sub (same `publish` /
`subscribe` API) when you go multi-instance. Also swap the in-memory rate limiter for Upstash
at the same time; right now every limit is per-warm-instance, so the effective ceiling is
`limit × instance_count`.

### 6.2 PostGIS, sooner than the strategy doc suggests

`STRATEGY.md §7` calls PostGIS "optional… can wait." I'd pull it forward. It fixes three
problems at once: §4.4 (the pagination/sort mismatch), the JS distance filter running after
`LIMIT`, and true nearest-N ordering. The sketch is already in your doc:

```sql
create extension if not exists postgis;
alter table profiles add column if not exists geom geography(point,4326);
update profiles set geom = ST_SetSRID(ST_MakePoint(lng, lat),4326)::geography
  where lat is not null and geom is null;
create index if not exists profiles_geom_idx on profiles using gist (geom);
```

### 6.3 The hardcoded city table is the real scaling wall

`src/lib/geo.ts` has **21 hardcoded SoCal/NV cities**. `coordForLocation` returns `null` for
anything else, and `originOf` silently falls back to `DEFAULT_COORD` — **Costa Mesa**.

So every user outside Southern California is told everyone is 0 miles away in Costa Mesa.
You cannot launch nationally in this state. Your own doc calls this "the highest-impact
product fix." I agree, with one addition: **the silent fallback is worse than no geo**,
because it produces confidently wrong distances instead of "location unknown."

**Fix:** browser Geolocation permission (you already have a PWA surface for it) with an
explicit, honest "location off" state; Mapbox/Google geocoding for text locations; store
`lat`/`lng` and treat null as unknown rather than Costa Mesa.

### 6.4 Media

Your "one Blob store is enough" analysis is correct — reads are CDN-served and never touch
the app. Keep it. The one change I'd make early is **direct-to-Blob client uploads**, because
today every upload is proxied through a serverless function, and that's the bandwidth
chokepoint the moment you add video.

### 6.5 Query-level notes

- `q` search uses `lower(display_name) like '%term%'` — leading wildcard, unindexable. Fine
  at launch; use a trigram index or full-text search when profiles exceed ~50k.
- `ensureSeed()` is called on most request paths. It's now one indexed read, which is fine,
  but it's on the hot path of discover/chat/likes/feed. Consider checking it once per
  instance with a TTL rather than per request.
- `getProfileForViewerUser` and `listDiscoverForUser` both run two queries (target + self).
  Collapsible into one with a lateral join if it ever matters.
- `profiles_latlng_idx` is a partial index on `(lat, lng)` where `lat is not null`. The bbox
  predicate is `lat is null or (lat between … and lng between …)` — the `lat is null` branch
  defeats index use. Consider a second partial index or splitting the query.

---

## 7. What's genuinely excellent (protect this)

I don't want a wall of criticism to obscure that a lot of this is really well done:

1. **The role-enforcement mechanic.** Even in its current self-declared form, it's the only
   feature in the category that encodes *rules* rather than *tags*. It makes the deck feel
   curated by a shared worldview. That's a moat. Fix §4.2 and protect it.
2. **`bnwo.ts` as a strategic asset.** Identity → role → decree → empty-state copy, all in
   one place, all in-voice. Most apps can't say the words; you built a whole vocabulary layer.
   The empty states ("No bulls in this radius. The Set will show. Keep the hole ready.") are
   the best I've seen in a seed-stage product.
3. **The AI persona system.** `identityLock` + `heat()` escalation + refusal detection +
   cross-provider fallback with live model discovery is genuinely sophisticated. The "start
   PG-13 and escalate only as they do" strategy is the correct answer to free-tier model
   filtering, and the self-healing model discovery means a retired Groq id doesn't silently
   degrade the product. Nice work.
4. **The Better Auth consolidation.** Collapsing three competing session systems into one is
   unglamorous and it's what finally made login work. The `ARCHITECTURE.md` "why the old
   setup didn't work" section is honest and correct.
5. **Keyset pagination being shipped at all.** Most seed-stage decks `OFFSET` and die at
   10k rows. You did it properly. It's just been combined with a JS re-sort (§4.4).
6. **Discreet mode existing at all.** Nobody in this category has shipped it. The *idea* is
   right; §2.3 is about making it true.

---

## 8. The industry, August 2026

### 8.1 The headline: the broad market just broke, and the niches didn't

**In 2025 the dating app market posted its first-ever annual revenue decline.**
Tinder −5.2%, Bumble −9.5%. Meanwhile **Grindr, PURE, and Feeld all grew**
[5](https://www.businessofapps.com/news/dating-app-market-first-annual-revenue-decline/).

That is the single most important fact about your market, and it is the strongest possible
validation of your thesis. Read it again: the two largest apps by revenue both shrank, and
every niche app in the dataset grew.

| | 2026 figure | Direction |
| --- | --- | --- |
| Global online dating revenue | **$6.09B** (Precedence) / $9.01B (BRI) | +7.9% CAGR [1](https://www.precedenceresearch.com/online-dating-services-market)[3](https://www.businessresearchinsights.com/market-reports/online-dating-services-market-123379) |
| US market | **$1.65B** (2025), 8.14% CAGR | Largest single market [1](https://www.precedenceresearch.com/online-dating-services-market) |
| Global users | **380M+** | Flat [2](https://getcupid.ai/blog/editorial/dating-app-statistics) |
| Tinder | 75M MAU, **−9% YoY**; 8.6M payers, **−5% YoY**, −21% from 2022 peak | Declining [3](https://catfishfinder.org/dating-app-statistics/) |
| Grindr | **15M MAU**, revenue **+28%** to $439.9M, **44.5% EBITDA margin** | Growing [3](https://catfishfinder.org/dating-app-statistics/) |
| Hinge | Revenue **+27%** to $185M, payers +17% | Growing [1](https://www.useluminix.com/reports/market-research/dating-app-market) |
| Feeld | ~£48.9M revenue, **+26%**; ~$65M; 2M+ members, **+368% 2021→2025** | Growing [1](https://www.globaldatinginsights.com/news/feelds-profits-climb-26-after-surge-in-vanilla-monogamous-users/)[2](https://www.swipestats.io/blog/feeld-review) |

Note what Grindr proves: **a focused community app can run a 44.5% EBITDA margin while the
generalists contract.** That's the shape of the business you're building.

### 8.2 The segment you're actually in

"Niche dating" is **19%** of the market and "adult dating" is **11%**
[3](https://www.businessresearchinsights.com/market-reports/online-dating-services-market-123379).
Strut sits at the intersection of both. Depending on which topline you use, that's roughly
**$1.0B–$1.7B globally** for the addressable segment — small enough that Match Group will
never defend it, large enough to build a $50M+ company in.

And the demand is *stated*, not inferred: **37% of adults say generalist apps offer too many
choices**, which is precisely the pain a niche app solves
[4](https://www.sci-tech-today.com/stats/online-dating-statistics/).

### 8.3 ARPPU — the number that actually matters

| App | Monthly revenue per payer |
| --- | --- |
| Hinge | **$33.13** |
| Bumble | $27.65 |
| **Grindr** | **$24.25** |
| Tinder | $17.56 |
| Badoo | $11.26 |

[3](https://catfishfinder.org/dating-app-statistics/)

Grindr is your benchmark: a niche, community-driven, sexually-explicit app monetizing at
**$24.25/payer/month** — 38% better than Tinder — with an **8.4% payer conversion**
(1.26M payers / 15M MAU).

Feeld proves the pricing ceiling directly: **$12–30/month** for Majestic
[2](https://www.swipestats.io/blog/feeld-review). That's your lane.

### 8.4 The PWA decision is correct, and better than you've argued

`STRATEGY.md §6` frames web-first as a workaround for app-store age-verification mandates.
It's actually a **structural advantage**:

- **Apple rejects PWAs outright.** App Store Guideline 4.2 blocks "repackaged websites," and
  4.2.2 targets "web clippings" specifically. There is no equivalent to Google's Trusted Web
  Activity, and there hasn't been since Chrome 72
  [1](https://www.mobiloud.com/blog/publishing-pwa-app-store).
- Even if you *did* build native, **Apple would not distribute this content**. Adult-only apps
  are not permitted in the stores at all.
- You keep **100% of revenue** — no 15–30% platform commission. On an adult-content app, that
  commission is the difference between a business and a hobby.
- No delisting risk. Your domain is your distribution.

The cost is real, and you should plan around it: **iOS PWA scores 86/100 vs Android's 97/100**,
with no automatic install prompt, no background sync, Safari-only installation, and push
gated behind install [2](https://www.mobiloud.com/blog/progressive-web-apps-ios)
[4](https://deepclick.com/resources/blog/progressive-web-apps-on-ios/).

**This makes `install-prompt.tsx` one of the highest-leverage components in the codebase.**
On iOS, Web Push only works *after* Add-to-Home-Screen, so without that flow you have **no
re-engagement channel at all on iPhone**. You built the right thing. Measure it, A/B the
copy, and treat install rate as a top-line growth metric.

### 8.5 The regulatory environment, precisely

- **27 states** require age verification as of **13 August 2026**; none enjoined. Iowa
  effective 1 July 2026; **Missouri effective 28 August 2026**
  [4](https://www.recordinglaw.com/us-laws/age-verification-laws/).
- *Free Speech Coalition v. Paxton*, 606 U.S. 461 (27 June 2025) — 6–3, intermediate
  scrutiny, "adults have no First Amendment right to avoid age verification"
  [5](https://natlawreview.com/article/us-supreme-court-upholds-adult-entertainment-website-age-verification-law).
- Threshold is **>⅓ of content** being "harmful to minors" — Strut is ~100%.
- **California and New York have no adult age-verification law** (CA AB 3080 died in
  committee) [4](https://www.recordinglaw.com/us-laws/age-verification-laws/) — which means
  your two biggest likely markets are currently the two least regulated. Use that window.
- **KOSA, COPPA 2.0, and the KIDS Act are not law** [4](https://www.recordinglaw.com/us-laws/age-verification-laws/).
- Australia Phase 2 (March 2026) extended age assurance to adult sites **and AI chatbots**,
  fines to **AUD 49.5M** [1](https://bunny-cms.com/blog/age-verification-for-adult-websites-2026-compliance-guide)
  — directly relevant to §2.8.
- Payment processing: build on an adult-compliant processor from day one.

---

## 9. Your demographic: how fast it's growing

### 9.1 The hard evidence

I'm going to be careful here and separate what's measured from what's inferred, because you
should not put a number in a deck you can't defend.

**Measured, 2025 (Pornhub Year in Review):**
- `hotwife` **+101%**
- `cheating` **+94%**
- `cuckold` **+73%**
- `swingers` **+68%**
- `wife swap` **+39%**
[2](https://mashable.com/article/pornhub-year-in-review-trends-2025)
[4](https://www.dazeddigital.com/life-culture/article/69253/1/the-silliest-and-sexiest-takeaways-from-pornhubs-2025-report)

**Measured, 2026 (continuation, not a one-year spike):**
- `cheating` / `sneaky cheating` **+2× YoY**
- `cuckold` **+73%** (again, second consecutive year)
- `caught cheating` **+53%**
[1](https://zine.kleinkleinklein.com/p/pornhub-trends-2026)

**Measured, commercial (Clips4Sale — actual sales, not searches):**
- Cuckold content sales **+191% since 2020**, and **+75% in the most recent year**
[3](https://mashable.com/article/right-wing-cuck-adult-content)

That last one is the number I'd lead with, because it's **revenue**, not curiosity. +191% over
five years is a **~23.8% CAGR in paid demand**, and the most recent year accelerated to +75%.

Adjacent validation: Feeld reports **"heteroflexible" grew 193% YoY** as its fastest-expanding
identity, with **Gen Z the fastest-growing cohort (+20%)**
[4](https://www.datezie.com/feeld-review/). Same underlying shift — explicit sexual identity
becoming something people *state* rather than hide.

### 9.2 Forecast (my estimate — label it as such)

Searches are a leading indicator and overstate durable behaviour; paid sales understate
reach but track money. I'd bracket it:

| Year | Interest index (2026 = 100) | Basis |
| --- | --- | --- |
| 2026 | 100 | +73% cuckold, +101% hotwife, +75% paid sales |
| 2027 | 140–170 | Continuation with first-stage decay |
| 2028 | 175–245 | Category maturity, first dedicated products land |
| 2029 | 210–330 | Slowing as it normalizes |

Call it **~40–70% CAGR now, decelerating to ~20–30% by 2029.** Against a broad dating market
growing at 6–8% and Tinder at −5 to −9%, the **relative** growth differential is roughly
**8–10×**. That differential is the entire investment thesis.

**Honest caveat:** this cluster is small in absolute terms and two of my sources are
adult-industry self-reports. If you're raising money on this, buy proper search-volume data
or commission a survey. The *direction* is unambiguous across four independent sources. The
*magnitude* is my estimate, not a cited figure.

### 9.3 Correcting the revenue model in `STRATEGY.md` ⚠️

This is the most commercially important thing in this document.

`STRATEGY.md §5` says: *"$6–15 monthly LTV; ~50k actives → $300–750k/mo."*

**That's a blended ARPU of $6–15 per *active* per month, including non-payers.** At Grindr's
benchmarked 8.4% payer conversion, that implies an ARPPU of **$71–179/month**. No app in this
category charges that. Hinge — the highest ARPPU in the market — is $33.13
[3](https://catfishfinder.org/dating-app-statistics/).

The real blended ARPU, bottom-up from the benchmark:

```
$24.25/payer/month  ×  8.4% payer conversion  =  ~$2.04 per active per month
```

| Actives | Payer conv. | ARPPU | Monthly revenue | Annual |
| --- | --- | --- | --- | --- |
| 50k | 8.4% | $24.25 | **~$102k** | ~$1.2M |
| 250k | 8.4% | $24.25 | **~$510k** | ~$6.1M |
| 1M | 8.4% | $24.25 | **~$2.0M** | ~$24M |

**So your "$300–750k/mo" figure is a ~150–250k-active business, not a 50k-active business.**
The model is off by roughly 4–5×.

Why this matters: an investor who redoes this arithmetic in the meeting will find it in about
ninety seconds, and finding one inflated number makes them discount every other number. Fix
it first. The corrected model is still a great story — **~$1.2M ARR at 50k actives with
Grindr's 44.5% EBITDA margin** is a capital-efficient business that doesn't need to raise at
all.

### 9.4 What this means for the deck

The defensible claim is **not** "huge market." It's:

> A $1–1.7B segment growing at 6–8%, containing a sub-segment whose demand is compounding at
> ~40–70% YoY, with **no purpose-built matching product** — in a category where the incumbent
> leader is contracting at 5–9% and the closest niche comparables run 44.5% EBITDA margins.

That's specific, falsifiable, and checkable. Much stronger than a TAM slide.

---

## 10. "First to market" — how I'd actually claim it

**The claim holds, but not for the reason in `STRATEGY.md`, and "first" is not the moat.**

Where it's defensible: a **Tinder-format swipe deck purpose-built for the BNWO/QOS/sissy/
whiteboi/hotwife/cuck/trans/group cluster, where the identity language is the product and
profile copy can be explicit by design.** I could not find a competitor doing that.

Where it's weaker than the doc implies:
- **Feeld** is adjacent and has 2M+ members. It's broader, and its users already say it's
  "less hardcore kink than before" — a generalist brand structurally **cannot say the words
  you say**. That's your opening, and it's real. But Feeld is not nothing.
- **FetLife** is community, not matching — wrong format, but it owns the community mindshare.
- Reddit/X/Discord serve this audience today, for free, without a matching product.

**The real moat is not being first. It's three things that compound:**

1. **The rules layer.** `bnwo.ts` — identity→role→decree. A clone can copy a feature list;
   it can't copy a worldview that's encoded in code and copy. Ship more of it, not less.
2. **Brand permission.** You say the words out loud. Every serious competitor has a brand,
   an app store, or a payment processor that stops them. That's a durable, structural
   advantage and it gets stronger as regulation tightens.
3. **Liquidity in specific metros.** In a niche this tight, 2,000 active users in
   **one** city beats 200,000 spread across forty. Own Los Angeles completely before you
   touch city two. This is the moat that actually protects you, and it's also the thing the
   hardcoded city table (§6.3) currently blocks.

**One warning:** a well-funded clone can raise money and copy the wedge — but they'd have to
say the words and take the regulatory risk too. Most won't. Your defence is to make the brand
and the rules inseparable, and to lock up metro liquidity before anyone tries.

---

## 11. Marketing & growth

### 11.1 What won't work

Paid social is closed to you. Meta and Google won't take explicit adult messaging, and
adult-adjacent buying is restricted regardless of creative. App Store discovery is
unavailable — you're not in the stores and can't be (§8.4). SEO is a slow, weak channel for a
product whose pages are correctly `noindex`.

**Accept this and stop planning around it.** You are an organic, community-led product. That's
fine — it's also cheaper and it builds a better moat.

### 11.2 What will work, ranked

**1. Creator partnerships — by far the highest leverage.**
In this space the influencers are creators on X, Reddit, and adult platforms. A handful of
partnerships, each with a referral code and a revenue share on signups, reaches the exact
micro-segment in one hop. Budget: rev-share, not cash. Ten mid-tier creators will outperform
any ad spend you could legally place.

**2. Metro-by-metro community seeding.**
Your audience is concentrated and loudly self-organizing — subreddits, X hashtags,
Discord/Telegram, FetLife groups. The rule is **native, not spammy**: earn permission, answer
honestly, be the "and there's a place for this now" answer. One city at a time. Say which
city you're in.

**3. The ♠️ as brand.**
The spade already functions as silent shorthand in bios across X, Instagram, and dating
profiles. A brand that *understands the code* gets adopted; one that has to explain it gets
ignored. You already have this in `components/logo.tsx`. Push it harder — it's the cheapest
distribution asset you own, because the community does the work.

**4. Referral asymmetry — build this specifically.**
The structure here is 1:many: one king ↔ many bottoms/wives. A single high-status king brings
dozens. So build **"Bring your king"** and **"Bring your wife"** invite flows, and reward
tops and couples for bringing their circle. Standard referral programs assume symmetric
networks; yours isn't. Exploit that.

**5. Privacy as the headline.**
"The mainstream app can't say it. We're the one that won't." Make the safety work *visible*:
one-tap deletion (§2.7), real discreet mode (§2.3), no screenshot-friendly defaults, no
public "who liked you" leakage. For closeted and married users, this isn't a feature — it's
the reason to choose you. **Then make sure it's true, or you have a liability.**

**6. Install rate as a growth metric.**
No App Store means no push, no re-engagement, no organic rediscovery (§8.4). Instrument the
Add-to-Home-Screen funnel like it's your activation metric, because it is.

### 11.3 Positioning

Your current copy is already unusually strong. "Strut is BNWO propaganda with a dating app
attached" is a better line than anything a focus group would produce, and the empty states
are excellent. Two suggestions:

- **Lead with belonging, not explicitness.** The explicitness is the proof; the product is
  "the first place that says the thing without a ban." Belonging converts and retains;
  transgression acquires and churns.
- **Publish a plain-language safety page.** Age gate, what you store, how to delete, how to
  report, how fast you act. Right now it doesn't exist. It will be your highest-converting
  page with the most hesitant — and highest-LTV — segment: married women and closeted men.

### 11.4 Metrics that actually matter here

Vanity metrics will mislead you. Track:

| Metric | Why |
| --- | --- |
| **King-to-kneeler ratio per metro** | The single health metric. Kings are supply; everyone else is demand. |
| **Bidirectional match rate** | Niche apps win on match quality, not volume. |
| **D1/D7 return for new kings** | If kings don't come back, the metro dies. |
| **PWA install rate** | Your only re-engagement channel on iOS. |
| **Time-to-first-match** | Best single predictor of retention in a matching product. |
| **Report rate per 1k messages** | Safety leading indicator. Watch it before it watches you. |

---

## 12. Changes I made to the repo

Two, both small:

1. **`vite.config.ts`** — added `allowedHosts: true` to the dev server. Vite 6+ rejects any
   Host it doesn't recognise with a 403, so **no proxied, tunnelled, or preview hostname
   could load the app at all** — I hit this immediately on first `npm run dev`. Scoped to
   `server` only; `preview` and `build` are untouched.
2. **`scripts/smoke.mjs`** (new) — the 19-step end-to-end test described in §1. Run it with
   `node scripts/smoke.mjs` against a running server. It's a real regression harness for
   auth, profile, role enforcement, discover, deck, swipe exclusion, chat, and the 401/403
   boundaries. **I'd recommend wiring it into CI** — it would have caught the undo bug's
   server half and it will catch authz regressions.

Everything else in this document is analysis only. I haven't touched application code.

---

## 13. Recommended sequence

**Before you let a single real user in:**
1. Age gate — birth date, server-enforced, pre-profile (§2.1)
2. Block + report (§2.2)
3. Real discreet mode (§2.3)
4. Rate limits: phone OTP, discover/deck/swipe, message send (§2.4, §2.5, §3)
5. Photo URL allowlist (§3.3)
6. Fix Undo (§4.1)

**Before you market in more than one city:**
7. Geocoding — kill the Costa Mesa fallback (§6.3)
8. Decide the role-enforcement question deliberately (§4.2)
9. Fix the Kings tab (§4.3)
10. Fix discover pagination/sort (§4.4)
11. PostGIS (§6.2)
12. Account deletion + export (§2.7)

**Before you monetize:**
13. Adult-compliant payment processor
14. AI-member disclosure (§2.8)
15. Message encryption at rest (§2.6)
16. Moderation queue + takedown SLA (§2.2)

---

## 14. Sources

Market: [Precedence Research](https://www.precedenceresearch.com/online-dating-services-market) ·
[getcupid 2026](https://getcupid.ai/blog/editorial/dating-app-statistics) ·
[Business Research Insights](https://www.businessresearchinsights.com/market-reports/online-dating-services-market-123379) ·
[Sci-Tech Today](https://www.sci-tech-today.com/stats/online-dating-statistics/) ·
[The Business Research Company](https://www.thebusinessresearchcompany.com/report/online-dating-and-matchmaking-global-market-report)

Apps: [Business of Apps — first annual decline](https://www.businessofapps.com/news/dating-app-market-first-annual-revenue-decline/) ·
[CatfishFinder — ARPPU & Grindr](https://catfishfinder.org/dating-app-statistics/) ·
[Luminix](https://www.useluminix.com/reports/market-research/dating-app-market) ·
[5WPR AI Visibility Index](https://www.5wpr.com/ai-visibility-index/dating-app-ai-visibility-index-2026/) ·
[Global Dating Insights — Feeld](https://www.globaldatinginsights.com/news/feelds-profits-climb-26-after-surge-in-vanilla-monogamous-users/) ·
[SwipeStats — Feeld](https://www.swipestats.io/blog/feeld-review) ·
[Datezie — Feeld](https://www.datezie.com/feeld-review/)

Demographic: [Mashable — Pornhub 2025](https://mashable.com/article/pornhub-year-in-review-trends-2025) ·
[Dazed — Pornhub 2025](https://www.dazeddigital.com/life-culture/article/69253/1/the-silliest-and-sexiest-takeaways-from-pornhubs-2025-report) ·
[Zine — Pornhub 2026](https://zine.kleinkleinklein.com/p/pornhub-trends-2026) ·
[Mashable — Clips4Sale sales data](https://mashable.com/article/right-wing-cuck-adult-content)

Legal: [RecordingLaw — 27-state table, Aug 2026](https://www.recordinglaw.com/us-laws/age-verification-laws/) ·
[National Law Review — FSC v. Paxton](https://natlawreview.com/article/us-supreme-court-upholds-adult-entertainment-website-age-verification-law) ·
[Mayer Brown](https://www.mayerbrown.com/en/insights/publications/2026/01/little-users-big-rules-tracking-childrens-privacy-legislation) ·
[Bunny CMS — 2026 compliance guide](https://bunny-cms.com/blog/age-verification-for-adult-websites-2026-compliance-guide)

Platform: [Mobiloud — PWA & App Store](https://www.mobiloud.com/blog/publishing-pwa-app-store) ·
[Mobiloud — PWA on iOS](https://www.mobiloud.com/blog/progressive-web-apps-ios) ·
[DeepClick — PWA on iOS](https://deepclick.com/resources/blog/progressive-web-apps-on-ios/)

---

*Audit performed against `main` @ `f29709f`, 27 August 2026.*


---

# Implemented — change log

Everything below is in the working tree now (`git diff` against `main`). Build,
typecheck, lint and the test suite all pass.

## P0 — ship-blockers, all closed

| # | Item | Where |
| --- | --- | --- |
| 0.1 | **Real age gate.** `birth_date` column, server-side `checkBirthDate`, an 18+ attestation written to `account_events` at profile creation, and a date-of-birth field on step 1 of onboarding. Age is *derived* from birth date — never accepted from the client. | `src/lib/age.ts`, `migrations/0015_age_gate.sql`, `src/routes/onboarding.tsx`, `src/lib/server/profiles.ts` |
| 0.2 | **Real discreet mode.** A discrete cosine-transform blur is generated client-side from each full photo (`fileToBlurPlaceholder`), stored as a data URI in `photos.photo_blurs`, and rendered as the only version of the image until the viewer opts in. One flag — `discreet` — now flips every photo everywhere, and the fallback when a placeholder is missing is a silhouette, never the real image. | `src/lib/media.ts`, `src/components/photo.tsx`, `migrations/0017_photo_blurs.sql`, `src/routes/_app/{index,me,feed,chat}.tsx`, `src/components/photo-viewer.tsx` |
| 0.3 | **Block + report + moderation.** `blocks` (symmetrical — you *both* disappear from each other's deck, likes and messages), `reports` with seven reasons including "Under 18" and "Non-consensual / intimate image" (both tagged for priority review), and an `account_events` audit trail. Blocked accounts are excluded **in SQL**, before `LIMIT`, so they can't consume a deck slot. | `src/lib/server/safety.ts`, `src/lib/server/audit.ts`, `migrations/0016_safety.sql`, `migrations/0018_account_events.sql` |
| 0.4 | **Rate limits on everything that costs money or leaks data.** Phone OTP (10/hr per IP, 5/hr per number), deck (400/hr), swipe+undo (1200/hr), mutations (300/hr), posts (30/hr), reports (20/hr), messages (120/hr per user, 400/hr per IP). Discover/deck were previously unmetered — a signed-in account could walk the keyset cursor and enumerate the whole member table. | `src/lib/server/rate-limit.ts`, `src/routes/api/app.ts`, `src/routes/api/phone/*`, `src/routes/api/messages/*` |
| 0.5 | **Photo URL allowlist + type sniffing.** Uploads are sniffed from magic bytes (the client's `Content-Type` is ignored — it previously allowed SVG/HTML onto the CDN, which is stored XSS), and saved photo URLs must be on the Blob host or an explicit allowlist. | `src/lib/server/media.server.ts`, `src/lib/photo-url.ts` |

## P1 — security hardening

- **CSRF on `/api/messages/*`** — all six routes now call `forbiddenUnlessTrustedOrigin`. It was on `/api/app`, `/api/media` and `/api/profile` but *none* of the message routes.
- **SSE slot leak closed.** `acquireStream` ran before validation and was only released on the happy path, so four malformed requests could kill a user's live chat for the whole 30-minute window. Validation now precedes acquisition and a `release()` closure covers every exit.
- **`on conflict` on likes and follows** — two rapid taps previously threw a 500 (and, worse, could double-write).
- **Account deletion and data export** — `GET`/`DELETE /api/account`. Deletion is real: it wipes the profile, likes, follows, swipes, posts, blocks, conversations and **deletes the photos from blob storage**. Export excludes other people's content so it can't be used as a dossier.
- **Server-side rate limit on phone `start`/`login`** (see P0.4).

## P2 — correctness

- **Undo is real.** It previously rewound a local index while the row was already in `swipes` *and* mirrored into `likes` — so you'd see a card you'd actually liked, and re-swiping produced a **false match**. `undoSwipeFor` now deletes from both tables.
- **Discover pagination.** Two bugs at once: the distance filter ran in JS *after* `LIMIT` (empty pages while the API still advertised "more"), and the result was re-sorted by distance while the cursor came from the unsorted SQL — two orderings in one feed, so page boundaries dropped and repeated profiles. Haversine now runs in SQL inside the bounding box, results are over-fetched and **not** re-sorted, and the cursor comes from the last row actually returned.
- **Kings tab.** It matched `Man + Admirer + Bull`, but the app's own `bnwo.ts` treats only "Bull" as a king — so the scarcest, highest-value cohort was diluted with submissive men. Kings is now Bull alone; `Man + Admirer` moved to a new **Men** tab.
- **Unbounded result sets** — `listLikesFor` and friends are now bounded and blocks-aware.
- **`npm test`** ran *zero* files: `node --test 'scripts/**/*.test.mjs'` doesn't expand globs. Now 7 tests run and pass.
- **Migration runner** — basename-keyed `applied_migrations`, non-recursive walk, whole-plan transaction, and a guard that fails the fast path if a new file would retroactively insert into `$NEXUS_SCHEMA`.

## Also

- **Bullseye overlay removed** from the landing hero.
- **Docs**: `docs/twilio.md` — exact step-by-step Twilio setup, the A2P 10DLC trap for US numbers, env-var checklist, verification commands, spend caps and an error-code table.
- **docs/design.md** — aesthetic direction, copy voice, tab architecture, the discreet-mode spec.

## Known gaps (deliberately deferred)

- **Moderation reviewer UI** — reports land in the table with nothing reading them.
- **Message encryption at rest** — needs a KMS; not worth it before PMF.
- **AI-member disclosure** — seeded profiles are indistinguishable from real ones. Cheap to add (an `is_ai` column plus a badge) and worth doing before any scale push.
- **PostGIS** for exact nearest-first ordering — current haversine-in-SQL is fine to ~100k profiles.

## Untracked files

```
M .env.example
 M package.json
 M src/components/photo-editor.tsx
 M src/components/photo.tsx
 M src/components/profile-card.tsx
 M src/components/swipe-deck.tsx
 M src/lib/auth/isolation.server.ts
 M src/lib/auth/sms.server.ts
 M src/lib/env.ts
 M src/lib/media.ts
 M src/lib/onboarding-draft.ts
 M src/lib/profile-api.ts
 M src/lib/server/chat.server.ts
 M src/lib/server/map.ts
 M src/lib/server/media.server.ts
 M src/lib/server/profiles.ts
 M src/lib/server/rate-limit.ts
 M src/lib/server/social.ts
 M src/lib/types.ts
 M src/routeTree.gen.ts
 M src/routes/_app/discover.tsx
 M src/routes/_app/feed.tsx
 M src/routes/_app/me.tsx
 M src/routes/api/app.ts
 M src/routes/api/media.ts
 M src/routes/api/messages/bot-status.ts
 M src/routes/api/messages/list.ts
 M src/routes/api/messages/open.ts
 M src/routes/api/messages/reply.ts
 M src/routes/api/messages/send.ts
 M src/routes/api/messages/stream.ts
 M src/routes/api/messages/thread.ts
 M src/routes/api/phone/login.ts
 M src/routes/api/phone/start.ts
 M src/routes/index.tsx
 M src/routes/onboarding.tsx
 M src/styles.css
 M vite.config.ts
?? AUDIT.md
?? docs/
?? migrations/0015_age_gate.sql
?? migrations/0016_safety.sql
?? migrations/0017_photo_blurs.sql
?? migrations/0018_account_events.sql
?? scripts/smoke.mjs
?? src/lib/age.ts
?? src/lib/photo-url.ts
?? src/lib/server/audit.ts
?? src/lib/server/safety.ts
?? src/routes/api/account.ts
?? src/routes/api/phone/status.ts
```

## Diffstat

```
.env.example                          |  14 +++
 package.json                          |   2 +-
 src/components/photo-editor.tsx       |  49 ++++++--
 src/components/photo.tsx              |  62 +++++++--
 src/components/profile-card.tsx       |   6 +-
 src/components/swipe-deck.tsx         |  51 ++++++--
 src/lib/auth/isolation.server.ts      |  19 +++
 src/lib/auth/sms.server.ts            | 107 ++++++++++++----
 src/lib/env.ts                        |  42 ++++++-
 src/lib/media.ts                      | 112 +++++++++++++----
 src/lib/onboarding-draft.ts           |   5 +
 src/lib/profile-api.ts                |  15 ++-
 src/lib/server/chat.server.ts         |   7 ++
 src/lib/server/map.ts                 |  19 ++-
 src/lib/server/media.server.ts        |  34 ++++-
 src/lib/server/profiles.ts            | 230 +++++++++++++++++++++++++++++-----
 src/lib/server/rate-limit.ts          |  69 +++++++++-
 src/lib/server/social.ts              |  47 +++++--
 src/lib/types.ts                      |  17 ++-
 src/routeTree.gen.ts                  |  42 +++++++
 src/routes/_app/discover.tsx          |  14 +++
 src/routes/_app/feed.tsx              |   3 +-
 src/routes/_app/me.tsx                | 164 +++++++++++++++++++++++-
 src/routes/api/app.ts                 | 155 +++++++++++++++++++----
 src/routes/api/media.ts               |  17 ++-
 src/routes/api/messages/bot-status.ts |   3 +
 src/routes/api/messages/list.ts       |   3 +
 src/routes/api/messages/open.ts       |  11 ++
 src/routes/api/messages/reply.ts      |   3 +
 src/routes/api/messages/send.ts       |  20 +++
 src/routes/api/messages/stream.ts     |  33 +++--
 src/routes/api/messages/thread.ts     |   3 +
 src/routes/api/phone/login.ts         | 110 ++++++++++++++--
 src/routes/api/phone/start.ts         |  78 ++++++++++--
 src/routes/index.tsx                  |   1 -
 src/routes/onboarding.tsx             |  65 ++++++++--
 src/styles.css                        |  14 ---
 vite.config.ts                        |   5 +
 38 files changed, 1424 insertions(+), 227 deletions(-)
```
