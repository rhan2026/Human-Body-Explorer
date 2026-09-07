import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE PLAIN LAP STARTS WHEN THE COVER COMES OFF, NOT WHEN THE PAGE MOUNTS.
 *
 * Owner, 2026-09-06: *"지금 각각 transition은 어때?"* — measured (crossings.mjs, 50 ms
 * samples inside the page): the destination mounts ~0.67 s after the press and
 * its clock started at once; the ring opened at ~1.375 s. The first 0.7 s of
 * every plain lap ran unseen, and on FIBER that is the burst the ONE PULL window
 * was cut to open on. Owner: *"고쳐"*.
 *
 * ONE READING, THREE FLOORS. `useCoverOpen` reads the ride's `crossing` flag —
 * `crossing` ALONE: `arrivedFromInside` also counts `cinematic`, the shell's
 * 1,800 ms recede, and BODY → FIBER would have stood frozen 0.6 s after the
 * picture was open. Each scene holds its run at 0 until the flag clears, seeks
 * to the lap's own start at that moment, and counts the lap from there.
 *
 * Measured after, ms from the press — flag gone / ring gone / clock moves:
 *   BODY → FIBER    1,259 / 1,363 / 1,414   clock 0.5525 (the window's start) → moving
 *   FIBER → ENERGY  1,269 / 1,370 / 1,319   clock 1.20 at mount (arrival rep) → 0.11 at open
 *   ENERGY → SIGNALS 2,462 / 2,616 / 2,565  clock 0 at mount → 54 run-s at open
 *
 * AND ENERGY IS QUIET WHILE IT PULLS BACK. At 700 ms into the ride to SIGNALS
 * the bubble still read "then press the magnifier" and the Condition toggle
 * stood — to a visitor who had just pressed it. `hush` on the guide, `!pulling`
 * on the controls; the character stays (*"캐릭터는 항상 보여야돼"*).
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the cover's own flag is read, alone, by one hook", () => {
  const crossing = read("./crossing.js");
  assert.match(crossing, /export function useCoverOpen\(\)/, "useCoverOpen is gone");
  assert.match(
    crossing,
    /useCoverOpen\(\)[\s\S]{0,400}dataset\.crossing !== undefined[\s\S]{0,600}dataset\.crossing === undefined/,
    "useCoverOpen no longer reads the `crossing` flag",
  );
  const body = crossing.slice(crossing.indexOf("export function useCoverOpen"));
  assert.doesNotMatch(body, /cinematic/, "useCoverOpen counts `cinematic` again — BODY → FIBER will freeze 0.6 s past the open");
});

test("every deep floor holds its plain lap until the cover is off, then starts it at the start", () => {
  const cell = read("./cell/CellScale.jsx");
  assert.match(cell, /const coverOpen = useCoverOpen\(\);/, "ENERGY stopped asking");
  assert.match(cell, /if \(stage !== "silent" \|\| !coverOpen\) return undefined;[\s\S]{0,700}if \(beats\.length\) seek\(t0\);/, "ENERGY's lap no longer waits for the cover, or no longer starts at t0");
  assert.match(cell, /stage === "silent" \? \(coverOpen \? \(REPS \* REP_SECONDS\) \/ INTRO_S : 0\)/, "ENERGY's run is not held under the cover");

  const sig = read("./signalling/SignallingScale.jsx");
  assert.match(sig, /const coverOpen = useCoverOpen\(\);/, "SIGNALS stopped asking");
  assert.match(sig, /if \(stage !== "silent" \|\| !coverOpen\) return undefined;\s*if \(beats\.length\) clock\.current = createRunClock\(0\);/, "SIGNALS's lap no longer waits for the cover, or no longer starts at 0");
  assert.match(sig, /&& !\(stage === "silent" && !coverOpen\) \? Math\.min\(delta, 0\.05\) : 0;/, "SIGNALS's run is not held under the cover");

  const fiber = read("./fiber/FiberScene.jsx");
  assert.match(fiber, /const coverOpen = useCoverOpen\(\);/, "FIBER stopped asking");
  assert.match(fiber, /if \(!coverOpen \|\| !playing\) return undefined;\s*let timer = null;/, "FIBER's lap timer no longer waits for the cover (and for Play)");
  assert.match(fiber, /if \(!coverOpen \|\| !playing\) speed = 0;[\s\S]{0,200}settleAt\(state\.current, runWindow\.from/, "FIBER's run is not held under the cover, or does not seek to the window's start");
  /* Code only — the comments above the timer say what stood there and why. */
  const fiberCode = fiber.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(fiberCode, /arrivedFromInside/, "FIBER is polling arrivedFromInside again, which counts the shell's recede");
});

test("ENERGY says nothing and offers nothing while it pulls back", () => {
  const cell = read("./cell/CellScale.jsx");
  assert.match(cell, /<Guide [^>]*hush=\{pulling\}/, "the guide keeps its resting prompt up through the pull-back");
  assert.match(cell, /status === "ready" && !pulling && \(stage === "main"/, "the Condition toggle stands through the pull-back");
  assert.match(read("./guide/Guide.jsx"), /const said = hush \? null : line \?\? \(passing \? null : resting\);/, "the guide's hush is gone");
});
