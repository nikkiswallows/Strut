import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { SEED_PROFILES } from "@/lib/seed-data";
import type { FeedPost, LikeBundle } from "@/lib/types";
import { PROFILE_COLS_P, mapProfile, type ProfileRow } from "./map";
import { parseJson } from "@/lib/utils";
import { ensureSeed } from "./seed";

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((toUserId: string) => toUserId)
  .handler(async ({ context, data: toUserId }) => {
    if (toUserId === context.userId) throw new Error("You cannot like yourself.");
    const sql = await getSql();
    const existing = await sql.query<{ from_user_id: string }>(
      `select from_user_id from likes where from_user_id = $1 and to_user_id = $2`,
      [context.userId, toUserId],
    );
    if (existing[0]) {
      await sql.query(`delete from likes where from_user_id = $1 and to_user_id = $2`, [
        context.userId,
        toUserId,
      ]);
      return { liked: false, matched: false };
    }
    await sql.query(`insert into likes (from_user_id, to_user_id) values ($1, $2)`, [
      context.userId,
      toUserId,
    ]);
    const seed = SEED_PROFILES.find((p) => p.userId === toUserId);
    if (seed?.autoMatch) {
      await sql.query(
        `insert into likes (from_user_id, to_user_id) values ($1, $2) on conflict do nothing`,
        [toUserId, context.userId],
      );
    }
    const back = await sql.query<{ from_user_id: string }>(
      `select from_user_id from likes where from_user_id = $1 and to_user_id = $2`,
      [toUserId, context.userId],
    );
    return { liked: true, matched: Boolean(back[0]) };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    if (userId === context.userId) return { following: false };
    const sql = await getSql();
    const existing = await sql.query<{ follower_id: string }>(
      `select follower_id from follows where follower_id = $1 and following_id = $2`,
      [context.userId, userId],
    );
    if (existing[0]) {
      await sql.query(`delete from follows where follower_id = $1 and following_id = $2`, [
        context.userId,
        userId,
      ]);
      return { following: false };
    }
    await sql.query(`insert into follows (follower_id, following_id) values ($1, $2)`, [
      context.userId,
      userId,
    ]);
    return { following: true };
  });

export const listLikes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LikeBundle> => {
    await ensureSeed();
    const sql = await getSql();
    const incoming = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS_P},
              true as likes_me,
              exists(select 1 from likes l where l.from_user_id = $1 and l.to_user_id = p.user_id) as liked_by_me
       from likes lk
       join profiles p on p.user_id = lk.from_user_id
       where lk.to_user_id = $1
       order by lk.created_at desc`,
      [context.userId],
    );
    const outgoing = await sql.query<ProfileRow>(
      `select ${PROFILE_COLS_P},
              true as liked_by_me,
              exists(select 1 from likes l where l.from_user_id = p.user_id and l.to_user_id = $1) as likes_me
       from likes lk
       join profiles p on p.user_id = lk.to_user_id
       where lk.from_user_id = $1
       order by lk.created_at desc`,
      [context.userId],
    );
    const matches = incoming.filter((row) => Boolean(row.liked_by_me));
    return {
      incoming: incoming.map(mapProfile),
      outgoing: outgoing.map(mapProfile),
      matches: matches.map(mapProfile),
    };
  });

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

export const listFeed = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureSeed();
    const sql = await getSql();
    const rows = await sql.query<PostRow>(
      `select po.id, po.user_id, po.body, po.photo_url, po.created_at,
              p.handle, p.display_name, p.photos,
              (select count(*)::int from post_likes pl where pl.post_id = po.id) as like_count,
              exists(select 1 from post_likes pl where pl.post_id = po.id and pl.user_id = $1) as liked_by_me
       from posts po
       join profiles p on p.user_id = po.user_id
       order by po.created_at desc
       limit 60`,
      [context.userId],
    );
    return rows.map(mapPost);
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { body: string; photoUrl?: string | null }) => {
    const body = input.body.trim().slice(0, 400);
    if (!body) throw new Error("Write something first.");
    return { body, photoUrl: input.photoUrl ?? null };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(`insert into posts (user_id, body, photo_url) values ($1, $2, $3)`, [
      context.userId,
      data.body,
      data.photoUrl,
    ]);
    await sql.query(`update profiles set last_active = now() where user_id = $1`, [
      context.userId,
    ]);
    return { ok: true };
  });

export const togglePostLike = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((postId: number) => postId)
  .handler(async ({ context, data: postId }) => {
    const sql = await getSql();
    const existing = await sql.query<{ post_id: number }>(
      `select post_id from post_likes where post_id = $1 and user_id = $2`,
      [postId, context.userId],
    );
    if (existing[0]) {
      await sql.query(`delete from post_likes where post_id = $1 and user_id = $2`, [
        postId,
        context.userId,
      ]);
      return { liked: false };
    }
    await sql.query(`insert into post_likes (post_id, user_id) values ($1, $2)`, [
      postId,
      context.userId,
    ]);
    return { liked: true };
  });
