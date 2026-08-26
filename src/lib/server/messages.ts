import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { ChatMessage, ConversationPreview } from "@/lib/types";
import { parseJson } from "@/lib/utils";
import { generateSeedReply, isSeedUser } from "./bot";
import { ensureSeed } from "./seed";

export const listConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ConversationPreview[]> => {
    await ensureSeed();
    const sql = await getSql();
    const rows = await sql.query<{
      id: number;
      user_a: string;
      user_b: string;
      last_message_at: string;
      handle: string;
      display_name: string;
      other_id: string;
      photos: unknown;
      last_body: string | null;
      unread: number | string;
    }>(
      `select c.id, c.user_a, c.user_b, c.last_message_at,
              p.user_id as other_id, p.handle, p.display_name, p.photos,
              (select m.body from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_body,
              (select count(*)::int from messages m
                where m.conversation_id = c.id
                  and m.sender_id <> $1
                  and m.read_at is null) as unread
       from conversations c
       join profiles p on p.user_id = case when c.user_a = $1 then c.user_b else c.user_a end
       where c.user_a = $1 or c.user_b = $1
       order by c.last_message_at desc`,
      [context.userId],
    );
    return rows.map((row) => {
      const photos = parseJson<string[]>(row.photos, []);
      return {
        id: Number(row.id),
        other: {
          userId: row.other_id,
          handle: row.handle,
          displayName: row.display_name,
          photo: photos[0] ?? null,
        },
        lastBody: row.last_body,
        lastAt: String(row.last_message_at),
        unread: Number(row.unread) || 0,
      };
    });
  });

export const openConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((otherUserId: string) => otherUserId)
  .handler(async ({ context, data: otherUserId }) => {
    if (otherUserId === context.userId) throw new Error("That's you.");
    const sql = await getSql();
    const existing = await sql.query<{ id: number }>(
      `select id from conversations
       where (user_a = $1 and user_b = $2) or (user_a = $2 and user_b = $1)`,
      [context.userId, otherUserId],
    );
    if (existing[0]) return { id: Number(existing[0].id) };
    const inserted = await sql.query<{ id: number }>(
      `insert into conversations (user_a, user_b) values ($1, $2) returning id`,
      [context.userId, otherUserId],
    );
    return { id: Number(inserted[0]!.id) };
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const conv = await sql.query<{ id: number; user_a: string; user_b: string }>(
      `select id, user_a, user_b from conversations where id = $1`,
      [id],
    );
    const row = conv[0];
    if (!row || (row.user_a !== context.userId && row.user_b !== context.userId)) {
      return null;
    }
    const otherId = row.user_a === context.userId ? row.user_b : row.user_a;
    const other = await sql.query<{
      user_id: string;
      handle: string;
      display_name: string;
      photos: unknown;
    }>(`select user_id, handle, display_name, photos from profiles where user_id = $1`, [
      otherId,
    ]);
    const o = other[0];
    if (!o) return null;
    await sql.query(
      `update messages set read_at = now()
       where conversation_id = $1 and sender_id <> $2 and read_at is null`,
      [id, context.userId],
    );
    const messages = await sql.query<{
      id: number;
      conversation_id: number;
      sender_id: string;
      body: string;
      created_at: string;
    }>(
      `select id, conversation_id, sender_id, body, created_at
       from messages where conversation_id = $1
       order by created_at asc`,
      [id],
    );
    const photos = parseJson<string[]>(o.photos, []);
    return {
      id: Number(row.id),
      other: {
        userId: o.user_id,
        handle: o.handle,
        displayName: o.display_name,
        photo: photos[0] ?? null,
        isSeed: isSeedUser(o.user_id),
      },
      messages: messages.map(
        (m): ChatMessage => ({
          id: Number(m.id),
          conversationId: Number(m.conversation_id),
          senderId: m.sender_id,
          body: m.body,
          createdAt: String(m.created_at),
          mine: m.sender_id === context.userId,
        }),
      ),
    };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { conversationId: number; body: string }) => {
    const body = input.body.trim().slice(0, 1000);
    if (!body) throw new Error("Message is empty.");
    return { conversationId: input.conversationId, body };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const conv = await sql.query<{ id: number; user_a: string; user_b: string }>(
      `select id, user_a, user_b from conversations where id = $1`,
      [data.conversationId],
    );
    const row = conv[0];
    if (!row || (row.user_a !== context.userId && row.user_b !== context.userId)) {
      throw new Error("Conversation not found.");
    }
    const otherId = row.user_a === context.userId ? row.user_b : row.user_a;
    await sql.query(
      `insert into messages (conversation_id, sender_id, body) values ($1, $2, $3)`,
      [data.conversationId, context.userId, data.body],
    );
    await sql.query(`update conversations set last_message_at = now() where id = $1`, [
      data.conversationId,
    ]);
    await sql.query(`update profiles set last_active = now() where user_id = $1`, [
      context.userId,
    ]);

    if (isSeedUser(otherId)) {
      const history = await sql.query<{ sender_id: string; body: string }>(
        `select sender_id, body from messages
         where conversation_id = $1
         order by created_at asc
         limit 24`,
        [data.conversationId],
      );
      const reply = await generateSeedReply({
        seedUserId: otherId,
        history: history.map((m) => ({ senderId: m.sender_id, body: m.body })),
      });
      if (reply) {
        await sql.query(
          `insert into messages (conversation_id, sender_id, body) values ($1, $2, $3)`,
          [data.conversationId, otherId, reply],
        );
        await sql.query(`update conversations set last_message_at = now() where id = $1`, [
          data.conversationId,
        ]);
      }
    }

    return { ok: true };
  });
