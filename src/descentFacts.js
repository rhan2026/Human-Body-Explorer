import { FILAMENT } from "./fiber/fiberSimulation.js";

/**
 * The one comparison the descent carries down: the span this muscle mesh was
 * measured at, against the resting sarcomere the fibre scale draws.
 *
 * Both ends are read, never typed. The span comes from `fibreGeometry`, which
 * reads rig.json; the sarcomere is `FILAMENT.restLength`, the same constant the
 * fibre simulation runs on — so if either end moves, the ratio moves with it and
 * the screen cannot drift from the model.
 *
 * CONTRACT — what the three numbers are allowed to claim, because the whole
 * point of the card is that they are ours rather than a stock zoom:
 *   spanMm       Measured. The end-to-end span of THIS mesh in the rest pose
 *                (fibreGeometry.js's contract). Not a histological fascicle
 *                length, not a fibre length, and no pennation was recorded — so
 *                whatever puts it on screen has to say "this mesh, rest pose".
 *   sarcomereUm  Measured. Standard vertebrate resting sarcomere, declared as
 *                such in fiberSimulation.js:13-17.
 *   ratio        Derived, and only that: it is spanMm / sarcomereUm and nothing
 *                more. It is NOT a count of sarcomeres in this muscle — real
 *                fascicles are shorter than the muscle that holds them and sit
 *                at an angle to it, neither of which anything here measured.
 *
 * Two significant figures on the ratio because the sarcomere has two. 0.1581 m
 * over 2.2 um is 71863.6..., and "71,864" would invent three digits.
 *
 * @param spanM metres, as `fibreGeometry(...).fascicleLengthM` gives it
 * @returns {{spanMm: number, sarcomereUm: number, ratio: number} | null}
 *          null when nothing measured a span — 170 of the 467 muscle meshes.
 */
export function descentFacts(spanM) {
  if (typeof spanM !== "number" || !Number.isFinite(spanM) || spanM <= 0) return null;
  return {
    spanMm: +(spanM * 1000).toPrecision(3),
    sarcomereUm: FILAMENT.restLength,
    ratio: +((spanM * 1e6) / FILAMENT.restLength).toPrecision(2),
  };
}
