import { useEffect, useState } from "react";
/**
 * Going in, and coming back out.
 *
 * A scale change used to be `window.location.hash = …` and nothing else: the
 * scene was replaced between two frames, and a viewer who pressed `↓ Cell` was
 * somewhere else before they had let go of the button. Only one of the five
 * crossings was ever a shot — `MotionScene`'s dive into a picked muscle — and
 * the other four were a slide change.
 *
 * The owner, on that: *"그게 들어가는 느낌 그리고 되게 soft한 transition"*, and
 * *"i dont want like an explanation and a blinking screen — just zooms in and
 * transitions, something very natural"*.
 *
 * ONLY THE ARRIVING SCENE MOVES, and that is deliberate rather than lazy. The
 * outgoing scene cannot be animated without holding the navigation back to wait
 * for it, and a scale change that hesitates after the press is a worse lie than
 * one that is instant. What a viewer reads as "going in" is the settling at the
 * far end, not the leaving.
 *
 * DIRECTION IS THE MEANING. Descending, the new scale opens slightly too close
 * and eases back to its framing — you have arrived inside something and are
 * finding your distance from it. Ascending, it opens slightly too far and comes
 * in. Same gesture, mirrored, so the two directions cannot be confused for one
 * another with the chrome hidden.
 *
 * NOT `beginCinematic`. That one hides the controls for 1.8 s and ends on any
 * input, because it is a beat a viewer is allowed to cut. This is 420 ms of
 * geometry settling, which is shorter than the reflex to interrupt it, and
 * cutting it would leave the canvas mid-transform. The two run together on a
 * descent and neither knows about the other.
 */

/** Long enough to read as a move, short enough that nobody waits for it. */
/**
 * How long the arriving scale takes to find its framing.
 *
 * WAS 420 AND THAT WAS A SETTLE, NOT AN ENTRY. Owner, 2026-09-04: *"그 go
 * inside면 줌하고 자연스럽게 넘어가(페이지 넘어가는 느낌말고 약간 자연스럽게
 * 진짜 들어가는 것처럼 들어가야돼)"*. 420 ms of a 4.5 % scale is a nudge — long
 * enough to notice something happened, too small and too quick to read as
 * having gone anywhere. The push it belongs to (`Descent.jsx`) is 620 ms, and
 * the two halves of one move should be one length.
 *
 * `styles.css` reads this through `--crossing-ms` rather than repeating it, for
 * the reason `Descent.jsx` gives about its own beats: a stylesheet copy is a
 * second source that drifts the first time the cut is retimed.
 */
export const CROSSING_MS = 620;

let timer = null;

/**
 * @param direction "down" to open close and pull back, "up" for the mirror,
 *        "swap" for a movement change — a blink with no zoom, because nothing
 *        is being entered. Canon H6; `styles.css` carries the measurement.
 * @param origin `{x, y}` in client pixels — the place on the glass the viewer
 *        pressed. Optional; the middle of the window when the crossing did not
 *        come from a point (the trail, the ways out).
 *
 * Written on `<html>` rather than held in React state for the same reason
 * `cinematic.js` gives: the scene swap unmounts whichever component would have
 * been holding it, halfway through the thing it describes.
 *
 * THE ORIGIN IS THE HALF THIS WAS MISSING. The rule this drives used to carry
 * its own note: *"`transform-origin: center` and nothing else: an origin at the
 * picked muscle would be better and is not available here, because the crossing
 * is drawn after the scene it came from is gone."* It is available now — the
 * magnifier knows where it stands (`MuscleLens` hands `screen` to `descend`) and
 * hands it down here, so the destination grows out of the muscle that was
 * pressed rather than out of the middle of a window the muscle was never in.
 * Centre is still the fallback, and still right for a crossing with no point.
 */
export function beginCrossing(direction, origin = null) {
  clearTimeout(timer);
  const root = document.documentElement;
  /* `style` is optional so the module stays testable against a bare document
     stub — `crossing.test.js` builds one — and so a crossing never fails to
     start because the origin could not be written. The fallbacks in the CSS
     are the same centre the rule had before this existed. */
  const px = (n) => `${Math.round(n)}px`;
  if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    root.style?.setProperty("--crossing-x", px(origin.x));
    root.style?.setProperty("--crossing-y", px(origin.y));
  } else {
    root.style?.removeProperty("--crossing-x");
    root.style?.removeProperty("--crossing-y");
  }
  root.style?.setProperty("--crossing-ms", `${CROSSING_MS}ms`);
  root.dataset.crossing = direction;
  timer = setTimeout(() => {
    delete root.dataset.crossing;
    timer = null;
  }, CROSSING_MS);
}

/**
 * DID THIS SCALE ARRIVE FROM INSIDE THE APP, OR FROM SOMEBODY'S LINK?
 *
 * The rule the scales meant to follow is `MuscleFiberVisualization.jsx`'s: *"A
 * SHARED LINK IS A DESTINATION, NOT A TOUR … Arriving with no instant is
 * arriving at the front of the scale, and that is where a pass belongs."* What
 * they implemented was "a URL with an instant is not a tour" — and the app's own
 * descent writes an instant into every URL it makes (`MotionScene.jsx`, both
 * branches: `t: +hud.t.toFixed(1)`), so the rule fired on the one arrival it was
 * never about.
 *
 * Measured 2026-08-27: descending from the bench press lands on
 * `#motion/bench_press/left-internal-oblique/fiber@1.1s`, and on arrival the
 * pass's line is null, it is still null six seconds later, and the camera sits
 * at the level preset [1.1, 1.8, 7.6] and never moves. Eight beats exist and
 * none of them play. The fibre's 25.8 s and four camera stops, and the cell's,
 * were unreachable by anyone using the app — only by a hand-typed URL with no
 * `@t`, which is the shape the app never produces.
 *
 * These two flags already outlive the scene swap, and for this reason: they are
 * attributes on <html> because "the ride crosses a scene boundary … anything
 * held inside either component is unmounted in the middle of the thing it is
 * describing". A descent sets `cinematic` for 1800 ms and a trail hop sets
 * `crossing` for 420, and the destination mounts inside both windows.
 */
export function arrivedFromInside() {
  if (typeof document === "undefined") return false;
  const flags = document.documentElement.dataset;
  return flags.cinematic !== undefined || flags.crossing !== undefined;
}

/**
 * THE COVER IS OFF — 2026-09-07. True once no `crossing` ride is over the page:
 * at once on a cold arrival, and on a descent the moment `<Descent>` has opened
 * its ring, which is when a visitor can first SEE the floor.
 *
 * WHY A SECOND READING BESIDE `arrivedFromInside`. That one also counts
 * `cinematic`, the shell's 1,800 ms recede, and the two are not the same
 * window: measured 2026-09-06 (tests/one-off/crossings.mjs), BODY → FIBER has
 * `crossing` from 648 to 1,272 ms and `cinematic` to ~1,900, so a lap that
 * waited on both would stand frozen for 0.6 s after the picture was already
 * open. Each floor's plain lap starts on THIS, because a lap that starts under
 * a closed cover spends its first 0.7 s unseen — on FIBER that is the burst the
 * ONE PULL window was cut to begin with.
 *
 * POLLED, for the reason `FiberScene` already polled: the flag is a dataset
 * attribute on <html> written by the ride, and the ride outlives the scene it
 * is handing over to, so there is nothing React-side to subscribe to.
 */
export function useCoverOpen() {
  const [open, setOpen] = useState(() => !(typeof document !== "undefined" && document.documentElement.dataset.crossing !== undefined));
  useEffect(() => {
    if (open) return undefined;
    const id = setInterval(() => {
      if (document.documentElement.dataset.crossing === undefined) {
        setOpen(true);
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, [open]);
  return open;
}


/**
 * ── THE RIDE, STARTABLE FROM INSIDE A SCENE ──────────────────────────────────
 *
 * `<Descent>` is the wash closing in and the camera diving, and it lives in
 * `main.jsx` because a dissolve needs both ends of itself — the scene it leaves
 * unmounts halfway through. Until now only the body scale could start one:
 * `MotionScene` takes an `onDescend` prop and calls it.
 *
 * SO TWO OF THE THREE SEAMS JUST CUT. Measured 2026-09-03 by clicking each of
 * them with the descent element polled from outside the page: body to fibre ran
 * 38 frames of it, fibre to cell and cell to signalling ran zero. `WayIn` called
 * `beginCrossing` and set `data-crossing="down"` on the root for 420 ms — and
 * NOTHING IN THIS APP DRAWS THAT ATTRIBUTE. Grepped every stylesheet: no rule
 * mentions it. `crossing.test.js` asserts the flag goes up and comes down and
 * passes, which is a gate on a value that reaches no pixel.
 *
 * A SIGNAL RATHER THAN A PROP CHAIN, and the shape is `beginCrossing`'s own —
 * this module is already where "moving between scales" lives, and `WayIn`
 * already imports from it. The alternative was threading `onDescend` from
 * `main.jsx` through two scene components into a control three levels down,
 * which is four files changed to move one function.
 *
 * ONE LISTENER, because there is one `<Descent>` and it is mounted once. A second
 * subscriber would mean two rides for one press.
 */
let rider = null;

/** Subscribe the ride. Returns an unsubscribe, for the effect that called it. */
export function onDescent(fn) {
  rider = fn;
  return () => {
    if (rider === fn) rider = null;
  };
}

/** Start a ride from anywhere. Silently does nothing if nothing is listening —
    a scene rendered outside the shell (a test harness, a preview) should still
    navigate rather than throw. */
export function beginDescent(ride) {
  rider?.(ride);
}
