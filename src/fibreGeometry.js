import { PropertyBinding } from "three";

/**
 * The measured fibre line of one muscle mesh, keyed the way the scene keys it.
 *
 * `rig.json` already carries `meshChain[<mesh name>].fibre = {c, a, len}` for 297
 * of the 467 muscle meshes, written by `anatomy-mesh-set/build/rig.mjs` off the
 * mesh vertices themselves. `App.jsx` already emits the mesh name on selection.
 * This is the join between them, and it is the only place the two meet.
 *
 * CONTRACT — what `len` is, because the label on screen depends on it:
 *   rig.mjs:686-696 measures the distance between the centroid of the vertices
 *   labelled to the first segment of the chain and the centroid of those labelled
 *   to the last, in the rest pose. It is a measured end-to-end span of THIS mesh,
 *   in metres, and it exists so the runtime can preserve volume (`rig.js`
 *   `updateGirth`). It is NOT a histological fascicle length: nothing here
 *   measured a fascicle, and no pennation angle was recorded. Anything putting
 *   this number on screen must say what was measured, or it turns a real
 *   measurement into a false claim — which is the failure `docs/objective.md`
 *   names and PRD §21 ranks first.
 *
 * The name arrives sanitised. GLTFLoader runs every node name through
 * `PropertyBinding.sanitizeNodeName`, so three.js says
 * "abdominal_part_of_left_pectoralis_major" where rig.json says
 * "abdominal part of left pectoralis major". Both sides go through the loader's
 * own function rather than a regex copied out of it, so they cannot drift.
 *
 * No fetch. `MotionScene.jsx:440` already loads `/mapping/rig.json`; this takes
 * the object it loaded.
 *
 * @param rig parsed rig.json — tolerates the pre-load `null` and the failed-fetch
 *            `false` that `useJson` produces
 * @param meshName either spelling of the mesh name
 * @returns {{centroid: number[], axis: number[], fascicleLengthM: number} | null}
 *          null for every mesh with no fibre entry. Never the nearest match.
 */
export function fibreGeometry(rig, meshName) {
  const fibre = indexOf(rig)?.get(PropertyBinding.sanitizeNodeName(meshName ?? ""));
  if (!fibre) return null;
  // Fresh arrays: rig.json is shared with the skinning and the girth solve, and a
  // caller nudging a centroid would move the muscle for everyone.
  return { centroid: [...fibre.c], axis: [...fibre.a], fascicleLengthM: fibre.len };
}

// One index per rig object. Built lazily, dropped with the rig.
const cache = new WeakMap();

function indexOf(rig) {
  if (!rig || typeof rig !== "object") return null;
  let index = cache.get(rig);
  if (!index) {
    index = new Map();
    // A chain may legally carry no fibre line — rig.mjs drops it when the two end
    // centroids sit under 10 mm apart. Those meshes are absent here, not zero.
    for (const [name, chain] of Object.entries(rig.meshChain ?? {})) {
      if (chain?.fibre) index.set(PropertyBinding.sanitizeNodeName(name), chain.fibre);
    }
    cache.set(rig, index);
  }
  return index;
}
