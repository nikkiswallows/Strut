# Admin control panel & seed-profile generator

`/admin` is a signed-in operator console. It does three things:

1. **Generates profiles** from a plain-language persona — bio and every profile
   field written by an uncensored AI Horde text model, one photo rendered by an
   AI Horde image model, then held for human edit and approval.
2. **Lists every profile** in the database with search and filters.
3. **Suspends / resumes / deletes** any profile.

Nothing it generates reaches a member's deck without an explicit click.

---

## Signing in

| | |
|---|---|
| URL | `/admin` |
| Email | `admin@admin.com` |
| Password | `StrutAdmin420$` |

The account is **bootstrapped automatically on first boot** — there is no
sign-up step. `ensureAdminAccount()` (`src/lib/server/admin-account.server.ts`)
writes Better Auth's own `user` + `account` rows using Better Auth's own
password hasher, so the credential verifies through the ordinary sign-in path.
It also creates the admin's profile row as `onboarded = true, suspended = true`
— signed in and fully functional, invisible to every member-facing query.

Change the login by setting `ADMIN_EMAILS` / `ADMIN_PASSWORD` and restarting.
The bootstrap re-syncs the password on every boot, so the console can never lock
you out.

> ### ⚠️ These credentials are committed literals
>
> `src/lib/server/secrets.server.ts` holds the fallback admin password **and**
> the AI Horde API key as source literals, because the current operator cannot
> set environment variables on their hosting side. If this repository is public,
> those values are public.
>
> Fix, in order of preference:
> 1. Set `ADMIN_EMAILS`, `ADMIN_PASSWORD`, `AIHORDE_API_KEY` as real env vars and
>    delete the literals (env always wins — step 1 is safe at any time).
> 2. Make the repository private.
> 3. Rotate both when testing is done.
>
> The console shows a red banner for as long as it is running on the fallbacks.

## Turning the console off

Set `ADMIN_DISABLED=1`. `/api/admin` then returns **404** — not 403 — so the
surface does not advertise its own existence. Do this in production.

---

## Generating a profile

Type a persona and press **Generate profile**. Examples:

```
Black bull, 29, Atlanta, gym rat, dominant and direct, wants sissies who obey
white sissy bottom, 32, Orange County, married and discreet, locked in chastity
Latina hotwife, 36, Miami, husband watches, only sees bulls
white cuck, 44, Dallas, cleans up after, worships his wife's bull
```

### What happens

| Step | Where | Typical time |
|---|---|---|
| Text job queued | `POST /api/admin {op:"seed"}` | instant |
| Bio + fields written | Horde text model (Skyfall-31B et al.) | 30 s – 3 min |
| Image job queued automatically | Horde image model | instant |
| Photo rendered | 512×768, 22 steps, ~7 kudos | 1 – 5 min |
| Photo downloaded and re-hosted | this app | instant |
| **Ready for review** | the console | — |

The console polls each pending job every 7 seconds. Polling is what *advances*
the job server-side, so leave the tab open.

### The persona → fields logic

The model proposes; deterministic rules in `coerceDraft()` decide. This is what
makes the tool reliable rather than a dice roll:

| Persona contains | Identity | Role | Ethnicity |
|---|---|---|---|
| bull / BBC / black king | `Bull` | **Top** | Black |
| sissy | `Sissy` | **Bottom** | White |
| whiteboi / beta | `Whiteboi` | **Bottom** | White |
| femboy | `Femboy` | **Bottom** | — |
| crossdresser / CD | `Crossdresser` | **Bottom** | — |
| t-girl / trans | `T-Girl` / `Trans woman` | **Bottom** | — |
| hotwife | `Hotwife` | Switch | — |
| cuck | `Cuck` | **Bottom** | White |
| couple / group | `Couple` / `Group` | Switch | — |

Explicit role words in the persona (`top`, `dom`, `bottom`, `sub`, `switch`,
`vers`, `side`) override identity inference — the operator's words beat the
rules, and the rules beat the model.

**Only the self-describing half of the persona sets identity.** "white sissy
bottom, 27, San Diego, obedient, **wants a Black bull to own her**" produced a
profile with identity `Bull` and role `Bottom` — incoherent, and filed into the
Kings tab, the one cohort the product cannot afford to pollute. `selfSegment()`
cuts the persona at the first desire verb (`wants`, `looking for`, `seeking`,
`collects`, `owns`, `into`, `only sees`, …), hints are ranked by **position**
rather than by table order, and a final coherence pass drops identities that
contradict the settled role. The primary (first) identity decides the role. Pronouns, "looking for" and interests are
back-filled from the same table when the model leaves them empty or invents
values outside the app's vocabularies (`src/lib/types.ts`).

### Editing before approval

Every field is editable in the review card: display name, handle, age, location,
height, ethnicity, role, identities, pronouns, looking-for, interests, and the
full bio. Edits are stored in `seed_jobs.draft_edited`, **separately** from the
model's own `draft`, so provenance stays honest about what a human changed.
`ai_seed.humanEdited` records that on the finished profile.

- **Approve & publish** — creates the real profile (saves pending edits first).
- **Re-roll photo** — re-queues just the image, keeping the text.
- **Delete draft** — discards it. Nothing was ever created.

---

## Managing profiles

The **Profiles** tab lists everything in the database — generated, seeded and
real — with search and `All / Generated / Suspended` filters. Click a row to
expand it.

| Action | Effect |
|---|---|
| **Suspend / pause** | Reversible. `profiles.suspended = true`, enforced **in SQL** on discover, search, profile-by-handle and the public landing strip. The member vanishes from the app; the data is untouched. |
| **Resume** | Undoes it. |
| **Delete** | Irreversible, two-click confirm. Removes the profile, auth rows, sessions, messages, conversations, likes, follows, swipes, blocks, reports and posts. |
| **Purge N generated** | Type `PURGE`, then one click. Deletes every `is_ai` profile at once. **This is the pre-production exit ramp.** |

You cannot suspend or delete the account you are signed in with.

---

## What every generated profile carries

```jsonc
// profiles.is_ai = true
// profiles.ai_seed
{
  "generator":   "ai-horde",
  "textModel":   "aphrodite/TheDrummer/Skyfall-31B-v4.2",
  "imageModel":  "ICBINP - I Can't Believe It's Not Photography",
  "persona":     "Black bull, 29, Atlanta, gym rat, dominant and direct",
  "imagePrompt": "amateur smartphone selfie photograph of a 29 year old …",
  "seedJobId":   1,
  "humanEdited": true,
  "approvedBy":  "admin-98bed0d1-…",
  "approvedAt":  "2026-08-28T03:52:11.402Z"
}
```

One statement finds them all (`where is_ai`), which is what makes the purge
button honest.

---

## Engineering notes (measured, not assumed)

**Text jobs are hard-capped at `max_length: 512`.** Above that the Horde refuses
unless the account already holds the full kudos cost:

```
horde submit 403: Due to heavy demand, for requests over 512 tokens, the client
needs to already have the required kudos. This request requires 1180.95 kudos.
```

At 512 the cost is deferred and a low-balance account is served normally. 512
tokens is enough for the structural fields plus a 6–9 sentence bio, which is why
`bio` is the **last** key in the requested JSON object — a truncated generation
loses the tail of the bio, not a structural field. `repairJson()` then closes the
unterminated string and object so the generation is still usable.

**The Horde's image URL expires in 30 minutes.** Renders come back as presigned
Cloudflare R2 links with `X-Amz-Expires=1800`. Writing one onto a profile would
produce a card that works for half an hour and then 403s forever, and the host
fails the photo allowlist anyway. So `persistHordeImage()` downloads the bytes
the moment the job completes and re-hosts them through `storePhotoObject()` —
Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set, a data URI otherwise.

**Anime checkpoints return black frames.** The model list used to lead with
`WAI-NSFW-illustrious-SDXL` (7 workers, so it won every routing decision); it
returned a solid black 1.1 KB frame with `censored: false`. The list now leads
with photoreal checkpoints (ICBINP, Realistic Vision, CyberRealistic Pony,
Juggernaut XL) and `IMG_BAD` excludes the anime families outright. A byte-size
floor of 6 KB catches any blank frame that still gets through and surfaces it as
"the worker returned a blank frame — re-roll the photo".

**A 429 must never kill a job.** The Horde rate-limits per IP, and the client
used to treat any non-OK status while polling as a permanent failure — so one
`429` marked a job `failed` even though it was still queued and about to
succeed. Now 408/425/429/5xx keep the job pending, a `429` starts a
process-wide cool-off (honouring `Retry-After`, 15 s floor, 120 s cap) during
which no Horde request is even attempted, and a per-job 5-second floor in
`pollSeedJob()` means extra polls are served from the database.

The 429 came from the console itself. The polling effect depended on the `jobs`
array, which is a fresh reference after every refetch: each refresh tore the
effect down, re-ran it, immediately fired another poll, refreshed again — a
tight loop. It now keys on a joined string of pending job ids and guards against
overlapping passes. Verified by firing **41 rapid polls in a row**: all 200, one
network call, job unharmed.

**Reasoning models eat the whole output budget.** Several of the strongest
uncensored text models on the Horde think out loud. With a 512-token ceiling
that monologue *is* the entire reply — measured: Skyfall-31B spent all 512
tokens deliberating about a persona and never emitted a character of JSON. Two
defences: the assistant turn is **prefilled with `{`** so the model continues
inside the object rather than starting to deliberate, and `stripThinking()`
removes any `<think>` block that still appears, including unterminated ones.

**Temperature matters for structured output.** At the chat default of 1.05 the
generator emitted valid JSON containing word salad — "gym sulfita sista",
"SLOW jeans". Seed generation runs at **0.85**.

**Truncation is recoverable.** `jsonCandidates()` emits several repairs
best-first: the complete object, the object with open braces closed, then the
object trimmed back to each of the last six top-level commas. That last one
matters — closing `…, "interes` naively yields `…, "interes"}`, still invalid,
while trimming to the previous comma recovers every field before it. If nothing
parses, the model's prose becomes the bio and every field is inferred from the
persona, with a warning on the card. A generation that cost real queue time is
never thrown away.

**Rate limits.** 30 generations/hour and 600 admin mutations/hour, per admin.

**Tests.** `src/lib/seed-persona.test.ts` covers the persona rules and the
tolerant parser — 13 cases, every one of them a failure actually observed
against live Horde output. Run with `npm test` (needs Node ≥ 22.12 for
`--experimental-strip-types`).

---

## Compliance (read before this cohort touches production)

These profiles are **synthetic humans on a dating app**. That is a regulated
thing to publish, not a neutral one.

- **FTC v. JDI Dating** (2014) — "virtual Cupids" fake profiles, **$616,165**.
  Their small "v-in-a-circle" badge was ruled insufficient: users were "not
  likely to see" or understand it.
- **FTC / Match Group** — March 30 2026 settlement, 20-year order.
- FTC civil penalty is **$53,088 per violation** (2026), each item counting
  separately.
- **NY A8887-B** (synthetic performers) — effective June 9 2026, $5,000 first /
  $10,000 subsequent.
- **California** — visible labels plus C2PA metadata, effective Aug 2 2026.
- **TAKE IT DOWN Act** (PL 119-12) — 48-hour removal obligation.

`is_ai` exists so that disclosure is *possible*. It is not disclosure by itself:
there is **no AI badge in the member-facing UI yet**. Until there is, treat this
cohort as internal test data and purge it before launch — which is exactly the
plan the user stated, and the purge button exists to make it one click.
