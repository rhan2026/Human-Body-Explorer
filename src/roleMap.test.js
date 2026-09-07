import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { allMotions } from "./motion/registry.js";

/**
 * THE LAYER THAT HAD NO GATE.
 *
 * `OPEN_QUESTIONS` item 7 states the problem better than a restatement would:
 * every other layer in this project earned one — the rig has its regression
 * cases, the Francis port has an RHS oracle, the Fowler network has the authors'
 * own stored cells — and the exercise-to-muscle role map has nothing, while
 * being "the most visible possible error — the wrong muscles lighting up".
 *
 * WHAT THIS CANNOT DO, said first so nobody mistakes green for settled. It
 * cannot tell you the curation is CORRECT. Five of the six exercises carry
 * `source: "curated"` and no citation, PRD 8.2 supplies bench press alone, and
 * `evidenceNote` in the manifest says so. Whether the deltoid belongs in a
 * lunge's stabilisers is a question for a reference and a curator, and item 7 is
 * still open for exactly that reason.
 *
 * WHAT IT DOES DO is catch the errors that ARE catchable from the shipped bytes,
 * every one of which would light the wrong muscle without saying anything: a
 * misspelled key that silently matches nothing, a muscle given two roles in one
 * movement, an exercise whose roles reach a muscle the mesh set does not have,
 * an exercise the app can animate but has no roles for, and a role list that has
 * quietly emptied. All five were clean when this was written, which is the point
 * — a gate is written while it is green so that it can go red on somebody.
 */

const MAP = JSON.parse(
  await readFile(new URL("../public/mapping/muscle-map.json", import.meta.url), "utf8"),
);
const ROLES = ["primary", "secondary", "stabilizer"];
const KEYS = new Set(MAP.muscles.map((m) => m.key));
const named = (ex) => new Set(ROLES.flatMap((r) => MAP.exercises[ex][r] ?? []));

test("every muscle a role map names exists in the mesh set", () => {
  // A key that matches nothing does not throw and does not light anything. It
  // reads on screen as "this muscle is not involved", which is a claim.
  for (const [ex, spec] of Object.entries(MAP.exercises)) {
    for (const role of ROLES) {
      for (const key of spec[role] ?? []) {
        assert.ok(
          KEYS.has(key),
          `${ex}.${role} names "${key}", which is not one of the ${KEYS.size} muscles in the mesh set`,
        );
      }
    }
  }
});

test("no muscle carries two roles in one movement", () => {
  // Primary and stabilizer are different colours on the body. A muscle in both
  // lists draws whichever the lookup reaches first, which is list order — an
  // ordering decision nobody made, deciding what a viewer sees.
  for (const ex of Object.keys(MAP.exercises)) {
    const seen = new Map();
    for (const role of ROLES) {
      for (const key of MAP.exercises[ex][role] ?? []) {
        assert.ok(
          !seen.has(key),
          `${ex} lists "${key}" as both ${seen.get(key)} and ${role}; the body can only draw one`,
        );
        seen.set(key, role);
      }
    }
  }
});

test("every movement the app can animate has a role map, and every map is reachable", () => {
  // `registry.js` and the manifest are produced by different pipelines — the
  // motions are hand-authored here, the roles come out of the mesh-set build —
  // so nothing but this makes them agree. An animation with no roles lights
  // nothing; a map no motion reaches is a curation nobody will ever check.
  const motions = new Set(allMotions().map((m) => m.roles));
  const mapped = new Set(Object.keys(MAP.exercises));
  for (const roles of motions) {
    assert.ok(mapped.has(roles), `a motion asks for roles "${roles}" and the manifest has none`);
  }
  for (const ex of mapped) {
    assert.ok(motions.has(ex), `the manifest maps "${ex}" and no motion reaches it`);
  }
});

test("no movement has an empty primary list", () => {
  // The visible failure mode with no error attached: the exercise plays, the
  // body stays inert, and nothing anywhere says the roles were missing.
  for (const [ex, spec] of Object.entries(MAP.exercises)) {
    assert.ok(
      (spec.primary ?? []).length > 0,
      `${ex} has no primary muscles, so choosing it animates a body that lights nothing`,
    );
    assert.ok(named(ex).size >= 3, `${ex} names only ${named(ex).size} muscles in total`);
  }
});

test("every movement says where its roles came from, and the honest ones say curated", () => {
  // The label is not the curation, and this only holds the label. Bench press
  // cites PRD 8.2; the other five say "curated", which is what `evidenceNote`
  // and PRD 14 call the whole layer. A blank source would let an assertion ship
  // wearing nobody's name.
  for (const [ex, spec] of Object.entries(MAP.exercises)) {
    assert.ok(
      typeof spec.source === "string" && spec.source.trim().length > 0,
      `${ex} has no source; a curated role map with no author is an assertion`,
    );
  }
  assert.match(
    MAP.exercises.bench_press.source,
    /PRD section 8\.2/,
    "bench press is the one exercise with a cited source and it has stopped citing it",
  );
  assert.match(MAP.evidenceNote, /Curated/, "the manifest stopped calling this layer Curated");
});
