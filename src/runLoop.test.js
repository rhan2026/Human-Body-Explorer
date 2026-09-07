import assert from "node:assert/strict";
import test from "node:test";

import { HOLD_S, createRunClock, stepRunClock } from "./runLoop.js";

/**
 * The seam, asked of the clock rather than of a screenshot.
 *
 * What the old wrap did, in one line: `if (t > tEnd) { t -= span; lap += 1 }`.
 * That fires in the middle of a moving picture, so the frame before the seam and
 * the frame after it are both frames of a running scene and the eye joins them.
 * Measured on soce_on the join is a 31% refill of the SR store in one frame.
 */

const T0 = 0;
const T_END = 12.98;
/** One frame at 60 fps, which is what the scenes actually hand this. */
const DT = 1 / 60;

/** Run the clock forward and record what it drew each frame. */
function play(clock, seconds, dt = DT) {
  const frames = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    stepRunClock(clock, dt, T0, T_END);
    frames.push({ t: clock.t, lap: clock.lap, held: clock.held });
  }
  return frames;
}

test("the run ends on its own last sample, not past it", () => {
  const clock = createRunClock(T_END - 0.02);
  play(clock, 0.1);
  assert.equal(clock.t, T_END, "the picture must come to rest on a frame the archive actually holds");
});

test("nothing moves for a beat at each end of the cut, so the cut is an edit and not a recovery", () => {
  // The whole treatment in one assertion. A recovery is a process: it takes
  // frames and the quantities move through them. This holds the last archived
  // frame still, cuts in one frame, and holds the first still — so the only
  // frame where anything jumps is a frame with stillness on both sides of it,
  // which is what a viewer reads as a tape restarting.
  const clock = createRunClock(T_END - 0.05);
  const frames = play(clock, HOLD_S * 2 + 0.4);

  const cut = frames.findIndex((f, i) => i > 0 && f.t < frames[i - 1].t);
  assert.ok(cut > 0, "the run never restarted");

  const before = frames.slice(0, cut);
  const stillBefore = before.filter((f) => f.t === T_END).length;
  const stillAfter = frames.slice(cut).filter((f) => f.t === T0).length;

  assert.ok(
    stillBefore * DT > HOLD_S * 0.9,
    `only ${(stillBefore * DT).toFixed(2)}s of stillness before the cut — the jump is still inside a moving picture`,
  );
  assert.ok(
    stillAfter * DT > HOLD_S * 0.9,
    `only ${(stillAfter * DT).toFixed(2)}s of stillness after the cut — the restart runs before it is seen`,
  );
  assert.equal(frames[cut].lap, before[before.length - 1].lap + 1, "the lap counter must tick on the cut itself");
});

test("the cut is one frame wide — the scene never draws its way back to the start", () => {
  // An eased or scrubbed return would draw the pool at values between the last
  // sample and the first, and no such row exists in the archive. scenarioData
  // snaps to archived samples and interpolates nothing; a transition that
  // interpolated would be the drawing inventing the data.
  const clock = createRunClock(T_END - 0.05);
  const frames = play(clock, HOLD_S * 2 + 0.4);
  const descending = frames.filter((f, i) => i > 0 && f.t < frames[i - 1].t);
  assert.equal(descending.length, 1, "time ran backwards on more than one frame — that is a scrub, not a cut");
  assert.equal(descending[0].t, T0, "the cut must land exactly on the first archived sample");
});

test("held frames are announced, because a still picture and a broken one look alike", () => {
  // CLAUDE.md §5: a snap the viewer cannot see is a bug. The readouts own the
  // words; this owns the flag they read, and the flag has to exist for the same
  // reason `lap` does.
  const clock = createRunClock(T_END - 0.05);
  assert.equal(clock.held, null, "a running clock is not holding anything");
  const frames = play(clock, HOLD_S * 2 + 0.4);
  assert.deepEqual(
    [...new Set(frames.map((f) => f.held))].sort(),
    [null, "end", "start"].sort(),
    "the two holds must be distinguishable — one is the run finishing, the other is it beginning",
  );
});

test("a backgrounded tab cannot swallow the hold", () => {
  // The scenes clamp their delta to 0.05 for this reason, but the hold is the
  // one place where a single large step would skip the whole treatment and put
  // the jump back in the middle of a moving picture. One step never crosses
  // more than one boundary.
  const clock = createRunClock(T_END - 0.01);
  stepRunClock(clock, 30, T0, T_END);
  assert.equal(clock.t, T_END);
  assert.equal(clock.held, "end", "a 30-second frame stepped straight through the hold");
});

test("a compressed run holds for the viewer's seconds, not for its own", () => {
  // SHIPPED BROKEN, CAUGHT IN A BROWSER. The signalling scale plays 44 model
  // minutes in 44 seconds, so its clock advances up to 3.0 of its own seconds
  // per frame. A hold counted in those was spent in one frame — measured,
  // end-hold 1 frame and start-hold 1 frame, which is the old wrap with extra
  // machinery in front of it. The fibre and cell scales run at 1x and could
  // never have shown this.
  const RUN_END = 2640;
  const clock = createRunClock(RUN_END - 1);
  let frames = 0;
  // One frame at 60 fps of a run playing 60x: 1/60 s of the viewer's time buys
  // one whole second of the model's.
  while (clock.held !== "end" && frames < 200) {
    stepRunClock(clock, 1, 0, RUN_END, DT);
    frames++;
  }
  assert.equal(clock.held, "end", "the compressed run never reached its own end");

  let heldFrames = 0;
  while (clock.held === "end") {
    stepRunClock(clock, 1, 0, RUN_END, DT);
    heldFrames++;
  }
  assert.ok(
    heldFrames * DT > HOLD_S * 0.9,
    `the hold lasted ${heldFrames} frames = ${(heldFrames * DT).toFixed(3)}s of the viewer's time — a hold ` +
      `nobody can see is the wrap it replaced`,
  );
});

test("the clock refuses to run backwards off the start of the run", () => {
  const clock = createRunClock(T0);
  stepRunClock(clock, -5, T0, T_END);
  assert.ok(clock.t >= T0, "a negative delta walked the clock off the front of the archive");
});
