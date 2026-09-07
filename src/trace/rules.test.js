import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * THE MD'S FIVE RULES, HELD AS ABSENCES (CLAUDE.md §3: what was decided not
 * to build is pinned by a test that goes red if it appears).
 *
 *   1. Evidence never gets its own sidebar.
 *   2. Maximum 2 simultaneous numeric values in the normal experience.
 *   3. Evidence appears only after the phenomenon has been shown.
 *   4. Every evidence visual is connected to the 3D state or the selected object.
 *   5. Paper source is always one quiet clickable line.
 *
 * And the two honesty rules that ride with them (CLAUDE.md §5, §9): a number
 * on screen is computed off the shipped series, never typed, and our
 * arithmetic is labelled ours ("this run"), never the paper's.
 *
 * Read as text, the way `signallingClaims.test.js` reads its floor: these are
 * claims about what the files say, and the files are the record. A review on
 * 2026-09-07 showed the first cut of this file could not tell a typed "−63%"
 * from a computed one, nor a dropped "this run" — the checks below are the
 * ones that went red on exactly those edits.
 */
const src = (p) => readFile(new URL(p, import.meta.url), "utf8");
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const FLOORS = {
  fiber: "../fiber/MuscleFiberVisualization.jsx",
  cell: "../cell/CellScale.jsx",
  signalling: "../signalling/SignallingScale.jsx",
};

test("rule 1 — the trace is a floating block, not a panel: no border, no box, no sidebar", async () => {
  const css = await src("./trace.css");
  const block = /\.trace \{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.ok(block.includes("position: absolute"), "the trace floats on the stage");
  assert.doesNotMatch(block, /\bborder\s*:/, "no border on the block");
  assert.doesNotMatch(block, /box-shadow/, "no card shadow on the block");
  assert.doesNotMatch(block, /height:\s*100%/, "never the stage's full height");
  const jsx = await src("./EvidenceTrace.jsx");
  assert.doesNotMatch(jsx, /<aside|sidebar|fiber__panel/, "no sidebar markup");
});

test("rule 2 — at most two values stand: the reveal is behind the dot, and yields to an object's rows", async () => {
  const jsx = code(await src("./EvidenceTrace.jsx"));
  assert.match(jsx, /opened && reveal \? reveal\.rows : \[\]/, "reveal rows render only when opened");
  assert.match(jsx, /\{reveal && !note\?\.length && \(/, "the dot is not offered beside an object's rows");
  assert.match(jsx, /if \(note\?\.length\) setOpened\(false\);/, "an arriving note folds the reveal");
  const fiber = code(await src(FLOORS.fiber));
  const rows = /const rows = \[([\s\S]*?)\]\.filter/.exec(fiber)?.[1] ?? "";
  assert.equal((rows.match(/\[\s*"/g) ?? []).length, 2, "FIBER's reveal is exactly two rows");
});

test("rule 3 — every mount is gated on main AND on no demonstration running", async () => {
  const fiber = code(await src(FLOORS.fiber));
  const cell = code(await src(FLOORS.cell));
  const sig = code(await src(FLOORS.signalling));
  const gate = (text, floor) => {
    const m = /<EvidenceTrace[\s\S]*?visible=\{([^}]*)\}/.exec(text)?.[1];
    assert.ok(m, `${floor}: no visible= on the trace mount`);
    assert.match(m, /stage === "main"/, `${floor}: not gated on main`);
    return m;
  };
  assert.match(gate(fiber, "fiber"), /!passRunning/, "FIBER: hidden while a part's demonstration runs");
  assert.match(gate(cell, "cell"), /!narrating/, "ENERGY: hidden while the result pass narrates");
  /* SIGNALS has no floating trace; its evidence is in the pick panel and the
     constellation hint, and both wait for main. */
  assert.match(sig, /stage === "main" && netHint/, "SIGNALS: the constellation's numbers wait for main");
  assert.match(sig, /\{stage === "main" && \(\s*<p className="sig-pick__source">/, "SIGNALS: the paper line waits for main");
  assert.match(sig, /showNums && stage === "main"/, "SIGNALS: the values wait for main");
  const jsx = await src("./EvidenceTrace.jsx");
  assert.match(jsx, /APPEAR_MS = 400/, "the ~400 ms the md asks for, after main");
  assert.match(code(jsx), /useState\(visible \? "pending" : "out"\)/, "a block visible at mount still waits its 400 ms");
});

test("rule 4 — the trace reads the floor's clock and the pressed object, never its own", async () => {
  const jsx = code(await src("./EvidenceTrace.jsx"));
  assert.match(jsx, /timeRef\?\.current/, "the cursor is the floor's instant");
  /* The "clock" drawing is armed by the cursor reaching the window's start,
     and the "sweep" drawing advances only on frames where the clock moved. */
  assert.match(jsx, /if \(!armed && \(x < 2 \|\| \(prevX !== null && x < prevX\)\)\) armed = true;/);
  assert.match(jsx, /if \(draw === "sweep" && moved\) swept =/);
  const fiber = code(await src(FLOORS.fiber));
  assert.match(fiber, /timeRef=\{timeAt\}/);
  assert.match(fiber, /openPart !== "sr"/, "the store's value waits for the store's ring");
  const cell = code(await src(FLOORS.cell));
  assert.match(cell, /timeRef=\{timeAt\}/);
  assert.match(cell, /cardPart/, "a pressed part replaces the trace with its own series");
  assert.equal((cell.match(/<EvidenceTrace/g) ?? []).length, 1, "ENERGY: one block, never five graphs");
});

test("rule 5 — the source is one line: cite + arrow, and the link is the pinned DOI", async () => {
  const line = await src("./SourceLine.jsx");
  assert.match(line, /\{p\.cite\} <span aria-hidden="true">↗<\/span>/);
  const rendered = code(line);
  assert.doesNotMatch(rendered, />[^<{]*(journal|DOI|Source:)[^<{]*</i, "no title, journal or DOI as text");
  assert.doesNotMatch(rendered, /title=\{p\.validation/, "no classifier sentence on the popover's link");
  assert.match(line, /target="_blank"/);
});

test("§9 — every value on the trace is computed off the series; nothing typed reaches a floor", async () => {
  const fiber = code(await src(FLOORS.fiber));
  const cell = code(await src(FLOORS.cell));
  assert.match(fiber, /pct\(peakChange\(caPeaks\)\)/, "FIBER: the calcium change is computed");
  assert.match(fiber, /pct\(peakChange\(forcePeaks\)\)/, "FIBER: the force change is computed");
  assert.match(fiber, /drop\(scenario\.series\("Ca_SR_total"\)\.values\)/, "FIBER: the store's drop is computed");
  assert.match(cell, /pct\(runs\.strength\.calcium\)/, "ENERGY: the share is computed");
  for (const [floor, text] of [["fiber", fiber], ["cell", cell]]) {
    assert.doesNotMatch(text, /[−-]\s?63\s?%|[−-]\s?1\.5\s?%|941\s*(→|->)\s*168|\b98\s?%/, `${floor}: a typed value`);
  }
  for (const f of ["./EvidenceTrace.jsx", "./trace.js", "./SourceLine.jsx"]) {
    assert.doesNotMatch(code(await src(f)), /[−-]\s?63\s?%|941\s*(→|->)\s*168|\b98\s?%|\b120\b|\b259\b/, `${f}: a typed value`);
  }
});

test("§5 — our arithmetic is labelled ours, and the paper's numbers are the only typed ones", async () => {
  const fiber = code(await src(FLOORS.fiber));
  const cell = code(await src(FLOORS.cell));
  assert.match(fiber, /label: "Model result · this run"/, "FIBER: the reveal says whose numbers they are");
  assert.match(fiber, /"Calcium store · this run"/, "FIBER: the store's drop says whose number it is");
  assert.match(cell, /"Calcium path · this run"/, "ENERGY: the share says whose number it is");
  const papers = code(await src("./papers.js"));
  assert.match(papers, /components: "120", interactions: "259"/, "the paper's own network size, quoted");
  assert.match(papers, /resistance: "18 \/ 21"/, "the authors' own score, quoted");
});

test("the old figures stay off: the trace does not read SHOW_FIGURES, and touches no badge", async () => {
  for (const f of ["./EvidenceTrace.jsx", "./SourceLine.jsx", "./trace.js", "./papers.js"]) {
    const text = await src(f);
    assert.doesNotMatch(text, /SHOW_FIGURES|SHOW_SOURCES|EvidenceBadge/, `${f} reaches into the 2026-08-30 switch`);
  }
});
