import { test } from "node:test";
import assert from "node:assert/strict";
import { isRepeatAsk, REPEAT_MAX_TOKENS } from "./repeatAsk.js";

test("a short line asking for a repeat is one; a question with the word in it is not", () => {
  for (const line of ["again", "again?", "Again!", "repeat", "say that again", "reshow", "can you reshow it", "  REPEAT that  "]) {
    assert.equal(isRepeatAsk(line), true, `${JSON.stringify(line)} should be a repeat`);
  }
  for (const line of [
    "why do muscles tire again and again after a rest?",
    "explain that again please, in detail",
    "replay",
    "what is AMPK?",
    "",
    "   ",
    null,
  ]) {
    assert.equal(isRepeatAsk(line), false, `${JSON.stringify(line)} should go to the model (or nowhere)`);
  }
  assert.equal(REPEAT_MAX_TOKENS, 4);
});
