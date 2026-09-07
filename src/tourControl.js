/**
 * The running pass, where the transport can reach it.
 *
 * WHY THIS EXISTS. `Ways` draws Pause, the way up, Go Home and — as of
 * 2026-09-06 — Skip, and it is mounted by each floor's page. The pass is run by
 * `useTour` deep inside that floor's canvas. The two have never had a way to
 * speak: the floors pass `playing` up to `Ways` by hand, and a Skip button would
 * have needed the same wiring added to three pages at once.
 *
 * TWO OF THOSE PAGES BELONG TO OTHER LANES, and they are editing them right now.
 * A module the pass registers with and the transport reads is the one shape that
 * adds a control to every floor without touching any floor — the same reason
 * `crossing.js` exists.
 *
 * ONE PASS AT A TIME, which is not an assumption but the app's shape: one scale
 * is mounted, one storyboard plays. A second registration replaces the first, and
 * an unmount clears only its own — so a floor that leaves while another arrives
 * cannot blank out the arriving one's Skip.
 */

let current = null;
const listeners = new Set();

function announce() {
  for (const fn of listeners) fn(current);
}

/**
 * The pass says it is running and how to end it.
 *
 * @param entry `{ id, skip }` — `id` identifies the registration so an unmount
 *   can tell "mine" from "the one that replaced me", `skip` ends the pass.
 * @returns a function that clears this registration if it is still the live one.
 */
export function holdTour(entry) {
  current = entry;
  announce();
  return () => {
    if (current?.id === entry.id) {
      current = null;
      announce();
    }
  };
}

/** What is running, or null. Read by `Ways`; nothing else should need it. */
export function runningTour() {
  return current;
}

/** Subscribe to changes. Returns an unsubscribe. */
export function onTour(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
