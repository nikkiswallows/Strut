import { coordForLocation } from "@/lib/geo";
import { getSql } from "@/lib/db";
import { SEED_POSTS, SEED_PROFILES, type SeedProfile } from "@/lib/seed-data";
import { unique } from "@/lib/utils";

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

    await sql`
      insert into profiles (
        user_id, handle, display_name, age, identity, pronouns, bio, location,
        looking_for, looking_for_list, photos, interests, height_cm, is_seed, auto_match, onboarded, last_active,
        identities, pronoun_list, hide_age, lat, lng, role
      ) values (
        ${p.userId}, ${p.handle}, ${p.displayName}, ${p.age}, ${identity}, ${p.pronouns},
        ${p.bio}, ${p.location}, ${lookingFor[0] ?? null}, ${JSON.stringify(lookingFor)}, ${JSON.stringify(p.photos)},
        ${JSON.stringify(p.interests)}, ${p.heightCm}, true, ${p.autoMatch}, true, now(),
        ${JSON.stringify(identities)}, ${JSON.stringify(pronouns)}, ${hideAge},
        ${coord?.lat ?? null}, ${coord?.lng ?? null}, ${p.role}
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
        is_seed = true,
        onboarded = true
    `;
  }

  const posts = await sql<{ n: number }>`select count(*)::int as n from posts`;
  if ((posts[0]?.n ?? 0) === 0) {
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
  }

  const pairs: Array<[string, string]> = [
    ["seed-aria", "seed-marcus"],
    ["seed-marcus", "seed-aria"],
    ["seed-blair", "seed-devon"],
    ["seed-devon", "seed-blair"],
    ["seed-dana", "seed-pilar"],
    ["seed-pilar", "seed-dana"],
    ["seed-iris", "seed-andre"],
    ["seed-hana", "seed-sloane"],
    ["seed-luna", "seed-mira"],
    ["seed-sage", "seed-quinn"],
    ["seed-eden", "seed-jules"],
    ["seed-wests", "seed-aria"],
    ["seed-tessa", "seed-ellis"],
    ["seed-maya", "seed-remy"],
  ];
  for (const [from, to] of pairs) {
    await sql`
      insert into likes (from_user_id, to_user_id)
      values (${from}, ${to})
      on conflict do nothing
    `;
  }
}
