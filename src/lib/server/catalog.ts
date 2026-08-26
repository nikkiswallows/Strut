import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { IDENTITIES, INTERESTS, PRONOUNS } from "@/lib/types";
import { unique } from "@/lib/utils";

export type TagKind = "identity" | "pronoun" | "interest";

const BASE: Record<TagKind, readonly string[]> = {
  identity: IDENTITIES,
  pronoun: PRONOUNS,
  interest: INTERESTS,
};

function cleanKind(kind: string): TagKind {
  if (kind === "identity" || kind === "pronoun" || kind === "interest") return kind;
  throw new Error("Unknown tag.");
}

export const listTags = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((kind: TagKind) => cleanKind(kind))
  .handler(async ({ data: kind }) => {
    const sql = await getSql();
    const rows = await sql.query<{ label: string }>(
      `select label from catalog_tags where kind = $1 order by created_at asc, label asc`,
      [kind],
    );
    return unique([...BASE[kind], ...rows.map((r) => r.label)]);
  });

export const addTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: TagKind; label: string }) => {
    const kind = cleanKind(input.kind);
    const label = input.label.trim().replace(/\s+/g, " ").slice(0, 28);
    if (label.length < 2) throw new Error("Give it at least two characters.");
    return { kind, label };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql.query(
      `insert into catalog_tags (kind, label) values ($1, $2) on conflict do nothing`,
      [data.kind, data.label],
    );
    return data.label;
  });
