/**
 * The ride carries no interface.
 *
 * A scale transition is a shot, not a screen: the reference it is cut against
 * has zero chrome on it for its whole length, and the previz frame that started
 * this had the exercise rail clipped across the establishing beat and the
 * control pills sitting over the figure. So for the length of the beat the
 * controls recede, and they come back when it settles.
 *
 * The state is one attribute on <html>, not React state, because the ride
 * crosses a scene boundary: main.jsx swaps MotionScene for DevFiberScene
 * halfway through it, so anything held inside either component is unmounted
 * in the middle of the thing it is describing. One attribute outlives both, and
 * the hiding itself is a single CSS rule in styles.css — no component ever
 * learns that it is in a mode, and nothing has to be threaded through the two
 * scenes to reach the pills.
 *
 * CONTRACT — that rule lists controls and nothing else. Loading, progress,
 * error and attribution copy is not in it and must not be added to it: those
 * say what is happening or who owns the data, and neither stops being true
 * because a transition is playing (CLAUDE.md §9).
 *
 * ponytail: one beat at a time, module-global. There is one viewer and one
 * ride; a second begin() simply replaces the first, which is the right answer
 * for a re-triggered transition anyway.
 */

/**
 * How long the destination gets before its controls come back.
 *
 * A calibration knob, not a constant of nature — it is a cut length, judged by
 * eye against the reference. Exported because tests/descent.spec.js asserts
 * that an interrupt beat the timer, and a hard-coded copy of this number would
 * turn that assertion into a coincidence the first time it is retuned.
 */
export const SETTLE_MS = 1800;

/**
 * What counts as the viewer asking for the controls back.
 *
 * Deliberately not pointermove: a mouse resting anywhere over the stage jitters
 * by a pixel and would end every ride before it started. These four are all
 * deliberate — a press, a key, a scroll, a touch.
 */
export const INTERRUPTS = ["pointerdown", "keydown", "wheel", "touchstart"];

let timer = null;

/** Chrome back, timer and listeners gone. Safe to call when nothing is running. */
function end() {
  clearTimeout(timer);
  timer = null;
  for (const type of INTERRUPTS) window.removeEventListener(type, end, true);
  delete document.documentElement.dataset.cinematic;
}

/**
 * Start the beat.
 *
 * Any input ends it early, which is why there is no separate button to find:
 * the viewer reaching for a control is the one signal that always outranks the
 * shot, and the affordance that is always available is every input there is.
 * Capture phase, so the press that asks for the controls back is not also
 * swallowed by whatever it landed on.
 */
export function beginCinematic(ms = SETTLE_MS) {
  end();
  document.documentElement.dataset.cinematic = "";
  timer = setTimeout(end, ms);
  for (const type of INTERRUPTS) window.addEventListener(type, end, true);
}
