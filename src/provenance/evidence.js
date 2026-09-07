/**
 * What the evidence word means, and how a provenance record is arranged for
 * somebody who has never read a paper.
 *
 * CONTRACT — this module writes prose about LABELS and never about SCIENCE.
 * The six sentences in `MEANING` and the `refusal` below are ours: they say what
 * a word means, which is a definition PRD-v2 §7 already fixed. Everything else a
 * viewer reads comes out of the record unchanged, and `evidence.test.js`
 * asserts that character for character.
 *
 * The line is not fussiness. A summary of a validation result is a new
 * scientific claim, and this file is the last place equipped to make one — see
 * the header of `evidence.test.js` for the three independent attempts that
 * proved it, and `CLAUDE.md` §5 for what it costs when one gets through.
 *
 * Derived points: `Evidence.jsx` (the badge that opens on this), and
 * `provenance/SourcePanel.jsx` (the reveal that renders it). Nothing else may
 * hold an opinion about what an evidence word means.
 */

/**
 * PRD-v2 §7's six, ordered by how many steps stand between the number and
 * somebody observing something.
 *
 * DISTANCE, NOT CONFIDENCE, and the distinction is load-bearing. Nothing in the
 * PRD ranks these by belief, and a hand-drawn curve labelled `Illustrative` is
 * not a worse measurement — it is not a measurement. Ranking them by trust would
 * be an editorial claim about six things the specification deliberately leaves
 * as kinds. Ordering them by distance is a statement about their definitions,
 * which is checkable against the table in §7.
 */
export const LADDER = ["Measured", "Digitized", "Derived", "Mapped", "Curated", "Illustrative"];

/** PRD-v2 §7's seventh word, named only to be refused. `science/scenarios/provenance.py:91`. */
export const REFUSED = "Modelled";

/**
 * One sentence per word. Plain restatements of §7's own "Meaning" column, and
 * they may not say more than it does.
 *
 * TWO OF THESE OVERCLAIMED AND WERE NARROWED, which is worth recording because
 * this module exists to stop exactly that and still did it. `Derived` said
 * "Computed here, by re-running a published model" — but `FiberMetrics`'s
 * `bands` row is `Derived` and is band arithmetic off standard filament
 * lengths, and `Descent`'s ratio is `Derived` and is a division. §7 says
 * "Calculated from model outputs" and nothing about re-running anything.
 * `Mapped` said "What you typed" while `CellReadout`'s Repetition row is the
 * clock read against a cycle, which nobody typed.
 *
 * The failure was a specific one: a sentence that describes how the MOST
 * COMMON number carrying a label was produced reads as the label's definition.
 * The specificity belongs in the per-number `why`, which is why the panel puts
 * it directly underneath.
 */
const MEANING = {
  Measured: "Somebody measured this, in an experiment.",
  Digitized: "Read off a figure printed in a paper — the picture, not a table of numbers.",
  Derived: "Calculated rather than measured.",
  Mapped: "A translation onto a protocol one of the papers actually ran.",
  Curated: "Chosen by hand. A person decided this one.",
  Illustrative: "Drawn to explain. Nothing computed it.",
};

export function meaning(word) {
  if (word === REFUSED) {
    throw new Error(`"${REFUSED}" is not a label this repository may use — call refusal() instead`);
  }
  if (!MEANING[word]) {
    throw new Error(`no evidence word "${word}" — PRD-v2 §7 defines ${LADDER.join(", ")}`);
  }
  return MEANING[word];
}

/**
 * Why the seventh word is absent, which is worth a viewer's time rather than a
 * viewer's ignorance.
 *
 * Restates PRD-v2 §7 and decisions.md #9 and adds nothing to them. It is on
 * screen because an absence somebody chose reads as rigour, and the same absence
 * unexplained reads as an oversight.
 */
export function refusal() {
  return (
    `"${REFUSED}" would mean the paper's own solver produced the number. ` +
    "None of these were run on it, so nothing here is allowed to claim it."
  );
}

/**
 * The order a person actually asks, which is not the order a schema is written
 * in. Each heading is a question; the fields under it are the record's answer,
 * unedited.
 *
 * `absences` is a heading rather than a footnote on purpose. "The authors never
 * published this, so we made it and said so" is the most persuasive material in
 * the record and was the most buried — `uncertainty` sat between an integrator
 * string and a sha256, and it is the field that says a posterior band exists in
 * the paper and ships on no branch of the clone.
 *
 * The catch-all at the end is not defensive coding, it is the §5 obligation:
 * the science layer adds fields — `cannot_be_recomputed` and `uncertainty` both
 * postdate the first scenario — and a lookup over a fixed list would drop the
 * next one silently. The next one is likely to be another absence.
 */
const GROUPS = [
  { heading: "Whose work is this", keys: ["source", "paper_id", "model_id", "model_version", "archive_version", "whose_protocol"] },
  { heading: "What was checked", keys: ["validation"] },
  { heading: "Where it disagrees", keys: ["known_discrepancy", "steady_state"] },
  {
    heading: "What we could not get, and what is ours",
    /* `kind` travels with the group so the screen can mark it without counting.
       The CSS did count — `nth-of-type(4)` — and it was wrong on the three
       Francis scenarios, which carry none of these keys: with this group absent
       the fourth rendered group is "How it was run", so the marking that means
       "here is what we could not get" was drawn beside the integrator and the
       parameters. A positional selector over a variable-length list is a claim
       about a shape nobody guaranteed. */
    kind: "absence",
    /* `exported_copy` is an absence and belongs here rather than in the
       catch-all, where it first landed: it says which of the archive's turning
       points the file the BROWSER plays does not contain. The rest of this
       record makes precision claims about 14,301 samples; the copy carrying
       them holds 796. That is the same kind of fact as "the posterior band
       never shipped", and it goes in the same box. */
    keys: [
      "uncertainty", "cannot_be_recomputed", "series_defined_by_us",
      "stands_in_for", "input_scale_note", "exported_copy",
    ],
  },
  { heading: "How it was run", keys: ["scenario", "inputs", "parameters", "integrator", "time_unit", "confidence"] },
  { heading: "The pin", keys: ["evidence_type", "port_source_sha256"] },
];

/** The heading unfamiliar fields land under, so a new one is visible on the day it ships. */
const REST = "Also on the record";

/** A reading carrier holds its record under `provenance`; a record is itself. */
const recordOf = (of) => (of && typeof of === "object" && of.provenance ? of.provenance : of);

/**
 * The record as a viewer meets it: headings in asking order, values verbatim.
 *
 * Non-string values (`inputs` is an object) are JSON, formatted and not
 * summarised — a viewer who has got this far wants the thing itself, and a
 * prose rendering of an input dictionary is a rewrite with extra steps.
 */
export function groupRecord(of) {
  const record = recordOf(of);
  if (!record || typeof record !== "object") throw new TypeError("groupRecord needs a provenance record");
  if (record.evidence_type === REFUSED) {
    throw new Error(`a record labelled "${REFUSED}" must not reach a screen — ${refusal()}`);
  }

  const text = (key) => (typeof record[key] === "string" ? record[key] : JSON.stringify(record[key], null, 1));
  const claimed = new Set(GROUPS.flatMap((g) => g.keys));
  const groups = GROUPS.map((g) => ({
    heading: g.heading,
    kind: g.kind ?? null,
    entries: g.keys.filter((k) => k in record).map((key) => ({ key, text: text(key) })),
  }));
  const rest = Object.keys(record).filter((k) => !claimed.has(k));
  if (rest.length) {
    groups.push({ heading: REST, kind: null, entries: rest.map((key) => ({ key, text: text(key) })) });
  }

  return groups.filter((g) => g.entries.length > 0);
}

/**
 * The four PRD-v2 §7 fields a file cannot carry, read off the reading itself.
 *
 * A scenario file stores ten; `time`, `variable`, `value` and `unit` change with
 * every sample and are joined on at read time by `scenarioData.js`. So a panel
 * opened over a reading shows fourteen and a panel opened over a file shows ten
 * — and the second says ten rather than inventing four, which is why this
 * returns an empty list instead of placeholders.
 *
 * Named in PRD-v2's own field order, not the carrier's.
 */
export function readingOf(carrier) {
  if (!carrier || typeof carrier !== "object" || carrier.value === undefined) return [];
  const has = (v) => v !== undefined && v !== null;
  return [
    ["variable", carrier.series],
    ["value", carrier.value],
    ["unit", carrier.unit],
    ["time", carrier.t],
  ]
    .filter(([, v]) => has(v))
    .map(([key, v]) => ({ key, text: String(v) }));
}

/**
 * Where the sheet goes, so that it never covers the number that opened it.
 *
 * One rule, two shapes. Wide, the sheet is a column at one edge and the only
 * question is which edge: the one the badge is not on. Narrow, there is no room
 * beside anything, so it is a sheet across the full width and the question
 * becomes top or bottom — and the answer is not "always bottom", which is what
 * shipped first.
 *
 * `SHEET_SHARE` is why. The sheet takes 62% of the height, so a bottom sheet
 * covers everything below 38% of the viewport. Lane 2 measured what that costs
 * on the gizmo layer at 320x640: four of the seven plates at the sarcomere
 * framing sit below the line, and their badges opened a sheet on top of
 * themselves. The gizmo layer is `position: absolute; inset: 0` inside the
 * canvas and does not scroll, so nothing rescues it — unlike a scale panel,
 * where the viewer can at least scroll the number back into view.
 *
 * Pure, and separated from the component, because the interesting part is
 * arithmetic and the browser is the expensive way to check arithmetic. The
 * component's job is only to hand over a real rect.
 */
const SHEET_SHARE = 0.62;
const NARROW_PX = 640;

export function placeSheet(rect, innerWidth, innerHeight) {
  if (!rect) return "right";
  if (innerWidth > NARROW_PX) {
    return rect.left + rect.width / 2 > innerWidth / 2 ? "left" : "right";
  }
  return rect.bottom > innerHeight * (1 - SHEET_SHARE) ? "sheet-top" : "sheet-bottom";
}
