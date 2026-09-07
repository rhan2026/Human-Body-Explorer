/**
 * A push-up, described physically rather than as hand-guessed joint angles.
 *
 * The only thing that really varies through a rep is how much the elbow is bent.
 * Everything else follows from it: the hands are planted on the floor, so a
 * flexed elbow lowers the shoulder, and a lowered shoulder pitches the whole
 * body about the toes. So the track below is one number over time, and the
 * scene solves the arms with IK to match.
 *
 * Tempo keeps the 2-1-1-1 shape generally coached for push-ups — lowering twice
 * as long as the press, with a hold at each end — compressed to a 4 s rep: 1.6 s
 * down, 0.8 s at the bottom, 0.8 s up, 0.8 s at lockout. Standard training
 * guidance rather than a measured trajectory; see the scientific standing note in
 * docs/exercise-animation.md.
 * This is hand-authored movement, not motion capture (OPEN_QUESTIONS item 5).
 */

/** Keyframes of elbow flexion, 0 = locked out at the top, 1 = bottom of the rep. */
const TRACK = [
  { t: 0.0, flex: 0.0 }, // lockout, holding
  { t: 0.8, flex: 0.0 }, // top hold
  { t: 2.4, flex: 1.0 }, // descent
  { t: 3.2, flex: 1.0 }, // bottom hold
  { t: 4.0, flex: 0.0 }, // press
];

export const PUSHUP_DURATION = TRACK[TRACK.length - 1].t;

/** Elbow flexion at time `t`, eased so the rep decelerates into each end. */
export function flexAt(time) {
  const t = ((time % PUSHUP_DURATION) + PUSHUP_DURATION) % PUSHUP_DURATION;
  let i = 0;
  while (i < TRACK.length - 2 && TRACK[i + 1].t <= t) i++;
  const a = TRACK[i];
  const b = TRACK[i + 1];
  const u = (t - a.t) / Math.max(b.t - a.t, 1e-6);
  const s = u * u * (3 - 2 * u);
  return a.flex + (b.flex - a.flex) * s;
}

/** Elbow interior angle in degrees: nearly straight at the top, deep at the bottom. */
// Down to 62 degrees at the bottom: a full-depth push-up brings the chest to
// within a couple of centimetres of the floor, which needs more than the 90
// degrees a half rep uses.
export const elbowAngleDeg = (flex) => 168 - 106 * flex;

/**
 * Trunk and leg angles. Small and nearly static — a push-up holds a plank, and
 * the give that does exist is at the neck and the scapulae, not the spine.
 */
export function supportPose(flex) {
  return {
    // Scapulae retract slightly as the chest lowers between them.
    "girdle.L": [0, 0, -6 + 10 * flex],
    "girdle.R": [0, 0, 6 - 10 * flex],
    lumbar: [1.5, 0, 0],
    thorax: [1.5, 0, 0],
    neck: [-14 - 8 * flex, 0, 0],
    head: [-8 - 4 * flex, 0, 0],
    "thigh.L": [2, 0, -1],
    "thigh.R": [2, 0, 1],
    "shank.L": [-1.5, 0, 0],
    "shank.R": [-1.5, 0, 0],
    // The shin is horizontal and the foot hangs off it, so the ankle is close to
    // its neutral angle. The toes are what change: they extend hard so the pads,
    // not the tips, take the load.
    "foot.L": [6, 0, 0],
    "foot.R": [6, 0, 0],
    // Held at zero on purpose. Not one muscle mesh is assigned to the toes —
    // the segment contains the 14 phalanges and nothing else — so any rotation
    // here swings the toe bones out from under the foot muscles that are meant
    // to wrap them. Bending the toes needs the muscles to come along, which
    // needs the skinning in rig.js working (see docs/exercise-animation.md).
    "toes.L": [0, 0, 0],
    "toes.R": [0, 0, 0],
  };
}

export function phaseAt(time) {
  const t = time % PUSHUP_DURATION;
  if (t < 0.8) return "top";
  if (t < 2.4) return "eccentric";
  if (t < 3.2) return "bottom";
  return "concentric";
}

/**
 * Normalized effort, 0 to 1. Highest coming out of the bottom, where the moment
 * arm at the shoulder and elbow is longest. Illustrative — not a force model.
 */
export function effortAt(time) {
  const t = time % PUSHUP_DURATION;
  if (t < 0.8) return 0.22;
  if (t < 2.4) return 0.22 + 0.58 * ((t - 0.8) / 1.6);
  if (t < 3.2) return 0.86;
  return 1.0 - 0.74 * ((t - 3.2) / 0.8);
}
