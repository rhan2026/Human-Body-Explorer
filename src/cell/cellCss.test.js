import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * THE SHEET IS A CONTRACT TWO WAYS. Other scales import it (`signalling.css`
 * `@import`s it for the arm colours; `FiberMetrics` and `SignallingReadout`
 * wear `.cell-out-of-range`), and the ENERGY page wears the selector names
 * ENERGY.md pins. A rewrite that dropped either would fail silently —
 * unstyled text, a legend with no colour — so this reads the file the way
 * those consumers do. And what the owner took off the floor on 2026-09-06 is
 * pinned absent, so it cannot drift back in as "just a rule".
 */
const css = await readFile(new URL("./cell.css", import.meta.url), "utf8");

test("the rules other scales import survive the rewrite", () => {
  for (const needle of [
    "--arm-resistance: #",
    "--arm-endurance: #",
    "--arm-control: #6f6a63", // CONTROL_TINT in signallingGeometry.js; cellClaims ties them
    ".cell-out-of-range",
    ".fiber.cell-stage-only",
    ".cell-stage-notices",
    ".cell-stage-notice",
  ]) {
    assert.ok(css.includes(needle), `${needle} is gone from cell.css and something else still reads it`);
  }
});

test("every selector the page wears is declared", () => {
  for (const sel of [".energy-controls", ".energy-card", ".energy-network", ".energy-hover"]) {
    assert.ok(new RegExp(`${sel.replace(/[.$]/g, "\\$&")}\\b[^{]*\\{`).test(css), `${sel} has no rule`);
  }
});

test("the strip, its arrival pulse and the standing label are gone — 2026-09-06", () => {
  /* Owner item 14 took the timeline; brief §8 and rule 5 took the one name
     that stood without a pointer. A rule with no element is dead weight until
     someone finds it and rebuilds the element to match. Comments stripped —
     the header may say what went; a rule may not. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  for (const needle of ["energy-clock", "energy-arrived", "energy-hover--standing"]) {
    assert.ok(!rules.includes(needle), `${needle} is still styled in cell.css and nothing wears it`);
  }
});

test("no text colour is a literal — every colour goes through a token", () => {
  /* `textClearsItsPaper.test.js` sweeps literals against the paper; the
     simplest way to stay under its floor is to write none. */
  const literals = [...css.matchAll(/(?:^|[;{\s])color:\s*(#[0-9a-fA-F]{3,6})\s*;/gm)].map((m) => m[1]);
  assert.deepEqual(literals, []);
});

test("the corner arithmetic is the one the comments derive", () => {
  /* ☰ at top 12 + 38 tall → the notices at 56; with no strip under them the
     controls stand at the stage's own 16 inset; the CTA's 132 is measured off
     the guide at home. A change to any one of these without the others is a
     collision the comments already warned about. */
  assert.match(css, /\.cell-stage-notices\s*\{[^}]*top:\s*168px/); /* under the Condition plate since 2026-09-07 */
  /* Top-right since 2026-09-07 (owner, ENERGY 16: '오른쪽 위로'). */
  /* right 16 / top 172 until 2026-09-07 — owner (cell C4): *"왼쪽 위 모든건 왼쪽 위"*. */
  assert.match(css, /\.energy-controls\s*\{[^}]*left:\s*16px[^}]*top:\s*56px/);
  assert.match(css, /\.energy-network\s*\{[^}]*bottom:\s*132px/);
});
