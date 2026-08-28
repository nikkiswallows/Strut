# Strut — Market, Product & Scale Strategy

*Written as a working document from the perspective of the market as it stands in August 2026.
Current product surface is §9; the scaling path is §7.*

---

## 1. The market you're playing in (2026)

The broad market is enormous but saturated; the head of the market is actually flat to
declining. That is exactly why this app wins. The growth is in **niches**.

| Signal | 2026 figure | What it means for Strut |
| --- | --- | --- |
| Global online-dating revenue | **$3.2B (GetStream) – $6.2B (Statista)** | Big enough to matter, but not where you'll win |
| US revenue | ~**$1.45B** | Largest single market — and you launch there |
| Tinder MAU | ~**75M**, **declining ~9% YoY**; first-ever annual revenue decline (FY2025) | The generalist deck is losing ground |
| Grindr (a *niche* app) | **+28% revenue to $439.9M, 15M MAU, 44.5% EBITDA margin** (FY2025) | Proof that a focused community scales |
| Feeld (a *niche* app) | 2M+ members, **+368% growth 2021→2025**, ~$65M revenue (+26%) | Same proof, kink-adjacent lane |
| Mobile share of usage | ~**52.7%** | The deck is a phone-first habit; PWA covers this |
| Kink/adult niche ARPPU | ~**$24/payer/month at ~8.4% payer conversion** (Grindr benchmark) → ~**$2 per active/month**; 50k actives ≈ **$102k/mo (~$1.2M ARR)** | Higher ARPPU & retention than mainstream dating |

Sources: [Statista — Online Dating](https://www.statista.com/outlook/emo/dating-services/online-dating/worldwide/),
[GetStream dating stats 2026](https://getstream.io/blog/dating-app-statistics/),
[getcupid 2026 stats](https://getcupid.ai/blog/editorial/dating-app-statistics),
[CatfishFinder 2026](https://catfishfinder.org/dating-app-statistics/),
[SwipeStats — Feeld](https://www.swipestats.io/blog/feeld-review).

**The read:** the "meet everyone" apps are fighting for shrinking attention and are
monetizing the *broadest* slice. Strut monetizes the *deepest* slice. A 15M-MAU,
28%-growing niche app (Grindr) is the closest analogue to what Strut can become at a
fraction of the Tinder endgame — because in a tight subculture, **loyalty, not scale, is
the moat.**

### The specific wave you're riding

The demographic Strut serves has gone **mainstream in symbol, still underground in product.** The
♠️ / **Queen of Spades** signal — a white woman with an exclusive, proudly voiced preference for
Black men — was long an in-group code. Around **2022** it went viral on imageboards and then
blew up on social: **#queenofspades / #QOS content has tens of millions of TikTok views**, and the
♠️ now functions as silent shorthand in bios across X, Instagram and dating profiles
([Virtue News](https://www.virtue.news/the-queen-of-spades-how-a-playing-card-symbol-became-a-viral-social-media-phenomenon/),
[knowyourmeme](https://knowyourmeme.com/memes/queen-of-spades-tattoo)).

The appetite **exists and is growing.** What doesn't exist is a **purpose-built home** for it:
- FetLife = community/social network, not a dating deck; painful, dated, and a bad matching product.
- Feeld = the "mainstream" kink-friendly app — now so broad it's diluted (its own users say it's
  "less hardcore kink than before"), and a generalist brand can't say *BNWO out loud* the way Strut does.
- No mainstream app (ever) lets a profile write "QOS, BBC, cuckold, breeding, chastity" literally.

**That is the wedge.** Everyone else is either *too broad* (can't say the words) or *wrong
format* (community site, not a matching product). Strut is the first product in this exact
space: a **Tinder-format matching deck purpose-built for the BNWO / QOS / sissy / whiteboi /
hotwife / cuck / trans / group ecosystem**, where the identity language is the product and the
profile copy can be explicit by design.

---

## 2. The people, and why they convert & stay

Strut's identities map cleanly to the real subcommunities. Each one is a *persona* with
different acquisition channels and different monetization. The app already encodes the
right social logic in [`src/lib/bnwo.ts`](src/lib/bnwo.ts), which is a real strategic asset:
- **Kings / Bulls / tops** — the scarciest, highest-value cohort. They're the reason anyone
  else joins. Everything that boosts king retention boosts everyone else.
- **Sissies / whitebois / crossdressers / femboys** — high intent, high churn-if-ignored, and
  the most likely to pay for attention (their whole experience is *being seen by a king*).
- **Hotwives / QOS white wives** — high value, the cultural center of the Queen of Spades wave.
- **Cucks / couples / groups** — highest LTV; they bring a partner and a budget.
- **T-girls / trans women** — an underserved cohort specifically *in this* energy; a real
  differentiator versus apps that either exclude them or tokenize them.

**The key behavioural insight:** in mainstream dating, the product *connects* people and the
utility is the match. In this niche, the product *validates an identity*. Users aren't just
finding a hookup — they're finding the first place that names their kink, their role, their
"thing" without a ban, without a filter, without a wink. That is why retention in tight-knit
adult niches beats mainstream (see §1 ARPPU/retention numbers). **Every product decision should
protect the experience of "this place says the thing out loud."**

Strut already nails the mechanics that matter:
- **Role is enforced by identity** (a whiteboi *cannot* pick Top — the app decrees Bottom).
  This is both a product gimmick and a genuine trust signal: it means the deck is curated by
  shared rules, not just tags. This is Strut's single most distinctive feature. Keep and deepen it.
- Badges (KING / QOS / CUCK / SISSY / WHITEBOI / BNWO) give instant visual hierarchy, each with
  its own hand-drawn mark.
- Onboarding is short and explicit ("Say the quiet part"). Good — **do not** genericize this.

---

## 3. Acquisition & go-to-market

You cannot buy this audience with paid ads on Meta/Google (they don't allow the explicit
messaging, and adult-adjacent buying is restricted). You *can* win it organically, because the
audience is already concentrated and loudly self-organizing. Channel priority:

1. **Creator & influencer collabs** — the highest-leverage channel. In the kink/BNWO space,
   the "influencers" are creators on X, Reddit, and adult platforms. A handful of creator
   partnerships (give them a referral code + a cut of their signatures' revenue) is worth more
   than any ad budget. Their word reaches the exact micro-segment in one hop.
2. **Community seeding** — the audience lives in: subreddits (r/QOS, r/whiteboi, r/cuckold,
   r/sissy, r/Blacked/complex), X accounts and hashtags, Discord/Telegram servers, FetLife
   groups. The strategy is *native, not spammy*: earn permission, answer honestly, and make
   Strut the natural "and then we have a place for this" answer.
3. **The ♠️ / watchword as brand** — lean into the symbols the community already signals
   with. The spade, "QOS," "BBC," "Queen." A brand that *understands the code* gets adopted;
   a brand that has to explain it gets ignored.
4. **Referral asymmetry** — the 1:many crypto-kink dynamic (one king ↔ many bottoms/wives)
   means a single high-status king brings dozens of users. Build a referral/reward loop
   specifically rewarding *tops and couples* who bring their circle. (A "bring your king,"
   "bring your wife" invite flow.)
5. **Privacy as a marketing line** — "the mainstream app can't say it; we're the one that
   won't." Explicitly position Strut as the safe, un-shadow-banned home. See §6.

---

## 4. Product gaps — what to build next (in order)

1. **Real-time presence + messaging (WebSocket)** — the current SSE stream covers live thread
   updates; presence, read receipts and unread counts at scale want Redis pub/sub → WebSocket
   fan-out. Milestone: Redis-backed bus on multi-instance deploys.
2. **Swipe left/right, not just "like"** — the deck already supports like/pass with a native
   drag; keep deepening the affordance and deck animation.
3. **Infinite scroll / pagination on Discover** — shipped via keyset cursor (§7); keep the
   load-more UX sharp.
4. **Video on profiles** — the niche is highly visual and the existing pipeline only handles
   JPEG/PNG/WebP. Add direct-to-Blob uploads from the browser (signed client tokens) to avoid
   proxying video through the serverless function.
5. **OnlyFans / external link integration** — creators are monetized elsewhere; letting them
   surface a link (age-gated; see §6) turns Strut into the *discovery/funnel* app and is a
   retention and monetization magnet for the creator cohort.
6. **"The Room"/community surface** — feed posts exist; add a proper community/party layer
   (events, "who's in this city," kink-focused rooms) to become a *home*, not just a deck.
7. **Match-quality + AI** — a compatibility/consent signal ("no DMs unless you say what you
   want," role compatibility), and an AI that surfaces the right people by behavior, not just
   tags. (Bots already write in-persona; extend that to a recommendation layer.)

---

## 5. Monetization

Because mainstream adult platforms have already trained this audience to pay, Strut can
monetize earlier and harder than a vanilla dating app.

| Tier | Price point | What it does |
| --- | --- | --- |
| **Free** | $0 | Swipe, like, match, chat. Always the core — never gate the deck itself. |
| **Strut Gold** | ~$12–15/mo (or ~$8/mo annual) | See who liked you, unlimited likes, 1 boost/mo. |
| **Strut Black** | ~$25–30/mo | Boost priority, "kings get seen," verified badge, read receipts, video. |
| **Coins / Boosts** | à la carte | Pay-per-boost, spotlight in a metro, super-like at a king. |
| **Creator cut** | revenue share | On OnlyFans/creator links the user taps through Strut. |

Bootstrap reasoning: at ~50k actives, Grindr's benchmark (~$24.25/payer/month at an 8.4%
payer conversion, ~44.5% EBITDA margin) yields roughly **$102k/month (~$1.2M ARR)** from a
paid tier — capital-efficient enough to not need outside money at all. The **kings tiers**
(who likifies first) and the **"be seen" tiers** (whitebois/sissies who pay to be visible to
kings) are where the coin flips. **Do not** paywall the explicit identity language or the role
enforcement — those are the reason people are here, and gating them kills the trust that makes
the app work. Run payments through an adult-compliant processor (Mastercard AN 5196 applies to
explicit-content transactions).

---

## 6. Trust, safety, compliance & legal reality (this is the existential axis)

This app ships explicit, sometimes extreme, sexual content. In **August 2026** that is a legal
minefield and a real operating constraint — and it is also *why a web-first product is a
strength, not a weakness.* Be deliberate.

- **Age verification is here.** **27 U.S. states** now enforce age-verification for adult
  content (up from 8 in 2023), with **Missouri joining August 28, 2026** and none currently
  enjoined. On **July 6, 2026 the U.S. Supreme Court declined to block Texas's App Store
  Accountability Act**, and Texas applies age-assurance at the *app-store* level (Apple
  already exposes Declared Age Range data for Texas accounts). The framework is designed to
  expand nationally. ([ViceSnob — 2026](https://www.vicesnob.com/age-verification-laws-onlyfans-2026/),
  [R Street](https://www.rstreet.org/commentary/no-conscripting-the-app-stores-doesnt-solve-the-problems-with-age-verification/),
  [RecordingLaw](https://www.recordinglaw.com/us-laws/age-verification-laws/),
  [EFF — SCREEN Act](https://www.eff.org/deeplinks/2026/07/screen-act-threatens-privacy-far-beyond-adult-websites)).
- **The trade-off that favors you:** Strut is a **PWA / web app, not a native App-Store
  distribution.** That keeps you outside the app-store age-verification mandate and lets you
  keep content that Apple/Google would ban outright. **This is a deliberate, valuable choice —
  do not rush a native app** until you've confronted the app-store content policy and the
  age-verification that comes with it.
- **Age assurance is the open item.** The app enforces an immutable, server-validated birth
  date — the correct first layer — but self-declaration satisfies none of the state regimes.
  Third-party age assurance (ID / transactional / digital-ID check) is wired into the schema
  (`age_assurance_*` columns) and belongs on the compliance roadmap; until then, geo-gate the
  27 AV states (the industry norm).
- **Payment processing is tightening.** Mastercard's **AN 5196** now requires performer
  identity verification and age documentation for adult transactions. Any in-app paid tier or
  creator-revenue flow must be built through a processor that supports this (and a legal/compliance
  path). Don't "figure it out later" on payments for explicit content.
- **The SCREEN Act** (pending) would require age-verification on almost *any* service hosting
  even one piece of explicit content — Pornhub-size and Discord/Reddit-size alike, and EFF
  flags it as a privacy/data-retention disaster. Watch it; it would directly threaten a
  small explicit app more than it threatens OnlyFans (which can absorb compliance cost).
- **AI members must be disclosed.** Synthetic/seed profiles are indistinguishable from real
  ones today. FTC precedent (JDI Dating) makes undisclosed synthetic profiles a deception
  problem; add an `is_ai` disclosure/badge before any scale push (the schema already carries
  the flag).
- **Positioning & honesty:** Do not pretend to be a general dating app. Be an **18+** product
  with a real age gate (birth-date + best-effort assurance), **clear terms, real moderation &
  reporting**, and **no minors ever**. The reputational and legal cost of failing here is total.
- **Privacy by design is a feature.** This community values secrecy. Make **account no.
  searchable without a match, blur-by-default, "sneaky" private mode, no public "who liked you"
  leaking,** and **one-tap account deletion / export (GDPR/CCPA)**. Low risk, huge trust payoff.

---

## 7. Scaling the data layer to "Tinder size"

The architecture is already sound and standard: **self-hosted Better Auth** (single canonical
session; no parallel token tables) → **Postgres** (Neon in prod, embedded PGlite locally) →
**Vercel Blob + CDN for media**. That is the correct spine. Here is the deliberate scaling
path, and what's already staged:

### Already in place
- **Discover filters in the database** (identity tab, role, ethnicity, looking-for, search)
  instead of loading a slab and filtering in JS. Candidates are bounded by the WHERE plus a
  **(lat,lng) bounding-box index**, so the query stays O(page).
- **Scale indexes** (`migrations/0011`): (lat,lng); (last_active DESC, id DESC); GIN on
  `identities` & `looking_for_list`; conversations by either side; posts by author/recency; a
  partial unread index; likes by direction.
- **`ethnicity` is a real, filterable field** — central to this demographic.
- **`last_active` bumps on real engagement** (likes), so the "recently active" deck ordering
  reflects behavior.
- **Discover paginates with a keyset cursor** on `(last_active DESC, id DESC)`: the deck is
  O(page), loads more with infinite scroll, and is not hard-capped at a page.

### The roadmap (when you cross scale thresholds)
1. **PostGIS (optional endgame)** — add the `postgis` extension and a `geography` column with a
   GiST index; then the radius filter *and* the "nearest N" ordering happen in one indexed
   query. Drive **infinite scroll with a keyset cursor** (order by last_active/id or distance;
   never `OFFSET`). *Sketch:*
   ```sql
   create extension if not exists postgis;
   alter table profiles add column if not exists geom geography(point,4326);
   update profiles set geom = ST_SetSRID(ST_MakePoint(lng, lat),4326)::geography where lat is not null and geom is null;
   create index if not exists profiles_geom_idx on profiles using gist (geom);
   ```
2. **Session hot-path cache** — put a **Redis/KeyDB** in front of Better Auth session reads
   (Better Auth supports a Redis adapter). Sessions stay in Postgres; Redis absorbs read QPS.
3. **Media: direct-to-Blob client uploads** — for video especially, issue a signed/permission
   token so the browser uploads straight to Blob instead of proxying through the serverless
   function (the function now is the bandwidth chokepoint).
4. **Messaging fan-out** — move chat off the plain `conversations`/`messages` polling hot path
   to a Redis pub/sub → WebSocket/push fan-out; keep Postgres as the durable store.
5. **Geo/nearby at national scale** — the hardcoded CITIES tree in `src/lib/geo.ts` is a SoCal
   artifact; replace it with a real geocoding service (Mapbox/Google) + PostGIS, so any city
   works. (This is the **highest-impact product fix** for "actually scale to the whole country.")
6. **Sharding** only when you must: a writer per node or "swipes/messages" on a sharded,
   managed store; identity + profiles stay on Postgres. Don't shard before you need to.

### The "best way to create/store/serve profiles" verdict
For the near term, the **current model is correct and I would not change it**:
- **Store:** one Postgres row per user in `profiles`, JSONB for the list-y fields (`identities`,
  `looking_for_list`, `interests`, `photos`), and columns for the hot filter dimensions
  (role, ethnicity, lat/lng, last_active). Never store media bytes in Postgres.
- **Serve:** CDN (Blob) for media; a **server function per operation**, not a Generic Data API; a
  **single `getSessionUserFromRequest`** path (no client-supplied identity, ever). This is the
  right shape.
- **The one slice left:** **PostGIS** for a true "nearest-N" index when a metro gets dense;
  it's optional and can wait. In the meantime, keep coordinates server-side — the client only
  ever needs a computed distance, never raw lat/lng.

---

## 8. Risks to watch

- **Content & legal exposure** — the #1 risk. A single incident (a minor, revenge, or a
  legally-definable violation) can kill the app. Invest in moderation (human + AI), reporting,
  and a clear 18+ gate up front. It is not optional.
- **Payment processor reliability for explicit content** — build the adult-compliant processor
  integration early; don't wait until you're monetizing.
- **Platform dependence** — because you're a web/PWA you control distribution, but you also
  can't lean on App-Store discovery. Own your organic channels (§3).
- **Commoditization** — a clone *can* raise money and copy the wedge, but they'd have to say the
  words and take the risk too; the brand and the role-enforcement rules are your defensible
  moat. Reinforce them.

---

## 9. Product surface (current)

**Matching & discovery**
- Tinder-style swipe deck (native drag, fast-flick decisions, Undo) with a grid toggle; the
  deck is the default view and fills the page.
- Discover tabs (Nearby / Kings / Men / Sissies / Whitebois / Trans / CDs / Femboys / Wives /
  Cucks / Groups) with identity, role, ethnicity, looking-for, search, and radius filters;
  infinite scroll via keyset cursor.
- Likes, mutual matches, follows; per-handle profile pages (`noindex`).
- **Match celebration:** full-screen takeover on every new match — **realistic BBC, chastity
  cage and gold-spade confetti** rain + burst (hand-drawn SVG figure pieces in three skin tones
  and steel/gold cage metals, mixed with crowns, hearts, lips and coins), the two photos drawn
  together, the match decree, and jump-to-DM.

**Identity & roles**
- Identity is multi-select (sissy, whiteboi, hotwife, bull, cuck, trans, couple, group…);
  **role is enforced by identity** (`src/lib/bnwo.ts`) — a whiteboi cannot pick Top.
- Hand-drawn badge marks per role (KING / QOS / CUCK / SISSY / WHITEBOI / BNWO) and
  in-character decrees.

**Orders of the Set** (`/glory`)
- Role-specific achievement tracks (bull / kneeler / wife / cuck / chastity) computed live
  from real activity; order points and ranks; a chastity lock timer with pledge durations
  (`lock_sessions`, migration 0021).

**Chat**
- 1:1 conversations with real-time SSE streaming; seeded personas reply in character via fast
  hosted providers (custom gateway / Grok / Groq / OpenRouter / Gemini) with an uncensored
  async AI Horde fallback; typing indicators; bot job pump with dedupe.

**Community**
- The Room: feed posts, post likes, follows, tags.

**Safety & trust**
- 18+ age gate (immutable birth date, derived age), discreet mode (real blur placeholders —
  the full photo is not in the DOM until tap), symmetrical blocks, reports (incl. Under-18 and
  NCII priority), account-events audit trail, one-tap account deletion + data export.

**Accounts & auth**
- Email/password, Google/X OAuth, passwordless phone OTP (Twilio in prod, on-screen code in
  dev; production fails closed without SMS).

**Admin console** (`/admin`)
- Seed-profile generator (persona → uncensored Horde text + image → human edit → approval →
  profile row, with full `is_ai` provenance), profile listing/search, suspend/delete/purge.
  Nothing generated reaches a member's deck without an explicit click.

**App platform**
- First-party PWA (manifest + icons), Add-to-Home-Screen flow, Vercel Blob photo uploads with
  magic-byte sniffing, Postgres/PGlite with automated migrations, security headers, gold
  black/ivory/gold brand kit with shimmer wordmark and gold gradient actions.

**Next build list:** video on profiles; creator links + monetization; PostGIS + real
geocoding; Redis-backed rate limits and realtime fan-out on multi-instance deploys; moderation
reviewer UI; AI-member disclosure badge; age assurance for regulated states.

---

## 10. References

- Statista — Online Dating worldwide outlook (revenue, users, ARPU; US largest market).
- GetStream — *Dating App Statistics (2026)*: market growth, platform revenue, niche scale, mobile share.
- getcupid — *Dating App Statistics 2026*: 380M+ users, $6.2B market, Tinder MAU/decline, Match Group & Tinder revenue; Tinder Gold pricing.
- CatfishFinder — *Dating App Statistics 2026*: ARPPU table; Tinder payer decline; Grindr 15M MAU, $439.9M revenue, 44.5% EBITDA margin, 8.4% payer conversion.
- SwipeStats / Global Dating Insights — Feeld: 2M+ members, +368% growth 2021→2025, ~$65M revenue, Majestic pricing.
- White Label Dating — *BDSM and Kink Dating Platform Playbook*: higher retention and ARPPU in adult/kink niches than mainstream dating.
- Virtue News — *Queen of Spades: how a playing-card symbol became viral*: QOS meaning; 2022 virality; TikTok #queenofspades/#QOS tens of millions of views; spade-emoji shorthand on X/Instagram.
- knowyourmeme — *Queen of Spades Tattoo*: signal meaning in cuckold/sissy communities; Soyjak.party 2022 spread.
- Mashable / Dazed — *Pornhub 2025 Year in Review*: hotwife +101%, cuckold +73%, cheating +94%, swingers +68%; Clips4Sale fetish-of-the-year data.
- ViceSnob — *Age verification laws reshaping OnlyFans & adult platforms (2026)*: SCOTUS decline to block Texas App Store Accountability Act (Jul 6, 2026); 27 states (up from 8 in 2023); app-store-level scope; Mastercard AN 5196.
- RecordingLaw — *Age verification laws by state (2026)*: 27-state table, Missouri effective Aug 28, 2026.
- EFF — *The SCREEN Act Threatens Privacy Far Beyond Adult Websites*: applies to any service hosting even one piece of explicit content; identity-linked age verification; data-retention concerns.
- R Street — *No, conscripting the app stores doesn't solve age verification*: app-store-level mandates; adult-only apps not even allowed in the stores — reinforces the web-first advantage.
