/**
 * Timing and easing, shared by every motion.
 *
 * Kept out of the motion files because tempo is a house convention rather than a
 * property of any one movement: a loaded lowering is controlled, a lift
 * accelerates out of the bottom, and nothing ever changes direction abruptly.
 * `what-good-looks-like.md` states the push-up's 2-1-1-1 as the reference.
 *
 * Every curve here has zero derivative at both ends. That is not decoration — a
 * looping movement whose velocity does not match across the seam reads as a
 * visible tick once per rep, and it is the first thing anyone notices.
 */

export const clamp01 = (u) => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Smoothstep. Symmetric, zero velocity at both ends. */
export const smooth = (u) => {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
};

/** Smootherstep — zero acceleration too. For the seam of a cyclic movement. */
export const smoother = (u) => {
  const t = clamp01(u);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * A lift. Smoothstep biased early, so the quickest part of the travel is just
 * off the bottom where a real rep is fastest, decelerating into lockout.
 *
 * The exponent is applied to smoothstep rather than to `u` so the derivative at
 * u = 0 stays zero: smooth(u) ~ 3u^2 near zero, and (3u^2)^0.78 still has zero
 * slope there. A plain `1 - (1-u)^3` does not, and puts a corner right at the
 * point the movement is meant to look strongest.
 */
export const press = (u) => Math.pow(smooth(u), 0.78);

/** A controlled lowering: the mirror of `press`, slowest into the bottom. */
export const lower = (u) => 1 - press(1 - clamp01(u));

export const linear = (u) => clamp01(u);

const EASES = { smooth, smoother, press, lower, linear };

export const easeByName = (name) => EASES[name] ?? smooth;

/** Wraps a time into [0, duration). Negative times wrap forward, not backward. */
export const wrap = (t, duration) => ((t % duration) + duration) % duration;

export const mix = (a, b, u) => a + (b - a) * u;

/**
 * Samples a keyframe track of `{ t, v, ease }` at `time`, looping.
 *
 * `ease` names the curve used across the span that *ends* at that key, so a
 * keyframe describes how the movement arrives at it. Defaults to smoothstep,
 * which is what the push-up uses.
 */
export function sampleTrack(track, time, duration = track[track.length - 1].t) {
  const t = wrap(time, duration);
  let i = 0;
  while (i < track.length - 2 && track[i + 1].t <= t) i++;
  const a = track[i];
  const b = track[i + 1];
  const span = Math.max(b.t - a.t, 1e-6);
  return mix(a.v, b.v, easeByName(b.ease)((t - a.t) / span));
}

/**
 * The phase containing `time`, from a list of `{ at, name, label }` sorted by
 * `at`. Returns the last phase for any time past the final boundary, which is
 * what makes a loop read correctly at t just under the duration.
 */
export function phaseAt(phases, time, duration) {
  const t = wrap(time, duration);
  let found = phases[0];
  for (const p of phases) {
    if (p.at <= t) found = p;
    else break;
  }
  return found;
}

/**
 * A smooth cyclic pulse in [0, 1], one full cycle as `p` goes 0 to 1.
 *
 * Sine rather than a keyframe track wherever the movement genuinely is
 * oscillatory — breathing, a body roll, the vertical bob of a stride. Using it
 * for a *rep* is the mistake `what-good-looks-like.md` warns about; using it for
 * an oscillation is just what an oscillation is.
 */
export const cycle = (p) => 0.5 - 0.5 * Math.cos(p * Math.PI * 2);

/** Signed version of `cycle`, in [-1, 1]. */
export const swing = (p) => Math.sin(p * Math.PI * 2);
