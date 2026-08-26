import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { IDENTITIES, LOOKING_FOR } from "@/lib/types";
import { mapProfile, type ProfileRow } from "./map";
import { ensureSeed } from "./seed";

const COLS = `id, user_id, handle, display_name, age, identity, pronouns, bio,
  location, looking_for, photos, interests, height_cm, is_seed,
  last_active, onboarded, created_at`;

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureSeed();
    const sql = await getSql();
    const rows = await sql.query<ProfileRow>(
      `select ${COLS} from profiles where user_id = $1`,
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
      `select ${COLS} from profiles where handle = $1`,
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
      `select ${COLS},
              exists(select 1 from likes l where l.from_user_id = $2 and l.to_user_id = profiles.user_id) as liked_by_me,
              exists(select 1 from likes l where l.from_user_id = profiles.user_id and l.to_user_id = $2) as likes_me,
              exists(select 1 from follows f where f.follower_id = $2 and f.following_id = profiles.user_id) as following,
              (select count(*)::int from likes l where l.to_user_id = profiles.user_id) as like_count
       from profiles
       where handle = $1`,
      [handle, context.userId],
    );
    return rows[0] ? mapProfile(rows[0]) : null;
  });

export const listDiscover = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: { identity?: string; lookingFor?: string; q?: string } | undefined) =>
      input ?? {},
  )
  .handler(async ({ context, data }) => {
    await ensureSeed();
    const sql = await getSql();
    const identity =
      data.identity && (IDENTITIES as readonly string[]).includes(data.identity)
        ? data.identity
        : null;
    const lookingFor =
      data.lookingFor && (LOOKING_FOR as readonly string[]).includes(data.lookingFor)
        ? data.lookingFor
        : null;
    const q = data.q?.trim() ? `%${data.q.trim().toLowerCase()}%` : null;

    const params: unknown[] = [context.userId];
    let where = `user_id <> $1 and onboarded = true`;
    if (identity) {
      params.push(identity);
      where += ` and identity = $${params.length}`;
    }
    if (lookingFor) {
      params.push(lookingFor);
      where += ` and looking_for = $${params.length}`;
    }
    if (q) {
      params.push(q);
      where += ` and (lower(display_name) like $${params.length} or lower(handle) like $${params.length} or lower(coalesce(location,'')) like $${params.length})`;
    }

    const rows = await sql.query<ProfileRow>(
      `select ${COLS},
              exists(select 1 from likes l where l.from_user_id = $1 and l.to_user_id = profiles.user_id) as liked_by_me,
              exists(select 1 from likes l where l.from_user_id = profiles.user_id and l.to_user_id = $1) as likes_me
       from profiles
       where ${where}
       order by last_active desc, id desc
       limit 80`,
      params,
    );
    return rows.map(mapProfile);
  });

export const listFeatured = createServerFn({ method: "GET" }).handler(async () => {
  await ensureSeed();
  const sql = await getSql();
  const rows = await sql.query<ProfileRow>(
    `select ${COLS} from profiles
     where is_seed = true and onboarded = true
     order by id
     limit 18`,
  );
  return rows.map(mapProfile);
});

export type ProfileInput = {
  handle: string;
  displayName: string;
  age: number | null;
  identity: string | null;
  pronouns: string | null;
  bio: string;
  location: string | null;
  lookingFor: string | null;
  photos: string[];
  interests: string[];
  heightCm: number | null;
};

function cleanProfile(input: ProfileInput): ProfileInput {
  const handle = input.handle
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  const displayName = input.displayName.trim().slice(0, 40);
  if (handle.length < 3) throw new Error("Handle must be at least 3 characters.");
  if (displayName.length < 2) throw new Error("Name is required.");
  const age =
    input.age == null || Number.isNaN(Number(input.age))
      ? null
      : Math.max(18, Math.min(99, Number(input.age)));
  return {
    handle,
    displayName,
    age,
    identity: input.identity?.trim() || null,
    pronouns: input.pronouns?.trim() || null,
    bio: input.bio.trim().slice(0, 500),
    location: input.location?.trim().slice(0, 80) || null,
    lookingFor: input.lookingFor?.trim() || null,
    photos: input.photos.filter(Boolean).slice(0, 8),
    interests: input.interests.filter(Boolean).slice(0, 8),
    heightCm:
      input.heightCm == null || Number.isNaN(Number(input.heightCm))
        ? null
        : Math.max(120, Math.min(220, Number(input.heightCm))),
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
         looking_for, photos, interests, height_cm, onboarded, last_active
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,true,now()
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
         photos = excluded.photos,
         interests = excluded.interests,
         height_cm = excluded.height_cm,
         onboarded = true,
         last_active = now()
       returning ${COLS}`,
      [
        context.userId,
        data.handle,
        data.displayName,
        data.age,
        data.identity,
        data.pronouns,
        data.bio,
        data.location,
        data.lookingFor,
        JSON.stringify(data.photos),
        JSON.stringify(data.interests),
        data.heightCm,
      ],
    );
    return mapProfile(rows[0]!);
  });
