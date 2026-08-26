import { getSql } from "@/lib/db";
import { SEED_POSTS, SEED_PROFILES } from "@/lib/seed-data";

const globalRef = globalThis as typeof globalThis & {
  __strutSeedPromise__?: Promise<void>;
};

export async function ensureSeed(): Promise<void> {
  if (!globalRef.__strutSeedPromise__) {
    globalRef.__strutSeedPromise__ = runSeed().catch((err) => {
      globalRef.__strutSeedPromise__ = undefined;
      throw err;
    });
  }
  await globalRef.__strutSeedPromise__;
}

async function runSeed() {
  const sql = await getSql();
  const existing = await sql<{ n: number }>`select count(*)::int as n from profiles where is_seed = true`;
  if ((existing[0]?.n ?? 0) > 0) return;

  for (const p of SEED_PROFILES) {
    await sql`
      insert into profiles (
        user_id, handle, display_name, age, identity, pronouns, bio, location,
        looking_for, photos, interests, height_cm, is_seed, auto_match, onboarded, last_active
      ) values (
        ${p.userId}, ${p.handle}, ${p.displayName}, ${p.age}, ${p.identity}, ${p.pronouns},
        ${p.bio}, ${p.location}, ${p.lookingFor}, ${JSON.stringify(p.photos)},
        ${JSON.stringify(p.interests)}, ${p.heightCm}, true, ${p.autoMatch}, true, now()
      )
      on conflict (user_id) do nothing
    `;
  }

  for (const post of SEED_POSTS) {
    await sql`
      insert into posts (user_id, body, photo_url, created_at)
      values (
        ${post.userId},
        ${post.body},
        ${post.photoUrl ?? null},
        now() - (${post.hoursAgo} || ' hours')::interval
      )
    `;
  }

  // A little social graph so the grid already feels alive.
  const pairs: Array<[string, string]> = [
    ["seed-aria", "seed-blair"],
    ["seed-blair", "seed-aria"],
    ["seed-dana", "seed-pilar"],
    ["seed-pilar", "seed-dana"],
    ["seed-faye", "seed-remy"],
    ["seed-hana", "seed-iris"],
    ["seed-luna", "seed-mira"],
    ["seed-sage", "seed-quinn"],
    ["seed-eden", "seed-jules"],
  ];
  for (const [from, to] of pairs) {
    await sql`
      insert into likes (from_user_id, to_user_id)
      values (${from}, ${to})
      on conflict do nothing
    `;
  }
}
