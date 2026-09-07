import assert from "node:assert/strict";
import test from "node:test";

import { anatomyNode, ROLE_ABSENT, ROLE_UNMAPPED } from "./anatomyNode.js";

/**
 * The record behind a picked muscle, and the three ways it is allowed to be
 * incomplete.
 *
 * `muscle-map.json` has carried an FMA id for every mesh since the mesh set was
 * built and `grep -rl FMA src/` returned nothing: computed, exported, served,
 * and reaching no pixel. What made it unusable was the shape. `meshes` and
 * `fmaIds` are two arrays filtered by two different predicates, so for the five
 * Z-Anatomy muscles — latissimus dorsi, rectus abdominis, internal oblique,
 * transversus abdominis, quadratus lumborum — `fmaIds` is empty beside two
 * meshes, and read positionally it labels a muscle with its neighbour's id.
 * `meshOntology` is keyed by mesh name for that reason, and these tests are
 * mostly about the absent cases, because those are the ones that lie.
 */

const MAP = {
  attribution: {
    bodyParts3D: "BodyParts3D, (c) The Database Center for Life Science — CC BY-SA 2.1 Japan",
    zAnatomy: "Z-Anatomy by Gauthier Kervyn — CC BY-SA 4.0",
  },
  meshOntology: {
    "sternocostal part of right pectoralis major": {
      fmaId: "FMA79979", bpId: "BP5613", source: "bp3d", isTendon: false,
    },
    "left latissimus dorsi": { fmaId: null, bpId: null, source: "z-anatomy", isTendon: false },
  },
};

const ROLES = {
  label: "Bench press",
  source: "PRD section 8.2",
  primary: ["pectoralis_major"],
  secondary: ["serratus_anterior"],
  stabilizer: [],
};

const PEC = { name: "sternocostal part of right pectoralis major", key: "pectoralis_major", label: "Pectoralis major" };
const LAT = { name: "left latissimus dorsi", key: "latissimus_dorsi", label: "Latissimus dorsi" };

test("a BodyParts3D mesh carries both ids and the 2.1 JP licence", () => {
  const n = anatomyNode(PEC, MAP, ROLES);
  assert.equal(n.fmaId, "FMA79979");
  assert.equal(n.bpId, "BP5613");
  assert.match(n.licence, /CC BY-SA 2\.1/);
  assert.equal(n.attribution, MAP.attribution.bodyParts3D);
});

test("a Z-Anatomy mesh reports the OTHER licence and no ids, rather than blank", () => {
  const n = anatomyNode(LAT, MAP, ROLES);
  assert.equal(n.fmaId, null, "must not borrow a neighbour's id");
  assert.equal(n.bpId, null);
  assert.match(n.licence, /CC BY-SA 4\.0/);
  assert.equal(n.attribution, MAP.attribution.zAnatomy);
  // The licence differs per mesh, which is the whole reason one blanket footer
  // credit is weaker than what the data supports.
  assert.notEqual(n.licence, anatomyNode(PEC, MAP, ROLES).licence);
});

test("the role is the exercise's own word for it, with the exercise named", () => {
  const n = anatomyNode(PEC, MAP, ROLES);
  assert.equal(n.role, "primary");
  assert.equal(n.roleLabel, "Primary in Bench press");
  assert.equal(n.roleSource, "PRD section 8.2");
});

test("a muscle the exercise does not use says so, and does not read as unknown", () => {
  const n = anatomyNode(LAT, MAP, ROLES);
  assert.equal(n.role, ROLE_ABSENT);
  assert.equal(n.roleLabel, "Not involved in Bench press");
});

test("a mesh outside the roster is distinguished from one the exercise skips", () => {
  const stray = { name: "some tendon", key: null, label: null };
  const n = anatomyNode(stray, MAP, ROLES);
  assert.equal(n.role, ROLE_UNMAPPED);
  assert.match(n.roleLabel, /roster/i);
  // "Not involved" would be a claim about a muscle nobody ever assessed.
  assert.doesNotMatch(n.roleLabel, /not involved/i);
});

test("no exercise selected means no role sentence at all, not a false negative", () => {
  const n = anatomyNode(PEC, MAP, null);
  assert.equal(n.role, null);
  assert.equal(n.roleLabel, null);
});

test("an unknown mesh yields a record that admits it knows nothing", () => {
  const n = anatomyNode({ name: "not in the map", key: null, label: null }, MAP, ROLES);
  assert.equal(n.fmaId, null);
  assert.equal(n.licence, null);
  assert.equal(n.attribution, null);
});

test("the underscored GLB spelling finds the spaced manifest key", () => {
  // `left_iliotibial_tract` is what a pick reports; the manifest says
  // `left iliotibial tract`. Measured: every lookup missed, and a complete
  // ontology looked like an absent one.
  const map = {
    attribution: { zAnatomy: "Z-Anatomy by Gauthier Kervyn — CC BY-SA 4.0" },
    meshOntology: {
      "left iliotibial tract": { fmaId: null, bpId: null, source: "z-anatomy", isTendon: true },
    },
  };
  const n = anatomyNode({ name: "left_iliotibial_tract", key: null }, map, null);
  assert.equal(n.source, "z-anatomy");
  assert.equal(n.isTendon, true);
  assert.match(n.licence, /CC BY-SA 4\.0/);
});

test("an unrostered mesh is not credited to a source that never judged it", () => {
  const map = { attribution: {}, meshOntology: {} };
  const roles = { label: "Bench press", source: "PRD section 8.2", primary: [], secondary: [], stabilizer: [] };
  const n = anatomyNode({ name: "some tendon", key: null }, map, roles);
  assert.equal(n.role, ROLE_UNMAPPED);
  assert.equal(n.roleSource, null, "crediting PRD 8.2 for a judgement it never made");
});
