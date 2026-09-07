import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE WALK LETS A VISITOR OUT.
 *
 * `useWalk` has returned a `stop` since it was written and NOTHING EVER CALLED
 * IT — found on 2026-09-02 by grepping every scene for `.stop()` and getting
 * nothing back. What that cost grew with the narration: the cell's walk is
 * thirteen beats and seventy-eight seconds since the owner's rewrite, and for
 * all of it a visitor who wanted to look at something else had no way to end it.
 *
 * Every other narration here already yields. `tour.js` arms `INTERRUPTS` in the
 * capture phase and says why: *"a press on a control ends the pass on its way
 * down rather than after the control has already acted"*. The walk arms the
 * same four, in the same phase, inside the hook rather than in each scene —
 * four scenes remembering to wire the same four listeners is four chances to
 * forget, and the one that forgot is how this shipped.
 *
 * A SOURCE TEST AND NOT A DOM ONE, deliberately. What went wrong was not a
 * broken listener; it was the absence of any listener, and an absence is what a
 * source check is for. Verified in a browser on both deep scales the day it was
 * written: talking before a press, gone after one.
 */

const source = readFileSync(new URL("./useWalk.js", import.meta.url), "utf8");

test("the walk arms the same interrupts every other narration here does", () => {
  assert.match(
    source,
    /import \{ INTERRUPTS \} from "\.\.\/cinematic\.js"/,
    "useWalk no longer imports INTERRUPTS — it would be the one narration in this app a visitor " +
      "cannot end, and the cell's is seventy-eight seconds long",
  );
  assert.match(
    source,
    /addEventListener\(type, \w+, true\)/,
    "the walk's way out is not armed in the CAPTURE phase; a press on a control would end the walk " +
      "only after that control had already acted",
  );
});

test("something actually calls stop", () => {
  /* The bug was a `stop` nobody called, so this asks for a caller rather than
     for the function's existence. */
  const callers = source.match(/stopRef\.current\(\)|\bstop\(\)/g) ?? [];
  assert.ok(
    callers.length > 0,
    "`stop` is exported and never invoked again — which is exactly the state this walk shipped in",
  );
});
