import assert from "node:assert/strict";
import { test } from "node:test";
import { planEmailLogin } from "./email-login-plan.ts";

test("new email signs up on join and is unknown on sign-in", () => {
  const none = { exists: false, hasPassword: false, onboarded: false };
  assert.equal(planEmailLogin(true, none), "signup");
  assert.equal(planEmailLogin(false, none), "unknown");
});

test("oauth-only or unfinished accounts attach a password on join", () => {
  assert.equal(
    planEmailLogin(true, { exists: true, hasPassword: false, onboarded: false }),
    "attach",
  );
  assert.equal(
    planEmailLogin(true, { exists: true, hasPassword: true, onboarded: false }),
    "attach",
  );
  assert.equal(
    planEmailLogin(false, { exists: true, hasPassword: false, onboarded: false }),
    "needs-join",
  );
});

test("finished accounts with a password always sign in", () => {
  const done = { exists: true, hasPassword: true, onboarded: true };
  assert.equal(planEmailLogin(true, done), "signin");
  assert.equal(planEmailLogin(false, done), "signin");
});
