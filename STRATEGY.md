# Strut — Market, Product & Scale Strategy

*Prepared from the perspective of the market as it stands in August 2026. Written as a
working document: everything is actionable, with the code changes that shipped in this
pass listed in §9 and the next milestones in §7.*

---

## 1. The market you're playing in (2026)

The broad market is enormous but saturated; the head of the market is actually flat to
declining. That is exactly why this app wins. The growth is in **niches**.

| Signal | 2026 figure | What it means for Strut |
| --- | --- | --- |
| Global online-dating revenue | ~**$3.2–6.2B** (Statista) | Big enough to matter, but not where you'll win |
| US revenue | ~**$1.45B** | Largest single market — and you launch there |
| Tinder MAU | ~**75M**, **declining ~9% YoY** | The generalist deck is losing ground |
| Grindr (a *niche* app) | **+25% revenue, 14.5M MAU** in Q1 2025 | Proof that a focused community scales |
| Mobile share of usage | ~**52.7%** | The deck is a phone-first habit; PWA covers this |
| Kink/adult niche ARPU | **$6–15 monthly LTV**; ~50k actives → **$300–750k/mo** | Higher ARPU & retention than mainstream dating |

Sources: [Statista — Online Dating](https://www.statista.com/outlook/emo/dating-services/online-dating/worldwide/),
[GetStream dating stats 2026](https://getstream.io/blog/dating-app-statistics/),
[getcupid 2026 stats](https://getcupid.ai/blog/editorial/dating-app-statistics),
[White Label Dating — kink playbook](https://whitelabeldating.com/playbooks/kink-dating-platform).

**The read:** the "meet everyone" apps are fighting for shrinking attention and are
monetizing the *broadest* slice. Strut monetizes the *deepest* slice. A 14.5M-MAU,
25%-growing niche app (Grindr) is the closest analogue to what Strut can become at a
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
adult niches beats mainstream (see §1 ARPU/retention numbers). **Every product decision should
protect the experience of "this place says the thing out loud."**

Strut already nails the mechanics that matter:
- **Role is enforced by identity** (a whiteboi *cannot* pick Top — the app decrees Bottom).
  This is both a product gimmick and a genuine trust signal: it means the deck is curated by
  shared rules, not just tags. This is Strut's single most distinctive feature. Keep and deepen it.
- Badges (KING / QOS / CUCK / SISSY / WHITEBOI / BNWO) give instant visual hierarchy.
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
   won't." Explicitly position Strut as the safe, un-shadowlan-banned home. See §6.

---

## 4. Product gaps — what to build next (in order)

1. **Real-time presence + messaging (WebSocket)** — now everything is request/poll. Match &
   chat should feel instant. This is the single biggest "feels like a real app" upgrade.
   Milestone: Redis pub/sub → WebSocket fan-out, or at minimum SSE for unread/match events.
2. **Swipe left/right, not just "like"** — a Tinder deck needs both directions. Add dislike
   pass and a proper deck animation. (The data model already supports it; the deck just needs
   the affordance.)
3. **Infinite scroll / pagination on Discover** — see §7. Currently capped at a page.
4. **Video on profiles** — the niche is highly visual and the existing pipeline only handles
   JPEGs. Add direct-to-Blob uploads from the browser (signed client tokens) to avoid proxying
   video through the serverless function.
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

Bootstrap reasoning: at ~50k actives and a $6–15 blended monthly LTV (adult-niche benchmark),
that's **$300k–750k/mo** — before a single paid feature. The **kings tiers** (who likifies
first) and the **"be seen"** tiers (whitebois/sissies who pay to be visible to kings) are where
the coin flips. **Do not** paywall the explicit identity language or the role enforcement —
those are the reason people are here, and gating them kills the trust that makes the app work.

---

## 6. Trust, safety, compliance & legal reality (this is the existential axis)

This app ships explicit, sometimes extreme, sexual content. In **August 2026** that is a legal
minefield and a real operating constraint — and it is also *why a web-first product is a
strength, not a weakness.* Be deliberate.

- **Age verification is here.** **25 U.S. states** now enforce age-verification for adult
  content (up from 8 in 2023). On **July 6, 2026 the U.S. Supreme Court declined to block
  Texas's App Store Accountability Act**, and Texas applies age-assurance at the *app-store*
  level (Apple already exposes Declared Age Range data for Texas accounts). The framework is
  designed to expand nationally. ([ViceSnob — 2026](https://www.vicesnob.com/age-verification-laws-onlyfans-2026/),
  [R Street](https://www.rstreet.org/commentary/no-conscripting-the-app-stores-doesnt-solve-the-problems-with-age-verification/),
  [EFF — SCREEN Act](https://www.eff.org/deeplinks/2026/07/screen-act-threatens-privacy-far-beyond-adult-websites)).
- **The trade-off that favors you:** Strut is a **PWA / web app, not a native App-Store
  distribution.** That keeps you outside the app-store age-verification mandate and lets you
  keep content that Apple/Google would ban outright. **This is a deliberate, valuable choice —
  do not rush a native app** until you've confronted the app-store content policy and the
  age-verification that comes with it.
- **Payment processing is tightening.** Mastercard's **AN 5196** now requires performer
  identity verification and age documentation for adult transactions. Any in-app paid tier or
  creator-revenue flow must be built through a processor that supports this (and a legal/compliance
  path). Don't "figure it out later" on payments for explicit content.
- **The SCREEN Act** (pending) would require age-verification on almost *any* service hosting
  even one piece of explicit content — Pornhub-size and Discord/Reddit-size alike, and EFF
  flags it as a privacy/data-retention disaster. Watch it; it would directly threaten a
  small explicit app more than it threatens OnlyFans (which can absorb compliance cost).
- **Positioning & honesty:** Do not pretend to be a general dating app. Be an **18+** product
  with a real age gate (birth-date + best-effort assurance), **clear terms, real moderation &
  reporting**, and **no minors ever**. The reputational and legal cost of failing here is total.
- **Privacy by design is a feature.** This community values secrecy. Make **account no. searchable
  without a match, blur-by-default, "sneaky" private mode, no public "who liked you" leaking,
  and one-tap account deletion / export (GDPR/CCPA)**. Low risk, huge trust payoff.

---

## 7. Scaling the data layer to "Tinder size"

The architecture is already sound and standard: **self-hosted Better Auth** (single canonical
session; no parallel token tables) → **Postgres** (Neon in prod, embedded PGlite locally) →
**Vercel Blob + CDN for media**. That is the correct spine. Here is the deliberate scaling
path, and what's already staged:

### Done in this pass (see §9)
- **Discover now filters in the database** (identity tab, role, ethnicity, looking-for, search)
  instead of loading a slab and filtering in JS. Candidates are bounded by the WHERE + a new
  **(lat,lng) bounding-box index**; the old code pulled up to 200 rows and filtered in JS, which
  does not survive a large table.
- **New scale indexes** (`migrations/0011`): (lat,lng); (last_active DESC, id DESC); GIN on
  `identities` & `looking_for_list`; conversations by either side; posts by author/recency; a
  partial unread index; likes by direction. All additive, validated on PGlite/Postgres.
- **`ethnicity` is now a real, filterable field** (it was a dead column) — central to this
  demographic.
- **`last_active` bumps on real engagement** (likes), so the "recently active" deck ordering
  reflects behavior.
- **Discover now paginates** with a keyset cursor on `(last_active DESC, id DESC)` (see §9):
  the deck is O(page), loads more with infinite scroll, and no longer hard-caps at a page.

### The roadmap (when you cross scale thresholds)
1. **PostGIS (optional endgame)** — keyset pagination is now shipped in plain SQL; add PostGIS (`postgis`
   extension) and a `geography` column with a GiST index; then the radius filter *and* the
   "nearest N" ordering happen in one indexed query. Drive **infinite scroll with a keyset
   cursor** (order by last_active/id or distance; never `OFFSET`). This removes the current
   client-side cap of ~80 and the 1000-candidate clamp. *Sketch:*
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
   managed store; identity + profiles stay on Postgres. Don't shard before you need to —

### The "best way to create/store/serve profiles" verdict
For the near term, the **current model is correct and I would not change it**:
- **Store:** one Postgres row per user in `profiles`, JSONB for the list-y fields (`identities`,
  `looking_for_list`, `interests`, `photos`), and columns for the hot filter dimensions
  (role, ethnicity, lat/lng, last_active). Never store media bytes in Postgres.
- **Serve:** CDN (Blob) for media; a **server function per operation**, not a Generic Data API; a
  **single `getSessionUserFromRequest`** path (no client-supplied identity, ever). This is the
  right shape.
- **The one thing I'd change at the very start:** profiles are a `TEXT`-keyed table with the
  auth user id — good. **Keyset pagination for the deck is now done** (§9), so the deck is
  O(page). The only remaining slice is **PostGIS** for a true "nearest-N" index when a metro
  gets dense; it's optional and can wait.

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

## 9. What shipped in this pass

All changes are validated (typecheck clean, lint 0 errors, build succeeds) and were smoke-tested
against the embedded Postgres (PGlite) to confirm the SQL runs.

| File | Change |
| --- | --- |
| `migrations/0011_scale_geo_indexes.sql` | Scale indexes: (lat,lng); (last_active DESC,id DESC); GIN on `identities`/`looking_for_list`; conversations both sides; posts author/recency; partial unread; likes direction. |
| `src/lib/server/profiles.ts` | Discover filters pushed into SQL (identity tab, role, ethnicity, looking-for, q) + geo bounding-box prefilter; `ethnicity` added to `ProfileInput`/`cleanProfile`/upsert; cursor-ready structure. |
| `src/lib/server/map.ts` | `ethnicity` added to `PROFILE_COLS`/`PROFILE_COLS_P`/`ProfileRow`/`mapProfile`. |
| `src/lib/types.ts` | `ETHNICITIES` + `Ethnicity` type; `ethnicity` on `Profile`. |
| `src/lib/geo.ts` | `bboxFor()` bounding-box helper (index-friendly radius prefilter). |
| `src/lib/server/social.ts` | Bump `last_active` on a new like (engagement-driven deck ordering). |
| `src/routes/api/app.ts` | Pass `ethnicity` to discover. |
| `src/routes/onboarding.tsx` | Optional ethnicity field (single-select) + state/draft/save wiring. |
| `src/routes/_app/discover.tsx` | Ethnicity filter chip in the filters sheet + pass to the query; switched to `useInfiniteQuery` with a load-more sentinel. |
| `src/components/chips.tsx` | Optional `hint` on `SingleChips`. |
| `src/lib/onboarding-draft.ts` | Persist `ethnicity` in the onboarding draft. |
| `src/lib/server/profiles.ts` (paginate) | `DiscoverPage { items, nextCursor }`; keyset cursor on `(last_active DESC, id DESC)`; `makeDiscoverCursor`/`parseDiscoverCursor` (ISO-normalized so it round-trips on Neon & PGlite); page-size clamp. |
| `src/routes/api/app.ts` | Pass `cursor`/`limit` to discover. |
| `src/routes/_app/inbox.$id.tsx` | Seed chat: composer no longer disabled while the seed is "writing" (server dedupes pending jobs, so you can keep typing); typing indicator cap shortened to ~2 min and clears reliably. |

**Suggested next build list:** §4.1 (real-time chat), §4.2 (swipe left/right), and the 18+
age gate + reporting in §6.

---

## 10. References

- Statista — Online Dating worldwide outlook (revenue, users, ARPU; US largest market).
- GetStream — *Dating App Statistics (2026)*: market growth, platform revenue, niche scale, mobile share.
- getcupid — *Dating App Statistics 2026*: 380M+ users, $6.2B market, Tinder MAU/decline, Match Group & Tinder revenue; Tinder Gold pricing.
- White Label Dating — *BDSM and Kink Dating Platform Playbook*: $6–15 monthly LTV; ~50k actives → $300k–750k/mo; higher retention.
- Virtue News — *Queen of Spades: how a playing-card symbol became viral*: QOS meaning; 2022 virality; TikTok #queenofspades/#QOS tens of millions of views; spade-emoji shorthand on X/Instagram.
- knowyourmeme — *Queen of Spades Tattoo*: signal meaning in cuckold/sissy communities; Soyjak.party 2022 spread.
- ViceSnob — *Age verification laws reshaping OnlyFans & adult platforms (2026)*: SCOTUS decline to block Texas App Store Accountability Act (Jul 6, 2026); 25 states (up from 8 in 2023); app-store-level scope; Mastercard AN 5196.
- EFF — *The SCREEN Act Threatens Privacy Far Beyond Adult Websites*: applies to any service hosting even one piece of explicit content; identity-linked age verification; data-retention concerns.
- R Street — *No, conscripting the app stores doesn't solve age verification*: app-store-level mandates; adult-only apps not even allowed in the stores — reinforces the web-first advantage.
