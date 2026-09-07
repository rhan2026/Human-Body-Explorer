import assert from "node:assert/strict";
import test from "node:test";
import { SOURCES } from "../sources/manifest.js";
import { readFile } from "node:fs/promises";

import { bodyWalk, walkFrom, watchLine } from "./firstWalk.js";

/**
 * THE WALK HAD NO GATE UNTIL IT STARTED SAYING NUMBERS, AND NOW IT HAS ONE FOR A
 * DIFFERENT REASON.
 *
 * The numbers are gone — the rewrite of 2026-09-05 took every sentence that
 * counted something, along with every sentence that defined a term before the
 * visitor had seen the thing it named. What replaced them is a walk whose beats
 * DRIVE THE PICTURE, and that is the property this file now exists to hold.
 *
 * The old failure was a sentence going stale against a manifest nobody in `src/`
 * controls. The new one is quieter and worse: a beat whose `show` nobody reads,
 * or a `show` key the scene silently ignores. Either leaves a beat that talks
 * over an unchanging picture, which is the exact defect the rewrite removed and
 * the one that is invisible in a screenshot of any single frame.
 *
 * WHAT IT STILL CANNOT DO, said first: it cannot tell you the curation is
 * CORRECT. `roleMap.test.js` wrote that down and OPEN_QUESTIONS item 7 is open
 * for it.
 */

const SRC = new URL("../", import.meta.url);
const MAP = JSON.parse(await readFile(new URL("../../public/mapping/muscle-map.json", import.meta.url), "utf8"));
/** The scene the walk stands on, read once — several tests below quote it. */
const SCENE = await readFile(new URL("MotionScene.jsx", SRC), "utf8");
const NAMED = MAP.muscles.length;
const ROLES = ["primary", "secondary", "stabilizer"];

/* The duration only sets how long the "watch one cycle" beat holds, and every
   movement's real one is inside the clamp, so a fixture is honest here and
   keeps three.js out of a node test. */
const movementFor = (ex) => ({ id: ex, category: MAP.exercises[ex].category, duration: 4 });
const walkFor = (ex) => bodyWalk(MAP.exercises[ex], movementFor(ex));
const beatIn = (walk, id) => walk.find((b) => b.id === id)?.line ?? "";
const numbersIn = (line) => [...String(line ?? "").matchAll(/\d+/g)].map((m) => Number(m[0]));

/* ── THE SHAPE OF THE WALK ────────────────────────────────────────────────── */

test("the six beats and the silence survive, in order, for every movement", () => {
  /* The walk's spine. Two of these — the two that stake themselves on a
     difference BETWEEN roles — are conditional on the movement actually having
     more than one weight filled, which is asserted separately below; all six
     movements fill all three today. */
  const wanted = ["arrive", "watch", "many", "rule", "movers", "holders", "pick"];
  for (const ex of Object.keys(MAP.exercises)) {
    const ids = walkFor(ex).map((b) => b.id);
    assert.deepEqual(ids, wanted, `${ex}'s walk is ${ids.join(", ")}`);
  }
});

test("every beat stands beside an anchor MotionScene can resolve", () => {
  /* The exact failure `useWalk` documents: an anchor nobody resolves is a beat
     that either never plays or plays at the last beat's coordinates. Read off
     `resolveAnchor` rather than restated, so a renamed anchor turns this red
     instead of quietly costing a sentence. */
  const known = new Set([...SCENE.matchAll(/anchor === "([a-z]+)"/g)].map((m) => m[1]));
  assert.ok(known.size >= 2, `resolveAnchor now handles only ${[...known].join(", ")}`);
  for (const ex of Object.keys(MAP.exercises)) {
    for (const beat of walkFor(ex)) {
      assert.ok(
        known.has(beat.anchor),
        `"${beat.id}" stands beside "${beat.anchor}", which resolveAnchor does not resolve`,
      );
    }
  }
});

/* ── THE ONE THIS FILE EXISTS FOR ─────────────────────────────────────────── */

test("every beat changes the picture", () => {
  /* THE WHOLE POINT OF THE REWRITE. The walk this replaced had sixteen beats and
     eleven of them altered nothing on screen — a visitor read eleven sentences
     against one unmoving image and had to take each on trust. On a floor whose
     lesson is "a muscle can be working hard while barely moving", a claim the
     picture does not demonstrate is a claim nobody has any reason to believe.
     A beat with no `show`, or a `show` with nothing in it, is that defect
     returning. */
  for (const ex of Object.keys(MAP.exercises)) {
    for (const beat of walkFor(ex)) {
      assert.ok(beat.show, `${ex}'s "${beat.id}" beat has no show — it would talk over a still picture`);
      assert.ok(
        Object.keys(beat.show).length > 0,
        `${ex}'s "${beat.id}" beat carries an empty show`,
      );
    }
  }
});

test("every show key the walk uses is one the scene actually acts on", () => {
  /* The silent half of the same defect. A beat can carry `show: { seek: "peak" }`
     and change nothing at all if the consumer never reads `seek` — and nothing
     would go red, because the beat looks driven right up until you watch it.
     So the keys are checked against the code that consumes them rather than
     against a list kept here, which would be a second place to forget. */
  const consumer = SCENE.slice(SCENE.indexOf("const show = walk.show;"));
  const used = new Set();
  for (const ex of Object.keys(MAP.exercises)) {
    for (const beat of walkFor(ex)) for (const k of Object.keys(beat.show ?? {})) used.add(k);
  }
  for (const key of used) {
    assert.match(
      consumer,
      new RegExp(`show\\.${key}\\b`),
      `beats ask for "${key}" and MotionScene's directive effect never reads it`,
    );
  }
});

test("the movement is named in its own words on the first line", () => {
  /* A guide that opens by mis-naming what you are watching has spent its
     credibility on beat one. Read off the registry's own `category` so a seventh
     movement inherits an answer rather than needing a branch. */
  assert.equal(watchLine("bench_press", "resistance"), "Watch **one rep**.");
  assert.equal(watchLine("running", "endurance"), "Watch **one stride**.");
  assert.equal(watchLine("swimming_freestyle", "endurance"), "Watch **one stroke cycle**.");
  for (const ex of Object.keys(MAP.exercises)) {
    const line = beatIn(walkFor(ex), "watch");
    assert.match(line.replace(/\*\*/g, ""), /^Watch one /, `${ex} does not open by naming one cycle of itself: "${line}"`);
  }
});

/* ── THE LADDER ───────────────────────────────────────────────────────────── */

test("a visitor who has already picked is not told to pick", () => {
  const roles = MAP.exercises.push_up;
  const ids = (state) => walkFrom({ ...state, roles, movement: movementFor("push_up") }).map((b) => b.id);
  assert.ok(ids({}).includes("pick"), "a visitor who has picked nothing is no longer invited to");
  assert.ok(!ids({ picked: true }).includes("pick"), "somebody who pressed a muscle is still told to press one");
});

/* ── WHAT THE WALK MUST NOT SAY ───────────────────────────────────────────── */

test("no sentence puts a figure in front of a first-time visitor", () => {
  /* Owner, 2026-09-04: *"숫자는 필요가 없어 … 그냥 이해를 돕는거야"*. The picture
     already says how many: they are lit. A digit inside a name is not a figure. */
  const FIGURE = /(?<![A-Za-z-])\d/;
  for (const ex of Object.keys(MAP.exercises)) {
    for (const beat of walkFor(ex)) {
      assert.doesNotMatch(String(beat.line ?? ""), FIGURE, `${ex}'s "${beat.id}" carries a figure: "${beat.line}"`);
    }
  }
});

test("the walk does not define the three role words before the visitor has met one", () => {
  /* AN ABSENCE TEST, and it pins a decision rather than a defect. The walk used
     to spend three beats defining Primary, Secondary and Stabilizer, in bold, on
     first use — which was the right shape while those words were the lesson.
     They are not: a definition read before the picture means anything is a
     vocabulary test, and the same fact costs one sentence and no memory once
     somebody has watched it happen. The words now arrive on the SELECTION CARD,
     at the moment a muscle has been pressed and the visitor wants them.
     This goes red if they creep back into the narration. */
  for (const ex of Object.keys(MAP.exercises)) {
    const said = walkFor(ex).map((b) => b.line ?? "").join(" ");
    for (const term of ["Primary", "Secondary", "Stabilizer", "Stabilizers"]) {
      assert.ok(
        !said.includes(term),
        `${ex}'s walk defines "${term}" up front again; that belongs to the card now`,
      );
    }
    /* The two words the floor is built to avoid needing. They are still the
       phase data's own vocabulary, which is fine — the walk is what must not
       require them. */
    assert.doesNotMatch(said, /eccentric|concentric/i, `${ex}'s walk asks a first-year visitor for lifting jargon`);
  }
  /* And the card is where they went. Checked against the scene rather than
     assumed, because "moved" and "deleted" look identical from in here. */
  assert.match(SCENE, /ROLE_WORD = \{ primary: "Primary"/, "the card stopped naming the roles it inherited");
});

test("the walk states no count, and the roster it no longer quotes is still a superset", () => {
  /* THE COUNT BEATS ARE GONE and this is the absence test for them. The second
     half still guards the manifest: every movement must name fewer muscles than
     the roster holds, because the moment one names all of them the phrase "some
     of them" stops being true of the picture the walk describes. */
  for (const ex of Object.keys(MAP.exercises)) {
    for (const beat of walkFor(ex)) {
      assert.equal(numbersIn(beat.line).length, 0, `"${beat.id}" says a number: ${beat.line}`);
    }
    const named = new Set(ROLES.flatMap((r) => MAP.exercises[ex][r] ?? []));
    assert.ok(named.size < NAMED, `${ex} names all ${NAMED} muscles, so "some of them" says nothing`);
  }
  assert.equal(NAMED, MAP.counts.namedMuscles, "the roster array and the manifest's own count disagree");
});

/* ── THE PICTURE THE SENTENCES DESCRIBE ───────────────────────────────────── */

test("three weights is three weights, and brightest really is primary", () => {
  /* The walk says the brightest muscles drive the movement and that others are
     holding you still. Both are claims about `ROLE_DRIVE` and `ROLE_OPACITY`,
     which live in the scene and have been repainted more than once. */
  const drive = Object.fromEntries(
    SCENE.match(/const ROLE_DRIVE = \{([^}]*)\}/)[1]
      .split(",")
      .map((pair) => pair.split(":").map((s) => s.trim()))
      .filter(([k]) => k)
      .map(([k, v]) => [k, Number(v)]),
  );
  assert.deepEqual(Object.keys(drive).sort(), ROLES.slice().sort(), "the scene no longer drives these three roles");
  assert.ok(
    drive.primary > drive.secondary && drive.secondary > drive.stabilizer,
    `ROLE_DRIVE is ${JSON.stringify(drive)}; the walk says brightest, middle, faintest in that order`,
  );
  assert.equal(new Set(Object.values(drive)).size, 3, "two roles now draw at the same weight, so there are not three");

  /* AND THE SECOND CHANNEL, which is what makes the ordering survive the
     palette. The sixteen group hues carry no lightness discipline, so opacity
     alone let a yellow stabiliser out-shout a coral prime mover; the wash toward
     the paper is what makes the three roles monotonic across all of them. If
     either ladder loses its order the picture stops matching the sentence. */
  const read = (name) =>
    Object.fromEntries(
      SCENE.match(new RegExp(`const ${name} = \\{([^}]*)\\}`))[1]
        .split(",")
        .map((pair) => pair.split(":").map((s) => s.trim()))
        .filter(([k]) => k)
        .map(([k, v]) => [k, Number(v)]),
    );
  const opacity = read("ROLE_OPACITY");
  const wash = read("ROLE_WASH");
  /* THREE ROLES ARE ONE LADDER; UNINVOLVED IS NOT ON IT — 2026-09-06.
     This asked for a single four-step fall through `ROLE_OPACITY`, and it went
     red when the BODY lane raised `none` from below the stabiliser to 0.72 to
     fix *"일부러 숨기면 너무 해골같아서"*. That looked like a regression and was
     not: read `MotionScene`'s own application and the two cases are drawn
     DIFFERENTLY, not just at different weights. An involved muscle washes toward
     PAPER; an uninvolved one washes toward `UNINVOLVED`, bone-white, and the
     comment there says why — at a full wash toward paper the muscle would BE the
     background and disappear, which is the thing the lane was fixing.
     So this case was grading a four-step ladder that the scene stopped having.
     What it grades now is what the walk actually claims: among the three roles
     that are DOING something, presence falls and contrast falls, in that order,
     in both channels. And uninvolved is quieter than any of them — carried by
     the wash, which is the channel that survives the palette — while staying
     visible, which is the whole of the lane's fix.
     THE ARGUMENT THAT DID NOT SURVIVE is the old note's "contrast must fall in
     the same order presence does". It cannot, because the two ladders no longer
     share an endpoint. */
  const involved = ["primary", "secondary", "stabilizer"];
  assert.ok(
    opacity.primary > opacity.secondary && opacity.secondary > opacity.stabilizer,
    `ROLE_OPACITY is ${JSON.stringify(opacity)}; presence must fall primary → secondary → stabilizer`,
  );
  assert.ok(
    wash.primary < wash.secondary && wash.secondary < wash.stabilizer,
    `ROLE_WASH is ${JSON.stringify(wash)}; contrast must fall in the order presence does`,
  );
  assert.ok(
    involved.every((role) => wash.none > wash[role]),
    `ROLE_WASH is ${JSON.stringify(wash)}; uninvolved muscle must recede further than any muscle that is working`,
  );
  assert.ok(opacity.none > 0, "uninvolved muscle went to nothing; it is meant to be quiet, not absent");
  /* AND IT IS NOT DRAWN AGAINST THE SAME GROUND, which is the fact that makes
     the ladders separate. If this ever lerps toward the paper the four-step
     ordering above becomes right again and this case is wrong. */
  assert.match(
    SCENE,
    /mat\.color\.lerp\(involved \? PAPER : UNINVOLVED, wash\)/,
    "uninvolved muscle is washed toward the same colour as the involved ones now; if so, presence " +
      "and contrast share an endpoint again and this case should go back to grading one ladder",
  );
});

test("the discovery beat still contradicts the expectation the picture builds", () => {
  /* The floor's one lesson, and the sentence that carries it. The wording has
     changed twice; what is pinned is that the beat names BOTH halves — the
     muscles that make the movement and the muscles that stop movement — because
     a version that names only one is a description instead of a correction. */
  for (const ex of Object.keys(MAP.exercises)) {
    const line = beatIn(walkFor(ex), "holders");
    assert.match(line, /create the movement/i, `${ex}'s discovery beat lost the half that moves you: "${line}"`);
    assert.match(line, /from moving/i, `${ex}'s discovery beat lost the half that holds you still: "${line}"`);
  }
});

test("the discovery beat slows the movement down, because that is the whole demonstration", () => {
  /* "Working but not moving" cannot be read at full speed on a body that is
     already moving. The slow-down is not decoration; it is the evidence. */
  for (const ex of Object.keys(MAP.exercises)) {
    const beat = walkFor(ex).find((b) => b.id === "holders");
    assert.ok(beat.show.speed < 1, `${ex}'s discovery beat runs at ${beat.show.speed}, too fast to see a still muscle lit`);
    assert.ok(
      beat.show.emphasis.stabilizer > beat.show.emphasis.primary,
      `${ex}'s discovery beat does not lift the stabilisers above the movers`,
    );
  }
});

test("a movement with one filled weight is not told it has several", () => {
  /* `roleMap.test.js` only guarantees `primary`, so an emptied curation must not
     leave the two comparison beats making a comparison against nothing. */
  const one = bodyWalk({ primary: ["a"], secondary: [], stabilizer: [] }, movementFor("push_up"));
  assert.ok(!one.some((b) => b.id === "holders"), "a movement with one weight still gets the discovery beat");
  assert.ok(!one.some((b) => b.id === "movers"), "a movement with one weight still gets the isolation beat");
  assert.ok(one.some((b) => b.id === "watch"), "a movement with one weight lost the beats that still apply");
});

test("no map at all — the walk still watches, and still says nothing it cannot support", () => {
  const bare = bodyWalk();
  assert.deepEqual(bare.map((b) => b.id), ["arrive", "watch", "many", "rule", "pick"]);
  for (const beat of bare) {
    assert.equal(numbersIn(beat.line).length, 0, `"${beat.id}" says a number with no map behind it: ${beat.line}`);
    assert.ok(beat.show, `"${beat.id}" lost its show on the no-map path`);
  }
});

/* ── AND WHOSE MAPPING IT IS ──────────────────────────────────────────────── */

test("the role mapping is still declared this project's own, where a visitor can reach it", () => {
  /* §5's floor: our arithmetic is not put in an author's mouth. `evidenceNote`
     calls this layer Curated and not measured, and the walk stopped being the
     place a visitor is told on 2026-09-02 — `sources/manifest.js` is, and says
     it harder. Both halves are asked here because between them they are the only
     thing standing between a curated list and an app that reports a body. */
  assert.match(MAP.evidenceNote, /Curated/, "the manifest stopped calling this layer Curated");
  assert.match(MAP.evidenceNote, /not measured/, "the manifest stopped saying these roles are not measured");
  const entries = Object.values(SOURCES).flat();
  assert.ok(entries.length >= 6, `SOURCES flattened to ${entries.length} entries — the shape changed under this test`);
  const sourced = entries.map((s) => `${s.of ?? ""} ${s.note ?? ""}`).join(" ");
  assert.match(sourced, /curated mapping/, "no source entry says the muscle mapping is ours");
  assert.match(
    sourced,
    /no published source stands behind it/,
    "the mapping's source entry stopped saying nothing published stands behind it",
  );
});

test("the card reports the map rather than a measurement", () => {
  /* The role words moved to the card, and the sentence beside them is a template
     with the movement's own noun in it — precisely so that it says exactly as
     much as a curated list supports. A per-muscle claim written here would be
     invented content wearing a finding's clothes. */
  assert.match(SCENE, /roleSentence\(role, motionId\)/, "the card stopped generating its sentence from the role");
  /* BOUNDED TO THE FUNCTION. Slicing to end-of-file matched twenty-three
     instances of "measured" in the rest of the scene's comments — none of them
     role-sentence prose — so the gate was red on a claim about text the
     function does not contain. The invariant is about what `roleSentence`
     returns: a curated map reported as a curated map, never as a measurement. */
  const from = SCENE.indexOf("function roleSentence");
  const body = SCENE.slice(from, SCENE.indexOf("\n}", from));
  assert.ok(body.length > 100 && body.length < 1200, `roleSentence body did not bound cleanly (${body.length} chars)`);
  assert.doesNotMatch(
    body,
    /measured|shown to|proven|EMG/i,
    "the card's role sentences started claiming a measurement",
  );
});
