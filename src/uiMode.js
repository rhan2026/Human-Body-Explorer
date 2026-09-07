/**
 * One switch: whether the screens show figures and sources at all.
 *
 * WHY IT EXISTS. Owner, 2026-08-30, after a night of provenance rounds:
 * "야 그냥 숫자를 다 삭제하고 뭐 calcium goes down this storage is used for
 * during this exercise this does 이런식으로만 가자 논문 아예 다 빼는데 일단
 * ui상으로만 빼 그리고 나중에 붙이자 차라리 그게 나을 듯"
 *
 * The reading that matters is the last clause: **take it out of the UI, and put
 * it back later.** So nothing is deleted. The scenarios still load, the records
 * still ship in `public/scenarios/`, every provenance field is still generated
 * and still checked by the science gates, and the components that draw figures
 * are untouched. This flag decides whether they are rendered.
 *
 * `docs/objective.md` already licensed this and is the higher document: "A
 * number does not need a taxonomy word to ship. 'Derived', 'Measured' and the
 * rest are our vocabulary, not the visitor's. Drop the word wherever it costs
 * more than it says." The owner is applying the same reasoning one step
 * further, to the figures themselves, for a first-year's study of three papers.
 *
 * TO PUT IT BACK: set this to `true`. That is the whole procedure, and the
 * browser gates that grade figures and badges are written to pass in that mode
 * — they skip themselves here rather than being deleted, for the same reason.
 */
export const SHOW_FIGURES = false;

/** Papers, DOIs, archive links and evidence words. Same switch, same reason. */
export const SHOW_SOURCES = SHOW_FIGURES;
