/**
 * THE GUIDE SAYING IT HAS ARRIVED, AND IS ABOUT TO SPEAK.
 *
 * Owner, 2026-09-06: *"when it has to move to a designated spot to explain, it
 * should hop onto the spot and the explaining should start when the character
 * has arrived at the spot"*. The explaining includes its time. A beat's `ms` is
 * how long a sentence stands, and `useWalk` used to start it the frame the beat
 * began, with the character still crossing the stage — watched on SIGNALS: the
 * first sentence stood for 1.1 s of its beat. So `Guide.jsx` says so here the
 * frame it hands a line over on arrival, and the walk's patience starts then.
 *
 * A window Event, the shape `PASS_ENDED` in `tour.js` and `SAY_AGAIN` next door
 * use, for the same reason: the guide is mounted by four scenes and the walk is
 * a hook in each, and a callback threaded through all of them for one verb is a
 * wire nobody wants to hold. `guideArrives.test.js` holds the name.
 */
export const GUIDE_ARRIVED = "hpe:guide-arrived";

export function guideArrived() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(GUIDE_ARRIVED));
}
