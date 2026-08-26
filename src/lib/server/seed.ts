import { coordForLocation } from "@/lib/geo";
import { getSql } from "@/lib/db";
import { SEED_POSTS, SEED_PROFILES, type SeedProfile } from "@/lib/seed-data";
import { unique } from "@/lib/utils";

const SEED_VERSION = 9;

const globalRef = globalThis as typeof globalThis & {
  __strutSeedPromise__?: Promise<void>;
  __strutSeedVersion__?: number;
};

export async function ensureSeed(): Promise<void> {
  if (globalRef.__strutSeedVersion__ !== SEED_VERSION) {
    globalRef.__strutSeedPromise__ = undefined;
    globalRef.__strutSeedVersion__ = SEED_VERSION;
  }
  if (!globalRef.__strutSeedPromise__) {
    globalRef.__strutSeedPromise__ = runSeed().catch((err) => {
      globalRef.__strutSeedPromise__ = undefined;
      throw err;
    });
  }
  await globalRef.__strutSeedPromise__;
}

function canonIdentity(raw: string): string {
  return raw === "Tgirl" ? "T-Girl" : raw;
}

function canonLooking(raw: string): string {
  if (raw === "Dating") return "Dates";
  if (raw === "Nightlife") return "Now";
  return raw;
}

function identitiesOf(p: SeedProfile): string[] {
  if (p.identities?.length) return p.identities;
  return [canonIdentity(p.identity)];
}

function lookingOf(p: SeedProfile): string[] {
  const raw = Array.isArray(p.lookingFor) ? p.lookingFor : [p.lookingFor];
  return unique(raw.map(canonLooking));
}

async function runSeed() {
  const sql = await getSql();

  for (const p of SEED_PROFILES) {
    const identity = canonIdentity(p.identity);
    const lookingFor = lookingOf(p);
    const identities = identitiesOf(p);
    const pronouns = p.pronounList?.length ? p.pronounList : [p.pronouns];
    const coord = coordForLocation(p.location);
    const hideAge = Boolean(p.hideAge);
    const ethnicity = p.ethnicity?.trim() || null;

    await sql`
      insert into profiles (
        user_id, handle, display_name, age, identity, pronouns, bio, location,
        looking_for, looking_for_list, photos, interests, height_cm, is_seed, auto_match, onboarded, last_active,
        identities, pronoun_list, hide_age, lat, lng, role, ethnicity
      ) values (
        ${p.userId}, ${p.handle}, ${p.displayName}, ${p.age}, ${identity}, ${p.pronouns},
        ${p.bio}, ${p.location}, ${lookingFor[0] ?? null}, ${JSON.stringify(lookingFor)}, ${JSON.stringify(p.photos)},
        ${JSON.stringify(p.interests)}, ${p.heightCm}, true, ${p.autoMatch}, true, now(),
        ${JSON.stringify(identities)}, ${JSON.stringify(pronouns)}, ${hideAge},
        ${coord?.lat ?? null}, ${coord?.lng ?? null}, ${p.role}, ${ethnicity}
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
        auto_match = excluded.auto_match,
        identities = excluded.identities,
        pronoun_list = excluded.pronoun_list,
        hide_age = excluded.hide_age,
        lat = excluded.lat,
        lng = excluded.lng,
        role = excluded.role,
        ethnicity = excluded.ethnicity,
        is_seed = true,
        onboarded = true
    `;
  }

  const keep = SEED_PROFILES.map((p) => p.userId);
  await sql.query(
    `delete from likes
     where from_user_id in (select user_id from profiles where is_seed = true and not (user_id = any($1::text[])))
        or to_user_id in (select user_id from profiles where is_seed = true and not (user_id = any($1::text[])))`,
    [keep],
  );
  await sql.query(
    `delete from posts where user_id in (select user_id from profiles where is_seed = true and not (user_id = any($1::text[])))`,
    [keep],
  );
  await sql.query(`delete from profiles where is_seed = true and not (user_id = any($1::text[]))`, [
    keep,
  ]);

  await sql`delete from posts where user_id like 'seed-%'`;
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

  const pairs: Array<[string, string]> = [
    ["seed-aria", "seed-marcus"],
    ["seed-marcus", "seed-aria"],
    ["seed-blair", "seed-marcus"],
    ["seed-marcus", "seed-blair"],
    ["seed-quinn", "seed-devon"],
    ["seed-devon", "seed-quinn"],
    ["seed-iris", "seed-andre"],
    ["seed-wren", "seed-marcus"],
    ["seed-sloane", "seed-marcus"],
    ["seed-tessa", "seed-andre"],
    ["seed-wests", "seed-marcus"],
    ["seed-jesscam", "seed-marcus"],
    ["seed-jules", "seed-devon"],
    ["seed-nico", "seed-andre"],
    ["seed-dana", "seed-cole"],
    ["seed-luna", "seed-mira"],
    ["seed-house", "seed-aria"],
    ["seed-set", "seed-blair"],
    ["seed-blair", "seed-set"],
    ["seed-set", "seed-wren"],
    ["seed-set", "seed-wests"],
    ["seed-sloane", "seed-set"],
    ["seed-todd", "seed-marcus"],
    ["seed-grant", "seed-andre"],
    ["seed-chloe", "seed-malik"],
    ["seed-malik", "seed-chloe"],
    ["seed-malik", "seed-wren"],
  ];
  for (const [from, to] of pairs) {
    await sql`
      insert into likes (from_user_id, to_user_id)
      values (${from}, ${to})
      on conflict do nothing
    `;
  }
}
