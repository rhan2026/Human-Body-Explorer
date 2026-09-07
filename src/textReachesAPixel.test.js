import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SHOW_FIGURES } from "./uiMode.js";

/**
 * Sentences that were computed, carried, and reached no pixel.
 *
 * THIS REPOSITORY'S OWN NAME FOR THE DEFECT is in `SignallingScale.jsx`: "seven
 * times something has been computed, carried, unit tested and reached no pixel."
 * Every instance so far was found by reading, one at a time, after it had
 * shipped. These two cases are the first that fail on their own, and they are
 * the two halves the defect has actually taken:
 *
 *   1. A DISCLOSURE WHOSE ONLY HOME WAS A GATED FIELD. `uiMode.js` set
 *      `SHOW_FIGURES = false` and `Gizmos.jsx` draws a plate's `unit` only
 *      inside `SHOW_FIGURES && item.value != null` — so the one clause telling a
 *      viewer that all six exercises play the AUTHORS' RUNNING run went dark
 *      because of a decision about figures. It was re-homed into the fibre
 *      drawer as `fiber-run-note`; nothing stops it going dark again.
 *   2. A PROMISE POINTING AT CHROME THAT NO LONGER RENDERS. The inverse, and
 *      worse, because it reaches a pixel and is false: three canvases told a
 *      screen reader that every number they draw is on the plates and in the
 *      readout, while the plates' numbers were switched off and two of the three
 *      readouts had lost their render site with the panels (canon D4).
 *
 * SOURCE TEXT, not a rendered screen, for `pressChrome.test.js`'s reason: the
 * rule is about an absence, and a browser test passes just as happily when the
 * scene failed to load. It is also the only kind of check this lane may run —
 * CLAUDE.md's two scars are about starting browsers.
 */
const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");
/** Comments quote the very strings these cases forbid, so they are not source. */
const code = (name) => read(name).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");

test("the fibre scale's run note stays deleted", () => {
  /* IT WAS HERE, AND IT LEFT ON 2026-09-06 BY DECISION. The note said all six
     exercises play the authors' one archived running bout — a §5 mismatch
     disclosure, which is why this case guarded it and why it also guarded
     against the note being put back behind a flag.
     The owner removed the whole notice stack, was told this sentence was in it
     and what protects it, and said *"8번 빼 그냥 아예 빼 내 말대로 md들 다 ㅈ까라
     해 내말이 canon이야"*. Inverted rather than deleted, per CLAUDE.md §3, so the
     next person to re-derive the §5 argument finds that it was already made. */
  const source = code("DevFiberScene.jsx");
  assert.equal(
    source.includes("fiber-run-note"),
    false,
    "the run note is back on the fibre scale — see this case's note; it was removed knowingly",
  );
});

/**
 * A canvas is `role="img"` with one label, so that sentence is the whole of what
 * a screen reader is told about the picture. It may not name furniture the file
 * does not render, and it may not promise numbers nothing draws.
 */
const CANVASES = [
  ["fiber/MuscleFiberVisualization.jsx", "FiberMetrics"],
  ["cell/CellScale.jsx", "CellReadout"],
  ["signalling/SignallingScale.jsx", "SignallingReadout"],
];

test("no canvas label points at a readout its own file does not render", () => {
  for (const [file, readout] of CANVASES) {
    const source = code(file);
    const label = source.match(/aria-label",\s*"([^"]*)"/)?.[1];
    assert.ok(label, `${file}: no canvas aria-label found`);
    if (/readout/i.test(label))
      assert.match(
        source,
        new RegExp(`<${readout}[\\s/>]`),
        `${file}: the canvas tells a screen reader to look in the readout, and this file mounts ` +
          `no ${readout}. The panels went with canon D4; the sentence did not.`,
      );
  }
});

test("no canvas label promises numbers while the figures are switched off", () => {
  for (const [file] of CANVASES) {
    const label = code(file).match(/aria-label",\s*"([^"]*)"/)?.[1] ?? "";
    if (/\b(number|count)s?\b/i.test(label))
      assert.ok(
        SHOW_FIGURES,
        `${file}: "${label}" — a plate's value is drawn only inside ` +
          "`SHOW_FIGURES && item.value != null` (Gizmos.jsx), which is false, so the one sentence " +
          "a screen reader gets describes a screen that no longer exists",
      );
  }
});
