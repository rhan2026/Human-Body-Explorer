import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * A COUNT ON A PLATE IS COUNTED, NOT TYPED.
 *
 * CLAUDE.md §9: *세어 나오는 값을 글자로 박지 마라*. `CellReadout.jsx` says the
 * same thing in English — "a number a viewer can see drawn is never also typed"
 * — and it is why the cell's repetition count is ten ticks rather than a
 * sentence.
 *
 * Q14 R8 and R9 found two anchor labels breaking it, both on signalling and
 * both agreeing with the archive by luck on the day they were read:
 * `"twelve outputs"` over a band the data says is 12, and `"two inputs"` over a
 * band the data says is 2. An archive exporting a different `node_roles` leaves
 * the plate lying and the pass — which says the same numbers through templates —
 * right.
 *
 * Read off the source rather than the screen, because a label built into a
 * geometry file is the one place a count can be typed where no browser test
 * would see it change.
 */
test("no anchor label types a count that the scene draws", async () => {
  const WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
  /* `Selected fiber` and the like are fine; what is banned is a QUANTITY in
     front of a plural. */
  const TYPED = new RegExp(`^\\s*(?:${WORDS}|\\d+)\\s+\\w+s\\b`, "i");

  for (const file of [
    "../fiber/fiberGeometry.js",
    "../cell/cellGeometry.js",
    "../signalling/signallingGeometry.js",
  ]) {
    const src = await readFile(new URL(file, import.meta.url), "utf8");
    /* Only the double-quoted form: a template literal is, by construction, a
       label that computes something. */
    const labels = [...src.matchAll(/label:\s*"([^"]*)"/g)].map((m) => m[1]);
    assert.ok(labels.length > 0, `${file} has no quoted anchor labels — repoint this test`);

    const typed = labels.filter((l) => TYPED.test(l));
    assert.deepEqual(
      typed,
      [],
      `${file} types a count into a label: ${JSON.stringify(typed)}. The scene draws those things; the ` +
        `label has to count them. Use a template literal off the same data the plate's value comes from`,
    );
  }
});
