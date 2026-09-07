import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE CHARACTER IS AN INHABITANT, NOT A TOUR.
 *
 * Owner, 2026-09-02: *"캐릭터는 항상 보여야돼"* — they listened to a little of the
 * body scale, picked a different workout, and the character was gone for the
 * rest of the visit. Two independent things did that and either one is enough:
 *
 *   1. `MotionScene` passed `visible={walk.running}`, and `running` is true only
 *      while a BEAT is playing. Anything that ended the walk deleted the
 *      character — including the pointerdown that opens the menu to change the
 *      workout, because every interrupt calls `stop()`.
 *   2. `Guide` itself returned null on a null anchor, so the three deep scales,
 *      which never passed `visible` at all and were therefore right in intent,
 *      lost the character anyway the moment a beat's anchor failed to resolve.
 *
 * Both are fixed: a beat's anchor is where the character GOES, and with no beat
 * it walks to its home corner and waits hushed. This gate is on the source
 * because the failure is a prop and a guard clause, and because it went
 * unnoticed through every browser case in the repo — the walk still worked, so
 * nothing that watched the walk could see it.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("no scene ties the character's existence to whether it is talking", () => {
  for (const path of [
    "../MotionScene.jsx",
    "../cell/CellScale.jsx",
    "../signalling/SignallingScale.jsx",
    "../fiber/MuscleFiberVisualization.jsx",
  ]) {
    const src = read(path);
    const mount = src.slice(src.indexOf("<Guide"), src.indexOf("<Guide") + 700);
    assert.ok(src.includes("<Guide"), `${path} no longer mounts the guide at all`);
    assert.doesNotMatch(
      mount,
      /visible=\{[^}]*\b(running|line|beat)\b/,
      `${path} gates the character on whether it is speaking. The character stays; the BUBBLE is what ` +
        "goes quiet, and `guide.css` already has `--hushed` for that.",
    );
  }
});

test("the guide draws without an anchor, and stands somewhere real when it has none", () => {
  const src = read("./Guide.jsx");
  assert.doesNotMatch(
    src,
    /if \(!visible \|\| !at\) return null/,
    "Guide bails on a null anchor again — that unmounts the character between beats and on every " +
      "anchor that fails to resolve",
  );
  assert.match(
    src,
    /anchor \?\?/,
    "Guide no longer falls back to a home position when a beat gives it nowhere to stand",
  );
});

/**
 * ONE WALK PER WORKOUT, NOT ONE PER TAB — and the counter has to be reset with
 * the key or the new walk is filed as spent before it speaks. That happened:
 * `sessionStorage` came back holding both `hpe.guide.firstWalk.bench_press` and
 * `...swimming_freestyle` with the swimmer never having said a word, because
 * `stop()` parks `index` at `MAX_SAFE_INTEGER` and changing the hash does not
 * remount `MotionScene`.
 */
test("changing the key resets the walk's own counter, in the same commit", () => {
  const src = read("./useWalk.js");
  assert.match(src, /indexKey/, "the index is no longer paired to the key it belongs to");
  assert.match(
    src,
    /if \(indexKey\.current !== seenKey\) return;/,
    "the done-marker no longer refuses to fire on the render where the key changed — it will file the " +
      "next walk as spent using the previous walk's index",
  );
});

/**
 * AND IT DOES NOT SIT ON THE ZONE LEGEND.
 *
 * The SIGNALS lane, 2026-09-06, from a still of the merged tree at 1280x800:
 * the resting bubble's lower-left corner covered the outcome caption
 * `Mitochondria`. Item 14's four-corner scoring had been measured at 0 px² and
 * was telling the truth — it forbids the spoken subject and `.gizmo--focus`
 * plates, and this caption is neither. It is permanent furniture.
 *
 * TWO HALVES, AND EITHER ONE ALONE LEAVES IT BROKEN. The floor has to declare
 * the furniture (`data-guide-clear`), and the guide has to be able to get off it
 * — which the corner scoring cannot do on its own, because all four candidates
 * sit within `reach` of the anchor and at rest the anchor itself is on the
 * legend. Re-measured after both: 0 px² on all four floors.
 */
test("the guide clears furniture a floor has marked, and can lift off it", () => {
  const guide = read("./Guide.jsx");
  assert.match(
    guide,
    /const plates = \[[^\]]*"\[data-guide-clear\]"/,
    "Guide no longer forbids what a floor marked with data-guide-clear",
  );
  assert.match(
    guide,
    /clearTo[\s\S]{0,400}Number\.isFinite\(clearTo\)[\s\S]{0,120}pick\.y = Math\.max\(h \+ floor/,
    "the lift that gets the guide off a box it still covers is gone",
  );
  const sig = read("../signalling/SignallingScale.jsx");
  for (const cls of ["sig-zone", "sig-zone__name"]) {
    assert.match(
      sig,
      new RegExp(`className="${cls}" data-guide-clear`),
      `SIGNALS' .${cls} caption no longer tells the guide to stay off it`,
    );
  }
});

/**
 * AND IT KNOWS ABOUT THE SHELL, WHICH IS NOT ITS PARENT'S CHILD.
 *
 * The SIGNALS lane's still of the land beat (p5-05) has the bubble across "Cell
 * Signalling" and the Resistance chevron's tip — on the one beat whose whole
 * point is that the two inputs at the top are in frame.
 *
 * WHAT WAS THERE WAS A CEILING FROM A CLASS NOTHING RENDERS. `Guide` computed
 * its top limit from `.scale-head`; the app draws `.shell-title--floor`, and
 * `scaleHead.css` still styles a class with no element. Measured on all three
 * deep floors: `document.querySelector(".scale-head")` is null, so the ceiling
 * had been silently `PAD` — the top of the stage — on every floor.
 *
 * A CEILING WAS ALSO THE WRONG SHAPE. The heading is a box in a corner, and
 * forbidding the whole band above its bottom edge spends the top of the picture
 * to protect two words. Both it and the transport go in the same list as
 * everything else, queried on the document because the shell is the stage's
 * PARENT. Measured after, land beat at 1280x800: 0 px² on both.
 */
test("the guide avoids the shell's heading and transport, not a class nobody renders", () => {
  const guide = read("./Guide.jsx");
  /* THE LIST GREW ON 2026-09-07 and is a named constant now — owner: *"bell
     should not overlap with other elements in the window, like user text box,
     graphs, buttons. it can overlap with the figures when it moves around to
     explain stuff"*. What this case was written for still holds and is checked
     the same way: the floor's name and the way out are on the list. The canvas
     must NOT be — the second half of that sentence is the reason, and a guide
     forbidden from the picture could not walk to anything on it. */
  assert.match(guide, /document\.querySelectorAll\(CHROME\)/, "the guide no longer avoids the app's furniture");
  const chrome = guide.match(/const CHROME = \[(.*?)\]\.join/s)?.[1] ?? "";
  assert.ok(chrome, "the list of furniture is gone");
  for (const must of ['".shell-title"', '".ways"', '".ask"', '".evidence"', '".opacity-dock"']) {
    assert.ok(chrome.includes(must), `the guide no longer avoids ${must}`);
  }
  assert.ok(!/"canvas"|\.press__stage"|\.stage"/.test(chrome), "the picture is on the avoid list, so the guide can no longer walk to anything on it");
  assert.doesNotMatch(
    guide,
    /querySelector\("\.scale-head"\)/,
    "the guide is asking for `.scale-head` again — nothing renders it",
  );
  /* The other half of the same finding, left for whoever touches that file:
     `Gizmos.jsx` asks for the same dead class. Recorded, not fixed here — it is
     a different component's placement and a different measurement. */
  assert.match(read("../gizmo/Gizmos.jsx"), /scale-head/, "if Gizmos stopped asking, delete this line and scaleHead.css with it");
});

/**
 * AND THE ENDING'S ARCS ARE GEOMETRY, SO THE FLOOR HAS TO SAY WHERE THEY ARE.
 *
 * The SIGNALS lane's still p6-04: on the compare beat the guide CHARACTER stood
 * on the right end of Mitochondria's cool arc. The arcs are the owner's fifth
 * brief §1 — the picture that says two routes reached almost the same place —
 * and their whole argument is that the warm one and the cool one are near-equal
 * LENGTHS. A character parked on one end shortens the thing being compared.
 *
 * NOTHING IN THE SCORING COULD SEE THEM. It reads the spoken subject, DOM
 * plates, `data-guide-clear` and the shell. An arc is a torus in a WebGL scene.
 * So the floor projects them into `clearRef` beside the anchor it already
 * projects, and `ARC_R` is turned into pixels by projecting a second point
 * rather than assumed — the same radius is a different number of pixels at each
 * beat's distance. Measured after, 1280x800 with the arcs up: the guide stands
 * on the left, all three pairs whole.
 */
test("SIGNALS hands the guide its ending arcs, in pixels it measured", () => {
  const scale = read("../signalling/SignallingScale.jsx");
  assert.match(scale, /clearRef\.current = reach/, "the ending's arcs are no longer handed to the guide");
  assert.match(scale, /kind === "outcome" && a2\.ringAt/, "the keep-off circles are no longer the outcomes' own centres");
  assert.match(scale, /Math\.hypot\(ex - x, ey - y\)/, "the arc radius is being assumed in pixels instead of projected");
  assert.match(scale, /clear=\{guideClear\}/, "the guide is not being given the list");
  assert.match(read("../signalling/heroGeometry.js"), /export const ARC_R/, "ARC_R is unexported again, so the page cannot project it");
  assert.match(read("./useAim.js"), /Array\.isArray\(p\)/, "useAim stopped carrying a list, so three circles become one");
});
