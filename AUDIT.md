# Strut — Security, Compliance & Market Posture

*Current-state working document · August 2026. Engineering, trust & safety, and go-to-market alignment.*

---

## 1. Verdict in one page

Strut is a web-first (PWA) dating product purpose-built for the BNWO / QOS / sissy / whiteboi /
hotwife / cuck / trans / group cluster — the first matching product (not a community platform)
that says this demographic's language out loud. The engineering spine is standard and sound,
the safety layer is unusually strong for an early-stage app, and the market timing is
excellent: the broad dating market is contracting while every niche comparable grows.

The outstanding work is (a) compliance integration — third-party age assurance for the 27
regulated states, a moderation reviewer surface, AI-member disclosure — and (b) the scale
plumbing (real geocoding, Redis, PostGIS). None of it blocks a careful early launch; all of it
is scheduled in §11.

| Dimension | Grade | One-line reason |
| --- | --- | --- |
| Product wedge | A | No purpose-built BNWO/QOS matching product exists; role-enforcement is a genuine moat |
| Architecture | A− | One identity layer, Postgres spine, CDN media, keyset pagination, standard auth |
| Security posture | A− | Fail-closed production secrets, origin/CSRF discipline, rate limits, real discreet mode |
| Trust & safety | A− | Symmetric SQL-enforced blocks, priority reports, real account deletion, audit trail |
| Compliance-readiness | C+ | Immutable age gate in place; third-party assurance, moderation UI and disclosure on the roadmap |
| Market timing | A | Tinder in first-ever revenue decline; Grindr/Feeld/PURE compounding; demand data up 40–70% YoY |

---

## 2. Security posture

Everything below is enforced in code today:

- **One identity layer.** Self-hosted Better Auth at `/api/auth/*`; a single HttpOnly, Secure,
  SameSite=Lax session cookie plus a bearer-token plugin for future native apps. No token in
  localStorage, no parallel token tables. Every protected path resolves the caller through
  `getSessionUserFromRequest` / `requireUserId` — client-supplied user ids are never trusted.
- **CSRF & same-site isolation.** Mutating routes require a trusted same-origin request
  (`isolation.server.ts`); Better Auth `trustedOrigins` is derived per request from the
  deployment's own hosts, Vercel preview aliases, and the request's own host — never from an
  arbitrary client-supplied Origin/Referer. This closes the same-site-sibling attack on shared
  parent domains.
- **Fail-closed production secrets.** `BETTER_AUTH_SECRET` is required in production (boot
  refuses to derive the session-signing key from `DATABASE_URL`). Phone OTP refuses to send in
  production without Twilio — the code can never leak to the client. Admin and AI-Horde
  credentials fall back to committed literals only when env vars are unset; set
  `ADMIN_EMAILS` / `ADMIN_PASSWORD` / `AIHORDE_API_KEY` before any public deployment.
- **Phone OTP metering.** Per-IP and per-number ceilings, resend cooldowns, and verification
  ceilings on both `/api/phone/start` and `/api/phone/login` — stops SMS pumping/toll fraud
  and brute force.
- **Uploads are sniffed, not trusted.** `/api/media` accepts only real JPEG/PNG/WebP bytes
  (magic-byte sniff; the client's Content-Type is ignored) and stores the sniffed type, so
  arbitrary `text/html`/SVG can't be hosted on the Blob CDN domain.
- **Photo URL allowlist.** Profiles can only store photos hosted by the app, the Blob CDN, or
  an explicit allowlist — a profile cannot become a tracking pixel that deanonymizes every
  member whose deck loads the card.
- **Rate limits on everything that costs money or leaks data.** Deck (400/hr), swipe+undo
  (1200/hr), mutations (300/hr), posts (30/hr), reports (20/hr), messages (120/hr per user,
  400/hr per IP), uploads (40/hr), bot replies (30/hr), OTP (above), and per-user SSE stream
  caps. Limits are per warm instance by design; swap the in-memory buckets for Upstash Redis
  when global limits matter at multi-instance scale.
- **Security headers** (`vercel.json`): nosniff, DENY framing, strict-origin referrer,
  permissions-policy, HSTS. Member profile pages are `noindex` — never searchable.

**Known limits to plan for at scale:** in-memory rate-limit buckets and the in-process realtime
bus are per-instance; on a multi-instance Vercel deploy they become per-warm-isolate, so
ceilings multiply and SSE events only fan out within an instance. The client treats the stream
as a hint and refetches, so a missed event degrades to a short poll. Back both with Redis when
multi-instance.

---

## 3. Trust & safety

- **Blocks are symmetrical and enforced in SQL.** If either side blocks, neither appears in
  the other's deck, likes, or (on send/open) messages. A block also clears the social graph in
  both directions. Filters live in the SQL WHERE, before LIMIT — no code path can forget them.
- **Reports** carry seven reasons including "Under 18" and "Non-consensual / intimate image"
  (both tagged for priority review at intake), snapshot context (conversation/message id), and
  a status lifecycle (`open → reviewing → actioned/dismissed`). Reports are never silently
  deduplicated and never shown to the reported party.
- **Discreet mode is real.** The hidden state renders a ~24px blur placeholder (a data URI
  generated client-side at upload) or a silhouette — the full-resolution photo is not in the
  DOM, not in view-source, and not in the network log until the viewer taps to reveal. Reveals
  last for the component's life only. The fallback when a placeholder is missing is a
  silhouette, never the real image.
- **Account deletion and export** (`/api/account`) are real: export returns everything Strut
  holds about the caller (never other people's content); deletion wipes the profile, likes,
  follows, swipes, posts, blocks, conversations, and removes photos from blob storage, then
  records an audit event with no personal data attached.
- **Age gate.** A date of birth is required to hold a profile, validated server-side
  (`checkBirthDate`), immutable once attested (no "edit your birthday" path), and enforced at
  the storage layer (`profiles_adult_only_chk`). Age is derived from the birth date, never
  accepted from the client. This is the correct first layer; third-party assurance is the
  remaining piece (§4).
- **Audit trail.** `account_events` records export/delete/age-attest/block/unblock/report/
  suspend/seed actions with no message content or photos — an audit row can never itself
  become the leak.

**On the roadmap:** a moderation reviewer UI (reports currently land with a status and nothing
reads them), AI-member disclosure badging, and 48-hour NCII takedown tooling.

---

## 4. Compliance reality (August 2026)

- **27 U.S. states** require commercial adult-content websites to verify a visitor's age;
  **none is currently enjoined**. Iowa took effect July 1, 2026; **Missouri takes effect
  August 28, 2026**. *Free Speech Coalition v. Paxton* (606 U.S. 461, June 2025) settled the
  constitutional question — "adults have no First Amendment right to avoid age verification."
  ([RecordingLaw](https://www.recordinglaw.com/us-laws/age-verification-laws/))
- **Self-attestation satisfies none of these regimes.** Strut's immutable birth-date gate is
  the right primitive, but the regulated states want third-party assurance. The schema already
  carries `age_assurance_level/method/at/ref`; integrate an assurance provider (ID,
  transactional, or digital-ID check — storing no identity document, per statute) or geo-gate
  the 27 AV states until then. The geo-gate is the fast, industry-standard interim.
- **App-store accountability acts** (TX, UT, LA, AL) push age assurance onto the app stores
  themselves; the Supreme Court declined to block Texas's version on July 6, 2026. **Strut's
  PWA/web distribution sits outside this entirely** — a structural advantage, not a
  workaround. Apple would not distribute this content anyway (adult-only apps are not allowed
  in the stores), and the stores take 15–30% of revenue.
- **California's Digital Age Assurance Act** (signed Oct 2025, effective 2027) moves age
  signals to the OS level — watch, but web is unaffected directly.
- **Mastercard AN 5196** now requires performer identity verification and age documentation
  for adult transactions. Build paid tiers and creator flows through an adult-compliant
  processor from day one.
- **The SCREEN Act** (federal, pending) would apply age verification to almost any service
  hosting even one piece of explicit content and carries serious data-retention concerns
  ([EFF](https://www.eff.org/deeplinks/2026/07/screen-act-threatens-privacy-far-beyond-adult-websites)).
  It threatens small sites disproportionately; the web-first, community-led model is the most
  defensible posture.
- **Australia Phase 2** (March 2026) extends age assurance to adult sites **and AI chatbots**,
  with fines to AUD 49.5M — directly relevant to the in-persona seed bots; disclose them and
  gate them.
- **FTC deception risk.** Undisclosed synthetic profiles are an FTC Section 5 problem
  (FTC v. JDI Dating). The schema already flags generated profiles (`is_ai`, `ai_seed`);
  surface a disclosure/badge before any scale push.
- **GDPR/CCPA** are covered operationally by the deletion + export endpoints and the audit
  trail (§3).

---

## 5. The industry, August 2026

### 5.1 The headline: the broad market broke, and the niches didn't

**In 2025 the dating app market posted its first-ever annual revenue decline** — Tinder
recorded its first annual revenue decline in its history (FY2025, ~−4%), payers down 5–8% YoY
and ~21% from the 2022 peak, and Bumble payers fell 23% in Q1 2026. Meanwhile **Grindr, Feeld
and PURE all grew** [1](https://catfishfinder.org/dating-app-statistics/). That is the single
most important fact about this market, and the strongest possible validation of the thesis:
the two largest apps by revenue both shrank, and every niche app in the dataset grew.

| | 2026 figure | Direction |
| --- | --- | --- |
| Global online dating revenue | **$3.2B (GetStream) – $6.2B (Statista)** | +6–8% (price-led) [5](https://getstream.io/blog/dating-app-statistics/)[2](https://getcupid.ai/blog/editorial/dating-app-statistics) |
| US market | ~**$1.45B** | Largest single market [5](https://getstream.io/blog/dating-app-statistics/) |
| Global users | **380M+** | Flat [2](https://getcupid.ai/blog/editorial/dating-app-statistics) |
| Tinder | 75M MAU, **−9% YoY**; 8.6M payers, **−5% YoY**, −21% from 2022 peak | Declining [1](https://catfishfinder.org/dating-app-statistics/)[2](https://getcupid.ai/blog/editorial/dating-app-statistics) |
| Grindr | **15M MAU**, revenue **+28% to $439.9M**, **44.5% EBITDA margin** | Growing [1](https://catfishfinder.org/dating-app-statistics/) |
| Hinge | Revenue **+27% to $185M**, payers +17% | Growing [4](https://www.useluminix.com/reports/market-research/dating-app-market) |
| Feeld | 2M+ members, **+368% 2021→2025**, ~$65M revenue (+26%), Majestic $12–30/mo | Growing [3](https://www.swipestats.io/blog/feeld-review)[6](https://www.globaldatinginsights.com/news/feelds-profits-climb-26-after-surge-in-vanilla-monogamous-users/) |

Note what Grindr proves: **a focused community app can run a 44.5% EBITDA margin while the
generalists contract.** That's the shape of the business being built.

### 5.2 The segment Strut is actually in

"Niche dating" is **19%** of the market and "adult dating" is **11%**. Strut sits at the
intersection of both — roughly **$1.0B–$1.7B globally** for the addressable segment: small
enough that Match Group will never defend it, large enough to build a $50M+ company in. The
demand is stated, not inferred: **37% of adults say generalist apps offer too many choices** —
precisely the pain a niche app solves.

### 5.3 ARPPU — the number that matters

| App | Monthly revenue per payer |
| --- | --- |
| Hinge | **$33.13** |
| Bumble | $27.65 |
| **Grindr** | **$24.25** |
| Tinder | $17.56 |
| Badoo | $11.26 |

Grindr is the benchmark: a niche, community-driven, sexually-explicit app monetizing at
**$24.25/payer/month** — 38% better than Tinder — with an **8.4% payer conversion**
(1.26M payers / 15M MAU) and a 44.5% EBITDA margin. Feeld proves the pricing ceiling directly:
**$12–30/month** for Majestic. That is Strut's lane.

### 5.4 The PWA decision is correct

- **Apple rejects PWAs outright** (App Store Guideline 4.2/4.2.2), and **would not distribute
  this content at all** — adult-only apps are not permitted in the stores.
- Web-first means **100% of revenue** (no 15–30% commission), **no delisting risk**, and no
  app-store age-verification mandate. On an adult-content app, that commission is the
  difference between a business and a hobby.
- The cost is real: **iOS PWA scores ~86/100 vs Android ~97/100**, no automatic install
  prompt, Safari-only installation, and **push gated behind Add-to-Home-Screen** — so
  `install-prompt.tsx` is one of the highest-leverage components in the codebase and install
  rate is a top-line growth metric, not a nicety.

---

## 6. The demographic & forecast

### 6.1 The hard evidence (measured, not inferred)

**Measured, 2025 (Pornhub Year in Review):**
- `hotwife` **+101%** · `cheating` **+94%** · `cuckold` **+73%** · `swingers` **+68%** · `wife swap` **+39%**
[Mashable](https://in.mashable.com/sex-dating-relationships/103366/pornhubs-2025-trends-the-internets-secret-viewing-habits-explained) ·
[Dazed](https://www.dazeddigital.com/life-culture/article/69253/1/the-silliest-and-sexiest-takeaways-from-pornhubs-2025-report)

**Measured, 2026 (continuation, not a one-year spike):**
- `cheating` / `sneaky cheating` **~2× YoY** · `cuckold` **+73%** (second consecutive year) ·
  `caught cheating` **+53%**
[Zine/Klein](https://zine.kleinkleinklein.com/p/pornhub-trends-2026)

**Measured, commercial (Clips4Sale — actual sales, not searches):**
- **Chastity was the 2025 fetish of the year**; cuckolding named a top-10 fetish of the last
  20 years, with sales up **+191% since 2020** and **+75% in the most recent year**.
[Mashable](https://mashable.com/article/chastity-fetish-of-the-year-clips4sale) ·
[Mashable](https://mashable.com/article/right-wing-cuck-adult-content)

That revenue number is the one to lead with: +191% over five years is a **~23.8% CAGR in paid
demand**, and the most recent year accelerated to +75%.

**Adjacent validation:** Feeld reports "heteroflexible" grew **+193% YoY** as its
fastest-expanding identity, with Gen Z its fastest-growing cohort (+20%). Same underlying
shift — explicit sexual identity becoming something people *state* rather than hide.

**Cultural normalization:** the ♠️ / Queen of Spades symbol went from imageboard code (2006
Urban Dictionary; 2022 virality) to mainstream-shorthand TikTok culture, with QOS/BNWO
hashtags and creators actively posting through late August 2026 — the community is loud,
self-organizing, and already signals with the brand.

### 6.2 Forecast (estimate — label it as such)

Searches are a leading indicator and overstate durable behaviour; paid sales understate reach
but track money. Bracket:

| Year | Interest index (2026 = 100) | Basis |
| --- | --- | --- |
| 2026 | 100 | +73% cuckold, +101% hotwife, +75% paid sales |
| 2027 | 140–170 | Continuation with first-stage decay |
| 2028 | 175–245 | Category maturity, first dedicated products land |
| 2029 | 210–330 | Slowing as it normalizes |

Call it **~40–70% CAGR now, decelerating to ~20–30% by 2029.** Against a broad dating market
growing at 6–8% and Tinder at −5 to −9%, the **relative** growth differential is roughly
**8–10×**. That differential is the entire investment thesis.

**Honest caveat:** this cluster is small in absolute terms and two of the sources are
adult-industry self-reports. The *direction* is unambiguous across four independent source
families. The *magnitude* is an estimate — if raising money on it, buy proper search-volume
data or commission a survey.

---

## 7. Revenue model (the canonical numbers)

Bottom-up from the Grindr benchmark ($24.25/payer/month, 8.4% payer conversion):

```
$24.25/payer/month  ×  8.4% payer conversion  =  ~$2.04 per active per month
```

| Actives | Payer conv. | ARPPU | Monthly revenue | Annual |
| --- | --- | --- | --- | --- |
| 50k | 8.4% | $24.25 | **~$102k** | ~$1.2M |
| 250k | 8.4% | $24.25 | **~$510k** | ~$6.1M |
| 1M | 8.4% | $24.25 | **~$2.0M** | ~$24M |

Adult/kink niches carry higher blended LTV than mainstream dating, so treat these as the
conservative floor. At Grindr-like margins the business is capital-efficient enough to not
need outside money at 50k actives. Pricing tiers and the no-paywall principles are in
`STRATEGY.md §5`.

**The defensible claim is not "huge market." It's:**

> A $1–1.7B segment growing at 6–8%, containing a sub-segment whose demand is compounding at
> ~40–70% YoY, with **no purpose-built matching product** — in a category where the incumbent
> leader is contracting at 5–9% and the closest niche comparable runs a 44.5% EBITDA margin.

Specific, falsifiable, checkable — much stronger than a TAM slide.

---

## 8. "First to market" — keeping the lead

The claim holds: a **Tinder-format swipe deck purpose-built for the BNWO/QOS/sissy/whiteboi/
hotwife/cuck/trans/group cluster, where the identity language is the product and profile copy
can be explicit by design.** There is no purpose-built competitor as of August 2026. Feeld is
adjacent but broader and explicitly diluting; FetLife is community, not matching; Reddit/X/
Discord serve this audience without a matching product.

**First is real but perishable. The moat is three things that compound:**

1. **The rules layer.** `bnwo.ts` — identity→role→decree. A clone can copy a feature list; it
   can't copy a worldview encoded in code and copy. Ship more of it, not less.
2. **Brand permission.** Strut says the words out loud. Every serious competitor has a brand,
   an app store, or a payment processor that stops them. That's a durable, structural
   advantage, and it gets stronger as regulation tightens.
3. **Liquidity in specific metros.** In a niche this tight, 2,000 active users in **one**
   city beats 200,000 spread across forty. Own Los Angeles/Orange County completely before
   city two. This is the moat that actually protects the product — and the hardcoded city
   table in `geo.ts` is the thing to replace (PostGIS + real geocoding) to scale it.

**One warning:** a well-funded clone can raise money and copy the wedge — but they'd have to
say the words and take the regulatory risk too. Most won't. The defence is to make the brand
and the rules inseparable, and to lock up metro liquidity before anyone tries.

---

## 9. Marketing & growth

### 9.1 What won't work

Paid social is closed: Meta and Google won't take explicit adult messaging, adult-adjacent
buying is restricted regardless of creative, and there is no App Store discovery for a
web/PWA product. SEO is a slow, weak channel for a product whose pages are correctly
`noindex`. **This is an organic, community-led product — which is also cheaper and builds a
better moat.**

### 9.2 What will work, ranked

1. **Creator partnerships — by far the highest leverage.** In this space the influencers are
   creators on X, Reddit, and adult platforms. A handful of partnerships, each with a referral
   code and revenue share on signups, reaches the exact micro-segment in one hop. Budget:
   rev-share, not cash.
2. **Metro-by-metro community seeding.** Subreddits (r/QOS, r/whiteboi, r/cuckold, r/sissy,
   r/Blacked), X hashtags, Discord/Telegram, FetLife groups. The rule is *native, not
   spammy*: earn permission, answer honestly, be the "and there's a place for this now"
   answer. One city at a time.
3. **The ♠️ as brand.** The spade already functions as silent shorthand across X, Instagram,
   and dating profiles. A brand that *understands the code* gets adopted; one that has to
   explain it gets ignored. Push the logo system hard — it's the cheapest distribution asset.
4. **Referral asymmetry — build this specifically.** One king ↔ many bottoms/wives. Build
   "bring your king" and "bring your wife" invite flows and reward tops/couples for bringing
   their circle. Standard referral programs assume symmetric networks; this one isn't.
5. **Privacy as the headline.** "The mainstream app can't say it. We're the one that won't."
   Make the safety work *visible*: one-tap deletion, real discreet mode, no screenshot-friendly
   defaults, no public "who liked you" leakage. For closeted and married users this is the
   reason to choose Strut — then make sure it's true.
6. **Install rate as a growth metric.** No App Store means no push, no re-engagement, no
   organic rediscovery. Instrument the Add-to-Home-Screen funnel like it's activation, because
   it is.

### 9.3 Positioning

Current copy is unusually strong — "Strut is BNWO propaganda with a dating app attached" is
better than anything a focus group would produce, and the empty states are excellent. Two
suggestions:

- **Lead with belonging, not explicitness.** The explicitness is the proof; the product is
  "the first place that says the thing without a ban." Belonging converts and retains;
  transgression acquires and churns.
- **Publish a plain-language Trust & Safety page.** Age gate, what's stored, how to delete,
  how to report, how fast action happens. It doesn't exist yet, and it will be the
  highest-converting page with the most hesitant — and highest-LTV — segment: married women
  and closeted men.

---

## 10. Metrics that matter

Vanity metrics will mislead. Track:

| Metric | Why |
| --- | --- |
| **King-to-kneeler ratio per metro** | The single health metric. Kings are supply; everyone else is demand. |
| **Bidirectional match rate** | Niche apps win on match quality, not volume. |
| **D1/D7 return for new kings** | If kings don't come back, the metro dies. |
| **PWA install rate** | The only re-engagement channel on iOS. |
| **Time-to-first-match** | Best single predictor of retention in a matching product. |
| **Report rate per 1k messages** | Safety leading indicator — watch it before it watches you. |

---

## 11. Roadmap (current priorities)

**Immediate (before real users):**
1. Set `ADMIN_EMAILS` / `ADMIN_PASSWORD` / `AIHORDE_API_KEY` as real env vars; remove the
   committed fallback literals in `secrets.server.ts`; rotate the Horde key; make the repo
   private if it stays public.
2. Wire `npm test` (directory-arg fix) and the smoke harness into CI — fix the stale smoke
   steps (missing birthDate; thread route param).
3. Keep exact lat/lng server-side (return distance only); rate-limit and block-check the
   `view` op.
4. **Geo-gate the 27 age-verification states** (or integrate third-party age assurance) —
   Missouri's law is effective August 28, 2026.

**Before the second metro:**
5. Real geocoding + PostGIS — kill the hardcoded CITIES table; unlock national metro play.
6. Moderation reviewer UI (reports table needs a reader), with the 48-hour NCII takedown flow.
7. AI-member disclosure badge.

**Before monetizing:**
8. Adult-compliant payment processor (Mastercard AN 5196).
9. Third-party age assurance for regulated states (or maintain the geo-gate).
10. Message encryption at rest if messaging is a paid-tier differentiator.

**Scale gates (in order):** Redis for rate limits + realtime fan-out → PostGIS nearest-N →
read replicas → sharding only if forced.

---

## 12. Sources

Market: [Statista](https://www.statista.com/outlook/emo/dating-services/online-dating/worldwide/) ·
[GetStream 2026](https://getstream.io/blog/dating-app-statistics/) ·
[getcupid 2026](https://getcupid.ai/blog/editorial/dating-app-statistics) ·
[CatfishFinder 2026](https://catfishfinder.org/dating-app-statistics/) ·
[Luminix](https://www.useluminix.com/reports/market-research/dating-app-market)

Apps: [Business of Apps — first annual decline](https://www.businessofapps.com/news/dating-app-market-first-annual-revenue-decline/) ·
[Global Dating Insights — Feeld](https://www.globaldatinginsights.com/news/feelds-profits-climb-26-after-surge-in-vanilla-monogamous-users/) ·
[SwipeStats — Feeld](https://www.swipestats.io/blog/feeld-review) ·
[Datezie — Feeld](https://www.datezie.com/feeld-review/)

Demographic: [Mashable — Pornhub 2025](https://in.mashable.com/sex-dating-relationships/103366/pornhubs-2025-trends-the-internets-secret-viewing-habits-explained) ·
[Dazed — Pornhub 2025](https://www.dazeddigital.com/life-culture/article/69253/1/the-silliest-and-sexiest-takeaways-from-pornhubs-2025-report) ·
[Zine — Pornhub 2026](https://zine.kleinkleinklein.com/p/pornhub-trends-2026) ·
[Mashable — Clips4Sale chastity](https://mashable.com/article/chastity-fetish-of-the-year-clips4sale) ·
[Mashable — Clips4Sale cuckold](https://mashable.com/article/right-wing-cuck-adult-content)

Legal: [RecordingLaw — 27-state table, Aug 2026](https://www.recordinglaw.com/us-laws/age-verification-laws/) ·
[idscan — state-by-state](https://idscan.net/blog/states-are-placing-age-restrictions-on-adult-content-is-your-state-one-of-them/) ·
[AgeWallet — AV & app-store laws](https://agewallet.com/age-verification-laws-2026/) ·
[ViceSnob — 2026](https://www.vicesnob.com/age-verification-laws-onlyfans-2026/) ·
[National Law Review — FSC v. Paxton](https://natlawreview.com/article/us-supreme-court-upholds-adult-entertainment-website-age-verification-law) ·
[EFF — SCREEN Act](https://www.eff.org/deeplinks/2026/07/screen-act-threatens-privacy-far-beyond-adult-websites)

Platform: [Mobiloud — PWA & App Store](https://www.mobiloud.com/blog/publishing-pwa-app-store) ·
[Mobiloud — PWA on iOS](https://www.mobiloud.com/blog/progressive-web-apps-ios) ·
[DeepClick — PWA on iOS](https://deepclick.com/resources/blog/progressive-web-apps-on-ios/)

Culture: [Virtue News — QOS](https://www.virtue.news/the-queen-of-spades-how-a-playing-card-symbol-became-a-viral-social-media-phenomenon/) ·
[knowyourmeme — Queen of Spades Tattoo](https://knowyourmeme.com/memes/queen-of-spades-tattoo) ·
[DAJAI — QOS lifestyle](https://dajai.io/blog/qos-queen-of-spades-lifestyle-explained)
