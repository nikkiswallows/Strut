import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupValues, tokenCandidates, tokensFromRequest } from "./session-tokens.ts";

test("tokenCandidates strips Bearer and keeps signed + unsigned forms", () => {
  assert.deepEqual(tokenCandidates(null), []);
  assert.deepEqual(tokenCandidates("short"), []);
  const token = "stk_abcdefghijklmnopqrstuvwxyz012345";
  assert.deepEqual(tokenCandidates(`Bearer ${token}`), [token]);
  const signed = `${token}.signaturepart`;
  const found = tokenCandidates(signed);
  assert.ok(found.includes(signed));
  assert.ok(found.includes(token));
});

test("tokensFromRequest reads bearer, custom header, body extra, and cookies", () => {
  const token = "stk_abcdefghijklmnopqrstuvwxyz012345";
  const request = new Request("https://strut.app/api/profile", {
    headers: {
      authorization: `Bearer ${token}`,
      "x-strut-session": "stk_fromheaderaaaaaaaaaaaaaaaaaaaa",
      cookie: `strut_at=${token}; other=1`,
    },
  });
  const tokens = tokensFromRequest(request, "stk_frombodybbbbbbbbbbbbbbbbbbbbbb");
  assert.ok(tokens.includes(token));
  assert.ok(tokens.includes("stk_fromheaderaaaaaaaaaaaaaaaaaaaa"));
  assert.ok(tokens.includes("stk_frombodybbbbbbbbbbbbbbbbbbbbbb"));
});

test("anonymous requests produce no tokens", () => {
  const request = new Request("https://strut.app/");
  assert.deepEqual(tokensFromRequest(request), []);
});

test("tokensFromRequest reads sessionToken on the query string", () => {
  const token = "stk_fromquerycccccccccccccccccccc";
  const request = new Request(`https://strut.app/api/media?sessionToken=${token}`);
  assert.ok(tokensFromRequest(request).includes(token));
});

test("lookupValues includes sha256 forms so hashed Better Auth rows still match", async () => {
  const { lookupValues } = await import("./session-tokens.ts");
  const token = "stk_abcdefghijklmnopqrstuvwxyz012345";
  const values = lookupValues([token]);
  assert.ok(values.includes(token));
  assert.equal(values.length, 3);
  assert.ok(values.every((value) => value.length >= 32));
});
