import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE BUBBLE HOLDS ITS SENTENCE, AND A VISITOR CAN STEP IT ON.
 *
 * Owner, 2026-09-07, of SIGNALS: *"the first two text dialogues bell tells the
 * user dissapears almost immediately after it is shown. this is not the only
 * problem; the text bubbles dissappear and appear irregularly. in the
 * explanation section involving involuntary text bubble from bell, make a small
 * arrow button that manually moves the user to bell's next text bubble.
 * voluntary inqueires from the user should function as it is now"*.
 *
 * Two faults, both measured frame by frame on that floor, and neither visible
 * to any other check here — the pass played and every sentence did appear.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("a wordless beat holds the last sentence instead of blanking it", () => {
  /* SIGNALS leaves beats wordless on purpose, "so the camera has room". `said`
     is null through them, so the sentence BEFORE them was being cleared by a
     beat that had nothing to say rather than by its own reading time: measured,
     the first sentence stood 1.6 s. Hush still means hush, and so does the end
     of the pass — only the silent beat holds. */
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /holdLast\.current = !hush && passing && !line;/, "a wordless beat no longer holds the last sentence");
  assert.match(jsx, /if \(shownRef\.current !== null && !holdLast\.current\)/, "the clear ignores the hold, so a silent beat blanks the bubble again");
});

test("the bubble hides for a trip only when a NEW sentence is waiting", () => {
  /* It also hid on `moved.current`, so a beat that moved the camera while the
     words were unchanged took the bubble away mid-sentence and gave it back
     with the next one — measured on SIGNALS, a sentence cut after 1.0 s. A
     character may walk and talk; what it must not do is say a NEW thing before
     it arrives. */
  const jsx = read("./Guide.jsx");
  const branch = jsx.slice(jsx.indexOf("} else if (want !== shownRef.current) {"), jsx.indexOf("} else if (want !== shownRef.current) {") + 600);
  assert.ok(branch, "the travel branch is gone");
  assert.doesNotMatch(
    jsx,
    /else if \(moved\.current \|\| want !== shownRef\.current\)/,
    "any move hides the bubble again, so a camera move cuts a sentence in half",
  );
});

test("the pass can be stepped on by hand, and only Bell's own explanation shows the control", () => {
  /* A beat ends when its `ms` runs out and the clock is `Date.now() - started`,
     so stepping on is subtracting what is left of this beat — the same shift
     `paused` already does the other way. It registers beside `skip`, which is
     what lets a control reach the pass without touching three floor pages
     (`tourControl.js` carries that argument). */
  const tour = read("../tour.js");
  assert.match(tour, /const next = useCallback\(\(\) => \{/, "the pass has no way to be stepped on");
  /* AND IT WAITS AT EVERY BEAT — owner: *"the dialogue should not proceed
     unless the button is clicked thats the whole point"*. `gate` is how far the
     clock may run; the tick caps `now` at it, so a beat plays and stops until
     the arrow moves the gate on. `started` absorbs the wall time that passed
     while it waited, so stepping on continues rather than jumping. */
  assert.match(tour, /const gateIndex = useRef\(0\);/, "the pass runs itself again instead of waiting for the visitor");
  assert.match(tour, /Math\.min\(raw, Math\.max\(0, endOf\(i\) - 1\)\)/, "the clock is no longer capped inside the held beat");
  assert.match(tour, /started\.current = Date\.now\(\) - to;/, "stepping on jumps by however long the visitor read for");
  /* HELD BY INDEX. The end of beat n is the start of beat n+1, so asking
     `beatAt` which beat a held millisecond belongs to answered the next one and
     the step landed a beat too far — measured, a press moved nothing visible
     because the sentence shown was already the next beat's. */
  assert.ok(!/beatAt\(beats, held\)/.test(tour), "the held beat is a time again, and the off-by-one comes back with it");
  assert.match(tour, /holdTour\(\{ id: `\$\{nonce\}:\$\{beats\.length\}`, skip, next \}\)/, "the transport cannot reach `next`");

  const jsx = read("./Guide.jsx");
  assert.match(jsx, /\{passing && pass\?\.next && !fromAside && \(/, "the arrow is not gated on a running pass, or shows on a reply");
  /* OUTSIDE THE BUBBLE, and it has to be: `useTour` now stops at every beat and
     only this moves it on, so a control inside a bubble that `--hushed` hides
     would strand the pass on a wordless beat. */
  const say = jsx.slice(jsx.indexOf('<span className="guide__say"'), jsx.indexOf("</span>", jsx.indexOf('<span className="guide__say"')));
  assert.ok(say && !say.includes("guide__next"), "the arrow is back inside the sentence's box, where a wordless beat hides it");
  assert.ok(
    jsx.indexOf('className="guide__next"') > jsx.indexOf('className="guide__bubble"'),
    "the arrow is drawn before the bubble; it belongs beside the box, outside the words",
  );
  assert.match(jsx, /className="guide__next"/);
  assert.match(jsx, /setFromAside\(aside\.current != null\)/, "an answer the visitor asked for would carry the pass's arrow");

  /* And a press on it is not a press on the scene: the walk arms `pointerdown`. */
  assert.match(read("./useWalk.js"), /\.guide__next/, "pressing the arrow ends the body walk");

  const css = read("./guide.css");
  const rule = css.match(/\n\.guide__next\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /position:\s*absolute/, "the control sits in the flow and moves what it is beside");
  assert.match(rule, /bottom:\s*calc\(var\(--guide-body\)/, "the arrow no longer sits level with the character, so it moves with the sentence's height");
  assert.match(rule, /pointer-events:\s*auto/, "the box is `pointer-events: none`, so the arrow cannot be pressed");
  assert.match(css, /\.guide--left \.guide__next \{ left:/, "the arrow no longer takes the corner away from the tail");
  assert.match(css, /\.guide--right \.guide__next \{ right:/);
});
