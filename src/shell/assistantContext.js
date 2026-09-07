/**
 * What the Anatomy Assistant is told about the screen, and the one place
 * that holds it.
 *
 * Same mechanism as uiState.js, for the same reason: the widget is mounted
 * once at the Router so it survives every scale change, and the scene it
 * floats over shares no parent with it. Two layers, merged on every write —
 *   route: what the hash says (the Router writes it: view, exercise, muscle)
 *   scene: what only the mounted scene knows (it writes at its own 10 Hz
 *          tick and clears itself on unmount) — the explorer's pick and
 *          exercise never touch the hash; the movement's phase and clock, the
 *          fibre's stage, the cell's and the network's readings live in refs.
 * Scene values win over route values, so a scene may sharpen "pull_up" into
 * "Pull-up" and a slug into the label it drew.
 *
 * The widget reads `getAssistantContext()` at the moment of Send, so every
 * question carries the newest state and nothing here re-renders anything.
 * Field names are the prompt's (server/anatomyAssistantPrompt.js); a field a
 * view does not have is simply not written, and a field it has with nothing
 * in it is written as null — the block prints the two differently.
 */

let route = {};
let scene = null;
let snapshot = Object.freeze({});

function publish() {
  snapshot = Object.freeze({ ...route, ...(scene ?? {}) });
}

export function setRouteContext(next) {
  route = next ?? {};
  publish();
}

/** The mounted scene's own fields; `null` clears them (call it on unmount). */
export function setSceneContext(next) {
  scene = next ?? null;
  publish();
}

export function getAssistantContext() {
  return snapshot;
}

/** The prompt's vocabulary for `currentView`, keyed by this app's scales. */
export const VIEW = Object.freeze({
  body: "BODY",
  motion: "SHOW_MOTION",
  fiber: "FIBER",
  cell: "CELL",
  signalling: "CELL_SIGNALING",
});

/** A hash muscle slug as words — the same reading the drawers print. */
export function readableSlug(slug) {
  return slug ? String(slug).replace(/-/g, " ") : null;
}

/**
 * The muscles an exercise lights, by the names the manifest gives them and
 * the role it assigns — "Pectoralis major (primary)". The roles are Curated
 * (muscle-map.json evidenceNote), and the model is told so by the prompt's
 * own rules, not by this list.
 */
export function describeRoles(spec, manifest) {
  if (!spec || !manifest) return null;
  const label = new Map((manifest.muscles ?? []).map((m) => [m.key, m.label]));
  const out = [];
  for (const role of ["primary", "secondary", "stabilizer"]) {
    for (const key of spec[role] ?? []) out.push(`${label.get(key) ?? String(key).replace(/_/g, " ")} (${role})`);
  }
  return out.length ? out : null;
}
