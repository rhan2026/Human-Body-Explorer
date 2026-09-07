import { test } from "node:test";
import assert from "node:assert/strict";
import { describeRoles, getAssistantContext, readableSlug, setRouteContext, setSceneContext, VIEW } from "./assistantContext.js";

test("the route layer is what every view has; the scene layer sharpens it and clears itself", () => {
  setSceneContext(null);
  setRouteContext({ currentView: VIEW.motion, selectedExercise: "pull_up", selectedMuscle: readableSlug("abdominal-part-of-left-pectoralis-major") });
  assert.deepEqual(getAssistantContext(), {
    currentView: "SHOW_MOTION",
    selectedExercise: "pull_up",
    selectedMuscle: "abdominal part of left pectoralis major",
  });

  setSceneContext({ selectedExercise: "Pull-up", motionState: "playing", activeMuscles: null });
  assert.deepEqual(getAssistantContext(), {
    currentView: "SHOW_MOTION",
    selectedExercise: "Pull-up",
    selectedMuscle: "abdominal part of left pectoralis major",
    motionState: "playing",
    activeMuscles: null,
  });

  // The scene unmounts: its fields go with it, the route's stay.
  setSceneContext(null);
  assert.deepEqual(getAssistantContext(), {
    currentView: "SHOW_MOTION",
    selectedExercise: "pull_up",
    selectedMuscle: "abdominal part of left pectoralis major",
  });

  // A new hash replaces the route layer wholesale — nothing from the old one lingers.
  setRouteContext({ currentView: VIEW.fiber, selectedExercise: null, selectedMuscle: null });
  assert.deepEqual(getAssistantContext(), { currentView: "FIBER", selectedExercise: null, selectedMuscle: null });
  assert.ok(Object.isFrozen(getAssistantContext()));
});

test("the view words are the prompt's, one per scale of this app", () => {
  assert.deepEqual(VIEW, { body: "BODY", motion: "SHOW_MOTION", fiber: "FIBER", cell: "CELL", signalling: "CELL_SIGNALING" });
});

test("roles come out by the manifest's names with the role beside each, primary first", () => {
  const manifest = {
    muscles: [
      { key: "pectoralis_major", label: "Pectoralis major" },
      { key: "triceps_brachii", label: "Triceps brachii" },
    ],
  };
  const spec = { primary: ["pectoralis_major"], secondary: ["triceps_brachii", "unlisted_key"], stabilizer: [] };
  assert.deepEqual(describeRoles(spec, manifest), ["Pectoralis major (primary)", "Triceps brachii (secondary)", "unlisted key (secondary)"]);
  assert.equal(describeRoles(null, manifest), null);
  assert.equal(describeRoles(spec, null), null);
  assert.equal(describeRoles({ primary: [] }, manifest), null);
  assert.equal(readableSlug(null), null);
});
