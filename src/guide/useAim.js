import { useEffect, useState } from "react";

/**
 * Re-reads where the guide should stand, a few times a second.
 *
 * WHY THIS IS A POLL AND NOT A SUBSCRIPTION. The three deep scales project
 * their anchors inside the render loop, sixty times a second, into a ref — that
 * is the cheap place to do it, because the camera and the model are already
 * there. Turning each of those frames into a React render to move one box is
 * the mistake the body scale's 10 Hz readout already made and had taken back
 * out. So the loop writes, this reads, and the spring in `Guide.jsx` draws
 * every frame regardless of when the target last changed.
 *
 * `useWalk` picked the same rate for the same job, and `PickTrack` before that.
 */
const AIM_MS = 50;

/**
 * @param resolve `() => {x, y, r?} | null` in stage pixels; identity matters,
 *                so scenes should hand a `useCallback`.
 * @param active  whether there is anything to stand beside right now
 */
/** Within half a pixel and the same radius — the test the identity rule uses. */
const still = (a, b) =>
  !!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && (a.r ?? 0) === (b.r ?? 0);

export function useAim(resolve, active) {
  const [at, setAt] = useState(null);

  useEffect(() => {
    if (!active) {
      setAt(null);
      return undefined;
    }
    /* THE SAME OBJECT BACK WHEN NOTHING MOVED. A new `{x, y}` every 50 ms would
       re-run `Guide`'s frame effect twenty times a second and restart its
       spring each time, which is a character that never settles.
       A LIST IS ALLOWED TOO, and holds the same identity rule — `Guide`'s
       `clear` is a set of circles a floor says not to stand on, and SIGNALS has
       three of them (the outcomes' ending arcs) where ENERGY has one. */
    const aim = () =>
      setAt((prev) => {
        const p = resolve();
        if (!p) return null;
        if (Array.isArray(p)) {
          return Array.isArray(prev) && prev.length === p.length && p.every((q, i) => still(prev[i], q))
            ? prev
            : p;
        }
        return still(prev, p) ? prev : p;
      });
    aim();
    const id = setInterval(aim, AIM_MS);
    return () => clearInterval(id);
  }, [resolve, active]);

  return at;
}
