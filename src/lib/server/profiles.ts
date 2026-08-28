import { createServerFn } from "@tanstack/react-start";
import { bboxFor, coordForLocation, DEFAULT_COORD, milesBetween } from "@/lib/geo";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { judgeRole } from "@/lib/bnwo";
import { DISCOVER_TABS, identityLine, ROLES, type DiscoverTab, type Profile } from "@/lib/types";
import { slugifyHandle, unique } from "@/lib/utils";
import { PROFILE_COLS, PROFILE_COLS_PUBLIC, mapProfile, type ProfileRow } from "./map";
import { cleanPhotoBlurs, isAllowedPhotoUrl } from "@/lib/photo-url";
import { ageOn, checkBirthDate, MIN_AGE, normalizeBirthDate } from "@/lib/age";
import { assertNotBlocked } from "./safety";
import { SEED_PROFILES } from "@/lib/seed-data";
import { ensureSeed } from "./seed";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS} from profiles where user_id = $1`,
      [context.userId],
    );
    return rows[0] ? mapProfile(rows[0]) : null;
  });

export const getProfileForViewer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((handle: string) => handle.replace(/^@/, "").toLowerCase())
  .handler(async ({ context, data: handle }) => {
    await ensureSeed();
    const sql = await getSql();
    const rows = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS},
              exists(select 1 from likes l where l.from_user_id = $2 and l.to_user_id = profiles.user_id) as liked_by_me,
              exists(select 1 from likes l where l.from_user_id = profiles.user_id and l.to_user_id = $2) as likes_me,
              exists(select 1 from follows f where f.follower_id = $2 and f.following_id = profiles.user_id) as following,
              (select count(*)::int from likes l where l.to_user_id = profiles.user_id) as like_count
       from profiles
       where handle = $1 and not suspended`,
      [handle, context.userId],
    );
    const profile = rows[0] ? mapProfile(rows[0]) : null;
    if (!profile) return null;
    const meRows = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS} from profiles where user_id = $1`,
      [context.userId],
    );
    const origin = originOf(meRows[0] ? mapProfile(meRows[0]) : null);
    const there =
      profile.lat != null && profile.lng != null
        ? { lat: profile.lat, lng: profile.lng }
        : coordForLocation(profile.location);
    return {
      ...profile,
      distanceMiles: there ? milesBetween(origin, there) : null,
    };
  });

export type DiscoverInput = {
  tab?: DiscoverTab | string;
  miles?: number;
  lookingFor?: string;
  role?: string;
  ethnicity?: string;
  q?: string;
  /** Opaque keyset cursor from the previous page (see `makeDiscoverCursor`). */
  cursor?: string;
  /** Page size (clamped). Defaults to PAGE_SIZE. */
  limit?: number;
  /** For the swipe deck: drop profiles the viewer has already decided on. */
  excludeDecided?: boolean;
};

export type DiscoverPage = {
  items: DiscoverItem[];
  nextCursor: string | null;
};

export type DiscoverItem = Profile & { distanceMiles?: number | null };

export function normalizeDiscover(input: DiscoverInput | undefined) {
  return {
    tab: (input?.tab as DiscoverTab | undefined) ?? "nearby",
    miles: clampMiles(input?.miles),
    lookingFor: input?.lookingFor ?? "",
    role: input?.role ?? "",
    ethnicity: input?.ethnicity ?? "",
    q: input?.q ?? "",
    cursor: input?.cursor ?? "",
    limit: clampPageSize(input?.limit),
    excludeDecided: Boolean(input?.excludeDecided),
  };
}

// Default rows per page and bounds. Discover now paginates with a keyset cursor
// on the deck's canonical order (last_active DESC, id DESC) so it stays O(page)
// and never loads the whole table — this is what makes the deck Tinder-sized.
export const DISCOVER_PAGE_SIZE = 40;
const DISCOVER_PAGE_MIN = 10;
const DISCOVER_PAGE_MAX = 80;

function clampPageSize(value: number | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return DISCOVER_PAGE_SIZE;
  return Math.max(DISCOVER_PAGE_MIN, Math.min(DISCOVER_PAGE_MAX, Math.round(Number(value))));
}

/**
 * The cursor is the (last_active, id) of the last row in the page, in the deck
 * order. Encoding it in the row handles any timestamp formatting the driver
 * returns (Neon/PGLite may render timestamptz differently), so the client
 * treats it as opaque. `|` can't appear in the ISO timestamp or the numeric id.
 */
export function makeDiscoverCursor(row: { last_active: string | Date; id: number }): string {
  // The driver may hand back last_active as a JS Date (Neon and PGLite both do
  // for timestamptz unless type-cast), which String() would render as the
  // locale "Thu Aug ..." form — invalid when the cursor is re-cast to
  // timestamptz on the next page. Normalize to ISO here so the cursor round-trips.
  const la =
    row.last_active instanceof Date ? row.last_active.toISOString() : String(row.last_active);
  return `${la}|${row.id}`;
}

function parseDiscoverCursor(
  cursor: string,
): { lastActive: string; id: number } | null {
  const i = cursor.lastIndexOf("|");
  if (i <= 0 || i >= cursor.length - 1) return null;
  const lastActive = cursor.slice(0, i);
  const id = Number(cursor.slice(i + 1));
  if (!Number.isFinite(id)) return null;
  if (!lastActive) return null;
  return { lastActive, id };
}

export async function listDiscoverForUser(
  userId: string,
  input: DiscoverInput | undefined,
): Promise<DiscoverPage> {
  const data = normalizeDiscover(input);
  try {
    await ensureSeed();
  } catch (err) {
    console.error("[seed] discover continued without demo profiles:", err);
  }
  const sql = await getSql();
  const meRows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS} from profiles where user_id = $1`,
    [userId],
  );
  const origin = originOf(meRows[0] ? mapProfile(meRows[0]) : null);

  const lookingFor = data.lookingFor.trim() || null;
  const role =
    data.role && (ROLES as readonly string[]).includes(data.role as (typeof ROLES)[number])
      ? data.role
      : null;
  const ethnicity = data.ethnicity.trim() || null;
  const q = data.q.trim() ? `%${data.q.trim().toLowerCase()}%` : null;

  const params: unknown[] = [userId];
  // `suspended` is the operator's reversible off-switch (migration 0020). It is
  // applied here, in SQL, for the same reason blocks are: a filter that lives in
  // JS is a filter some future code path forgets.
  let where = `user_id <> $1 and onboarded = true and not suspended`;

  // Blocks are symmetrical and enforced in SQL so no code path can forget them:
  // if either party has blocked the other, the profile never enters the deck,
  // the grid, or search. Filtering this in JS after the fact would let a blocked
  // account still consume a slot in every page.
  where += ` and not exists (
    select 1 from blocks b
    where (b.blocker_id = $1 and b.blocked_id = profiles.user_id)
       or (b.blocked_id = $1 and b.blocker_id = profiles.user_id)
  )`;

  // Deterministic filters are pushed into SQL so the DB return set is bounded and
  // index-backed (see migrations/0011). This is what keeps discover O(page-ish)
  // instead of "load everything into the app and filter in JS".
  if (role) {
    params.push(role);
    where += ` and role = $${params.length}`;
  }

  if (ethnicity) {
    params.push(ethnicity);
    where += ` and lower(coalesce(ethnicity, '')) = lower($${params.length})`;
  }

  if (q) {
    params.push(q);
    where += ` and (lower(display_name) like $${params.length} or lower(handle) like $${params.length} or lower(coalesce(location,'')) like $${params.length})`;
  }

  const tab = DISCOVER_TABS.find((t) => t.id === data.tab) ?? DISCOVER_TABS[0]!;
  if (tab.match.length) {
    const preds: string[] = [];
    // Match against the canonical identities array (indexed via GIN) and the
    // legacy single `identity` column for pre-fill rows.
    for (const label of tab.match) {
      params.push(JSON.stringify([label]));
      preds.push(`identities @> $${params.length}::jsonb`);
      params.push(label);
      preds.push(`lower(coalesce(identity, '')) = lower($${params.length})`);
    }
    where += ` and (${preds.join(" or ")})`;
    if (tab.id === "women") {
      params.push(JSON.stringify(["T-Girl"]));
      params.push(JSON.stringify(["Trans woman"]));
      where += ` and not (identities @> $${params.length - 1}::jsonb or identities @> $${params.length}::jsonb)`;
    }
  }

  if (lookingFor) {
    params.push(JSON.stringify([lookingFor]));
    params.push(lookingFor);
    where += ` and (looking_for_list @> $${params.length - 1}::jsonb or lower(coalesce(looking_for, '')) = lower($${params.length}))`;
  }

  // Geo: an index-friendly bounding-box prefilter in SQL for profiles that have
  // coordinates (the common case). Profiles without coords are kept out of the
  // box clause and resolved from their `location` in JS below, so nothing that
  // worked before disappears.
  const originAt =
    origin?.lat != null && origin?.lng != null ? { lat: origin.lat, lng: origin.lng } : null;
  const box =
    originAt && data.miles < 500 ? bboxFor(originAt, data.miles) : null;
  if (box && originAt) {
    params.push(box.latMin, box.latMax, box.lngMin, box.lngMax);
    const boxStart = params.length - 3;
    // Exact haversine, evaluated IN SQL, so the radius filter happens before
    // LIMIT rather than after it. Previously the distance test ran in JS on an
    // already-truncated page: in a dense metro with a tight radius the member
    // could be handed an empty page while the API still advertised "more".
    params.push(originAt.lat, originAt.lng, data.miles);
    const latP = params.length - 2;
    const lngP = params.length - 1;
    const miP = params.length;
    where += ` and (lat is null or (
        lat between $${boxStart} and $${boxStart + 1}
    and lng between $${boxStart + 2} and $${boxStart + 3}
    and (
      3958.8 * acos(
        least(1, greatest(-1,
            cos(radians($${latP})) * cos(radians(lat)) * cos(radians(lng) - radians($${lngP}))
          + sin(radians($${latP})) * sin(radians(lat))
        ))
      )
    ) <= $${miP}
    ))`;
  }

  // Keyset cursor: restart the deck strictly after the previous page's last row
  // in (last_active DESC, id DESC) order. No OFFSET, no full-table load.
  const cursor = data.cursor ? parseDiscoverCursor(data.cursor) : null;
  if (cursor) {
    params.push(cursor.lastActive, cursor.id);
    where += ` and (last_active, id) < ($${params.length - 1}::timestamptz, $${params.length})`;
  }

  // Swipe deck: exclude profiles the viewer has already decided on (a like or a
  // pass). This keeps the deck moving forward and never re-surfaces a card.
  if (data.excludeDecided) {
    where += ` and not exists (
      select 1 from swipes s
      where s.user_id = $1 and s.target_id = profiles.user_id
    ) and not exists (
      select 1 from likes lk
      where lk.from_user_id = $1 and lk.to_user_id = profiles.user_id
    )`;
  }

  // Over-fetch by a bounded multiple, then trim to `limit`.
  //
  // A handful of rows can still be dropped after the query: profiles with no
  // coordinates are resolved from their `location` text in JS, and legacy rows
  // can carry an identity label the SQL predicates miss. Filtering those out
  // after a bare `limit` is what starved pages in dense metros — the API would
  // return 3 profiles and still report "more to load". Over-fetching keeps a
  // page full, and the cursor is taken from the last row actually RETURNED, so
  // it stays honest no matter how many rows the filter removed.
  const fetchLimit = Math.min(240, data.limit * 3);

  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS},
            exists(select 1 from likes l where l.from_user_id = $1 and l.to_user_id = profiles.user_id) as liked_by_me,
            exists(select 1 from likes l where l.from_user_id = profiles.user_id and l.to_user_id = $1) as likes_me
     from profiles
     where ${where}
     order by last_active desc, id desc
     limit ${fetchLimit}`,
    params,
  );

  const match = new Set(tab.match.map((s) => s.toLowerCase()));
  const wantLooking = lookingFor?.toLowerCase() ?? null;

  // Keep the raw row alongside each mapped profile: the keyset cursor needs the
  // driver's own `last_active` value (a Date on Neon/PGlite), and mapProfile
  // flattens it to a string — which is what makeDiscoverCursor exists to
  // normalise, but only if we hand it the raw value.
  const items = rows
    .map((row) => {
      const profile = mapProfile(row);
      const there =
        profile.lat != null && profile.lng != null
          ? { lat: profile.lat, lng: profile.lng }
          : coordForLocation(profile.location);
      return {
        ...profile,
        photos: profile.photos.slice(0, 6),
        distanceMiles: there && originAt ? milesBetween(originAt, there) : null,
        __row: row,
      };
    })
    .filter((profile) => {
      if (profile.userId === userId) return false;
      // Identity-tab fuzzy membership, kept as a safety net in case a profile
      // has a label that is only present in the joined "identity line" text.
      if (match.size) {
        const labels = [...(profile.identities ?? []), identityLine(profile)]
          .join(" ")
          .toLowerCase();
        const hit = [...match].some((token) => labels.includes(token));
        if (!hit) return false;
        if (tab.id === "women") {
          if (labels.includes("trans") || labels.includes("t-girl")) return false;
        }
      }
      if (wantLooking) {
        const hit = (profile.lookingFor ?? []).some(
          (item) => item.toLowerCase() === wantLooking,
        );
        if (!hit) return false;
      }
      if (profile.distanceMiles != null && profile.distanceMiles > data.miles) return false;
      return true;
    });
  // NOTE: there is deliberately no re-sort here any more.
  //
  // The previous code sorted each page by distance *after* the SQL had already
  // ordered it by (last_active DESC, id DESC) — while the keyset cursor was
  // taken from the last raw SQL row. Two orderings in one paginated feed meant
  // the cursor no longer described what the member had actually seen, so page
  // boundaries silently dropped and repeated profiles. It also ran the distance
  // filter after LIMIT, so a dense metro with a tight radius could return an
  // empty page while still advertising "more".
  //
  // Ordering is now exactly one thing — the SQL order — so the cursor is honest.
  // Exact nearest-first ordering arrives with PostGIS (see ARCHITECTURE.md);
  // until then distance is shown and filtered, not used to sort.

  // Trim to the requested page size. `items` is still in the SQL order
  // (last_active DESC, id DESC) because the re-sort by distance was removed,
  // so slicing here is stable and matches the keyset.
  const page = items.slice(0, data.limit);

  // nextCursor marks the last row actually returned, so the next page resumes
  // immediately after it — no overlap, no gap, regardless of how many rows the
  // post-query filter removed. `rows.length >= fetchLimit` means the database
  // still had candidates, so there is more to fetch even if this page is short.
  const boundary = page[page.length - 1]?.__row;
  const moreAvailable = rows.length >= fetchLimit || page.length >= data.limit;
  const nextCursor =
    moreAvailable && boundary
      ? makeDiscoverCursor({ last_active: boundary.last_active, id: Number(boundary.id) })
      : null;

  // `__row` is an internal cursor hint, never part of the API surface.
  return { items: page.map(({ __row: _row, ...rest }) => rest), nextCursor };
}

/**
 * Record a swipe decision and keep `likes` (and thus matches) consistent.
 *  - like → also mirror into `likes` (so the existing match logic and the grid's
 *           liked_by_me / likes_me / like_count all keep working), clear a pass.
 *  - pass → remove any prior like from this viewer to the target (a pass isn't a
 *           like), leaving `likes`/matches untouched otherwise.
 * `swipes` is the deck's "already decided on" log; `likes` stays the match truth.
 */
export async function swipeFor(
  userId: string,
  targetId: string,
  direction: "like" | "pass",
): Promise<{ ok: true; matched: boolean }> {
  if (targetId === userId) throw new Error("You cannot swipe on yourself.");
  if (direction !== "like" && direction !== "pass") throw new Error("Bad swipe direction.");
  await assertNotBlocked(userId, targetId);
  const sql = await getSql();

  // Upsert the decision (last one wins for this target).
  await sql.query(
    `insert into swipes (user_id, target_id, direction)
     values ($1, $2, $3)
     on conflict (user_id, target_id)
     do update set direction = excluded.direction, created_at = now()`,
    [userId, targetId, direction],
  );

  if (direction === "like") {
    // Decide first, then record the like for match purposes.
    const seed = SEED_PROFILES.find((p) => p.userId === targetId);
    await sql.query(
      `insert into likes (from_user_id, to_user_id) values ($1, $2) on conflict do nothing`,
      [userId, targetId],
    );
    if (seed?.autoMatch) {
      await sql.query(
        `insert into likes (from_user_id, to_user_id) values ($1, $2) on conflict do nothing`,
        [targetId, userId],
      );
    }
    const back = await sql.query<{ from_user_id: string }>(
      `select from_user_id from likes where from_user_id = $1 and to_user_id = $2`,
      [targetId, userId],
    );
    return { ok: true, matched: Boolean(back[0]) };
  }

  // pass → a like and a pass are mutually exclusive decisions.
  await sql.query(`delete from likes where from_user_id = $1 and to_user_id = $2`, [
    userId,
    targetId,
  ]);
  return { ok: true, matched: false };
}

export type SwipeDirection = "like" | "pass";

/**
 * Undo the last swipe decision.
 *
 * The deck's Undo button previously only rewound a local index: the decision
 * was already in `swipes` and already mirrored into `likes`, so the member saw
 * a card they had in fact already liked. Swiping again re-recorded it, and on a
 * like the other person saw a match with someone who believed they had taken it
 * back — a false match, which in this app is a safety problem, not just a bug.
 *
 * This removes both the decision and the mirrored like. Undoing is best-effort
 * by nature (the other party may already have matched), which is exactly why
 * the client must never *show* an undone card without calling this first.
 */
export async function undoSwipeFor(
  userId: string,
  targetId: string,
): Promise<{ ok: true; undone: boolean }> {
  if (!targetId || targetId === userId) return { ok: true, undone: false };
  const sql = await getSql();
  await sql.query(
    `delete from swipes where user_id = $1 and target_id = $2`,
    [userId, targetId],
  );
  await sql.query(
    `delete from likes where from_user_id = $1 and to_user_id = $2`,
    [userId, targetId],
  );
  return { ok: true, undone: true };
}

/**
 * The swipe deck: the discover deck limited to profiles you haven't decided on.
 * Rows are the same shapes as DiscoverItem; the client consumes one per swipe.
 */
export async function listDeckForUser(
  userId: string,
  input: DiscoverInput | undefined,
): Promise<DiscoverPage> {
  return listDiscoverForUser(userId, { ...input, excludeDecided: true });
}

export async function getProfileForViewerUser(userId: string, handleRaw: string) {
  const handle = handleRaw.replace(/^@/, "").toLowerCase();
  try {
    await ensureSeed();
  } catch (err) {
    console.error("[seed] viewer continued:", err);
  }
  const sql = await getSql();
  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS},
            exists(select 1 from likes l where l.from_user_id = $2 and l.to_user_id = profiles.user_id) as liked_by_me,
            exists(select 1 from likes l where l.from_user_id = profiles.user_id and l.to_user_id = $2) as likes_me,
            exists(select 1 from follows f where f.follower_id = $2 and f.following_id = profiles.user_id) as following,
            (select count(*)::int from likes l where l.to_user_id = profiles.user_id) as like_count
     from profiles
     where handle = $1 and not suspended`,
    [handle, userId],
  );
  const profile = rows[0] ? mapProfile(rows[0]) : null;
  if (!profile) return null;
  const meRows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS} from profiles where user_id = $1`,
    [userId],
  );
  const origin = originOf(meRows[0] ? mapProfile(meRows[0]) : null);
  const there =
    profile.lat != null && profile.lng != null
      ? { lat: profile.lat, lng: profile.lng }
      : coordForLocation(profile.location);
  return {
    ...profile,
    distanceMiles: there ? milesBetween(origin, there) : null,
  };
}

export const listDiscover = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: DiscoverInput | undefined) => normalizeDiscover(input))
  .handler(async ({ context, data }) => listDiscoverForUser(context.userId, data));

export const listFeatured = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await ensureSeed();
  } catch (err) {
    console.error("[seed] featured skipped:", err);
    return [];
  }
  const sql = await getSql();
  // The landing page is public, so this projection deliberately omits lat/lng
  // and the age-assurance columns (see PROFILE_COLS_PUBLIC). Serving a
  // member's coordinates to an anonymous caller is the leak this closes.
  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS_PUBLIC} from profiles
     where is_seed = true and onboarded = true and not suspended
     order by id
     limit 24`,
  );
  return rows.map(mapProfile);
});

export type ProfileInput = {
  handle: string;
  displayName: string;
  age: number | null;
  /** ISO `YYYY-MM-DD`. Required for a new profile; ignored on later saves. */
  birthDate?: string | null;
  hideAge?: boolean;
  discreet?: boolean;
  /** Tiny data-URI blur placeholders, aligned index-wise with `photos`. */
  photoBlurs?: string[];
  identities: string[];
  pronouns: string[];
  role?: string | null;
  bio: string;
  location: string | null;
  ethnicity?: string | null;
  lookingFor?: string[] | string | null;
  photos: string[];
  interests: string[];
  heightCm: number | null;
};

function asLookingList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return unique(value).slice(0, 8);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function cleanProfile(input: ProfileInput, existingBirthDate: string | null = null) {
  const handle = slugifyHandle(input.handle);
  const displayName = input.displayName.trim().slice(0, 40);
  if (handle.length < 3) throw new Error("Handle must be at least 3 characters.");
  if (displayName.length < 2) throw new Error("Name is required.");

  // ── Age gate ────────────────────────────────────────────────────────────
  // A date of birth is required to hold a profile, and once attested it is
  // immutable: there is no "edit my birthday" path, because an editable DOB is
  // not a gate. The age shown on the card is derived, never trusted from input.
  let birthDate: string | null = null;
  let age: number | null = null;
  if (existingBirthDate) {
    birthDate = normalizeBirthDate(existingBirthDate);
  }
  if (!birthDate && input.birthDate) {
    const checked = checkBirthDate(input.birthDate);
    if (!checked.ok) throw new Error(checked.error);
    birthDate = checked.birthDate;
  }
  if (!birthDate) {
    throw new Error("Confirm your date of birth to save your profile. Strut is 18+.");
  }
  age = ageOn(birthDate);
  if (age < MIN_AGE) {
    throw new Error("Strut is strictly 18+. You cannot create an account.");
  }

  const identities = unique(input.identities).slice(0, 8);
  const pronouns = unique(input.pronouns).slice(0, 6);
  const interests = unique(input.interests).slice(0, 16);
  const location = input.location?.trim().slice(0, 80) || null;
  const ethnicity = input.ethnicity?.trim().slice(0, 40) || null;
  const coord = coordForLocation(location);
  const roleRaw = input.role?.trim() || "";
  const role = judgeRole(identities, roleRaw).forced;

  // Photos must point somewhere this app controls. See isAllowedPhotoUrl: an
  // arbitrary remote URL is a tracking pixel that deanonymizes every member
  // whose deck loads the card.
  const photos = input.photos
    .filter((src) => typeof src === "string" && src.trim())
    .map((src) => src.trim())
    .filter((src) => {
      if (isAllowedPhotoUrl(src)) return true;
      throw new Error(
        "One of those photos isn't hosted by Strut. Upload photos in the app.",
      );
    })
    .map((src) => {
      if (src.startsWith("data:image/") && src.length > 240_000) {
        throw new Error("Upload photos before saving. Data URLs are too large for the profile.");
      }
      return src;
    })
    .slice(0, 8);

  return {
    handle,
    displayName,
    age,
    birthDate,
    hideAge: Boolean(input.hideAge),
    discreet: Boolean(input.discreet),
    identities,
    pronouns,
    identity: identities[0] ?? null,
    pronounText: pronouns[0] ?? null,
    role,
    bio: input.bio.trim().slice(0, 500),
    location,
    ethnicity,
    lookingFor: asLookingList(input.lookingFor),
    photos,
    // Blur placeholders are index-aligned with `photos`; extras are dropped so
    // the two arrays can never drift out of sync.
    photoBlurs: cleanPhotoBlurs(input.photoBlurs, photos.length),
    interests,
    heightCm:
      input.heightCm == null || Number.isNaN(Number(input.heightCm))
        ? null
        : Math.max(120, Math.min(220, Number(input.heightCm))),
    lat: coord?.lat ?? null,
    lng: coord?.lng ?? null,
  };
}

export async function writeProfileForUser(userId: string, input: ProfileInput) {
  try {
    await ensureSeed();
  } catch (err) {
    console.error("[seed] save continued:", err);
  }
  const sql = await getSql();

  // The age gate needs the *existing* birth date before it can decide whether
  // this save is creating one (required) or updating one (immutable).
  const existingRows = await sql.query<{ birth_date: string | null }>(
    `select birth_date from profiles where user_id = $1`,
    [userId],
  );
  const existingBirthDate = existingRows[0]?.birth_date ?? null;

  const data = cleanProfile(input, existingBirthDate);

  const taken = await sql.query<{ user_id: string }>(
    `select user_id from profiles where handle = $1 and user_id <> $2`,
    [data.handle, userId],
  );
  if (taken[0]) throw new Error("That handle is taken.");

  // Attested once, on the first save that carries a birth date. Never backdated
  // or rewritten afterward — `birth_date` is excluded from the update set below,
  // and age_attested_at is only populated while it is still null.
  const firstAttestation = existingBirthDate ? null : new Date().toISOString();

  const rows = await sql.query<ProfileRow>(
    `insert into profiles (
       user_id, handle, display_name, age, identity, pronouns, bio, location, ethnicity,
       looking_for, looking_for_list, photos, interests, height_cm, onboarded, last_active,
       identities, pronoun_list, hide_age, discreet, lat, lng, role,
       birth_date, age_attested_at, photo_blurs
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,true,now(),
       $15::jsonb,$16::jsonb,$17::boolean,$18::boolean,$19,$20,$21,
       $22::date,$23::timestamptz,$24::jsonb
     )
     on conflict (user_id) do update set
       handle = excluded.handle,
       display_name = excluded.display_name,
       age = excluded.age,
       identity = excluded.identity,
       pronouns = excluded.pronouns,
       bio = excluded.bio,
       location = excluded.location,
       ethnicity = excluded.ethnicity,
       looking_for = excluded.looking_for,
       looking_for_list = excluded.looking_for_list,
       photos = excluded.photos,
       interests = excluded.interests,
       height_cm = excluded.height_cm,
       identities = excluded.identities,
       pronoun_list = excluded.pronoun_list,
       hide_age = excluded.hide_age,
       discreet = excluded.discreet,
       lat = excluded.lat,
       lng = excluded.lng,
       role = excluded.role,
       photo_blurs = excluded.photo_blurs,
       -- Attested once; the birth_date column itself is deliberately NOT in
       -- this update list, so a later save can never move it.
       age_attested_at = coalesce(profiles.age_attested_at, excluded.age_attested_at),
       onboarded = true,
       last_active = now()
     returning ${PROFILE_COLS}`,
    [
      userId,
      data.handle,
      data.displayName,
      data.age,
      data.identity,
      data.pronounText,
      data.bio,
      data.location,
      data.ethnicity,
      data.lookingFor[0] ?? null,
      JSON.stringify(data.lookingFor),
      JSON.stringify(data.photos),
      JSON.stringify(data.interests),
      data.heightCm,
      JSON.stringify(data.identities),
      JSON.stringify(data.pronouns),
      data.hideAge,
      data.discreet,
      data.lat,
      data.lng,
      data.role,
      data.birthDate,
      firstAttestation,
      JSON.stringify(data.photoBlurs),
    ],
  );
  return mapProfile(rows[0]!);
}

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: ProfileInput) => input)
  .handler(async ({ context, data }) => writeProfileForUser(context.userId, data));

function clampMiles(value: number | undefined): number {
  if (value == null || Number.isNaN(Number(value))) return 100;
  return Math.max(1, Math.min(500, Math.round(Number(value))));
}

function originOf(profile: { lat: number | null; lng: number | null; location: string | null } | null) {
  if (profile?.lat != null && profile?.lng != null) {
    return { lat: profile.lat, lng: profile.lng };
  }
  return coordForLocation(profile?.location) ?? DEFAULT_COORD;
}
