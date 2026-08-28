import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coerceDraft,
  jsonCandidates,
  parseDraft,
  selfSegment,
  stripThinking,
} from "./seed-persona.ts";

/**
 * Regression tests for the seed-profile parser and the persona rules.
 *
 * Every case here is a real failure observed against live AI Horde output while
 * building the admin console — not a hypothetical.
 */

test("selfSegment cuts the persona before what the member WANTS", () => {
  assert.equal(
    selfSegment("white sissy bottom, 27, San Diego, obedient, wants a Black bull to own her").trim(),
    "white sissy bottom, 27, San Diego, obedient,",
  );
  // No desire marker: the whole thing describes the member.
  assert.equal(selfSegment("Black bull, 29, Atlanta"), "Black bull, 29, Atlanta");
});

test("a sissy who wants a bull is a Sissy Bottom, not a Bull", () => {
  const d = coerceDraft(
    {},
    "white sissy bottom, 27, San Diego, gym twink, obedient, wants a Black bull to own her",
  );
  assert.equal(d.role, "Bottom");
  assert.ok(d.identities.includes("Sissy"), `got ${d.identities.join(",")}`);
  assert.ok(!d.identities.includes("Bull"), "Bull is what she wants, not what she is");
  assert.equal(d.ethnicity, "White");
});

test("a bull who collects sissies is a Bull Top", () => {
  const d = coerceDraft({}, "Black bull, 34, Houston, calm and commanding, collects sissies");
  assert.equal(d.role, "Top");
  assert.deepEqual(d.identities, ["Bull"]);
  assert.equal(d.ethnicity, "Black");
  assert.deepEqual(d.pronouns, ["he/him"]);
});

test("an explicit role word overrides a contradicting model answer", () => {
  const d = coerceDraft({ role: "Top", identities: ["Bull"] }, "white sissy bottom, 32");
  assert.equal(d.role, "Bottom");
  assert.ok(!d.identities.includes("Bull"));
});

test("out-of-vocabulary model values are dropped, not passed through", () => {
  const d = coerceDraft(
    { identities: ["Alpha Male", "Sissy"], role: "dominant", interests: ["Golf"], age: 12 },
    "sissy, 30",
  );
  assert.deepEqual(d.identities, ["Sissy"]);
  assert.ok(["Top", "Bottom", "Switch", "Side"].includes(d.role));
  assert.ok(!d.interests.includes("Golf"));
  assert.ok(d.age >= 18, "age is clamped to adult");
});

test("age is clamped and defaults sanely", () => {
  assert.equal(coerceDraft({ age: 9 }, "sissy").age, 18);
  assert.equal(coerceDraft({ age: 900 }, "sissy").age, 65);
  assert.equal(coerceDraft({ age: "not a number" }, "sissy").age, 30);
});

test("height is read out of the bio when the model leaves the field null", () => {
  const d = coerceDraft({ heightCm: null, bio: 'Petite 5\'6" frame.' }, "sissy, 32");
  assert.equal(d.heightCm, 168);
});

test("lowercase display names are title-cased", () => {
  assert.equal(coerceDraft({ displayName: "janine" }, "sissy").displayName, "Janine");
});

test("jsonCandidates recovers a reply truncated mid-key", () => {
  const truncated =
    '{ "handle": "nathanbull69", "displayName": "Dominant Dynamo", "age": 34, ' +
    '"identities": ["Bull"], "role": "Top", "ethnicity": "Black", ' +
    '"location": "Houston, TX", "heightCm": 183, "lookingFor": ["Dates"], "interes';
  const parsed = jsonCandidates(truncated)
    .map((c) => {
      try {
        return JSON.parse(c) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .find(Boolean);
  assert.ok(parsed, "no candidate parsed");
  assert.equal(parsed!.handle, "nathanbull69");
  assert.equal(parsed!.location, "Houston, TX");
});

test("jsonCandidates recovers a reply truncated mid-string and mid-array", () => {
  const midString = '{"handle":"x","age":34,"bio":"I am a bio that got cut off right he';
  const midArray = '{"handle":"x","interests":["Fitness","BNW';
  for (const raw of [midString, midArray]) {
    const ok = jsonCandidates(raw).some((c) => {
      try {
        JSON.parse(c);
        return true;
      } catch {
        return false;
      }
    });
    assert.ok(ok, `nothing recovered from: ${raw}`);
  }
});

test("stripThinking removes a reasoning model's monologue", () => {
  assert.equal(stripThinking('<think>hmm, let me see</think>{"a":1}'), '{"a":1}');
  // Unterminated block (truncation) with JSON after it.
  assert.equal(stripThinking('<think>hmm{"a":1}'), '{"a":1}');
  // Unterminated block with nothing after it: nothing usable remains.
  assert.equal(stripThinking("<think>hmm, let me see"), "");
});

test("parseDraft handles the prefilled opening brace", () => {
  // The assistant turn is prefilled with `{`, so the reply starts inside it.
  const reply = '"handle":"bigmike","displayName":"Big Mike","age":31,"identities":["Bull"]}';
  const out = parseDraft(reply, "Black bull, 31, Atlanta");
  assert.ok(out);
  assert.equal(out!.fromProse, false);
  assert.equal(out!.draft.handle, "bigmike");
  assert.equal(out!.draft.role, "Top");
});

test("parseDraft falls back to prose instead of dead-ending the job", () => {
  const prose =
    "He is a towering presence in any room, thirty-four years old, and he has never " +
    "once had to raise his voice to be obeyed. Weeknights he is at the gym.";
  const out = parseDraft(prose, "Black bull, 34, Houston");
  assert.ok(out);
  assert.equal(out!.fromProse, true);
  assert.ok(out!.draft.bio.length > 40);
  assert.equal(out!.draft.role, "Top");
  assert.equal(out!.draft.location, "Los Angeles, CA");
});
