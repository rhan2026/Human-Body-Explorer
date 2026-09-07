import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * A SENTENCE IS SAID, AND THEN IT IS PUT AWAY — AND CAN BE ASKED FOR AGAIN.
 *
 * Owner, 2026-09-06: *"the text bubble should disappear after a few seconds
 * after the appropriate reading time of the text within has past. if the user
 * requests to reshow the text through the text box feature our other agent is
 * working on, then the same content should reappear"*.
 *
 * Three things this pins, each of which a browser case would miss because the
 * words are in the DOM either way:
 *
 *   1. The reading time is `tour.js`'s `readingMs` — the rule every other line
 *      on every scale already obeys. A second definition here would drift.
 *   2. The way back is ONE seam, `sayAgain()` in `sayAgain.js`, a window Event
 *      like `PASS_ENDED`: the text box is another agent's and lives in the
 *      shell; the guide is mounted by four scenes. A prop through all of them
 *      for one verb is a wire nobody wants to hold.
 *   3. The bubble FADES; it does not leave the layout. `display: none` takes its
 *      height out of the box, and the box is translated up by its own height,
 *      so the character's feet would drop by a bubble when the words go.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `guide.css has no rule for \`${selector}\``);
  return m[1];
}

test("the bubble leaves after its reading time, by the rule every other line obeys", () => {
  const jsx = read("./Guide.jsx");
  assert.match(
    jsx,
    /import \{[^}]*\breadingMs\b[^}]*\} from "\.\.\/tour\.js"/,
    "the guide times its sentence by a rule of its own — two definitions of a reading time drift apart",
  );
  assert.match(jsx, /const LINGER_MS = \d+;/, "the few seconds after reading are no longer a named number");
  assert.match(jsx, /readingMs\(shown\) \+ LINGER_MS/, "the bubble no longer goes away once its sentence has been read");
});

test("asking again brings the same sentence back, through the one seam the text box has", () => {
  const bus = read("./sayAgain.js");
  assert.match(bus, /export const SAY_AGAIN = "hpe:guide-say-again";/, "the event's name changed — the text box dispatches this string");
  assert.match(bus, /export function sayAgain\(/, "the verb the text box calls is gone");
  assert.match(bus, /dispatchEvent\(new Event\(SAY_AGAIN\)\)/, "`sayAgain()` no longer dispatches on window");
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /addEventListener\(SAY_AGAIN,/, "the guide no longer listens for the ask");
  assert.doesNotMatch(
    jsx,
    /import \{[^}]*\bsayAgain\b[^}]*\} from "\.\/sayAgain\.js"/,
    "the guide imports its own ask — the seam is for the text box, and the guide already has its line",
  );
});

test("the words go, the feet stay: the bubble fades rather than leaving the layout", () => {
  const css = read("./guide.css");
  const said = rule(css, ".guide--said .guide__bubble");
  assert.match(said, /opacity:\s*0/);
  assert.match(said, /visibility:\s*hidden/, "a bubble at opacity 0 is still in the accessibility tree and still under the pointer");
  assert.doesNotMatch(said, /display:\s*none/, "`display: none` takes the bubble's height out of the box and drops the character's feet by that much");
});
