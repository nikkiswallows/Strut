import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isMigrationFile, migrationName, pendingMigrations } from "./migration-plan.mjs";

// Repo root (two levels up from scripts/) — inlined from the removed
// with-app-env.mjs helper this test used to import.
function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

const AUTH_MIGRATION = "0001_auth.sql";

/**
 * The auth-on copy of the Better Auth schema and its source, or null when the
 * app has not turned sign-in on (the shipped state).
 */
function authSchemaCopy(root) {
  const copy = join(root, "migrations", AUTH_MIGRATION);
  const source = join(root, "migrations/auth", AUTH_MIGRATION);
  if (!existsSync(copy) || !existsSync(source)) return null;
  return { copy: readFileSync(copy, "utf8"), source: readFileSync(source, "utf8") };
}

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/auth/0001_auth.sql"), "0001_auth.sql");
  assert.equal(migrationName("0001_auth.sql"), "0001_auth.sql");
});

test("a file already applied from another directory does not re-apply", () => {
  // The auth-on path copies migrations/auth/0001_auth.sql into the globbed
  // directory; a database that already has it must not run it twice.
  assert.deepEqual(pendingMigrations(["/migrations/0001_auth.sql"], ["0001_auth.sql"]), []);
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("non-.sql entries are dropped (readdir also yields the auth/ directory)", () => {
  assert.equal(isMigrationFile("auth"), false);
  assert.deepEqual(pendingMigrations(["auth", "README.md"], []), []);
});

test("the auth schema ships outside the globbed directory", () => {
  const migrationsDir = join(projectRoot(), "migrations");
  const readdir = readdirSync(migrationsDir);

  // The `auth/` directory is never picked up as a migration file (drop non-.sql).
  assert.ok(readdir.includes("auth"), "migrations/auth/ must exist");
  assert.equal(isMigrationFile("auth"), false);

  // Auth-off template (shipped state): the globbed dir has no .sql yet, so
  // nothing is pending and the auth source is the only copy, outside the glob.
  if (!readdir.includes(AUTH_MIGRATION)) {
    assert.deepEqual(pendingMigrations(readdir, []), []);
    assert.ok(readdirSync(join(migrationsDir, "auth")).includes(AUTH_MIGRATION));
    return;
  }

  // Auth-on: 0001_auth.sql is copied up so it applies by basename, and is then
  // among the (unapplied) migrations. The auth/ source still exists and stays
  // out of the glob; byte-identity of the copy is asserted separately.
  const pending = pendingMigrations(readdir, []);
  assert.ok(
    pending.some((m) => m.name === AUTH_MIGRATION),
    "the copied-up auth schema must be listed as a pending migration when unapplied",
  );
  assert.ok(readdirSync(join(migrationsDir, "auth")).includes(AUTH_MIGRATION));
});

test("this workspace's auth schema copy is byte-identical to its source", () => {
  // An edited copy diverges silently: basename keying skips it on a database
  // that already ran the original, and applies it on a fresh PGLite preview.
  const pair = authSchemaCopy(projectRoot());
  if (pair === null) return; // sign-in off — nothing has been copied up
  assert.equal(
    pair.copy,
    pair.source,
    "migrations/0001_auth.sql has been edited — it must stay a verbatim copy of migrations/auth/0001_auth.sql",
  );
});

test("the copy check reads both files and catches an edit", () => {
  const root = mkdtempSync(join(tmpdir(), "auth-schema-"));
  mkdirSync(join(root, "migrations/auth"), { recursive: true });
  writeFileSync(join(root, "migrations/auth", AUTH_MIGRATION), "create table t ();\n");
  assert.equal(authSchemaCopy(root), null);

  writeFileSync(join(root, "migrations", AUTH_MIGRATION), "create table t ();\n");
  const same = authSchemaCopy(root);
  assert.equal(same.copy, same.source);

  writeFileSync(join(root, "migrations", AUTH_MIGRATION), "create table t (x int);\n");
  const drifted = authSchemaCopy(root);
  assert.notEqual(drifted.copy, drifted.source);
});
