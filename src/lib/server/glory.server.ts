import { getSql } from "@/lib/db";
import { isKing, isKneeler, isCuck, isWife } from "@/lib/bnwo";
import {
  ACHIEVEMENTS,
  audienceApplies,
  evaluateAchievement,
  nextRank,
  rankFor,
} from "@/lib/achievements";
import { assertNotBlocked } from "@/lib/server/safety";
import type { GloryBoard, GloryStats, LockSession, Profile, ServeClaim } from "@/lib/types";

type ProfileRowLite = {
  user_id: string;
  identities: unknown;
  interests: unknown;
  onboarded: boolean | number | string;
};

function normIds(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.toLowerCase());
  if (typeof v === "string" && v.trim()) return [v.toLowerCase()];
  return [];
}

async function getMyProfile(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql.query<ProfileRowLite>(
    `select user_id, identities, interests, onboarded from profiles where user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

const HOUR = 3600 * 1000;

async function getLocks(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const rows = await sql.query<{
    id: number;
    started_at: string;
    released_at: string | null;
    pledge_hours: number | null;
    completed: boolean | number | string;
    note: string | null;
  }>(
    `select id, started_at, released_at, pledge_hours, completed, note
       from lock_sessions where user_id = $1 order by started_at desc limit 50`,
    [userId],
  );
  const now = Date.now();
  return rows.map((r) => {
    const started = new Date(r.started_at).getTime();
    const released = r.released_at ? new Date(r.released_at).getTime() : null;
    const end = released ?? now;
    const elapsedMs = Math.max(0, end - started);
    const elapsedHours = Math.round((elapsedMs / HOUR) * 10) / 10;
    const open = !released;
    const pledgeHours = r.pledge_hours ?? null;
    const pledgeProgress = open
      ? pledgeHours
        ? Math.max(0, Math.min(1, elapsedMs / (pledgeHours * HOUR)))
        : 0
      : r.completed === true || r.completed === 1 || r.completed === "t"
        ? 1
        : 0;
    return {
      id: Number(r.id),
      startedAt: r.started_at,
      releasedAt: r.released_at,
      pledgeHours,
      completed: r.completed === true || r.completed === 1 || r.completed === "t",
      note: r.note,
      elapsedHours,
      pledgeProgress,
      open,
    } satisfies LockSession;
  });
}

/** Compute all glory stats for a user from live tables. */
export async function gloryFor(userId: string): Promise<GloryBoard> {
  const sql = await getSql();
  const me = await getMyProfile(sql, userId);
  const identities = normIds(me?.identities);
  const interests = normIds(me?.interests);

  const flags = {
    isKing: isKing(identities),
    isKneeler: isKneeler(identities),
    isWife: isWife(identities),
    isCuck: isCuck(identities),
    intoChastity:
      isKneeler(identities) ||
      isCuck(identities) ||
      interests.includes("chastity") ||
      interests.includes("locked") ||
      interests.includes("sissy training"),
  };

  // Count helpers.
  const scalar = async (text: string, params: unknown[] = []) => {
    const rows = await sql.query<{ n: number | string | bigint }>(text, params);
    return Number(rows[0]?.n ?? 0);
  };

  // Matches: likes I sent that are reciprocated.
  const matches = await scalar(
    `select count(*)::int n from likes a
       where a.from_user_id = $1 and exists
       (select 1 from likes b where b.from_user_id = a.to_user_id and b.to_user_id = $1)`,
    [userId],
  );
  const posts = await scalar(`select count(*)::int n from posts where user_id = $1`, [userId]);
  const chats = await scalar(
    `select count(*)::int n from conversations where user_a = $1 or user_b = $1`,
    [userId],
  );
  const likesSent = await scalar(`select count(*)::int n from likes where from_user_id = $1`, [userId]);
  const likesReceived = await scalar(`select count(*)::int n from likes where to_user_id = $1`, [userId]);
  const wearsSpade = interests.some((i) => ["bnwo", "qos", "bbc"].includes(i)) ? 1 : 0;

  // Matches with a bull (king). Compute the set of my match partners who are bulls.
  const bullMatches = await sql.query<{ uid: string }>(
    `select distinct a.to_user_id uid
       from likes a
       join profiles k on k.user_id = a.to_user_id
      where a.from_user_id = $1
        and exists (select 1 from likes b where b.from_user_id = a.to_user_id and b.to_user_id = $1)
        and exists (
          select 1 from jsonb_array_elements_text(coalesce(k.identities,'[]'::jsonb)) as v(ident)
          where lower(v.ident) = 'bull'
        )`,
    [userId],
  );
  const kingMatches = bullMatches.length;

  // Conversations with kings (the other party is a bull).
  const kingChatRows = await sql.query<{ n: number | string | bigint }>(
    `select count(*)::int n from conversations c
       join profiles k on k.user_id = case when c.user_a = $1 then c.user_b else c.user_a end
      where (c.user_a = $1 or c.user_b = $1)
        and exists (
          select 1 from jsonb_array_elements_text(coalesce(k.identities,'[]'::jsonb)) as v(ident)
          where lower(v.ident) = 'bull'
        )`,
    [userId],
  );
  const kingChats = Number(kingChatRows[0]?.n ?? 0);

  // Conversations a king has with kneelers.
  const kneelerChats = await scalar(
    `select count(*)::int n from conversations c
       join profiles k on k.user_id = case when c.user_a = $1 then c.user_b else c.user_a end
      where (c.user_a = $1 or c.user_b = $1)
        and exists (
          select 1 from jsonb_array_elements_text(coalesce(k.identities,'[]'::jsonb)) as v(ident)
          where lower(v.ident) in ('sissy','faggot','fag','whiteboi','crossdresser','femboy')
        )`,
    [userId],
  );

  // Serves — only bull-approved rows score; pending is display-only.
  const servesApproved = await scalar(
    `select count(*)::int n from serves where kneeler_id = $1 and status = 'approved'`,
    [userId],
  );
  const servesPending = await scalar(
    `select count(*)::int n from serves where kneeler_id = $1 and status = 'pending'`,
    [userId],
  );

  // Claims waiting on the viewer's word (bulls only).
  let serveApprovals: ServeClaim[] = [];
  if (flags.isKing) {
    const rows = await sql.query<{
      id: number;
      kneeler_id: string;
      created_at: string;
      handle: string;
      display_name: string;
      photos: unknown;
    }>(
      `select s.id, s.kneeler_id, s.created_at, p.handle, p.display_name, p.photos
         from serves s
         join profiles p on p.user_id = s.kneeler_id
        where s.bull_id = $1 and s.status = 'pending'
        order by s.created_at desc
        limit 20`,
      [userId],
    );
    serveApprovals = rows.map((r) => {
      let photos: string[] = [];
      if (Array.isArray(r.photos)) photos = r.photos.map(String);
      else if (typeof r.photos === "string") {
        try {
          const parsed = JSON.parse(r.photos) as unknown;
          if (Array.isArray(parsed)) photos = parsed.map(String);
        } catch {
          photos = [];
        }
      }
      return {
        id: Number(r.id),
        kneeler: {
          userId: r.kneeler_id,
          handle: r.handle,
          displayName: r.display_name,
          photo: photos[0] ?? null,
        },
        createdAt: r.created_at,
      };
    });
  }

  // Locks.
  const locks = await getLocks(sql, userId);
  const locksCompleted = locks.filter((l) => l.completed).length;
  const lockedHours = Math.round(locks.reduce((sum, l) => sum + l.elapsedHours, 0) * 10) / 10;
  const currentLock = locks.find((l) => l.open) ?? null;
  const currentLockHours = currentLock?.elapsedHours ?? 0;

  const stats: GloryStats = {
    onboarded: me?.onboarded === true || me?.onboarded === 1 || me?.onboarded === "t" ? 1 : 0,
    matches,
    posts,
    chats,
    likesSent,
    likesReceived,
    wearsSpade,
    kingMatches,
    kneelerKingMatches: kingMatches,
    wifeKingMatches: kingMatches,
    kingKneelerChats: kneelerChats,
    kneelerKingChats: kingChats,
    wifeKingChats: kingChats,
    servesApproved,
    servesPending,
    locksCompleted,
    lockedHours,
    currentLockHours,
  };

  // Evaluate only the orders this member's role can earn.
  const earned: string[] = [];
  let points = 0;
  for (const def of ACHIEVEMENTS) {
    if (!audienceApplies(def.audience, flags)) continue;
    const state = evaluateAchievement(def, stats);
    if (state.earnedTier >= 0) earned.push(def.id);
    points += state.points;
  }

  const rank = rankFor(points);
  const next = nextRank(points);

  return {
    stats,
    flags,
    points,
    rankName: rank.name,
    rankIcon: rank.icon,
    nextRankName: next?.name ?? null,
    nextRankAt: next?.min ?? null,
    earnedIds: earned,
    currentLock,
    locks,
    serveApprovals,
  };
}

/**
 * A kneeler claims they served a bull. The claim is pending until the bull
 * rules on it — nothing self-reported ever scores.
 */
export async function claimServeFor(
  userId: string,
  bullId: string,
): Promise<{ ok: true; pending: true }> {
  if (!bullId || bullId === userId) throw new Error("Point at the king you served.");
  const sql = await getSql();
  const me = await getMyProfile(sql, userId);
  if (!me || !isKneeler(normIds(me.identities))) {
    throw new Error("Serve claims are for sissies, faggots, whitebois, CDs and femboys.");
  }
  const target = await getMyProfile(sql, bullId);
  if (!target || !isKing(normIds(target.identities))) {
    throw new Error("That member is not a bull. Serves only count for kings.");
  }
  await assertNotBlocked(userId, bullId);
  const pending = await sql.query<{ id: number }>(
    `select id from serves where kneeler_id = $1 and bull_id = $2 and status = 'pending' limit 1`,
    [userId, bullId],
  );
  if (pending[0]) throw new Error("Already claimed. Wait for his word.");
  await sql.query(`insert into serves (kneeler_id, bull_id) values ($1, $2)`, [userId, bullId]);
  return { ok: true, pending: true };
}

/** The bull rules on a pending serve claim addressed to him. */
export async function decideServeFor(
  userId: string,
  serveId: number,
  approve: boolean,
): Promise<{ ok: true; approved: boolean }> {
  if (!Number.isFinite(serveId) || serveId <= 0) throw new Error("Bad claim.");
  const sql = await getSql();
  const rows = await sql.query<{ id: number }>(
    `update serves set status = $3, decided_at = now()
      where id = $1 and bull_id = $2 and status = 'pending'
      returning id`,
    [serveId, userId, approve ? "approved" : "denied"],
  );
  if (!rows[0]) throw new Error("No pending claim to rule on.");
  return { ok: true, approved: approve };
}

/** Start a chastity lock. Fails if one is already open. */
export async function startLockFor(
  userId: string,
  input: { pledgeHours?: number | null; note?: string | null },
): Promise<{ ok: true; lock: LockSession }> {
  const sql = await getSql();
  const open = await sql.query<{ id: number }>(
    `select id from lock_sessions where user_id = $1 and released_at is null limit 1`,
    [userId],
  );
  if (open[0]) throw new Error("You're already locked. Serve it out or release first.");
  const pledge =
    input.pledgeHours && Number.isFinite(input.pledgeHours) && input.pledgeHours > 0
      ? Math.min(24 * 365, Math.round(input.pledgeHours))
      : null;
  const note = input.note?.trim().slice(0, 200) || null;
  const rows = await sql.query<{ id: number }>(
    `insert into lock_sessions (user_id, pledge_hours, note) values ($1, $2, $3) returning id`,
    [userId, pledge, note],
  );
  const locks = await getLocks(sql, userId);
  const lock = locks.find((l) => l.id === Number(rows[0]!.id)) ?? locks[0]!;
  return { ok: true, lock };
}

/** Release the current lock; marks completed if the pledge has been served. */
export async function releaseLockFor(userId: string): Promise<{ ok: true; lock: LockSession | null }> {
  const sql = await getSql();
  const open = await sql.query<{
    id: number;
    started_at: string;
    pledge_hours: number | null;
  }>(
    `select id, started_at, pledge_hours from lock_sessions where user_id = $1 and released_at is null limit 1`,
    [userId],
  );
  if (!open[0]) return { ok: true, lock: null };
  const row = open[0];
  const elapsedH = (Date.now() - new Date(row.started_at).getTime()) / HOUR;
  const completed = row.pledge_hours ? elapsedH >= row.pledge_hours : false;
  await sql.query(
    `update lock_sessions set released_at = now(), completed = $2 where id = $1`,
    [row.id, completed],
  );
  const locks = await getLocks(sql, userId);
  return { ok: true, lock: locks.find((l) => l.id === row.id) ?? null };
}

// Re-export for callers that only want the profile type surface.
export type { Profile };
