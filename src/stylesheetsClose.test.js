import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * EVERY STYLESHEET CLOSES EVERY BLOCK IT OPENS.
 *
 * WHY THIS EXISTS, 2026-09-02. `press.css` was one closing brace short. The
 * missing one belonged to `@media (max-width: 420px)`, which meant every rule
 * written after it — `.press__beat`, its arc, its word, `.press__rail`, the rest
 * of the file — was swallowed into that query and therefore DEAD at every width
 * the app is used at. Nothing failed. The build was green, `vite` served the file
 * happily, and 476 tests passed, because a stylesheet that parses is not a
 * stylesheet that does what it says.
 *
 * WHAT IT COST, measured in the browser at 1201x678: the readout never got
 * `display: flex`, so it laid out below the canvas; its `<svg viewBox="0 0 36
 * 36">` never got its `1.6rem` box, so it took the full column width and, being
 * square, 1201 px of height. The document came out 1901 px tall in a 678 px
 * window — 1223 px of scroll. One wheel notch slid the bench press out of frame,
 * and the owner reported it as the guide character breaking the viewport. It was
 * not the guide; it was this.
 *
 * THE FAILURE IS SILENT AND THE BLAST RADIUS IS "THE REST OF THE FILE", which is
 * the combination that earns a gate. Comments are stripped first because this
 * repo's stylesheets carry long prose that contains braces.
 */
const DIR = new URL("./", import.meta.url).pathname;

function stylesheets(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...stylesheets(full));
    else if (e.name.endsWith(".css")) out.push(full);
  }
  return out;
}

test("every stylesheet closes every block it opens", () => {
  const sheets = stylesheets(DIR);
  assert.ok(sheets.length >= 8, `only ${sheets.length} stylesheets found — the walk is not reaching them`);
  for (const file of sheets) {
    const body = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const open = (body.match(/\{/g) ?? []).length;
    const close = (body.match(/\}/g) ?? []).length;
    assert.equal(
      open,
      close,
      `${file.split("/").pop()} opens ${open} blocks and closes ${close}. An unclosed block does not ` +
        "fail to parse — it swallows every rule after it, so the whole rest of the file silently stops " +
        "applying. That is how a 1223 px scrollbar got onto the body scale and was blamed on the guide.",
    );
  }
});
