/**
 * What a motion is, and what it is handed.
 *
 * The shape exists so that a movement is data plus one solve function, and the
 * scene knows nothing about any particular exercise. Adding the seventh should
 * touch exactly one new file and one line of the registry.
 *
 * ```
 * ExerciseMotionDefinition = {
 *   id            canonical exercise key, matching muscle-map.json
 *   label         display name
 *   duration      seconds for one full loop
 *   loop          true for everything so far; kept explicit
 *   roles         muscle-map.json exercise key driving the activation colour
 *   camera        key into cameras.js — framing is stored apart from joint data
 *   props         scene furniture this movement needs: "floor", "bar", "bench"…
 *   markers       which measured contacts it wants built (see MotionScene)
 *   phases        [{ at, name, label }] biomechanical phases, sorted by `at`
 *   effortAt(t)   0..1, drives the activation glow. Illustrative, not a force model
 *   note          one line stating what is hand-authored. REACHES NO PIXEL since
 *                 2026-08-30: it rendered in the body scale's footer behind
 *                 `SHOW_FIGURES` — `{motion.note} Hand-authored kinematics, not
 *                 motion capture.` — and canon D4 deleted the footer outright
 *                 ("\ubc11\uc5d0 footer\ub3c4 \uc5c6\uc5b4"). Kept and unread, the same standing
 *                 `workoutMapping.js`'s `mapWorkout` has and for the same reason:
 *                 where it goes back is a placement decision, not a rename.
 *   setup(ctx)    called once when the motion becomes active; returns its state
 *   frame(t,ctx,state)  poses the rig for time t
 * }
 * ```
 *
 * `ctx` is the same object for every motion:
 *
 * ```
 * ctx = {
 *   rig       the parsed rig.json
 *   root      the rig root bone
 *   groups    Map of segment name -> THREE.Bone
 *   body      measureBody(rig): limb lengths, rest directions, foot frames
 *   markers   Map of marker name -> THREE.Object3D riding the body
 *   fibres    volume-preservation markers, updated by the scene
 * }
 * ```
 *
 * Two rules the scene relies on and cannot check for you:
 *
 * 1. **`frame` must be a pure function of `t`.** Scrubbing, pausing and the
 *    tests all set the clock directly. A motion that integrates per-frame state
 *    drifts, and drift on a loop is the defect the whole system is built to
 *    avoid. Anything expensive and constant belongs in `setup`.
 * 2. **`frame` must call `applyPose` before anything else**, because that is
 *    what clears every segment back to a known rotation. Solving a limb and
 *    *then* posing overwrites the solve.
 */

/**
 * Segments that must never be rotated, whatever a motion asks for.
 *
 * The toes USED to live here: they hold 14 phalanges and no muscle, so
 * rotating them swung bone out from under the flesh. That stopped being true
 * when the skin chains grew past the MTP row — every muscle that reaches the
 * toes now blends across the measured hinge, the same contract the fingers
 * ship under — so the freeze came off. A movement that lifts its heel now
 * OWES its toes an extension pose, or the frozen-toe defect returns as
 * toes-through-the-floor at toe-off.
 */
export const FROZEN_SEGMENTS = new Set([]);

/** Strips rotations off segments that hold no muscle. */
export function guardPose(pose) {
  for (const name of FROZEN_SEGMENTS) {
    if (pose[name]) pose[name] = [0, 0, 0];
  }
  return pose;
}
