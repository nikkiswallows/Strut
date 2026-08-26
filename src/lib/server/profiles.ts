import { createServerFn } from "@tanstack/react-start";
import { coordForLocation, DEFAULT_COORD, milesBetween } from "@/lib/geo";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { DISCOVER_TABS, ETHNICITIES, ROLES, type DiscoverTab } from "@/lib/types";
import { FEATURED_HANDLES } from "@/lib/seed-data";
import { slugifyHandle, unique } from "@/lib/utils";
import { PROFILE_COLS, mapProfile, type ProfileRow } from "./map";
import { ensureSeed } from "./seed";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureSeed();
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
};

export const listDiscover = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: DiscoverInput | undefined) => ({
    tab: (input?.tab as DiscoverTab | undefined) ?? "nearby",
    miles: clampMiles(input?.miles),
    lookingFor: input?.lookingFor ?? "",
    role: input?.role ?? "",
    ethnicity: input?.ethnicity ?? "",
    q: input?.q ?? "",
  }))
  .handler(async ({ context, data }) => {
    await ensureSeed();
    const sql = await getSql();
    const meRows = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS} from profiles where user_id = $1`,
      [context.userId],
    );
    const origin = originOf(meRows[0] ? mapProfile(meRows[0]) : null);

    const lookingFor = data.lookingFor.trim() || null;
    const role =
      data.role && (ROLES as readonly string[]).includes(data.role as (typeof ROLES)[number])
        ? data.role
        : null;
    const ethnicity =
      data.ethnicity &&
      (ETHNICITIES as readonly string[]).includes(data.ethnicity as (typeof ETHNICITIES)[number])
        ? data.ethnicity
        : null;
    const q = data.q.trim() ? `%${data.q.trim().toLowerCase()}%` : null;

    const params: unknown[] = [context.userId];
    let where = `user_id <> $1 and onboarded = true`;
    if (role) {
      params.push(role);
      where += ` and role = $${params.length}`;
    }
    if (q) {
      params.push(q);
      where += ` and (lower(display_name) like $${params.length} or lower(handle) like $${params.length} or lower(coalesce(location,'')) like $${params.length})`;
    }

    const rows = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS},
              exists(select 1 from likes l where l.from_user_id = $1 and l.to_user_id = profiles.user_id) as liked_by_me,
              exists(select 1 from likes l where l.from_user_id = profiles.user_id and l.to_user_id = $1) as likes_me
       from profiles
       where ${where}
       order by last_active desc, id desc
       limit 200`,
      params,
    );

    const tab = DISCOVER_TABS.find((t) => t.id === data.tab) ?? DISCOVER_TABS[0]!;
    const match = new Set(tab.match.map((s) => s.toLowerCase()));

    return rows
      .map((row) => {
        const profile = mapProfile(row);
        const there =
          profile.lat != null && profile.lng != null
            ? { lat: profile.lat, lng: profile.lng }
            : coordForLocation(profile.location);
        return {
          ...profile,
          photos: profile.photos.slice(0, 6),
          distanceMiles: there ? milesBetween(origin, there) : null,
        };
      })
      .filter((profile) => {
        if (profile.userId === context.userId) return false;
        if (match.size) {
          const hit = (profile.identities ?? []).some((id) => match.has(id.toLowerCase()));
          if (!hit) return false;
        }
        if (lookingFor) {
          const want = lookingFor.toLowerCase();
          const hit = (profile.lookingFor ?? []).some((item) => item.toLowerCase() === want);
          if (!hit) return false;
        }
        if (ethnicity && (profile.ethnicity ?? "").toLowerCase() !== ethnicity.toLowerCase()) {
          return false;
        }
        if (profile.distanceMiles != null && profile.distanceMiles > data.miles) return false;
        return true;
      })
      .sort((a, b) => (a.distanceMiles ?? 9_999) - (b.distanceMiles ?? 9_999))
      .slice(0, 80);
  });

export const listFeatured = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeed();
  const sql = await getSql();
  const handles = [...FEATURED_HANDLES];
  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS} from profiles
     where is_seed = true and onboarded = true and handle = any($1::text[])`,
    [handles],
  );
  const rank = new Map<string, number>(handles.map((h, i) => [h, i]));
  return rows
    .map(mapProfile)
    .sort((a, b) => (rank.get(a.handle) ?? 99) - (rank.get(b.handle) ?? 99));
});

export type ProfileInput = {
  handle: string;
  displayName: string;
  age: number | null;
  hideAge?: boolean;
  identities: string[];
  pronouns: string[];
  role?: string | null;
  ethnicity?: string | null;
  bio: string;
  location: string | null;
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
  if (identities.length === 0) throw new Error("Pick at least one identity.");
  const pronouns = unique(input.pronouns).slice(0, 6);
  const interests = unique(input.interests).slice(0, 16);
  const location = input.location?.trim().slice(0, 80) || null;
  const coord = coordForLocation(location);
  const roleRaw = input.role?.trim() || null;
  const role =
    roleRaw && (ROLES as readonly string[]).includes(roleRaw as (typeof ROLES)[number])
      ? roleRaw
      : null;
  const ethnicityRaw = input.ethnicity?.trim() || null;
  const ethnicity =
    ethnicityRaw &&
    (ETHNICITIES as readonly string[]).includes(ethnicityRaw as (typeof ETHNICITIES)[number])
      ? ethnicityRaw
      : null;
  const photos = input.photos.filter(Boolean).slice(0, 8);
  if (photos.length === 0) throw new Error("Add at least one photo of you.");
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
    ethnicity,
    bio: input.bio.trim().slice(0, 500),
    location,
    lookingFor: asLookingList(input.lookingFor),
    photos,
    interests,
    heightCm:
      input.heightCm == null || Number.isNaN(Number(input.heightCm))
        ? null
        : Math.max(120, Math.min(220, Number(input.heightCm))),
    lat: coord?.lat ?? null,
    lng: coord?.lng ?? null,
  };
}

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: ProfileInput) => cleanProfile(input))
  .handler(async ({ context, data }) => {
    await ensureSeed();
    const sql = await getSql();
    const taken = await sql.query<{ user_id: string }>(
      `select user_id from profiles where handle = $1 and user_id <> $2`,
      [data.handle, context.userId],
    );
    if (taken[0]) throw new Error("That handle is taken.");
    const rows = await sql.query<ProfileRow>(
      `insert into profiles (
         user_id, handle, display_name, age, identity, pronouns, bio, location,
         looking_for, looking_for_list, photos, interests, height_cm, onboarded, last_active,
         identities, pronoun_list, hide_age, lat, lng, role, ethnicity
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,true,now(),
         $14::jsonb,$15::jsonb,$16::boolean,$17,$18,$19,$20
       )
       on conflict (user_id) do update set
         handle = excluded.handle,
         display_name = excluded.display_name,
         age = excluded.age,
         identity = excluded.identity,
         pronouns = excluded.pronouns,
         bio = excluded.bio,
         location = excluded.location,
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
         ethnicity = excluded.ethnicity,
         onboarded = true,
         last_active = now()
       returning ${PROFILE_COLS}`,
      [
        context.userId,
        data.handle,
        data.displayName,
        data.age,
        data.identity,
        data.pronounText,
        data.bio,
        data.location,
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
        data.ethnicity,
      ],
    );
    return mapProfile(rows[0]!);
  });

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
