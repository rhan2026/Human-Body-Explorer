import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { MUSCLES, MUSCLE_GROUPS, SHOW_MUSCLES_TOOL, SHOW_MUSCLE_TOOL, TOOLS, groupsAsked, muscleAsked } from "./assistantMiddleware.js";

/**
 * THE SECOND TOOL: SHOWING A MOVEMENT'S MUSCLES BY SWITCHING THE REST OFF.
 *
 * Owner, 2026-09-07: *"when i ask bell about excercises not on the list, it
 * identifies what muscles are used but cannot highlight them on the idle
 * model. when a user asks to highlight certain muscles used on an exercise,
 * unselect the irrelevant muscles groups instead of highlighting the requested
 * muscles directly"*.
 */

test("the tool's groups are the manifest's groups, not a copy of them", () => {
  /* A sixteen-key list typed into the middleware would be a second definition
     of the mesh set's own, and the two drift the first time a group is added.
     The tool reads the file the app draws from; this holds them equal. */
  const map = JSON.parse(readFileSync(new URL("../public/mapping/muscle-map.json", import.meta.url), "utf8"));
  assert.deepEqual(MUSCLE_GROUPS, Object.keys(map.groups), "the tool's group enum has drifted from muscle-map.json");
  assert.ok(MUSCLE_GROUPS.length >= 10, `only ${MUSCLE_GROUPS.length} groups were read; the manifest path is probably wrong`);
  assert.deepEqual(SHOW_MUSCLES_TOOL.input_schema.properties.groups.items.enum, MUSCLE_GROUPS);
});

test("the tool is offered, and says which way its mechanism runs", () => {
  assert.ok(TOOLS.some((t) => t.name === "show_muscles"), "the group tool is no longer offered");
  assert.match(
    SHOW_MUSCLES_TOOL.description,
    /SWITCHING OFF every group you do not name/i,
    "the description no longer tells the model that naming a group keeps it and silence removes it",
  );
  assert.equal(SHOW_MUSCLES_TOOL.input_schema.required.length, 1);
  assert.equal(SHOW_MUSCLES_TOOL.input_schema.properties.groups.minItems, 1, "an empty call would switch every group off and blank the body");
});

test("a call naming groups this mesh set does not have cannot blank the body", () => {
  assert.deepEqual(groupsAsked({ groups: ["chest", "glutes"] }), ["chest", "glutes"]);
  assert.deepEqual(groupsAsked({ groups: ["chest", "wings", "gills"] }), ["chest"], "unknown group keys are no longer dropped");
  assert.deepEqual(groupsAsked({ groups: ["wings"] }), [], "a call naming nothing real should yield nothing, and the caller shows nothing");
  for (const junk of [null, undefined, {}, { groups: "chest" }, { groups: 42 }]) {
    assert.deepEqual(groupsAsked(junk), [], `groupsAsked(${JSON.stringify(junk)}) should be empty`);
  }
});

test("one muscle is a tool of its own, with the roster's keys and the label the search needs", () => {
  /* Owner, 2026-09-07: *"when a user requests highlight just 'this' muscle on
     motion or idle, unselect every other muscle"*. Groups cannot express it.
     The label travels with the key because the scenes single a muscle out with
     their SEARCH, which matches on the label — resolved here, where the roster
     already is, rather than in two scenes. */
  assert.deepEqual(TOOLS.map((t) => t.name), ["navigate", "show_muscles", "show_muscle"]);
  const map = JSON.parse(readFileSync(new URL("../public/mapping/muscle-map.json", import.meta.url), "utf8"));
  assert.equal(MUSCLES.length, map.muscles.filter((m) => m.key && m.label).length);
  assert.deepEqual(SHOW_MUSCLE_TOOL.input_schema.properties.muscle.enum, MUSCLES.map((m) => m.key));
  assert.ok(MUSCLES.length >= 40, `only ${MUSCLES.length} muscles were read from the roster`);

  assert.deepEqual(muscleAsked({ muscle: "pectoralis_major" }), { key: "pectoralis_major", label: "Pectoralis major" });
  for (const junk of [null, undefined, {}, { muscle: "not_a_muscle" }, { muscle: 7 }]) {
    assert.equal(muscleAsked(junk), null, `muscleAsked(${JSON.stringify(junk)}) should be null`);
  }
  assert.match(SHOW_MUSCLE_TOOL.description, /every other muscle unselected/i);
});
