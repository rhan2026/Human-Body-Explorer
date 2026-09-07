import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * EVERY STYLESHEET IS IMPORTED BY SOMETHING.
 *
 * WHY THIS EXISTS, and it is not hygiene. `wayin.css` was imported nowhere, and
 * had been for as long as the file existed. What that cost, measured in a
 * browser on 2026-09-01: `.wayin__target` — the ONLY way from the cell scale
 * down to the signalling scale — draws as a 16x6 px button with
 * `pointer-events: none`, because an empty `<button>` with no sheet is the
 * browser's default box inheriting `.wayin`'s own `pointer-events: none`. The
 * sheet says 44x44 and `auto`, with a comment explaining that 44 is the
 * smallest target a finger finds without hunting. None of it was applied.
 *
 * SO THE DEEPEST SCALE IN THIS APP WAS UNREACHABLE BY POINTER. Not hidden, not
 * broken — present, drawn, announced to a screen reader, and impossible to
 * click. It survived every gate in the repo because the button is still in the
 * document, still has its `aria-label`, and still opens on FOCUS, so a keyboard
 * reaches it and every test that queries for it finds it.
 *
 * A missing import is invisible to a bundler — Vite builds green either way,
 * since nothing references the file — and invisible to a DOM test, which sees
 * the element. It is only visible in a browser, to somebody trying to press it.
 * This is the cheap check that does not need one.
 */

const SRC = fileURLToPath(new URL("./", import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = walk(SRC);
const sheets = files.filter((f) => f.endsWith(".css"));
/* Test files do not count as a consumer: a sheet only a gate imports still
   reaches no pixel, which is the whole defect this is about. */
const code = files.filter((f) => /\.jsx?$/.test(f) && !f.endsWith(".test.js"));
const source = code.map((f) => readFileSync(f, "utf8")).join("\n");

test("every stylesheet is imported by something that ships", () => {
  const orphans = sheets.filter((sheet) => {
    const name = sheet.slice(sheet.lastIndexOf("/") + 1);
    return !new RegExp(`import\\s+"[^"]*${name.replace(".", "\\.")}"`).test(source);
  });
  assert.deepEqual(
    orphans.map((o) => o.slice(SRC.length)),
    [],
    "these stylesheets are imported by nothing, so none of what they say reaches a pixel — " +
      "`wayin.css` was one for the whole life of the file and it made the way down to the " +
      "signalling scale a 16x6 button that could not be clicked",
  );
});

/**
 * AND THE ONE THAT COST SOMETHING KEEPS ITS OWN LINE, because the general rule
 * above would go green again the day somebody imports the sheet into a test.
 */
test("the way in imports its own sheet", () => {
  const wayIn = readFileSync(new URL("./wayin/WayIn.jsx", import.meta.url), "utf8");
  assert.match(
    wayIn,
    /import\s+"\.\/wayin\.css"/,
    "WayIn.jsx does not import wayin.css — its 44 px hit target reverts to a 16x6 default " +
      "box with pointer-events none, and the signalling scale becomes unreachable by pointer",
  );
});
