import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE WAIT AND THE FAILURE, IN BELL'S BUBBLE — the API lane's one block in
 * `Guide.jsx`, 2026-09-07. The answer itself is the peer's: handed in through
 * `bellSays` and typed like any line. What the character shows while the
 * model runs is the three dots, and when it cannot answer, the error line —
 * never faded (§9), cleared by the next question — and neither is hidden for
 * a trip. Nothing here writes the store; `ask/bridge.js` does.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const jsx = strip(read("./Guide.jsx"));
const css = strip(read("./guide.css"));

test("the character reads the store, and shows the dots or the error line instead of the line", () => {
  assert.match(jsx, /import \{ useBellSays \} from "\.\.\/ask\/bellSays\.js"/);
  assert.match(jsx, /const answering = says\.status !== "idle";/);
  assert.match(jsx, /guide__dots/, "the wait is the three dots, not a word");
  assert.match(jsx, /says\.status === "error" \? \(\s*says\.text/, "the failure is its own line");
  assert.doesNotMatch(jsx, /says\.text\s*\}\s*\{says\.status === "streaming"|guide__answer/, "the streamed text is not shown here — the bubble types the whole answer through bellSays");
  assert.doesNotMatch(jsx, /setBellSays|dismissBellSays/, "the guide only reads the store");
});

test("the wait is never hidden for a trip, never put away on the line's clock, and always announced", () => {
  assert.match(jsx, /going && !answering \? " guide--going"/);
  assert.match(jsx, /shown && said && !answering \? " guide--said"/);
  assert.match(jsx, /const spoken = announce \|\| answering;/);
  assert.doesNotMatch(jsx, /answerSaid/, "a wait or an error does not fade");
});

test("the peer's answer path is intact under the block", () => {
  assert.match(jsx, /addEventListener\(BELL_SAYS,/);
  assert.match(jsx, /const want = aside\.current \?\? \(pending\.current \|\| null\);/);
});

test("a box that grows does not move the character, and the peer's box takes what was asked down on a failure", () => {
  /* Measured 2026-09-07 with the first answers handed in at home: the bubble
     made the box ~300 px wider in one frame and the bounded spring left the
     character at x 1287 on a 1280 stage for most of a second.
     THE FIX IS NOW STRUCTURAL, AND THIS CASE FOLLOWS IT. `lastW` took the
     growth off the box's x in the frame it happened, which is this fault
     patched on the one side it was seen from. The loop springs the CHARACTER's
     position now and derives the box from it every frame, so a bubble that
     appears, goes away, or merely re-wraps grows away from a character that has
     not moved — on either side, and hushed as well. Owner, of the same fault
     from the other end: *"it mvoes fast here slower another teleports somewhere
     else"*, measured at 2,295 px/s against a walking pace of 560. */
  assert.match(jsx, /const target = \{ x: pick\.x \+ charOffset, y: pick\.y \};/, "the loop tracks the box again, so a growing bubble moves the character");
  assert.match(jsx, /translate3d\(\$\{pos\.current\.x - charOffset\}px/, "the box is no longer derived from where the character has to stand");
  assert.ok(!/lastW/.test(jsx.replace(/\/\*[\s\S]*?\*\//g, "")), "the one-sided correction is back alongside the structural one, and they will double-count");
  const box = strip(read("./AskBell.jsx"));
  assert.match(box, /if \(says\.status === "error"\) setAsked\(null\);/, "what was asked must come down when the character says it failed");
  assert.match(box, /addEventListener\(BELL_SAYS, answered\)/);
  assert.match(box, /addEventListener\(SAY_AGAIN, answered\)/);
});

test("the sheet draws the dots with the assistant's restraint", () => {
  const dots = css.match(/\n\.guide__dots span\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(dots, /animation:\s*guide-think 1\.1s/);
  assert.match(css, /@keyframes guide-think/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^@]*\.guide__dots span\s*\{[^}]*animation:\s*none/);
  assert.match(css, /\n\.guide__say--thinking\s*\{[^}]*justify-content:\s*center/);
});
