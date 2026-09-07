/**
 * The exercise-motion registry.
 *
 * One place that answers "does this exercise move, and how". The scene asks it
 * for a definition and knows nothing else about any particular exercise; the
 * explorer asks it whether to enable a button.
 *
 * Lookup is normalised because the same exercise arrives spelled several ways —
 * `push_up` from the manifest, `pushup` from the legacy hash route, `Push-up`
 * from a display label — and a motion that silently fails to resolve is exactly
 * the "button that does nothing" this is meant to prevent.
 */

import { pushUp } from "./motions/pushUp.js";
import { pullUp } from "./motions/pullUp.js";
import { benchPress } from "./motions/benchPress.js";
import { lunge } from "./motions/lunge.js";
import { running } from "./motions/running.js";
import { swimming } from "./motions/swimming.js";

const DEFINITIONS = [pushUp, pullUp, benchPress, lunge, running, swimming];

/**
 * Canonical form: lowercase, punctuation and whitespace collapsed to single
 * underscores, ends trimmed. `Push-Up`, `push up` and `push_up` all land on the
 * same key, and so does a label typed into a URL.
 */
export function normalizeExerciseId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Spellings that do not normalise onto their canonical id.
 *
 * Only genuine synonyms belong here. `pushup` is the pre-existing hash route and
 * has to keep working; the rest are the shapes a display label collapses to.
 */
const ALIASES = {
  pushup: "push_up",
  press_up: "push_up",
  pullup: "pull_up",
  chin_up: "pull_up",
  chinup: "pull_up",
  bench: "bench_press",
  barbell_bench_press: "bench_press",
  forward_lunge: "lunge",
  lunges: "lunge",
  run: "running",
  jog: "running",
  jogging: "running",
  sprint: "running",
  swim: "swimming_freestyle",
  swimming: "swimming_freestyle",
  freestyle: "swimming_freestyle",
  freestyle_swimming: "swimming_freestyle",
  front_crawl: "swimming_freestyle",
};

const BY_ID = new Map();
for (const definition of DEFINITIONS) {
  BY_ID.set(definition.id, definition);
  // A definition's own label resolves too, so a caller holding only the display
  // string still finds the motion.
  BY_ID.set(normalizeExerciseId(definition.label), definition);
}

/** Canonical id for any spelling, or the normalised input if it is unknown. */
export function canonicalExerciseId(value) {
  const key = normalizeExerciseId(value);
  return ALIASES[key] ?? key;
}

/** The motion for an exercise, or null. Never throws on an unknown id. */
export function getMotion(value) {
  return BY_ID.get(canonicalExerciseId(value)) ?? null;
}

export function hasMotion(value) {
  return getMotion(value) !== null;
}

/** Every motion, in registration order. */
export function allMotions() {
  return DEFINITIONS.slice();
}

/**
 * Which exercises in a manifest have a motion and which do not.
 *
 * Used to build the coverage report and, more importantly, to make a gap loud:
 * an exercise added to `muscle-map.json` with no motion shows up here rather
 * than quietly rendering a dead button.
 */
export function motionCoverage(manifestExercises = {}) {
  return Object.entries(manifestExercises).map(([key, spec]) => {
    const motion = getMotion(key);
    return {
      id: key,
      label: spec?.label ?? key,
      motion: motion?.id ?? null,
      animated: motion !== null,
      // Highlighting is connected when the roles the motion asks for exist.
      roles: motion ? (manifestExercises[motion.roles] ? motion.roles : null) : null,
    };
  });
}
