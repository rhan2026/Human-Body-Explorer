import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

/**
 * THE PAGE, READ AS TEXT. `CellScale.jsx` mounts a WebGL canvas, so the only
 * cheap way to hold it to what was decided is to read the source the way
 * `seamBuildsTheDestination.test.js` does. Two lists: what must be there
 * because another file reaches for it, and what must NOT be there because the
 * owner took it off the floor (CLAUDE.md §3: "만들지 않기로 한 것은 부재
 * 테스트로 고정"). Comments are stripped first — a comment may say why the
 * strip is gone; the code may not draw one.
 */
const src = await readFile(new URL("./CellScale.jsx", import.meta.url), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, "");

test("what the owner took off the floor stays off — 2026-09-06", () => {
  for (const [needle, why] of [
    ["energy-clock", "the rep strip / scrubber (owner item 14: timeline 쳐 빼)"],
    ["RepStrip", "the rep strip component (owner item 14)"],
    ["EnergyHalo", "hover / focus rings (owner item 13: no rings anywhere)"],
    ["HaloRing", "hover / focus rings (owner item 13)"],
    ["energy-demand-name", "the standing 'ATP demand' label (brief §8, rule 5: no standing text)"],
    ["sessionStorage", "'already seen' memory (rule 3) and the handoff (handoff.js builds it at the crossing)"],
    /* ENERGY.md's "deliberately not built" list, pinned since the review of
       2026-09-06 found none of them held by a test. */
    ["FocusRing", "the fibre's orange press-ring vocabulary (ENERGY.md: not on this floor)"],
    ["CameraSway", "the sway (ENERGY.md: none)"],
    ["<Gizmos", "standing plates (ENERGY.md: none)"],
    ["<Handle", "standing handles (ENERGY.md: none — the hit meshes are the geometry's)"],
    ["energy__title", "a second floor title (the shell draws the one)"],
    ["scale-facts", "a standing facts paragraph (rule 5)"],
    ["scale-time", "a standing clock readout (rule 5)"],
  ]) {
    assert.ok(!code.includes(needle), `${needle} is back in CellScale.jsx — ${why}`);
  }
});

test("what the other files reach for is still there", () => {
  for (const [needle, who] of [
    ["buildCellChainLevel(", "seamBuildsTheDestination.test.js — the fibre's coin builds this"],
    ['to: "signalling"', "seamBuildsTheDestination.test.js — the seam down"],
    ["<WayIn", "the way down, ENERGY.md"],
    ['data-testid="cell-stage"', "the browser gates' stage handle"],
    ["stage-status", "the loading / error region, CLAUDE.md §9"],
    ["Loading the coupled run", "CLAUDE.md §9: loading copy is never deleted"],
    ["Waiting for the first frame", "CLAUDE.md §9: progress copy is never deleted"],
  ]) {
    assert.ok(code.includes(needle), `${needle} is gone from CellScale.jsx and ${who} still reads it`);
  }
});

test("the 2026-09-06 mechanics are wired, not described", () => {
  /* One rep loops by default (owner item 14); Pause stops the pass with the
     scene (rule 2 — the option lands in tour.js, the page passes it now); the
     geometry's spotlight is the selection mark (owner item 12); the viewer's
     seconds reach the geometry so a held beat still breathes (`wallDt`). */
  /* No View toggle at all (owner, 2026-09-06 night: 삭제) — the loop rep is
     the floor's one resting state; a pass that needs the set seeks there. */
  for (const needle of ["energy-view", "Whole set", "setView", "useState(\"rep\")"]) {
    assert.ok(!code.includes(needle), `${needle} is back — the set view was deleted`);
  }
  assert.equal((code.match(/paused:\s*!playing/g) ?? []).length, 2, "both useTour calls pass paused: !playing");
  assert.match(code, /model\.spotlight\?\.\(/, "the page never hands the geometry a spotlight id");
  assert.match(code, /wallDt:\s*step/, "the viewer's seconds never reach model.update");
});


/**
 * THE ARRIVAL IS THREE STAGES — owner, 2026-09-06: *"1. 한번 쭉 보여주고 (main) 이
 * 때는 toggle이고 뭐고 없어 그냥 left header + right pause skip / 2. 그다음 guided
 * tour / 3. now main again with all the toggles"*. On this floor the plain lap is
 * the protocol's ten repetitions — *"12.96초짜리 protocol 한 바퀴"*, *"모든거
 * 한바귀가 아니야"* — fitted to *"한 5초 정도"*.
 *
 * What stood here held the clock at speed 0 for 1.6 s (audit r2). Measured after:
 * 0–5.2 s Skip only, no controls, no bubble; 5.2 s beat 0; 47.0 s main. Skip at
 * 2 s: main and the controls at 2.1 s, nothing behind it.
 */
test("the protocol runs once in three seconds before the pass, and Skip lands in main", () => {
  assert.ok(code.includes("const INTRO_S = 3;"), "the plain lap's length is no longer three seconds by name (5 until 2026-09-07)");
  assert.ok(
    /stage === "silent" \? \(coverOpen \? \(REPS \* REP_SECONDS\) \/ INTRO_S : 0\) : speaking\?\.beat\?\.speed \?\? 1/.test(code),
    "the plain lap is held at speed 0 again, or the pass's own speed got re-timed with it",
  );
  assert.ok(
    /stage === "silent"[\s\S]{0,40}\{ from: t0, to: t0 \+ REPS \* REP_SECONDS \}/.test(code),
    "the plain lap runs the whole grid (rest phase included) instead of the protocol",
  );
  assert.ok(/beats\.length \? INTRO_S \* 1000 : SILENT_MS/.test(code), "the plain lap no longer lasts INTRO_S before the pass");
  assert.ok(/if \(beats\.length\) seek\(t0\);/.test(code), "the plain lap no longer starts at t0 — it starts in the rep you arrived in");
  assert.ok(/holdTour\(\{ id: "intro", skip: \(\) => setSkipIntro/.test(code), "the page no longer holds Skip during the plain lap");
  assert.ok(/if \(!skipIntro\) return;[\s\S]{0,60}setStage\("main"\);[\s\S]{0,40}seek\(loopRep\.current\.from\)/.test(code), "Skip no longer lands in main at the loop rep's first instant");
});

/**
 * THE VISITOR WHO NEVER REACHES FOR THE DOOR PAYS NOTHING FOR IT — owner,
 * 2026-09-06, choosing option 2: *"2번으로 하고"*, *"안 누르는 방문자는 값을 안
 * 낸다"*. The coin's build was moved to the first hover at 3dcac05 and the record
 * said the visitor paid nothing; the pass audit of 2026-09-06 found the three
 * Fowler fetches still running on mount, because `WayIn` returned null until
 * `seam` existed and a seam that needs a fetch cannot exist before it.
 *
 * Measured after: 0 `fowler_*` requests in 6 s without a hover; 3 at the first
 * hover; disc open with a still. The first cut of the fix took the whole floor
 * down — `SCALE_LABEL[seam.to]` in the lens's accessible name, on a null seam.
 */
test("the Fowler scenarios are fetched on the first hover, not on arrival", () => {
  assert.ok(
    /const \[wanted, setWanted\] = useState\(false\);[\s\S]{0,120}if \(!wanted\) return undefined;[\s\S]{0,200}loadScenario\("fowler_resistance"\)/.test(code),
    "the seam's fetch runs on mount again — every ENERGY visitor downloads the signalling archive",
  );
  assert.ok(/onWant=\{\(\) => setWanted\(true\)\}/.test(code), "WayIn has no way to ask this floor for the seam");
  const lens = readFileSync(new URL("../wayin/WayIn.jsx", import.meta.url), "utf8");
  assert.ok(/if \(!visible\) return null;/.test(lens) && !/if \(!on\) return null;/.test(lens), "the lens cannot exist before its seam, so nobody can hover to ask for it");
  assert.ok(/const to = seam\?\.to \?\? nextScale\(/.test(lens), "the lens names its destination off the seam again, and a null seam takes the floor down");
});
