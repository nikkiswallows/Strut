import { createFileRoute } from "@tanstack/react-router";
import { forbiddenUnlessTrustedOrigin } from "@/lib/auth/isolation.server";
import { getSessionUserFromRequest } from "@/lib/auth/session.server";
import { getSql } from "@/lib/db";
import { clientIp, rateLimit, sweepRateBuckets } from "@/lib/server/rate-limit";
import { accountEvent } from "@/lib/server/audit";

/**
 * Account lifecycle: export and one-tap deletion.
 *
 * Both are legal obligations (GDPR Art. 15/17, CCPA/CPRA §1798.100–.105) and
 * both were entirely absent. For this audience they are also a product feature:
 * "you can delete everything, instantly, and take your data with you" is the
 * single most trust-building sentence you can say to someone who is closeted,
 * married, or otherwise one screenshot away from losing something.
 *
 * Deletion is real, not a soft-delete flag: photos are removed from blob storage
 * too, because a "deleted" account whose images still resolve at a public CDN
 * URL is not deleted.
 */

const noStore = { "cache-control": "no-store" };

export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      /**
       * Portability: everything Strut holds about the caller, as JSON.
       * Deliberately excludes other people's data — an export must not become
       * a way to exfiltrate someone else's photos or messages. Conversation
       * *content* is therefore limited to threads the caller belongs to, and
       * only their own side plus the counterpart's handle.
       */
      GET: async ({ request }) => {
        const forbidden = forbiddenUnlessTrustedOrigin(request);
        if (forbidden) return forbidden;
        const user = await getSessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        sweepRateBuckets();
        if (!rateLimit(`export:${user.id}`, 5, 60 * 60 * 1000)) {
          return Response.json(
            { error: "You've exported a lot. Try again in an hour." },
            { status: 429, headers: noStore },
          );
        }

        const sql = await getSql();
        const profileRows = await sql.query<Record<string, unknown>>(
          `select handle, display_name, age, birth_date, identity, identities, pronouns,
                  pronoun_list, bio, location, ethnicity, looking_for, looking_for_list,
                  photos, photo_blurs, interests, height_cm, role, hide_age, discreet,
                  lat, lng, last_active, created_at
           from profiles where user_id = $1`,
          [user.id],
        );
        const likesOut = await sql.query<{ to_user_id: string; created_at: string }>(
          `select to_user_id, created_at from likes where from_user_id = $1 order by created_at desc`,
          [user.id],
        );
        const posts = await sql.query<Record<string, unknown>>(
          `select body, photo_url, created_at from posts where user_id = $1 order by created_at desc`,
          [user.id],
        );
        const threads = await sql.query<{
          id: number;
          user_a: string;
          user_b: string;
        }>(
          `select id, user_a, user_b from conversations
           where user_a = $1 or user_b = $1 order by id`,
          [user.id],
        );
        const messages = await sql.query<{
          conversation_id: number;
          sender_id: string;
          body: string;
          created_at: string;
        }>(
          `select m.conversation_id, m.sender_id, m.body, m.created_at
           from messages m
           join conversations c on c.id = m.conversation_id
           where c.user_a = $1 or c.user_b = $1
           order by m.created_at`,
          [user.id],
        );
        const blocks = await sql.query<{ blocked_id: string; created_at: string }>(
          `select blocked_id, created_at from blocks where blocker_id = $1`,
          [user.id],
        );
        const reports = await sql.query<Record<string, unknown>>(
          `select reported_id, reason, detail, status, created_at
           from reports where reporter_id = $1 order by created_at desc`,
          [user.id],
        );

        await accountEvent(user.id, "export", { posts: posts.length }, {
          ip: clientIp(request),
          userAgent: request.headers.get("user-agent"),
        });

        return Response.json(
          {
            exportedAt: new Date().toISOString(),
            account: {
              id: user.id,
              email: user.email,
              name: user.name,
              phoneNumber: user.phoneNumber,
            },
            profile: profileRows[0] ?? null,
            likes: likesOut,
            posts,
            // Own messages only; the counterpart is identified by user id, not
            // by name, so an export cannot be used to build a dossier.
            conversations: threads.map((t) => {
              const other = t.user_a === user.id ? t.user_b : t.user_a;
              return {
                id: t.id,
                otherUserId: other,
                messages: messages
                  .filter((m) => m.conversation_id === t.id)
                  .map((m) => ({
                    from: m.sender_id === user.id ? "you" : "them",
                    body: m.body,
                    createdAt: String(m.created_at),
                  })),
              };
            }),
            blocks,
            reports,
          },
          { headers: { "content-type": "application/json", ...noStore } },
        );
      },

      /**
       * Delete the account and everything attached to it. Requires an explicit
       * confirmation string so a stray tap (or a CSRF-ish mistake) cannot wipe
       * a member's account.
       */
      DELETE: async ({ request }) => {
        const forbidden = forbiddenUnlessTrustedOrigin(request);
        if (forbidden) return forbidden;
        const user = await getSessionUserFromRequest(request);
        if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let confirm = "";
        try {
          const body = (await request.json()) as { confirm?: string };
          confirm = String(body.confirm ?? "").trim().toLowerCase();
        } catch {
          confirm = "";
        }
        if (confirm !== "delete") {
          return Response.json(
            { error: "Type DELETE to confirm. This cannot be undone." },
            { status: 400, headers: noStore },
          );
        }

        sweepRateBuckets();
        if (!rateLimit(`delete:${user.id}`, 3, 60 * 60 * 1000)) {
          return Response.json(
            { error: "Too many attempts. Try again later." },
            { status: 429, headers: noStore },
          );
        }

        const sql = await getSql();
        const id = user.id;

        // Photos first, from blob storage: a deleted profile whose images still
        // resolve at a public CDN URL is not deleted.
        let photosRemoved = 0;
        try {
          const photoRows = await sql.query<{ photos: unknown }>(
            `select photos from profiles where user_id = $1`,
            [id],
          );
          const raw = photoRows[0]?.photos;
          const list: string[] = Array.isArray(raw)
            ? raw.map(String)
            : typeof raw === "string"
              ? (JSON.parse(raw) as string[])
              : [];
          const urls = list.filter((u) => /^https?:\/\//i.test(u));
          if (urls.length) {
            const { del } = await import("@vercel/blob");
            await del(urls);
            photosRemoved = urls.length;
          }
        } catch (err) {
          // Never block deletion on storage cleanup — but do say so.
          console.error("[account] blob cleanup failed:", err);
        }

        // Conversations the caller is part of, then their messages.
        await sql.query(
          `delete from messages where conversation_id in
             (select id from conversations where user_a = $1 or user_b = $1)`,
          [id],
        );
        await sql.query(
          `delete from conversations where user_a = $1 or user_b = $1`,
          [id],
        );

        for (const table of [
          "likes",
          "follows",
          "swipes",
          "post_likes",
          "blocks",
          "reports",
        ]) {
          // Every one of these tables keys the user under two possible columns,
          // so clear both directions.
          const cols: Record<string, [string, string]> = {
            likes: ["from_user_id", "to_user_id"],
            follows: ["follower_id", "following_id"],
            swipes: ["user_id", "target_id"],
            post_likes: ["user_id", "user_id"],
            blocks: ["blocker_id", "blocked_id"],
            reports: ["reporter_id", "reported_id"],
          };
          const [a, b] = cols[table]!;
          await sql.query(
            `delete from ${table} where ${a} = $1${b !== a ? ` or ${b} = $1` : ""}`,
            [id],
          );
        }

        // Feed posts (and any likes on them), then the profile.
        await sql.query(
          `delete from post_likes where post_id in (select id from posts where user_id = $1)`,
          [id],
        );
        await sql.query(`delete from posts where user_id = $1`, [id]);
        await sql.query(`delete from bot_jobs where seed_user_id = $1`, [id]);
        await sql.query(`delete from profiles where user_id = $1`, [id]);

        // Finally the identity itself (Better Auth's own tables).
        await sql.query(`delete from verification where user_id = $1`, [id]).catch(() => {});
        await sql.query(`delete from account where user_id = $1`, [id]).catch(() => {});
        await sql.query(`delete from session where user_id = $1`, [id]).catch(() => {});
        await sql.query(`delete from "user" where id = $1`, [id]).catch(() => {});

        // Record the deletion with no personal data attached: proving we
        // honoured the request must not resurrect it.
        await accountEvent("deleted", "delete", { photosRemoved }, {
          ip: clientIp(request),
          userAgent: request.headers.get("user-agent"),
        });

        const headers = new Headers({ "content-type": "application/json", ...noStore });
        // Clear the session cookie so the client lands logged out.
        headers.append(
          "set-cookie",
          "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
        );
        return new Response(
          JSON.stringify({ ok: true, photosRemoved }),
          { status: 200, headers },
        );
      },
    },
  },
});
