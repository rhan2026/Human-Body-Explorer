/**
 * The one clock every finite run loops on — and the reason the loop is an EDIT
 * rather than a jump.
 *
 * THE DEFECT THIS REPLACES. All three scales below the body replay a finite
 * archive in a tab that is not finite, and all three wrapped the same way:
 * `if (t > tEnd) { t -= span; lap += 1 }`. That fires in the middle of a moving
 * picture. The frame before the seam and the frame after it are both frames of a
 * running scene, so the eye joins them into one event — and the event it reads is
 * a recovery. Measured on `ampk_francis_soce_on`, the seam is invisible in force
 * (0.00014 -> 0.00053) and violent in the SR store: 716.6 -> 941.2 µM in one
 * frame, a 31% refill of the one quantity this model's fatigue lives in. The
 * fibre, cell and signalling readouts each carried a sentence apologising for it.
 * A caption explaining a confusing drawing is a bug report about the drawing.
 *
 * THE TREATMENT, AND WHY THIS SHAPE. The run ends on its own last archived
 * sample and everything holds still; the cut happens in a single frame while
 * nothing else is moving; the first sample is held still too before the run
 * begins again. Motion, stillness, cut, stillness, motion.
 *
 * That works because a recovery is a PROCESS — it needs frames, and the
 * quantities move through them together. Nothing physiological happens during a
 * frozen picture, so a jump bracketed by stillness has nowhere to be read as
 * physiology; the only thing it can be is the recording starting over. The
 * stillness is the punctuation, and it costs nothing but time nobody was using.
 *
 * WHAT WAS REJECTED, because each is a live temptation:
 *   - A rewind. Traversing the archive backwards fast is honest about the data
 *     and lethal on screen: ten repetitions replayed in half a second is a 20 Hz
 *     flicker, straight through the ≥3 Hz band `tests/photosensitivity.spec.js`
 *     gates. Slow it under 3 Hz and it stops reading as a rewind.
 *   - A blank, or a fade to the paper. A whole-scene luminance step is the same
 *     photosensitivity risk with none of the meaning.
 *   - Easing the quantities back to their starting values. Every frame of that
 *     ease is a row the archive does not hold. `scenarioData.js` snaps to
 *     archived samples and interpolates nothing on purpose; a transition that
 *     interpolated would be the drawing inventing the data it is labelled
 *     `Derived` for.
 *
 * CONTRACT — `held` is null while the run is playing, "end" on the closing hold
 * and "start" on the opening one, and `lap` ticks on the cut frame and only
 * there. `dt` moves the run's own clock and `wallDt` spends the hold; they are
 * the same number only where a run plays at 1x. Derived points to keep in step:
 * `FiberScene.jsx`, `cell/CellScale.jsx` and `signalling/SignallingScale.jsx`,
 * which are the three scenes that step this clock; `runLoop.test.js` holds the
 * shape.
 */

/**
 * How long each end of the cut is held, IN THE VIEWER'S SECONDS.
 *
 * Long enough that a viewer registers the picture has stopped — under about half
 * a second a freeze reads as a dropped frame — and short enough that two of them
 * are a beat in a 13 s run rather than an interruption of it.
 *
 * WALL SECONDS, NOT RUN SECONDS, and the difference is not academic: it shipped
 * broken for an afternoon. The fibre and cell scales replay a body clock at 1x,
 * so the two units are the same number there and the bug was invisible. The
 * signalling scale compresses 44 model minutes into 44 seconds — its clock
 * advances up to 3.0 of its own seconds per frame — so a hold counted in run
 * seconds was spent in ONE frame. Measured in a browser: end-hold 1 frame,
 * start-hold 1 frame, which is the old wrap with extra machinery. The hold is a
 * thing a person watches, so it is counted in the seconds that person is living
 * through.
 *
 * The scenes hand this their own clamped delta, so on a renderer slow enough to
 * be clamped the hold runs LONGER than 0.9 s of wall time — 1.9 s measured on
 * SwiftShader at 8 fps. That is the safe direction (more stillness around the
 * cut, never less) and it is why a browser measurement of this will not read
 * 0.9 on a machine without a GPU.
 */
/* 0.9 -> 0.5 ON 2026-09-06, and the number is the ENERGY lane's after they
   watched the loop with the cell's view toggle gone. Their measurement: at 0.9 s
   each end the still time is 73 % of a 2.45 s cycle, so a cold arrival sees a
   held picture first and the repetition second — the rep reads as a pulse inside
   a pause rather than as the thing the floor is showing. At 0.5 it is 61 % and
   the seam still reads as a restart, because what makes the cut legible is the
   snap (the model resets, no recovery flights carry over) and not the length of
   the silence around it.
   0.5 IS THE FLOOR, not a step on the way down: below it this stops reading as a
   hold at all and becomes a stutter, which is the failure the hold exists to
   prevent. The paragraph above still applies — a clamped renderer holds LONGER
   than this in wall time, which is the safe direction. */
export const HOLD_S = 0.5;

export const createRunClock = (t) => ({ t, lap: 0, held: null, holdLeft: 0 });

/**
 * Advance `clock` by `dt` seconds within [t0, tEnd]. Mutates and returns it —
 * these are per-frame objects in a `useRef`, and allocating one per frame at
 * 60 fps is a garbage collector the scenes do not need.
 *
 * ONE BOUNDARY PER STEP, deliberately. A backgrounded tab hands back a delta of
 * whole seconds, and a step that crossed both the hold and the cut would put the
 * jump back in the middle of a moving picture — the exact defect this file
 * exists to remove. The scenes clamp their own delta as well; this is the guard
 * that does not depend on them remembering to.
 */
export function stepRunClock(clock, dt, t0, tEnd, wallDt = dt) {
  if (clock.held) {
    clock.holdLeft -= Math.max(0, wallDt);
    if (clock.holdLeft > 0) return clock;
    if (clock.held === "end") {
      // The cut. One frame, straight to the first archived sample.
      clock.t = t0;
      clock.lap += 1;
      clock.held = "start";
      clock.holdLeft = HOLD_S;
    } else {
      clock.held = null;
      clock.holdLeft = 0;
    }
    return clock;
  }

  // Clamped at both ends. A shared link can name any instant and a negative
  // delta must not walk the clock off the front of the archive, where `sample`
  // would answer every frame with `outOfRange` and the scene would look broken.
  clock.t = Math.max(t0, clock.t + dt);
  if (clock.t >= tEnd) {
    clock.t = tEnd;
    clock.held = "end";
    clock.holdLeft = HOLD_S;
  }
  return clock;
}
