/**
 * THE ONE WAY TO ASK THE GUIDE TO SAY ITS LINE AGAIN.
 *
 * Owner, 2026-09-06: the bubble goes away once its sentence has had its reading
 * time, and *"if the user requests to reshow the text through the text box
 * feature our other agent is working on, then the same content should
 * reappear"*. That text box is not in this tree yet, so this is the seam it
 * plugs into: call `sayAgain()` and the guide brings back exactly the sentence
 * it last said, with its pop, for another reading time. Nothing is passed — the
 * guide already knows its line, and a caller that had to supply the words would
 * be a second copy of them.
 *
 * A window Event, the shape `PASS_ENDED` in `tour.js` already uses: the guide
 * is mounted by four scenes and the text box will live in the shell, and a
 * prop threaded through all of them for one verb is a wire nobody wants to
 * hold. `guideSaid.test.js` holds the name — the text box dispatches it.
 */
export const SAY_AGAIN = "hpe:guide-say-again";

export function sayAgain() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SAY_AGAIN));
}
