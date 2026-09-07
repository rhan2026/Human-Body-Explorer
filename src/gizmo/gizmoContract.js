/**
 * What a gizmo is allowed to say, enforced where it is said.
 *
 * CLAUDE.md §5 — every number on screen carries its evidence word — has until
 * now been held by `scenarioData.js`, which refuses a scenario with no
 * `evidence_type` and hands back frozen carriers so a caller cannot strip the
 * label on the way to a screen. The gizmo opens a NEW way for a number to reach
 * a pixel: a caller composes `{label, value}` by hand and hands it here. Nothing
 * on that path passes through scenarioData, so the refusal has to exist here too
 * or §5 is held only by the goodwill of whichever lane is writing the callout.
 *
 * The six words are PRD-v2 §7's, and the list is a copy of a copy — the source
 * of truth is `science/scenarios/provenance.py`, which is Python and cannot be
 * imported here. `Modelled` is named explicitly rather than merely being absent
 * so its rejection carries the reason: nothing in this repository has been run
 * against its authors' own solver, so nothing may claim to be a model's output
 * (decisions.md #9, provenance.py:FORBIDDEN_LABEL).
 */

export const EVIDENCE_WORDS = Object.freeze([
  "Measured",
  "Digitized",
  "Derived",
  "Illustrative",
  "Mapped",
  "Curated",
]);

export const FORBIDDEN_WORD = "Modelled";

/**
 * A gizmo naming a part of the anatomy makes no claim and needs no word. One
 * carrying a `value` is a number on screen, and a number on screen is §5's.
 *
 * @param item {{id, label, value?, evidence?}}
 * @returns the item, so this can wrap a call rather than sit beside one
 */
export function assertLabelled(item) {
  if (item.value === undefined || item.value === null || item.value === "") return item;

  if (item.evidence === FORBIDDEN_WORD) {
    throw new Error(
      `gizmo "${item.id}" labels a number ${FORBIDDEN_WORD}, which is forbidden: nothing here has been ` +
        `checked against its authors' own solver (decisions.md #9). Use Derived and state the discrepancy.`,
    );
  }
  if (!EVIDENCE_WORDS.includes(item.evidence)) {
    throw new Error(
      `gizmo "${item.id}" carries the value ${JSON.stringify(item.value)} with no evidence word ` +
        `(got ${JSON.stringify(item.evidence)}). An unlabelled number does not ship — CLAUDE.md §5. ` +
        `One of: ${EVIDENCE_WORDS.join(", ")}.`,
    );
  }
  // The word alone is half a label. Lane 4 narrowed their panel's six class
  // sentences on 2026-08-17 because two of them claimed more than §7 does —
  // `Derived` covers re-running a published model AND dividing two numbers — so
  // the class can no longer say what THIS number is. `why` is the half that can.
  if (!String(item.why ?? "").trim()) {
    throw new Error(
      `gizmo "${item.id}" is labelled ${item.evidence} and says nothing about itself. The evidence word ` +
        `names a class, not this number: pass \`why\`, one sentence about where THIS value came from. ` +
        `It is what the provenance panel shows and what a reader actually gets.`,
    );
  }
  return item;
}
