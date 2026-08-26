import { getSql } from "@/lib/db";
import { IDENTITIES, INTERESTS, LOOKING_FOR, PRONOUNS } from "@/lib/types";
import { unique } from "@/lib/utils";

export type TagKind = "identity" | "pronoun" | "interest" | "looking";

const BASE: Record<TagKind, readonly string[]> = {
  identity: IDENTITIES,
  pronoun: PRONOUNS,
  interest: INTERESTS,
  looking: LOOKING_FOR,
};

function cleanKind(kind: string): TagKind {
  if (kind === "identity" || kind === "pronoun" || kind === "interest" || kind === "looking") {
    return kind;
  }
  throw new Error("Unknown tag.");
}

export async function listTagsFor(kindRaw: string) {
  const kind = cleanKind(kindRaw);
  const sql = await getSql();
  const rows = await sql.query<{ label: string }>(
    `select label from catalog_tags where kind = $1 order by created_at asc, label asc`,
    [kind],
  );
  return unique([...BASE[kind], ...rows.map((r) => r.label)]);
}

export async function addTagFor(kindRaw: string, labelRaw: string) {
  const kind = cleanKind(kindRaw);
  const label = labelRaw.trim().replace(/\s+/g, " ").slice(0, 28);
  if (label.length < 2) throw new Error("Give it at least two characters.");
  const sql = await getSql();
  await sql.query(
    `insert into catalog_tags (kind, label) values ($1, $2) on conflict do nothing`,
    [kind, label],
  );
  return label;
}
