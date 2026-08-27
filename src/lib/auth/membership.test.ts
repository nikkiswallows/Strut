import assert from "node:assert/strict";
import { test } from "node:test";
import { pathForMembership, planMembership } from "./membership.ts";

test("stale local session without a server profile does not enter the app", () => {
  assert.equal(
    planMembership({
      sessionPending: false,
      userId: "user-1",
      profilePending: false,
      onboarded: false,
      unauthorized: false,
    }),
    "needs-profile",
  );
  assert.equal(pathForMembership("needs-profile"), "/onboarding");
});

test("dead token is a guest, not a fake member", () => {
  assert.equal(
    planMembership({
      sessionPending: false,
      userId: "user-1",
      profilePending: false,
      onboarded: true,
      unauthorized: true,
    }),
    "guest",
  );
  assert.equal(pathForMembership("guest"), "/login");
});

test("only a server-onboarded profile is a member", () => {
  assert.equal(
    planMembership({
      sessionPending: false,
      userId: "user-1",
      profilePending: false,
      onboarded: true,
      unauthorized: false,
    }),
    "member",
  );
  assert.equal(pathForMembership("member"), "/discover");
});

test("waits for session and profile before routing", () => {
  assert.equal(
    planMembership({
      sessionPending: true,
      userId: null,
      profilePending: false,
      onboarded: false,
      unauthorized: false,
    }),
    "loading",
  );
  assert.equal(
    planMembership({
      sessionPending: false,
      userId: "user-1",
      profilePending: true,
      onboarded: false,
      unauthorized: false,
    }),
    "loading",
  );
});
