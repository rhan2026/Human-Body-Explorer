import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

/**
 * NO WALK SAYS MORE THAN THE BUBBLE CAN HOLD.
 *
 * `guide.css` gives the bubble a FIXED size and the reason is in that file: the
 * owner's drawing is used whole rather than nine-sliced, because a hand-drawn
 * curve cut apart and reassembled shows its seam at 2x. What that buys is a
 * bubble that never distorts. What it costs is a ceiling on how much a beat can
 * say, and the file says so — *"which costs a ceiling on sentence length this
 * guide was already under"*.
 *
 * IT IS NOT UNDER IT ANY MORE, AND THAT IS THE POINT OF THIS GATE. The cell's
 * narration was rewritten on 2026-09-01 to the owner's own draft: thirteen
 * beats, several of them two sentences with an arrow chain in the middle.
 * Measured in a browser at 1280x800 across all thirteen, the worst needs 93 px
 * of a 97 px box. FOUR PIXELS. A re-export that turns 98% into 100%, or one
 * more word in one beat, silently clips a sentence — and clipping is invisible
 * to every other gate here, because the text is all still in the DOM.
 *
 * A CHARACTER BUDGET AND NOT A PIXEL ONE, because a pixel measurement needs a
 * browser and this has to run in the node suite where a walk is actually
 * edited. 168 is the measured line's length plus the four pixels' worth of
 * slack; it is a proxy and it is deliberately a tight one.
 */

/** Longest line the fixed bubble is known to hold at 1280x800. */
const BUDGET = 168;

const SRC = fileURLToPath(new URL("../", import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/* Every file that writes beats for the guide, found rather than listed, so a
   scale that gets a walk tomorrow is covered without anybody remembering. */
const files = walk(SRC).filter((f) => /Walk\.js$/.test(f) && !f.endsWith(".test.js"));

test("there is more than one walk to check", () => {
  assert.ok(files.length >= 2, `found ${files.length} walk files; the finder is looking in the wrong place`);
});

test("no line a walk can say is longer than the bubble holds", () => {
  const over = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    /* The `line:` values as authored. Template holes count as their widest
       plausible filling rather than as nothing — a percentage is up to four
       characters and a ratio up to five, so each `${...}` is scored at 5. */
    for (const m of source.matchAll(/^\s*line:\s*([\s\S]*?),\n\s*ms:/gm)) {
      const raw = m[1];
      for (const lit of raw.matchAll(/[`"']((?:[^`"'\\]|\\.)*)[`"']/g)) {
        const text = lit[1].replace(/\$\{[^}]*\}/g, "XXXXX").replace(/\\n/g, " ");
        if (text.length > BUDGET) {
          over.push(`${file.slice(SRC.length)}: ${text.length} chars — "${text.slice(0, 60)}…"`);
        }
      }
    }
  }
  assert.deepEqual(
    over,
    [],
    "these beats are longer than the bubble can hold, and a clipped sentence is invisible to every " +
      "other gate here because the words are still in the DOM:\n  " + over.join("\n  "),
  );
});
