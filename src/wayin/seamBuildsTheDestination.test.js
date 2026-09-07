import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { LEVELS, buildSarcomereLevel } from "../fiber/fiberGeometry.js";
import { buildCellChainLevel } from "../cell/cellChainGeometry.js";
import { buildHeroLevel } from "../signalling/heroGeometry.js";

/**
 * THE COIN BUILDS WHAT THE DESTINATION DRAWS.
 *
 * `previewLevel.js` states this as its first rule and calls it honesty by
 * construction: "The group comes from the DESTINATION'S OWN BUILDER, called by
 * the name the destination calls it by. If the builder changes, this changes.
 * There is no second asset that can drift away from the first."
 *
 * IT HAS DRIFTED TWICE. `CellScale`'s signalling seam built
 * `buildSignallingLevel` after that scale had moved to `buildHeroLevel`, so the
 * coin showed a hundred and twenty-one marks on five shelves that no longer
 * existed. Caught, fixed, written up. Then on 2026-09-04 the fibre's cell seam
 * turned out to have the same shape: it built `buildCellLevel` while the cell
 * scale has drawn `buildCellChainLevel` since the chain rewrite — `CellScale`
 * names the old one only in the past tense.
 *
 * BOTH TIMES IT WENT UNNOTICED BECAUSE THE COIN IS SMALL. A wrong picture at
 * 88 px reads as an unfamiliar one, which is exactly what a preview of somewhere
 * you have not been is supposed to read as. Nothing was going to catch this by
 * looking.
 *
 * TWO CHECKS, AND THE SECOND IS THE ONE THAT BITES. The first is by IDENTITY —
 * the function a seam names and the function its destination draws have to be
 * the same object, which no amount of renaming or re-exporting can fake. The
 * second is by SOURCE, because a seam file can only be read as text: the name it
 * builds with must be a name the destination's own scene file calls. Coarse, and
 * enough for the failure that has now happened twice — a constant in one file
 * pointing at a function the other file has stopped using.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the level a coin builds is the sarcomere the fibre scale draws", () => {
  /* SARCOMERE, NOT FIBRE — 2026-09-07, owner: *"body -> fiber는 sacromere를
     보여주는게 맞을 것 같아"*. The floor still arrives on the fascicle; the coin
     shows what the descent is for. */
  /* `MuscleLens` reads `LEVELS.sarcomere.build` rather than naming a function, which
     is the strongest form of this rule: the table belongs to the destination, so
     the coin cannot name something the destination has stopped listing. Checked
     by identity anyway, because the table itself could be re-pointed. */
  assert.equal(
    LEVELS.sarcomere.build,
    buildSarcomereLevel,
    "LEVELS.sarcomere.build is no longer buildSarcomereLevel — the body's coin and the fibre scale have parted",
  );
  assert.match(
    read("./MuscleLens.jsx"),
    /LEVELS\.sarcomere\.build/,
    "MuscleLens stopped reading the fibre's own table and named something instead",
  );
});

test("the deep seams name the builders their destinations call", () => {
  for (const { seam, to, draws, builder, fn } of [
    { seam: "../fiber/FiberScene.jsx", to: "cell", draws: "../cell/CellScale.jsx",
      builder: "buildCellChainLevel", fn: buildCellChainLevel },
    { seam: "../cell/CellScale.jsx", to: "signalling", draws: "../signalling/SignallingScale.jsx",
      builder: "buildHeroLevel", fn: buildHeroLevel },
  ]) {
    assert.equal(typeof fn, "function", `${builder} is no longer a function`);

    const src = read(seam);
    const at = src.indexOf(`to: "${to}"`);
    assert.ok(at > 0, `${seam} no longer declares a seam to "${to}"`);
    /* The first `build:` after the `to:`, comments stripped — a fixed window
       around the `to:` was the first cut and it broke the moment one of these
       seams grew a paragraph explaining itself, which is this repository's
       normal state. */
    const after = src.slice(at).replace(/\/\*[\s\S]*?\*\//g, " ");
    const built = after.match(/build:\s*(?:\(\)\s*=>\s*)?([A-Za-z_$][\w$.]*)/);
    assert.ok(built, `the seam to "${to}" in ${seam} has no readable build:`);
    assert.equal(
      built[1],
      builder,
      `${seam} builds the "${to}" coin with ${built[1]}, not ${builder}`,
    );
    assert.match(
      read(draws),
      new RegExp(`\\b${builder}\\s*\\(`),
      `${draws.split("/").pop()} does not call ${builder}() — the coin promises a room that scale has ` +
        "stopped drawing, which is the drift that put a retired signalling scene in one coin and a " +
        "retired cell in another",
    );
  }
});
