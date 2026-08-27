import { createServerFn } from "@tanstack/react-start";
import { bboxFor, coordForLocation, DEFAULT_COORD, milesBetween } from "@/lib/geo";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { judgeRole } from "@/lib/bnwo";
import { DISCOVER_TABS, identityLine, ROLES, type DiscoverTab, type Profile } from "@/lib/types";
import { slugifyHandle, unique } from "@/lib/utils";
import { PROFILE_COLS, mapProfile, type ProfileRow } from "./map";
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

export const getPublicProfile = createServerFn({ method: "GET" })
  .validator((handle: string) => handle.replace(/^@/, "").toLowerCase())
  .handler(async ({ data: handle }) => {
    await ensureSeed();
    const sql = await getSql();
    const rows = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS} from profiles where handle = $1`,
      [handle],
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
       where handle = $1`,
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
  let where = `user_id <> $1 and onboarded = true`;

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
  if (box) {
    params.push(box.latMin, box.latMax, box.lngMin, box.lngMax);
    where += ` and (lat is null or (lat between $${params.length - 3} and $${params.length - 2} and lng between $${params.length - 1} and $${params.length}))`;
  }

  // Keyset cursor: restart the deck strictly after the previous page's last row
  // in (last_active DESC, id DESC) order. No OFFSET, no full-table load.
  const cursor = data.cursor ? parseDiscoverCursor(data.cursor) : null;
  if (cursor) {
    params.push(cursor.lastActive, cursor.id);
    where += ` and (last_active, id) < ($${params.length - 1}::timestamptz, $${params.length})`;
  }

  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS},
            exists(select 1 from likes l where l.from_user_id = $1 and l.to_user_id = profiles.user_id) as liked_by_me,
            exists(select 1 from likes l where l.from_user_id = profiles.user_id and l.to_user_id = $1) as likes_me
     from profiles
     where ${where}
     order by last_active desc, id desc
     limit ${data.limit}`,
    params,
  );

  const match = new Set(tab.match.map((s) => s.toLowerCase()));
  const wantLooking = lookingFor?.toLowerCase() ?? null;

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
    })
    .sort((a, b) => (a.distanceMiles ?? 9_999) - (b.distanceMiles ?? 9_999));

  // nextCursor reflects the last row actually returned (the deck-order boundary),
  // so the next page resumes right after it and never overlaps or skips.
  const boundary = rows[rows.length - 1];
  const nextCursor =
    rows.length >= data.limit && boundary
      ? makeDiscoverCursor({ last_active: boundary.last_active, id: Number(boundary.id) })
      : null;

  return { items, nextCursor };
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
     where handle = $1`,
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
  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS} from profiles
     where is_seed = true and onboarded = true
     order by id
     limit 24`,
  );
  return rows.map(mapProfile);
});

export type ProfileInput = {
  handle: string;
  displayName: string;
  age: number | null;
  hideAge?: boolean;
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

function cleanProfile(input: ProfileInput) {
  const handle = slugifyHandle(input.handle);
  const displayName = input.displayName.trim().slice(0, 40);
  if (handle.length < 3) throw new Error("Handle must be at least 3 characters.");
  if (displayName.length < 2) throw new Error("Name is required.");
  const age =
    input.age == null || Number.isNaN(Number(input.age))
      ? null
      : Math.max(18, Math.min(99, Number(input.age)));
  const identities = unique(input.identities).slice(0, 8);
  const pronouns = unique(input.pronouns).slice(0, 6);
  const interests = unique(input.interests).slice(0, 16);
  const location = input.location?.trim().slice(0, 80) || null;
  const ethnicity = input.ethnicity?.trim().slice(0, 40) || null;
  const coord = coordForLocation(location);
  const roleRaw = input.role?.trim() || "";
  const role = judgeRole(identities, roleRaw).forced;
  return {
    handle,
    displayName,
    age,
    hideAge: Boolean(input.hideAge),
    identities,
    pronouns,
    identity: identities[0] ?? null,
    pronounText: pronouns[0] ?? null,
    role,
    bio: input.bio.trim().slice(0, 500),
    location,
    ethnicity,
    lookingFor: asLookingList(input.lookingFor),
    photos: input.photos
      .filter((src) => typeof src === "string" && src.trim())
      .filter((src) => /^(https?:\/\/|\/photos\/|\/uploads\/)/i.test(src) || src.startsWith("data:image/"))
      .map((src) => {
        if (src.startsWith("data:image/") && src.length > 240_000) {
          throw new Error("Upload photos before saving. Data URLs are too large for the profile.");
        }
        return src;
      })
      .slice(0, 8),
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
  const data = cleanProfile(input);
  try {
    await ensureSeed();
  } catch (err) {
    console.error("[seed] save continued:", err);
  }
  const sql = await getSql();
  const taken = await sql.query<{ user_id: string }>(
    `select user_id from profiles where handle = $1 and user_id <> $2`,
    [data.handle, userId],
  );
  if (taken[0]) throw new Error("That handle is taken.");
  const rows = await sql.query<ProfileRow>(
    `insert into profiles (
       user_id, handle, display_name, age, identity, pronouns, bio, location, ethnicity,
       looking_for, looking_for_list, photos, interests, height_cm, onboarded, last_active,
       identities, pronoun_list, hide_age, lat, lng, role
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,true,now(),
       $15::jsonb,$16::jsonb,$17::boolean,$18,$19,$20
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
       lat = excluded.lat,
       lng = excluded.lng,
       role = excluded.role,
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
      data.lat,
      data.lng,
      data.role,
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
