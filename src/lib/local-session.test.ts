import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearLocalSession,
  readLocalSession,
  writeLocalSession,
} from "./local-session.ts";

test("write then read round-trips a session in memory", () => {
  clearLocalSession();
  writeLocalSession({
    token: "stk_testtokenabcdefghijklmnopqrstuv",
    userId: "user-1",
    name: "Nikki",
    onboarded: true,
  });
  const session = readLocalSession();
  assert.equal(session?.token, "stk_testtokenabcdefghijklmnopqrstuv");
  assert.equal(session?.userId, "user-1");
  assert.equal(session?.name, "Nikki");
  assert.equal(session?.onboarded, true);
  clearLocalSession();
  assert.equal(readLocalSession(), null);
});

test("refuses empty token or user id", () => {
  clearLocalSession();
  writeLocalSession({ token: "   ", userId: "user-1", name: null });
  assert.equal(readLocalSession(), null);
  writeLocalSession({ token: "stk_oktokenabcdefghijklmnopqrstuvwx", userId: "  ", name: null });
  assert.equal(readLocalSession(), null);
});

test("switching accounts does not inherit onboarded or name", () => {
  clearLocalSession();
  writeLocalSession({
    token: "stk_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    userId: "user-1",
    name: "Old",
    onboarded: true,
  });
  writeLocalSession({
    token: "stk_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    userId: "user-2",
    name: null,
  });
  const session = readLocalSession();
  assert.equal(session?.userId, "user-2");
  assert.equal(session?.name, null);
  assert.equal(session?.onboarded, false);
  clearLocalSession();
});
