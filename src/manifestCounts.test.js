import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * THE FOUR NUMBERS ON THE FRONT DOOR COUNT WHAT THEY SAY THEY COUNT.
 *
 * `App.jsx` prints `{counts.namedMuscles} muscles · {counts.muscleMeshes} meshes
 * · {counts.bones} bones · {counts.groups} groups` — read off the manifest
 * rather than typed, which Q14 R8-R10 had to fix in three other places. Q15 R7
 * asks the next question: does the manifest's own count match the manifest's own
 * data?
 *
 * Measured 2026-08-27: `namedMuscles` 53 against 53 muscles, `groups` 16 against
 * 16, `exerciseRosterMeshes` 146 against the meshes those muscles list, and
 * `muscleMeshes` 467 against the ontology's 467 entries. All four agree.
 *
 * `bones` is not checked here — it comes from the rig, and
 * `anatomy-mesh-set/build/check.mjs` already holds it.
 */
test("the manifest's counts count the manifest", async () => {
  const raw = await readFile(new URL("../public/mapping/muscle-map.json", import.meta.url), "utf8");
  const map = JSON.parse(raw);
  const counts = map.counts ?? {};

  const muscles = Array.isArray(map.muscles) ? map.muscles : Object.values(map.muscles ?? {});
  const rosterMeshes = muscles.flatMap((m) => m.meshes ?? []);

  assert.equal(counts.namedMuscles, muscles.length, "namedMuscles is not the number of named muscles");
  assert.equal(counts.groups, Object.keys(map.groups ?? {}).length, "groups is not the number of groups");
  assert.equal(
    counts.exerciseRosterMeshes,
    rosterMeshes.length,
    "exerciseRosterMeshes is not the number of meshes the named muscles list",
  );
  assert.equal(
    counts.muscleMeshes,
    Object.keys(map.meshOntology ?? {}).length,
    "muscleMeshes is not the number of meshes the ontology knows — the front door prints this one",
  );

  /* And every mesh a muscle lists is one the ontology can place, which is what
     makes the two counts halves of the same set rather than two tallies. */
  const unplaced = rosterMeshes.filter(
    (n) => !map.meshOntology?.[n] && !map.meshOntology?.[String(n).replace(/_/g, " ")],
  );
  assert.deepEqual(
    unplaced.slice(0, 5),
    [],
    `${unplaced.length} meshes are listed by a muscle and unknown to the ontology, so a pick on them has ` +
      `no licence and no id to show`,
  );
});
