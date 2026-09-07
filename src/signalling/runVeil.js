import { HOLD_S } from "../runLoop.js";

/**
 * The veil over the run's seam — fifth brief §8, the owner's own recipe:
 *
 *   44.9 min final state → 200 ms scene fades toward paper → hidden reset to 0
 *   → 250 ms idle stone network fades back in
 *
 * and the rule under it: *"data를 interpolate하지 않고 scene transition만 한다"*.
 * Thirty-two seconds of signal used to go back to the stone in one frame; a
 * value eased across the cut would have been a row the archive does not hold.
 * So the biology is untouched — `runLoop.js` still ends still, cuts in one
 * frame and starts still — and this is only a number for a paper-coloured
 * sheet over the stage, read off the clock's own holds: up over the last
 * `VEIL_OUT_S` of the closing hold, full on the cut frame, down over the first
 * `VEIL_IN_S` of the opening hold. Both fit inside `HOLD_S`; `runVeil.test.js`
 * holds that, because a fade longer than the hold would run into the moving
 * picture.
 */
export const VEIL_OUT_S = 0.2;
export const VEIL_IN_S = 0.25;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** 0 = the picture, 1 = paper. `clock` is a `runLoop.js` run clock. */
export function veilOf(clock) {
  if (!clock?.held) return 0;
  if (clock.held === "end") return clamp01(1 - clock.holdLeft / VEIL_OUT_S);
  return clamp01((clock.holdLeft - (HOLD_S - VEIL_IN_S)) / VEIL_IN_S);
}
