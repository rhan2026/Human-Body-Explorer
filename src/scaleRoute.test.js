import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { hashForScale, parseHash, serializeHash, SCALE_LABEL, SCALE_ORDER, trailSteps } from "./scaleRoute.js";
import { allMotions } from "./motion/registry.js";

/**
 * A slug and an instant from the grammar this file used to pin, kept here on
 * purpose: they are what the OLD addresses are made of, and the parser still
 * has to land them. Nothing serializes them any more.
 */
const OLD_SLUG = "abdominal-part-of-left-pectoralis-major";

test("the explorer and a bare exercise", () => {
  assert.deepEqual(parseHash(""), { exercise: null, scale: "body" });
  assert.deepEqual(parseHash("#"), { exercise: null, scale: "body" });
  assert.deepEqual(parseHash("#push_up"), { exercise: "push_up", scale: "body" });
  // Aliases resolve through the registry, which is why `#pushup` needs no entry
  // of its own — the LEGACY map that used to hold it is gone.
  assert.deepEqual(parseHash("#pushup"), { exercise: "push_up", scale: "body" });
  assert.equal(parseHash("#bench").exercise, "bench_press");
});

test("two segments, and the second is the scale", () => {
  for (const scale of SCALE_ORDER) {
    assert.deepEqual(parseHash(`#bench_press/${scale}`), { exercise: "bench_press", scale });
  }
  // A scale with no exercise stays legal: it is the retired dev page's state,
  // and a state the serializer can spell is a state parse has to accept back.
  assert.deepEqual(parseHash("#/fiber"), { exercise: null, scale: "fiber" });
});

/* ---- what is NOT in the hash -------------------------------------------
 *
 * 2026-08-30. The address carried an instant and a muscle slug for weeks and
 * neither was ever read back: `resolveMeshName` had no caller outside this
 * file, `main.jsx` never mentions `muscle`, and the three deep scales say in
 * their own comments that the muscle selects nothing — CellScale.jsx:447 ("the
 * exercise, the muscle and the instant were parsed, round-tripped, unit tested
 * and dropped on the floor"), SignallingScale.jsx:576, DevFiberScene.jsx:11.
 * The instant was worse than unread: `arrivedFromInside()` exists ONLY to
 * ignore the `@t` the app itself wrote, and crossing.js:66 records what that
 * cost — the fibre's 25.8 s guided pass "was unreachable by anyone using the
 * app".
 *
 * These are absence tests (CLAUDE.md §3). What we decided not to build is
 * pinned, not left to be re-derived by the next person holding a URL.
 */

test("no address the app makes carries an instant", () => {
  const emitted = [];
  for (const definition of allMotions()) {
    for (const scale of SCALE_ORDER) emitted.push(serializeHash({ exercise: definition.id, scale }));
  }
  emitted.push(serializeHash({}), serializeHash({ exercise: null, scale: "fiber" }));
  for (const hash of emitted) {
    assert.ok(!hash.includes("@"), `${hash} carries an instant`);
    assert.equal(hash, encodeURI(hash), `${hash} needs percent-encoding`);
  }
});

test("a t handed to the serializer is dropped, not spelled", () => {
  const plain = serializeHash({ exercise: "bench_press", scale: "fiber" });
  for (const t of [0, 1.4, 6.11, 1800, "5.2"]) {
    assert.equal(serializeHash({ exercise: "bench_press", scale: "fiber", t }), plain, `t=${t}`);
  }
});

test("a muscle handed to the serializer is dropped, not spelled", () => {
  const plain = serializeHash({ exercise: "bench_press", scale: "cell" });
  for (const muscle of [OLD_SLUG, "left-digastric-2", ""]) {
    assert.equal(serializeHash({ exercise: "bench_press", scale: "cell", muscle }), plain, muscle);
  }
});

test("parse invents neither key", () => {
  for (const hash of ["#", "#bench_press", "#bench_press/fiber", `#motion/bench_press/${OLD_SLUG}/fiber@1.4s`]) {
    const parsed = parseHash(hash);
    assert.deepEqual(Object.keys(parsed).sort(), ["exercise", "scale"], hash);
  }
});

/* ---- old addresses still land ------------------------------------------
 *
 * TOLERANT PARSER, STRICT SERIALIZER. Every screenshot, doc and shared link in
 * this repository spells the old grammar, and a URL somebody kept is the one
 * kind of address we do not control. So the two halves are deliberately NOT
 * inverses any more: parse accepts the `motion/` prefix, a muscle slug and an
 * `@t` and throws all three away; serialize emits only what is left.
 */

test("an old link keeps its exercise and its scale", () => {
  const cases = [
    ["#motion/bench_press", { exercise: "bench_press", scale: "body" }],
    [`#motion/bench_press/${OLD_SLUG}`, { exercise: "bench_press", scale: "body" }],
    [`#motion/bench_press/${OLD_SLUG}/fiber@1.4s`, { exercise: "bench_press", scale: "fiber" }],
    ["#motion/bench_press/fiber@0.1s", { exercise: "bench_press", scale: "fiber" }],
    [`#motion/push_up/${OLD_SLUG}/cell@6.11s`, { exercise: "push_up", scale: "cell" }],
    [`#motion/bench_press/${OLD_SLUG}/signalling@1800s`, { exercise: "bench_press", scale: "signalling" }],
    ["#motion/bench_press/body@2.25s", { exercise: "bench_press", scale: "body" }],
    ["#motion//cell", { exercise: null, scale: "cell" }],
    [`#motion//${OLD_SLUG}`, { exercise: null, scale: "body" }],
    // The retired dev page, whose LEGACY entry is gone. "dev" is not a
    // registered exercise and "muscle-fiber" is not a scale — but an unknown
    // exercise is CARRIED, never silently dropped (the rule `#deadlift` is here
    // for), so this lands as an unknown exercise on the body. `main.jsx` then
    // rewrites it to push_up and says so in the address bar, which is the same
    // path any typo takes. An old bookmark loses its scale, not its footing.
    ["#dev/muscle-fiber", { exercise: "dev", scale: "body" }],
  ];
  for (const [hash, want] of cases) assert.deepEqual(parseHash(hash), want, hash);
});

test("an old link normalises on the way back out", () => {
  assert.equal(serializeHash(parseHash(`#motion/bench_press/${OLD_SLUG}/fiber@1.4s`)), "#bench_press/fiber");
  assert.equal(serializeHash(parseHash("#motion/push_up")), "#push_up");
  // Not "#": an unknown exercise survives serialization so main.jsx can see it
  // and correct it. Dropping it here would make the correction silent, which is
  // the snap CLAUDE.md §5 forbids.
  assert.equal(serializeHash(parseHash("#dev/muscle-fiber")), "#dev");
});

test("serialize is the inverse of parse for everything serialize emits", () => {
  const states = [
    { exercise: null, scale: "body" },
    { exercise: "push_up", scale: "body" },
    { exercise: "deadlift", scale: "body" }, // unknown: carried, never silently dropped
    { exercise: "bench_press", scale: "fiber" },
    { exercise: "push_up", scale: "cell" },
    { exercise: "bench_press", scale: "signalling" },
    { exercise: null, scale: "fiber" },
  ];
  for (const s of states) assert.deepEqual(parseHash(serializeHash(s)), s, JSON.stringify(s));
  assert.equal(serializeHash(states[0]), "#");
  assert.equal(serializeHash(states[3]), "#bench_press/fiber");
  assert.equal(serializeHash(states[6]), "#/fiber");
  // Every registered exercise, so an alias that fails to round-trip to its own
  // canonical id cannot hide behind the ids spelled out above.
  for (const definition of allMotions()) {
    for (const scale of SCALE_ORDER) {
      const s = { exercise: definition.id, scale };
      assert.deepEqual(parseHash(serializeHash(s)), s, JSON.stringify(s));
    }
  }
});

test("the set of scales is closed, both ways", () => {
  assert.deepEqual(SCALE_ORDER, ["body", "fiber", "cell", "signalling"]);
  assert.throws(() => serializeHash({ exercise: "push_up", scale: "signaling" }), /unknown scale: signaling/);
  assert.throws(() => serializeHash({ exercise: "push_up", scale: "organelle" }), /unknown scale: organelle/);
  // On the way in, a near-miss is not absorbed as a fifth scale — it is ignored,
  // and the address falls back to the body rather than drawing something nobody
  // asked for.
  assert.deepEqual(parseHash("#push_up/signaling"), { exercise: "push_up", scale: "body" });
  assert.deepEqual(parseHash("#push_up/organelle"), { exercise: "push_up", scale: "body" });
});

test("level is not in the hash", () => {
  // Design §3: the three fibre levels are not a continuous descent, so putting
  // them in the URL would imply a relationship fiberGeometry.js:15-18 denies.
  const state = { exercise: "bench_press", scale: "fiber" };
  assert.equal(serializeHash({ ...state, level: "fascicle" }), serializeHash(state));
  assert.deepEqual(parseHash("#bench_press/fiber/fascicle"), state);
});

test("garbage never throws", () => {
  assert.equal(parseHash("#motion/").exercise, null);
  assert.equal(parseHash("#nonsense").scale, "body");
  assert.equal(parseHash("#bench_press/fiber@abc").scale, "fiber");
  assert.deepEqual(parseHash(undefined), { exercise: null, scale: "body" });
  assert.deepEqual(parseHash(null), { exercise: null, scale: "body" });
  assert.equal(serializeHash({}), "#");
  assert.equal(serializeHash({ exercise: "push_up" }), "#push_up");
});

/**
 * The one thing hashForScale knows that serializeHash does not — which, since
 * the instant left the grammar, is nothing.
 *
 * IT IS KEPT ANYWAY, and the reason is not sentiment: it is the single door
 * every way-down and way-up control in the app goes through (`ScaleTrail.jsx`,
 * `director/ride.js`, `DevFiberScene.jsx`), so the day a scale change needs to
 * carry or drop something again, it is one edit rather than three. The
 * signalling cut it used to guard is gone with the number it guarded.
 */
test("moving between scales keeps the exercise and changes only the scale", () => {
  const at = { exercise: "bench_press", scale: "fiber" };
  assert.equal(hashForScale(at, "cell"), "#bench_press/cell");
  assert.equal(hashForScale(at, "signalling"), "#bench_press/signalling");
  assert.equal(hashForScale({ ...at, scale: "signalling" }, "body"), "#bench_press");
});

test("every scale is reachable from every other, and lands parsed", () => {
  const from = { exercise: "bench_press", scale: "body" };
  for (const a of SCALE_ORDER) {
    for (const b of SCALE_ORDER) {
      const parsed = parseHash(hashForScale({ ...from, scale: a }, b));
      assert.equal(parsed.scale, b, `${a} -> ${b}`);
      assert.equal(parsed.exercise, "bench_press", `${a} -> ${b} keeps the exercise`);
    }
  }
});

/* ---- the footer chain ---------------------------------------------------
 *
 * Until 2026-08-17 three footers each held the fixed text "BODY", "MUSCLE",
 * "FIBER", "CELL" joined by arrows. Two things were wrong with it and only one
 * was the word MUSCLE: the chain was identical on every screen, so it said
 * nothing about where the viewer was, and it was typed out four times, so the
 * cell scale had shipped for days before the chain gained the word and a fourth
 * scale would have to be typed into every footer again. These tests pin the
 * chain to the closed set of scales this file already owns.
 */

/** Every file that can draw, read from disk — the chain must be in none of them as text. */
function jsxSources() {
  const dir = new URL(".", import.meta.url);
  return readdirSync(dir, { recursive: true })
    .filter((name) => name.endsWith(".jsx"))
    .map((name) => [name, readFileSync(new URL(name, dir), "utf8")]);
}

test("the trail is the closed set of scales, in descent order", () => {
  assert.deepEqual(SCALE_ORDER.slice(0, 3), ["body", "fiber", "cell"]);
  assert.deepEqual(
    trailSteps("fiber").map((s) => s.scale),
    SCALE_ORDER,
    "a scale added to SCALE_ORDER must appear in the footer with no other edit",
  );
  /* AGAINST `SCALE_LABEL`, NOT AGAINST THE IDS UPPER-CASED — 2026-09-05.
     This read `SCALE_ORDER.map((s) => s.toUpperCase())`, which is the exact
     derivation `trailSteps` was carrying and which had to go: an id that spells
     its own label works right up until the label and the id stop being the same
     word. That day arrived — `cell` is ENERGY on screen and `signalling` is
     SIGNALS, because `docs/20260905-fix/cell.md` argues a muscle fibre IS a
     cell and "Cell" as a deeper level was teaching something false.
     So the gate asserted the defect. What it should hold, and now does, is that
     the trail takes its words from the one table every other control takes them
     from — a fifth spelling anywhere is what this is for. */
  assert.deepEqual(
    trailSteps("fiber").map((s) => s.label),
    SCALE_ORDER.map((s) => SCALE_LABEL[s]),
    "the trail must read its words from SCALE_LABEL, which is the only place a floor's user-facing name is written",
  );
});

test("exactly one step is where the viewer is, and only for a scale we draw", () => {
  for (const scale of SCALE_ORDER) {
    assert.deepEqual(
      trailSteps(scale).filter((s) => s.here).map((s) => s.scale),
      [scale],
      scale,
    );
  }
  // The explorer is not a scale, and neither is a hash we cannot draw. Marking
  // nothing is the honest answer; marking the first step would be a guess.
  for (const nothing of [null, undefined, "", "muscle", "organelle"]) {
    const steps = trailSteps(nothing);
    assert.equal(steps.length, SCALE_ORDER.length, `${nothing}: the whole chain still draws`);
    assert.deepEqual(steps.filter((s) => s.here), [], String(nothing));
  }
});

test("MUSCLE is not a step, and no scene draws the chain as fixed text", () => {
  assert.ok(!SCALE_ORDER.includes("muscle"), "a muscle is not a scale, and is no longer a selection either");
  const files = jsxSources();
  assert.ok(files.length > 5, "the scenes must be readable, or this test proves nothing");
  /* COMMENTS ARE NOT DRAWN, AND THIS CASE IS ABOUT DRAWING — 2026-09-05.
     The name says "no scene DRAWS the chain as fixed text" and the match ran
     over raw source, so a banner over the handoff block —
     `/* ── BODY → FIBER HANDOFF ──` — failed it. That comment is the most
     accurate thing in the file about what the block does; the rule it tripped
     is about a chain reaching a pixel without passing through `SCALE_ORDER`,
     and a comment reaches none.
     STRIPPED RATHER THAN THE ARROW BANNED. Telling a lane to rename a true
     comment to satisfy a text search is the gate governing the wrong thing. */
  const undocumented = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const [name, source] of files) {
    assert.equal(
      /(BODY|MUSCLE|FIBER|CELL)\s*→/.test(undocumented(source)),
      false,
      `${name} spells the chain out; it has to come from SCALE_ORDER or it goes stale`,
    );
  }
});
