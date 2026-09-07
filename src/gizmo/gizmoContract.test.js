/**
 * The gizmo's honesty contract, pinned the way cellClaims.test.js pins claims:
 * partly by running the guard, partly by reading the component's source —
 * because the component is JSX and this runner is `node --test`, the source IS
 * the testable surface for what it must never contain.
 *
 * CLAUDE.md §5: a number that cannot be labelled does not ship. The gizmo is
 * the new place numbers appear, so the refusal has to live in the gizmo itself,
 * not in the goodwill of whichever lane feeds it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { assertLabelled, EVIDENCE_WORDS } from "./gizmoContract.js";

const componentSource = () => readFile(new URL("./Gizmos.jsx", import.meta.url), "utf8");

/**
 * The source with its prose taken out.
 *
 * A guard a comment can satisfy is not a guard — `test_ci_runs_the_gate.py`
 * exists because the phrase `make check` survived in a file's header and turned
 * a red assertion green. This is the same mistake pointing the other way: the
 * comment explaining why the plate is no longer a button contains the words
 * `button` and `onEngage`, and failed the assertion about the code.
 */
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ---- the guard ----------------------------------------------------------- */

test("a value with no evidence word throws — an unlabelled number does not ship", () => {
  assert.throws(() => assertLabelled({ id: "atp", label: "ATP", value: "6.5 mM" }), /evidence/);
});

test("the word Modelled throws — science/scenarios/provenance.py forbids it and nothing has earned it", () => {
  assert.throws(() => assertLabelled({ id: "atp", label: "ATP", value: "6.5 mM", evidence: "Modelled" }), /Modelled/);
});

test("an evidence word outside the six is a typo, and a typo is an unlabelled number", () => {
  assert.throws(() => assertLabelled({ id: "atp", label: "ATP", value: "6.5 mM", evidence: "derived" }));
  assert.equal(EVIDENCE_WORDS.length, 6);
  assert.ok(!EVIDENCE_WORDS.includes("Modelled"));
});

/**
 * Lane 4, 2026-08-17, after narrowing their panel's six class definitions:
 * two of them claimed more than PRD-v2 §7 does — `Derived` said "computed here
 * by re-running a published model" while `FiberMetrics`'s band row is arithmetic
 * off standard filament lengths and `Descent`'s ratio is a division. §7 says
 * only "Calculated from model outputs". So the class sentence cannot carry a
 * number's meaning, and the per-number one is not decoration: it is the half of
 * the label that says which of those a reader is looking at.
 */
test("a number with an evidence word but no sentence is half-labelled, and does not ship", () => {
  assert.throws(
    () => assertLabelled({ id: "atp", label: "ATP", value: "6.489", evidence: "Derived" }),
    /why/,
  );
  assert.throws(
    () => assertLabelled({ id: "atp", label: "ATP", value: "6.489", evidence: "Derived", why: "   " }),
    /why/,
  );
  assertLabelled({ id: "atp", label: "ATP", value: "6.489", evidence: "Derived", why: "the published run's own output at this instant" });
});

test("a name with no number needs no evidence word — labels are not claims", () => {
  assertLabelled({ id: "z", label: "Z-disc" });
});

test("a fully labelled value passes through untouched", () => {
  for (const word of EVIDENCE_WORDS) {
    assertLabelled({ id: "x", label: "X", value: "1", evidence: word, why: `a ${word} number, and here is which one` });
  }
});

/* ---- the component's absences -------------------------------------------- */

test("Gizmos renders its evidence word with Evidence.jsx, not a second badge", async () => {
  const src = await componentSource();
  assert.match(src, /from "\.\.\/Evidence\.jsx"/, "the one badge definition is src/Evidence.jsx — import it");
});

test("Gizmos never reaches into the provenance record — the record is lane 4's to render", async () => {
  const code = codeOnly(await componentSource());
  assert.ok(
    !/provenance\s*[.[]/.test(code),
    "Gizmos.jsx reads provenance fields; it passes the record whole to the badge and renders none of it",
  );
});

/**
 * Lane 4 turned `Evidence.jsx`'s badge into a `<button>` that opens the record
 * (their message, 2026-08-17, verified against
 * `.worktrees/provenance/human-performance-explorer/src/Evidence.jsx`). The
 * gizmo drew its own button around the whole plate, which after that merge is a
 * button inside a button — invalid HTML, and two designs for one gesture. The
 * badge is the affordance; the plate is not.
 */
test("the plate is a button only when a floor hands `onPress` — never a <button>, so the badge does not nest in one", async () => {
  /* 2026-09-07 — FIBER pace 7: the fibre floor makes its plates the press surface.
     Opt-in through `onPress`; every other floor's layer stays inert. */
  const code = codeOnly(await componentSource());
  assert.ok(!/<button/.test(code), "the plate must not be a <button> element");
  assert.match(code, /role=\{onPress \? "button" : undefined\}/, "a plate is a button only when asked");
  assert.match(code, /onClick=\{onPress \? \(\) => onPress\(item\.id\) : undefined\}/, "the press hands back the plate's id");
});

test("the provenance record is handed to the badge as `source`, not held for a callback", async () => {
  const code = codeOnly(await componentSource());
  assert.match(code, /source=\{item\.provenance\}/, "the agreed slot is <EvidenceBadge source={…}>");
  assert.ok(!/onEngage/.test(code), "a second way to open the record is a second design for one gesture");
});

test("the forbidden word appears nowhere in the gizmo", async () => {
  const src = await componentSource();
  assert.ok(!src.includes("Modelled"), "Modelled is forbidden on every surface, including this one");
});

/**
 * ONE PROP, TWO SPEAKERS, TWO VOCABULARIES — 2026-08-31, found by reading the
 * wiring rather than by any gate.
 *
 * This component reported its arrival cascade as `onIntro(true)` and
 * `onIntro(false)`, from the days when the page's only question was "is the
 * cascade running". When the three scales became four-state machines, each
 * scene started calling ITS `onIntro` with the stage NAME — `"silent"`,
 * `"tour"`, `"main"` — and then forwarded the very same callback down to here.
 * So the page's `stage` was a boolean for part of every visit.
 *
 * Nothing went red, because `"main"`, `true` and `false` are all just values.
 * What it actually cost, on the two scales whose `tourOn` was still a stored
 * boolean fed straight from that prop: `"main"` is truthy, so after the tour
 * `tourOn` never went false — state 4 kept its opening sentence, and
 * `WayIn`'s `visible={!tourOn}` meant THE WAY DOWN NEVER CAME BACK. A scale
 * with no way out of it, from a prop name.
 *
 * The cascade's length is still this component's and still lives in the
 * stylesheet, which is what `onIntro` was written to protect. `data-intro` on
 * the plate layer says the same thing to anyone who needs to watch it, without
 * being a second voice on somebody else's channel.
 */
test("the gizmo does not report its cascade on a callback — the scene's stage is the only speaker", async () => {
  const code = codeOnly(await componentSource());
  assert.ok(
    !/onIntro|introCb/.test(code),
    "Gizmos.jsx reports its cascade on a callback again; the scenes call the same prop with a stage NAME, " +
      "so this makes the page's stage a boolean for part of every visit — watch `data-intro` instead",
  );
  assert.match(
    code,
    /data-intro=/,
    "the cascade is no longer observable at all — `data-intro` is what replaced the callback",
  );
});
