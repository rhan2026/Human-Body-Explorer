import assert from "node:assert/strict";
import test from "node:test";

import { phaseAt } from "./ease.js";
import { allMotions } from "./registry.js";

/**
 * EVERY PHASE A TABLE DECLARES HAS TO BE ONE A VIEWER CAN ACTUALLY SEE.
 *
 * `phaseAt` walks the table in ARRAY order and breaks at the first entry whose
 * `at` is past the clock. That is correct and cheap for a table sorted in time,
 * and silently wrong for one that is not: an entry followed by an earlier one is
 * never the answer, because the later iteration always overwrites it.
 *
 * Which is what freestyle had. Its `at` values were 0, 0.364, 0.936, **1.612**,
 * **1.300**, 2.106 — the right arm's recovery starts at `PULL_SHARE` of its own
 * stroke circle, 0.62 of 2.6 s, and the LEFT arm enters at half the cycle,
 * 1.3 s. Both numbers are right about the swimmer. The table is one pointer, and
 * a swimmer's two arms overlap, so "Exit · recovery" could not be returned for
 * any t at all — found by measuring phase spans and getting **-0.31 s**.
 *
 * The reachability half is the one that matters. Ascending order alone would
 * have passed a table whose last entry starts at the duration, and a label
 * nobody can see is the same defect this project keeps finding in other
 * clothes: something computed, carried, and reaching no pixel.
 */
const MOTIONS = allMotions();

test("every exercise has a phase table sorted in time", () => {
  assert.ok(MOTIONS.length >= 4, `only ${MOTIONS.length} motions registered — this test is watching too few`);
  for (const motion of MOTIONS) {
    const at = motion.phases.map((p) => p.at);
    for (let i = 1; i < at.length; i += 1) {
      assert.ok(
        at[i] > at[i - 1],
        `${motion.id}: phase ${i} ("${motion.phases[i].label}") starts at ${at[i]} s, which is not after ` +
          `phase ${i - 1} ("${motion.phases[i - 1].label}") at ${at[i - 1]}. \`phaseAt\` walks this in array ` +
          `order, so the earlier one is unreachable`,
      );
    }
  }
});

test("every phase a table declares is returned for some instant of the rep", () => {
  for (const motion of MOTIONS) {
    const seen = new Set();
    const step = motion.duration / 2000;
    for (let t = 0; t < motion.duration; t += step) seen.add(phaseAt(motion.phases, t, motion.duration).label);
    const unreachable = motion.phases.map((p) => p.label).filter((l) => !seen.has(l));
    assert.deepEqual(
      unreachable,
      [],
      `${motion.id}: ${unreachable.join(", ")} is declared, carried and returned for no instant of the rep`,
    );
  }
});
