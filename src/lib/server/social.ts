import { DISCOVER_TABS } from "@/lib/types";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { SEED_PROFILES } from "@/lib/seed-data";
import type { FeedPost, LikeBundle } from "@/lib/types";
import { PROFILE_COLS_P, mapProfile, type ProfileRow } from "./map";
import { parseJson } from "@/lib/utils";
import { ensureSeed } from "./seed";
import { isStoredPhotoUrl } from "./media.server";
import { assertNotBlocked } from "./safety";

export async function toggleLikeFor(userId: string, toUserId: string) {
  if (toUserId === userId) throw new Error("You cannot like yourself.");
  await assertNotBlocked(userId, toUserId);
  const sql = await getSql();
  const existing = await sql.query<{ from_user_id: string }>(
    `select from_user_id from likes where from_user_id = $1 and to_user_id = $2`,
    [userId, toUserId],
  );
  if (existing[0]) {
    await sql.query(`delete from likes where from_user_id = $1 and to_user_id = $2`, [
      userId,
      toUserId,
    ]);
    return { liked: false, matched: false };
  }
  // `on conflict do nothing`: the SELECT above is a UX check, not a lock — a
  // double-tap race would otherwise throw a duplicate-key error and surface as
  // a 400 to the user. (Matches how swipeFor already behaves.)
  await sql.query(
    `insert into likes (from_user_id, to_user_id) values ($1, $2)
     on conflict (from_user_id, to_user_id) do nothing`,
    [userId, toUserId],
  );
  // A like is a strong engagement signal: bump the actor's last_active so the
  // discover deck (ordered by last_active desc) surfaces them, and so "recently
  // active" reflects real behavior rather than last profile save.
  await sql.query(
    `update profiles set last_active = now() where user_id = $1 and last_active < now() - interval '1 minute'`,
    [userId],
  );
  const seed = SEED_PROFILES.find((p) => p.userId === toUserId);
  if (seed?.autoMatch) {
    await sql.query(
      `insert into likes (from_user_id, to_user_id) values ($1, $2) on conflict do nothing`,
      [toUserId, userId],
    );
  }
  const back = await sql.query<{ from_user_id: string }>(
    `select from_user_id from likes where from_user_id = $1 and to_user_id = $2`,
    [toUserId, userId],
  );
  return { liked: true, matched: Boolean(back[0]) };
}

export async function toggleFollowFor(userId: string, otherId: string) {
  if (otherId === userId) return { following: false };
  await assertNotBlocked(userId, otherId);
  const sql = await getSql();
  const existing = await sql.query<{ follower_id: string }>(
    `select follower_id from follows where follower_id = $1 and following_id = $2`,
    [userId, otherId],
  );
  if (existing[0]) {
    await sql.query(`delete from follows where follower_id = $1 and following_id = $2`, [
      userId,
      otherId,
    ]);
    return { following: false };
  }
  await sql.query(
    `insert into follows (follower_id, following_id) values ($1, $2)
     on conflict (follower_id, following_id) do nothing`,
    [userId, otherId],
  );
  return { following: true };
}

/**
 * Blocked accounts are hidden in both directions, and the result is bounded —
 * an unbounded "who liked you" query is the payload you plan to sell, so it is
 * the one most guaranteed to grow until it hurts.
 */
export async function listLikesFor(userId: string, limit = 200): Promise<LikeBundle> {
  await ensureSeed();
  const sql = await getSql();
  const bound = Math.max(20, Math.min(500, Math.round(limit)));
  const noBlocks = `and not exists (
     select 1 from blocks b
     where (b.blocker_id = $1 and b.blocked_id = p.user_id)
        or (b.blocked_id = $1 and b.blocker_id = p.user_id)
   )`;
  const incoming = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS_P},
            true as likes_me,
            exists(select 1 from likes l where l.from_user_id = $1 and l.to_user_id = p.user_id) as liked_by_me
     from likes lk
     join profiles p on p.user_id = lk.from_user_id
     where lk.to_user_id = $1 ${noBlocks}
     order by lk.created_at desc
     limit ${bound}`,
    [userId],
  );
  const outgoing = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS_P},
            true as liked_by_me,
            exists(select 1 from likes l where l.from_user_id = p.user_id and l.to_user_id = $1) as likes_me
     from likes lk
     join profiles p on p.user_id = lk.to_user_id
     where lk.from_user_id = $1 ${noBlocks}
     order by lk.created_at desc
     limit ${bound}`,
    [userId],
  );
  const matches = incoming.filter((row) => Boolean(row.liked_by_me));
  return {
    incoming: incoming.map(mapProfile),
    outgoing: outgoing.map(mapProfile),
    matches: matches.map(mapProfile),
  };
}

type PostRow = {
  id: number;
  user_id: string;
  body: string;
  photo_url: string | null;
  created_at: string;
  like_count: number | string;
  liked_by_me: boolean | number | string;
  handle: string;
  display_name: string;
  photos: unknown;
};

function mapPost(row: PostRow): FeedPost {
  const photos = parseJson<string[]>(row.photos, []);
  return {
    id: Number(row.id),
    userId: row.user_id,
    body: row.body,
    photoUrl: row.photo_url,
    createdAt: String(row.created_at),
    likedByMe: row.liked_by_me === true || row.liked_by_me === 1 || row.liked_by_me === "t",
    likeCount: Number(row.like_count) || 0,
    author: {
      handle: row.handle,
      displayName: row.display_name,
      photo: photos[0] ?? null,
    },
  };
}

export async function listFeedFor(userId: string, tabId?: string) {
  await ensureSeed();
  const sql = await getSql();
  // Same identity cohorts as the deck tabs: pass a DISCOVER_TABS id to only
  // see posts from that cohort (kings, sissies, faggots, wives, ...).
  const tab = tabId ? DISCOVER_TABS.find((t) => t.id === tabId && t.match.length) : undefined;
  const params: unknown[] = [userId];
  let where = "";
  if (tab) {
    const labels = tab.match.map((l) => l.toLowerCase());
    const ph = labels.map((_, i) => `$${i + 2}`).join(",");
    where = ` where (
      exists (
        select 1 from jsonb_array_elements_text(coalesce(p.identities,'[]'::jsonb)) as v(ident)
        where lower(v.ident) in (${ph})
      )
      or lower(coalesce(p.identity,'')) in (${ph})
    )`;
    params.push(...labels);
  }
  const rows = await sql.query<PostRow>(
    `select po.id, po.user_id, po.body, po.photo_url, po.created_at,
            p.handle, p.display_name, p.photos,
            (select count(*)::int from post_likes pl where pl.post_id = po.id) as like_count,
            exists(select 1 from post_likes pl where pl.post_id = po.id and pl.user_id = $1) as liked_by_me
     from posts po
     join profiles p on p.user_id = po.user_id
     ${where}
     order by po.created_at desc
     limit 60`,
    params,
  );
  return rows.map(mapPost);
}

export async function createPostFor(
  userId: string,
  input: { body: string; photoUrl?: string | null },
) {
  const body = input.body.trim().slice(0, 400);
  if (!body) throw new Error("Write something first.");
  const photoUrl = input.photoUrl?.trim() || null;
  if (photoUrl?.startsWith("data:")) {
    throw new Error("Upload the photo first. Feed posts store URLs, not raw files.");
  }
  if (photoUrl && !isStoredPhotoUrl(photoUrl)) {
    // Only allow http(s)/app-relative photo URLs — arbitrary schemes
    // (javascript:, etc.) must never reach the feed.
    throw new Error("Use an uploaded photo.");
  }
  const sql = await getSql();
  await sql.query(`insert into posts (user_id, body, photo_url) values ($1, $2, $3)`, [
    userId,
    body,
    photoUrl,
  ]);
  await sql.query(`update profiles set last_active = now() where user_id = $1`, [userId]);
  return { ok: true as const };
}

export async function togglePostLikeFor(userId: string, postId: number) {
  const sql = await getSql();
  const existing = await sql.query<{ post_id: number }>(
    `select post_id from post_likes where post_id = $1 and user_id = $2`,
    [postId, userId],
  );
  if (existing[0]) {
    await sql.query(`delete from post_likes where post_id = $1 and user_id = $2`, [postId, userId]);
    return { liked: false };
  }
  await sql.query(`insert into post_likes (post_id, user_id) values ($1, $2)`, [postId, userId]);
  return { liked: true };
}

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((toUserId: string) => toUserId)
  .handler(async ({ context, data: toUserId }) => toggleLikeFor(context.userId, toUserId));

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => toggleFollowFor(context.userId, userId));

export const listLikes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listLikesFor(context.userId));

export const listFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listFeedFor(context.userId));

export const createPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { body: string; photoUrl?: string | null }) => input)
  .handler(async ({ context, data }) => createPostFor(context.userId, data));

export const togglePostLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((postId: number) => postId)
  .handler(async ({ context, data: postId }) => togglePostLikeFor(context.userId, postId));
