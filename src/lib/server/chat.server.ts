import { getSql } from "@/lib/db";
import type { ChatMessage, ConversationPreview } from "@/lib/types";
import { parseJson } from "@/lib/utils";
import {
  cannedReply,
  getSeed,
  hordeMessagesFor,
  hordeResultToReply,
  isFreaky,
  isSeedUser,
  tryFastReply,
  type ChatViewer,
} from "./bot";
import { hordeCheck, hordeSubmit } from "./horde.server";
import { ensureSeed } from "./seed";

type BotJobRow = {
  id: number;
  conversation_id: number;
  seed_user_id: string;
  horde_id: string | null;
  status: string;
  result_body: string | null;
  error: string | null;
  created_at: string;
};

export async function listChats(userId: string): Promise<ConversationPreview[]> {
  await ensureSeed();
  const sql = await getSql();
  const rows = await sql.query<{
    id: number;
    last_message_at: string;
    handle: string;
    display_name: string;
    other_id: string;
    photos: unknown;
    last_body: string | null;
    unread: number | string;
  }>(
    `select c.id, c.last_message_at,
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
    [userId],
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
}

export async function openChat(userId: string, otherUserId: string): Promise<{ id: number }> {
  if (otherUserId === userId) throw new Error("That's you.");
  const sql = await getSql();
  const existing = await sql.query<{ id: number }>(
    `select id from conversations
     where (user_a = $1 and user_b = $2) or (user_a = $2 and user_b = $1)`,
    [userId, otherUserId],
  );
  if (existing[0]) return { id: Number(existing[0].id) };
  const inserted = await sql.query<{ id: number }>(
    `insert into conversations (user_a, user_b) values ($1, $2) returning id`,
    [userId, otherUserId],
  );
  return { id: Number(inserted[0]!.id) };
}

export async function getChat(userId: string, id: number) {
  const sql = await getSql();
  const conv = await sql.query<{ id: number; user_a: string; user_b: string }>(
    `select id, user_a, user_b from conversations where id = $1`,
    [id],
  );
  const row = conv[0];
  if (!row || (row.user_a !== userId && row.user_b !== userId)) return null;
  const otherId = row.user_a === userId ? row.user_b : row.user_a;
  const other = await sql.query<{
    user_id: string;
    handle: string;
    display_name: string;
    photos: unknown;
  }>(`select user_id, handle, display_name, photos from profiles where user_id = $1`, [otherId]);
  const o = other[0];
  if (!o) return null;
  await sql.query(
    `update messages set read_at = now()
     where conversation_id = $1 and sender_id <> $2 and read_at is null`,
    [id, userId],
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
        mine: m.sender_id === userId,
      }),
    ),
  };
}

export async function sendChat(userId: string, conversationId: number, body: string) {
  const text = body.trim().slice(0, 1000);
  if (!text) throw new Error("Message is empty.");
  const sql = await getSql();
  const conv = await sql.query<{ id: number; user_a: string; user_b: string }>(
    `select id, user_a, user_b from conversations where id = $1`,
    [conversationId],
  );
  const row = conv[0];
  if (!row || (row.user_a !== userId && row.user_b !== userId)) {
    throw new Error("Conversation not found.");
  }
  const otherId = row.user_a === userId ? row.user_b : row.user_a;
  await sql.query(
    `insert into messages (conversation_id, sender_id, body) values ($1, $2, $3)`,
    [conversationId, userId, text],
  );
  await sql.query(`update conversations set last_message_at = now() where id = $1`, [conversationId]);
  await sql.query(`update profiles set last_active = now() where user_id = $1`, [userId]);
  return { ok: true as const, otherId, seed: isSeedUser(otherId) };
}

// ---- Bot reply context -----------------------------------------------------

async function loadBotContext(
  userId: string,
  conversationId: number,
): Promise<{ seedId: string; viewer: ChatViewer | null; history: { senderId: string; body: string }[] } | null> {
  const sql = await getSql();
  const conv = await sql.query<{ user_a: string; user_b: string }>(
    `select user_a, user_b from conversations where id = $1`,
    [conversationId],
  );
  const row = conv[0];
  if (!row || (row.user_a !== userId && row.user_b !== userId)) return null;
  const seedId = row.user_a === userId ? row.user_b : row.user_a;
  if (!isSeedUser(seedId)) return null;

  const historyRows = await sql.query<{ sender_id: string; body: string }>(
    `select sender_id, body from messages
     where conversation_id = $1
     order by created_at asc
     limit 24`,
    [conversationId],
  );
  const last = historyRows.at(-1);
  // Only reply when the last message is from the human (avoid double replies).
  if (!last || last.sender_id === seedId) return null;
  const history = historyRows.map((m) => ({ senderId: m.sender_id, body: m.body }));

  const me = await sql.query<{
    display_name: string;
    identities: unknown;
    role: string | null;
    location: string | null;
    looking_for_list: unknown;
  }>(
    `select display_name, identities, role, location, looking_for_list
     from profiles where user_id = $1`,
    [userId],
  );
  const mine = me[0];
  const viewer: ChatViewer | null = mine
    ? {
        displayName: mine.display_name,
        identities: parseJson<string[]>(mine.identities, []),
        role: mine.role,
        location: mine.location,
        lookingFor: parseJson<string[]>(mine.looking_for_list, []),
      }
    : null;

  return { seedId, viewer, history };
}

async function insertBotMessage(conversationId: number, seedId: string, body: string): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into messages (conversation_id, sender_id, body) values ($1, $2, $3)`,
    [conversationId, seedId, body],
  );
  await sql.query(`update conversations set last_message_at = now() where id = $1`, [conversationId]);
}

/**
 * Kick off a seed reply. Strategy:
 *   1. Try the fast hosted providers inline (a few seconds). If they answer,
 *      insert the message and return it immediately.
 *   2. If they refuse/fail (common for explicit chat on free mainstream models),
 *      hand the job to AI Horde's free UNCENSORED models via an async job row.
 *      We submit the queued job and return "pending"; the client polls
 *      /api/messages/bot-status and the reply lands when a worker finishes
 *      (feels like the match is typing).
 */
export async function replyAsSeed(
  userId: string,
  conversationId: number,
): Promise<{ status: "replied"; body: string } | { status: "pending" } | { status: "noop" }> {
  const ctx = await loadBotContext(userId, conversationId);
  if (!ctx) return { status: "noop" };
  const { seedId, viewer, history } = ctx;
  const prior = history.filter((m) => m.senderId === seedId).map((m) => m.body);

  // Already a pending job for this conversation? Don't stack duplicates.
  const sql = await getSql();
  const existing = await sql.query<{ id: number }>(
    `select id from bot_jobs where conversation_id = $1 and status = 'pending' limit 1`,
    [conversationId],
  );
  if (existing[0]) return { status: "pending" };

  // 1) Fast path.
  const fast = await tryFastReply({ seedUserId: seedId, history, viewer });
  if (fast) {
    await insertBotMessage(conversationId, seedId, fast);
    return { status: "replied", body: fast };
  }

  // 2) Slow/uncensored path: submit to AI Horde, record the job.
  const messages = hordeMessagesFor({ seedUserId: seedId, history, viewer });
  const freaky = isFreaky(history);
  let hordeId: string | null = null;
  if (messages) {
    const sub = await hordeSubmit(messages, { maxLength: freaky ? 260 : 180 });
    if ("hordeId" in sub) hordeId = sub.hordeId;
    else console.error("[bot] horde submit failed:", sub.error);
  }
  await sql.query(
    `insert into bot_jobs (conversation_id, seed_user_id, horde_id, status)
     values ($1, $2, $3, 'pending')`,
    [conversationId, seedId, hordeId],
  );
  return { status: "pending" };
}

/**
 * Advance any pending bot job for this conversation. Called by the polling
 * endpoint (and opportunistically when the thread loads). Inserts the reply
 * message when ready; returns whether a (possibly new) reply is now available.
 */
export async function pumpBotJob(
  userId: string,
  conversationId: number,
): Promise<{ pending: boolean; replied: boolean; queuePosition?: number }> {
  const sql = await getSql();
  // Authorize + find the seed.
  const conv = await sql.query<{ user_a: string; user_b: string }>(
    `select user_a, user_b from conversations where id = $1`,
    [conversationId],
  );
  const row = conv[0];
  if (!row || (row.user_a !== userId && row.user_b !== userId)) return { pending: false, replied: false };
  const seedId = row.user_a === userId ? row.user_b : row.user_a;
  if (!isSeedUser(seedId)) return { pending: false, replied: false };

  const jobs = await sql.query<BotJobRow>(
    `select * from bot_jobs where conversation_id = $1 and status = 'pending'
     order by created_at desc limit 1`,
    [conversationId],
  );
  const job = jobs[0];
  if (!job) return { pending: false, replied: false };

  const finish = async (body: string) => {
    // Guard: don't double-insert if a reply already landed after this job began.
    const lastRows = await sql.query<{ sender_id: string; created_at: string }>(
      `select sender_id, created_at from messages where conversation_id = $1
       order by created_at desc limit 1`,
      [conversationId],
    );
    const lastMsg = lastRows[0];
    if (lastMsg && lastMsg.sender_id === seedId && new Date(lastMsg.created_at) >= new Date(job.created_at)) {
      await sql.query(`update bot_jobs set status = 'cancelled', updated_at = now() where id = $1`, [job.id]);
      return false;
    }
    await insertBotMessage(conversationId, seedId, body);
    await sql.query(
      `update bot_jobs set status = 'done', result_body = $2, updated_at = now() where id = $1`,
      [job.id, body],
    );
    return true;
  };

  const failWithCanned = async (err: string) => {
    console.error("[bot] job", job.id, "failed:", err);
    const hist = await sql.query<{ sender_id: string; body: string }>(
      `select sender_id, body from messages where conversation_id = $1 order by created_at asc limit 24`,
      [conversationId],
    );
    const history = hist.map((m) => ({ senderId: m.sender_id, body: m.body }));
    const seed = getSeed(seedId);
    const prior = history.filter((m) => m.senderId === seedId).map((m) => m.body);
    const body = seed ? cannedReply(seed, prior, isFreaky(history)) : "hey… you there?";
    const inserted = await finish(body);
    // finish() marks the job done on insert; record the underlying error so the
    // diagnostics trail shows why we fell back (only when nothing was inserted).
    if (!inserted) {
      await sql.query(`update bot_jobs set status = 'error', error = $2, updated_at = now() where id = $1`, [
        job.id,
        err.slice(0, 300),
      ]);
    }
  };

  // Job was created but Horde submission had failed (no horde id): retry submit
  // once; if it still fails, give a canned line so the chat never hangs.
  if (!job.horde_id) {
    const ctx = await loadBotContext(userId, conversationId);
    if (ctx) {
      const messages = hordeMessagesFor({
        seedUserId: ctx.seedId,
        history: ctx.history,
        viewer: ctx.viewer,
      });
      if (messages) {
        const sub = await hordeSubmit(messages, { maxLength: isFreaky(ctx.history) ? 260 : 180 });
        if ("hordeId" in sub) {
          await sql.query(`update bot_jobs set horde_id = $2, updated_at = now() where id = $1`, [
            job.id,
            sub.hordeId,
          ]);
          return { pending: true, replied: false };
        }
      }
    }
    await failWithCanned("horde unavailable");
    return { pending: false, replied: true };
  }

  const status = await hordeCheck(job.horde_id);
  if ("failed" in status) {
    await failWithCanned(status.error);
    return { pending: false, replied: true };
  }
  if (!status.done) {
    // Expire very old jobs (e.g. worker vanished) so the user isn't stuck.
    const ageMs = Date.now() - new Date(job.created_at).getTime();
    if (ageMs > 6 * 60 * 1000) {
      await failWithCanned("horde timeout");
      return { pending: false, replied: true };
    }
    return { pending: true, replied: false, queuePosition: status.queuePosition };
  }

  // Done — convert generation to a reply.
  const histRows = await sql.query<{ sender_id: string; body: string }>(
    `select sender_id, body from messages where conversation_id = $1 order by created_at asc limit 24`,
    [conversationId],
  );
  const history = histRows.map((m) => ({ senderId: m.sender_id, body: m.body }));
  const prior = history.filter((m) => m.senderId === seedId).map((m) => m.body);
  const reply = hordeResultToReply(seedId, prior, status.text);
  const seed = getSeed(seedId);
  const body = reply ?? (seed ? cannedReply(seed, prior, isFreaky(history)) : status.text);
  const inserted = await finish(body);
  return { pending: false, replied: inserted };
}
