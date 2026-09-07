/**
 * Whether this browser can give us a 3D context, and what to say when it cannot.
 *
 * WHY THIS FILE EXISTS. Q35 R2, 2026-08-30. Measured with `getContext` stubbed
 * to refuse every webgl variant: the front door renders, the muscle list and the
 * search box work, the stage is EMPTY, and the only sign anything went wrong is
 * `THREE.WebGLRenderer: Error creating WebGL context` in the console. Nothing on
 * the page says a word.
 *
 * `SceneBoundary` does not catch it and cannot: React error boundaries see
 * errors thrown during render, and the renderer is created inside an effect, so
 * the throw happens after the tree is already committed. A capability check
 * before the `<Canvas>` is mounted is the only place this can be caught in
 * time.
 *
 * CLAUDE.md §9 puts loading, progress and error copy in the one class of text
 * that may never be deleted. This is that class, and it was missing rather than
 * deleted — which is the same hole from the reader's side.
 *
 * The check runs once and is cached: creating a probe context per scale is four
 * contexts on a machine that has already said it has none to give.
 *
 * AND THE SECOND SENTENCE WAS FALSE WHEN IT WAS FIRST WRITTEN. It said
 * "everything written on the page is still here — the numbers, the records and
 * the way to every source", and measuring the page with WebGL refused gave
 * **0 plates and 0 badges** on all three deep scales: the plates are positioned
 * against the scene and the readout is inside it, so what survived was the
 * transport, the level captions, the footer's provenance sentence, the
 * breadcrumb and the trail. Words, not numbers. A reassurance that is wrong is
 * worse than no message, which is what this file was written to replace.
 *
 * FOUR OF THOSE FIVE HAVE SINCE GONE, and the message below is right anyway
 * because it promises nothing: canon D3 and D4 (2026-08-30) took the transport
 * off the deep scales, the footers, the breadcrumb and the trail. What a
 * WebGL-refused page keeps today is the level captions, this notice, and the
 * drawer. If that ever becomes the thing to state, measure it again — the list
 * above is what was measured on 2026-08-27 and nothing more.
 */

let cached = null;

/** True when a WebGL context can be created here. Cached after the first call. */
export function hasWebGL() {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return (cached = true);
  try {
    const c = document.createElement("canvas");
    cached = !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * What stands where the scene would be.
 *
 * It says what is missing, what still works, and what to do — the three things
 * an error message owes a reader. It does not say "your browser is old": the
 * cause is as often a disabled setting, a virtual machine or a blocked
 * extension, and naming the wrong cause sends someone to fix the wrong thing.
 */
export function NoWebGL({ what = "This scene" }) {
  return (
    <div className="fatal" data-testid="no-webgl">
      <p>
        <strong>{what} needs 3D graphics, and this browser is not providing them.</strong>{" "}
        WebGL is switched off, unavailable in this window, or blocked by an extension.
      </p>
      <p>
        The words are still here: which archived run this plays, the paper behind it, and the way
        down. The numbers are not — every one of them is read off the scene frame by frame, so with
        no scene there is nothing to read.
      </p>
    </div>
  );
}
