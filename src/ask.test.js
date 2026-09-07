import { test } from "node:test";
import assert from "node:assert/strict";

import { QUESTIONS, hashFor, matchQuestion } from "./ask.js";
import { parseHash, SCALE_ORDER } from "./scaleRoute.js";

/**
 * The front door's questions, pinned to the thing that can silently rot: the
 * route they build.
 *
 * IT USED TO PIN A SECOND THING and no longer can. Two questions named an
 * instant — "why do muscles get tired" claimed the SR store is at its emptiest
 * at the second it went to — and this file re-derived both from
 * `public/scenarios/soce_on.json` on every run, so a re-export that moved the
 * trough failed here rather than quietly putting a viewer on a full store under
 * a question about an empty one. Three tests and the `extremumAt` helper that
 * fed them went with the instants on 2026-08-30 (`ask.js`'s header says why the
 * instants went).
 *
 * Nothing here replaces that check, and pretending otherwise would be worse
 * than the gap: the trough is now shown by the fibre scale's guided pass, which
 * is that scale's to test.
 *
 * No browser: everything asserted below is a hash or a token set, and none of
 * it needs a canvas.
 */
const EXERCISE = "bench_press";

test("every question goes somewhere the router can parse", () => {
  for (const question of QUESTIONS) {
    const hash = hashFor(question, EXERCISE);
    const state = parseHash(hash);
    assert.equal(state.exercise, EXERCISE, `${question.id}: ${hash} lost the exercise`);
    assert.equal(state.scale, question.scale, `${question.id}: ${hash} parsed as ${state.scale}`);
    // AND CARRIES NOTHING ELSE. The instants left this file on 2026-08-30 with
    // the `t` in the grammar; a question that put one back would be sending a
    // viewer to a frozen frame with the destination's guided pass switched off,
    // which is what `ask.js`'s header records. Absence test (CLAUDE.md §3).
    assert.ok(!("t" in state), `${question.id}: ${hash} parsed an instant`);
    assert.ok(!hash.includes("@"), `${question.id}: ${hash} names an instant`);
  }
});

test("every destination is a scale this app has", () => {
  for (const question of QUESTIONS) {
    assert.ok(
      SCALE_ORDER.includes(question.scale),
      `${question.id} points at "${question.scale}", which main.jsx has no scene for`,
    );
  }
});

test("a question finds its own destination when it is typed verbatim", () => {
  // The list is what a viewer reads before typing, so the sentence they copy
  // out of it has to be one this matcher answers. A question the printed
  // wording misses is a matcher that only works on the words nobody can see.
  for (const question of QUESTIONS) {
    assert.equal(
      matchQuestion(question.text)?.id,
      question.id,
      `"${question.text}" does not match its own entry`,
    );
  }
});

test("no two questions answer to the same word", () => {
  // `matchQuestion` takes the first entry in order. That is only a tie-break
  // nobody has to think about while the sets are disjoint; the moment two
  // questions share a word, the order becomes a rule a reader has to know.
  const seen = new Map();
  for (const question of QUESTIONS) {
    for (const word of question.keywords) {
      const owner = seen.get(word);
      assert.equal(owner, undefined, `"${word}" belongs to both ${owner} and ${question.id}`);
      seen.set(word, question.id);
    }
  }
});

test("a keyword that is not one token can never match", () => {
  // `matchQuestion` splits the input on non-alphanumerics, so "ca2+" or "get
  // tired" as a keyword is dead weight that looks alive in the source.
  for (const question of QUESTIONS) {
    for (const word of question.keywords) {
      assert.match(word, /^[a-z0-9]+$/, `${question.id}'s "${word}" is not a single lowercase token`);
    }
  }
});

test("what it cannot answer comes back as no answer, not as a destination", () => {
  // The whole reason there is no model behind this. An unmatched line has to
  // reach the caller as nothing at all, so the screen can say it has no answer
  // — a generated one is the answer that gets believed.
  for (const asked of [
    "",
    "   ",
    "what is the meaning of life",
    "how much protein should I eat",
    "can you write my essay",
    "because I can",
    "hello",
  ]) {
    assert.equal(matchQuestion(asked), null, `"${asked}" was answered by something`);
  }
});



