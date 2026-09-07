/**
 * THE SEAM BELL USES TO SHOW A SET OF MUSCLE GROUPS ON THE BODY.
 *
 * Owner, 2026-09-07: *"when i ask bell about excercises not on the list, it
 * identifies what muscles are used but cannot highlight them on the idle model.
 * when a user asks to highlight certain muscles used on an exercise, unselect
 * the irrelevant muscles groups instead of highlighting the requested muscles
 * directly"*.
 *
 * The app ships six exercises; a deadlift, a row, a squat are not among them,
 * so there is no scenario to load and nothing for `navigate` to point at. What
 * the body scale DOES have is the group selection the chips drive — a Set of
 * group keys, where anything outside it is switched off — and that is exactly
 * the owner's mechanism: showing a movement's muscles is UNSELECTING the ones
 * it does not work. So this carries a set of group keys, and the front door
 * (`App.jsx`) sets its `groupSel` from it, which is the same state a visitor
 * changes by pressing the chips.
 *
 * In `shell/` because both sides import it and neither owns it: the API lane's
 * executor (`ask/askStream.js`) dispatches, the scene listens. The same place
 * and the same reason as `assistantContext.js`.
 *
 * The event carries the groups the movement WORKS, not the ones to hide. The
 * hiding is what the scene does with them, and saying it the other way round
 * would put the app's rendering rule inside the model's vocabulary.
 */
export const SHOW_GROUPS = "hpe:show-groups";

export function showGroups(groups) {
  if (typeof window === "undefined") return;
  const asked = Array.isArray(groups) ? groups.filter((g) => typeof g === "string" && g) : [];
  if (!asked.length) return;
  window.dispatchEvent(new CustomEvent(SHOW_GROUPS, { detail: { groups: asked } }));
}

/**
 * AND ONE MUSCLE, WHICH IS A DIFFERENT GRAIN — owner, 2026-09-07: *"when a user
 * requests highlight just 'this' muscle on motion or idle, unselect every other
 * muscle"*. A group is the wrong unit for "this one": a visitor who has picked
 * the pectoralis major and asks for just it would get the whole chest.
 *
 * This drives the other highlighting control the owner named on 2026-08-31 —
 * the SEARCH — so each floor does with it what it already does. The idle model
 * hides everything else; the motion floor washes it out instead, because "a
 * moving body with holes in it reads as broken, not as filtered"
 * (`MotionScene.jsx`). Both floors call that unselected, and both listen.
 *
 * The label travels with the key because the search matches on the label, and
 * the middleware has the roster to resolve it — so neither scene has to.
 */
export const SHOW_MUSCLE = "hpe:show-muscle";

export function showMuscle(muscle) {
  if (typeof window === "undefined") return;
  const label = typeof muscle?.label === "string" ? muscle.label.trim() : "";
  if (!label) return;
  window.dispatchEvent(new CustomEvent(SHOW_MUSCLE, { detail: { key: muscle.key ?? null, label } }));
}
