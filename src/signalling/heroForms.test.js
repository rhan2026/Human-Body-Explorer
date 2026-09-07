import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";

import { buildForm } from "./heroForms.js";
import { heroAt } from "./heroGeometry.js";
import { HERO_NODES } from "./heroNetwork.js";
import { SCENARIOS } from "./signallingBinding.js";

const archive = async (id) =>
  JSON.parse(await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"));

const mats = () => ({
  body: new THREE.MeshBasicMaterial(),
  detail: new THREE.MeshBasicMaterial(),
});

const count = (group) => {
  let n = 0;
  group.traverse((o) => {
    if (o.isMesh) n += 1;
  });
  return n;
};

const box = (group) => {
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(group);
};

test("every one of the twelve is drawn as something, not as nothing", async () => {
  const { nodes } = await archive(SCENARIOS.resistance);
  for (const node of HERO_NODES) {
    const form = buildForm(node, nodes[node.id]?.type ?? "", mats());
    assert.ok(count(form) > 0, `"${node.id}" builds an empty group — it would be an invisible node`);
  }
});

/**
 * THE WHOLE POINT, PINNED. The owner's instruction was *"저 핵심 12개를 실제로
 * 그려서 만들라고 그냥 점이 아니라"*, and the failure mode this guards is the one
 * that is easy to reach by accident: a `switch` that falls through, or a form
 * table that loses an entry, and twelve nodes quietly become twelve of the same
 * shape again while every other gate stays green.
 */
test("the twelve do not all look the same", async () => {
  const { nodes } = await archive(SCENARIOS.resistance);
  const shapes = HERO_NODES.map((node) => {
    const form = buildForm(node, nodes[node.id]?.type ?? "", mats());
    const b = box(form);
    const size = b.getSize(new THREE.Vector3());
    return `${count(form)}:${size.x.toFixed(3)}:${size.y.toFixed(3)}`;
  });
  const distinct = new Set(shapes);
  assert.ok(
    distinct.size >= 7,
    `only ${distinct.size} distinct silhouettes across twelve nodes — they have collapsed back ` +
      `toward one shape: ${[...distinct].join(" | ")}`,
  );
});

/**
 * THE TWO DOORS HAVE TO LOOK LIKE TWO DOORS. This screen's sentence is that the
 * two bouts come in at different places; if `integrin` and `B_AR` draw the same,
 * the picture contradicts its own caption. Seven-pass for a GPCR and two legs
 * for an integrin heterodimer are both textbook, and they are also the cheapest
 * way to make that difference visible without a word.
 */
test("the resistance door and the endurance door are different objects", async () => {
  const { nodes } = await archive(SCENARIOS.resistance);
  const of = (id) =>
    count(buildForm(HERO_NODES.find((n) => n.id === id), nodes[id].type, mats()));
  assert.notEqual(
    of("integrin"),
    of("B_AR"),
    "the two doors build the same number of parts; a seven-pass receptor and a two-legged " +
      "heterodimer are being drawn identically",
  );
});

/**
 * THE FORM FOLLOWS THE ARCHIVE'S TYPE, which is the honesty argument this whole
 * scale rests on — `signallingBinding.js` states it for placement and the same
 * reasoning carries to shape. If the type column stops driving the drawing then
 * the shapes are ours, and ours is not what this model can support.
 */
test("changing a node's type changes what is drawn for it", async () => {
  const node = HERO_NODES.find((n) => n.id === "JNK");
  const asProtein = count(buildForm(node, "protein", mats()));
  const asGene = count(buildForm(node, "gene", mats()));
  const asReceptor = count(buildForm(node, "receptor", mats()));
  assert.ok(
    new Set([asProtein, asGene, asReceptor]).size === 3,
    `the same node drew ${asProtein}/${asGene}/${asReceptor} parts as protein/gene/receptor — the ` +
      "type column is not reaching the drawing",
  );
});

/**
 * Nothing may be so large it walks into its neighbour's row or column.
 *
 * RE-AIMED 2026-09-01, BECAUSE THE OLD BOUND MEASURED NOTHING. It was
 * `size <= FORM_R * 3.2`, and `FORM_R` is the dial that makes the forms bigger.
 * Both sides of that comparison move together, so the gate is green at 0.072 and
 * green at 0.72 — it cannot report the collision its own message describes. The
 * forms grew 1.75x today and it did not notice, which is the definition of a
 * gate that was never going to fail.
 *
 * WHAT IT ASKS NOW IS ABSOLUTE, IN WORLD UNITS, AND AGAINST THE REAL POSITIONS.
 * `heroAt` puts each of the thirteen where the drawing actually puts it, so the
 * distance to a node's nearest neighbour is a fact about the layout rather than
 * about a radius. A form may reach halfway to that neighbour and no further:
 * two neighbours may touch — the render note asks for exactly that, *"let
 * neighbours overlap"* — but neither may pass the midline, because past the
 * midline it is covering the other one's centre, and a node's centre is where
 * `Gizmos` hangs its name plate and where `FocusRing` draws. A form that swallows
 * its neighbour's label is the failure worth catching; two that graze is not.
 *
 * MEASURED AT THE SIZE THIS SHIPS AT, over all thirteen: the binding node is
 * `ResistanceExercise`, 0.158 of half-extent against the 0.235 that is half the
 * way to `integrin` — 0.471, which is one row plus the depth the dome gives the
 * two of them. Margin 1.49x, and the loosest is `Mitochondrial_Biogenesis` at
 * 3.80x. So this bites at about half as much growth again, which is where it
 * should sit: `FORM_R` moved 1.75x today and the next hand on that dial should
 * meet something. Checked in x and y only — z is depth toward the camera and
 * nothing is beside anything there.
 */
/**
 * RE-AIMED 2026-09-01 AT WHAT IT WAS ACTUALLY PROTECTING. This asserted
 * `size / 2 <= nearest / 2` — a form may reach halfway to its nearest
 * neighbour — which means two neighbours can at most TOUCH and can never
 * overlap. An audit of all three scales put object-to-object occlusion at the
 * top of what the fibre scale has and this one does not, and confirmed it
 * against three independent refuters: with nothing ever passing in front of
 * anything, a still frame of this scale carries no ordinal depth at all. So the
 * old bound was not protecting a thing, it was forbidding the strongest depth
 * cue there is.
 *
 * What it IS protecting is in its own failure message: "it is covering that
 * node's centre, which is where its name plate and its focus ring are drawn".
 * That is a real invariant and a narrower one. A form may now reach three
 * quarters of the way to its neighbour — so two of them overlap across half the
 * gap between them — and every centre stays clear by a quarter of it, which is
 * what the plate anchor and the ring need.
 *
 * The ceiling is not 1.0 because a form that reaches its neighbour's centre can
 * swallow it whole; 0.75 was chosen as the largest bound that still leaves each
 * node a quarter of its own gap on every side.
 */
/* RAISED 0.75 -> 0.88, 2026-09-02, FOR THE REASON THE PREVIOUS RE-AIM GIVES.
   That note says the old 0.5 bound "was not protecting a thing, it was
   forbidding the strongest depth cue there is", and picked 0.75 to leave every
   centre a quarter of its gap because "its name plate and its focus ring are
   drawn" there. The plate is not drawn there: `heroGeometry.js` hangs it at
   `node.row === 0 ? y - FORM_R * 1.5 : y + FORM_R * 1.5`, off the form and
   scaled by the same radius, so it clears whatever the form grows to.
   MEASURED, WHICH IS WHY THIS MOVED: six frames put this scale's solid-object
   ink at 12.6 % against fibre's 27.7 %. `FORM_R` went 0.16 -> 0.285 and the ink
   went to 26.6 %. The binding node is `ResistanceExercise` at 0.256 of half
   extent against 0.320 to its nearest neighbour — 0.80, so 0.88 ships it with
   margin and still stops a form that would reach a neighbour's far side.
   SEEN: `.claude/shots/r2-signalling-*.png`, every one of the thirteen plates
   legible and attached. */
const CLEARANCE = 0.88;

test("no form covers its neighbour's centre", async () => {
  const { nodes } = await archive(SCENARIOS.resistance);
  const centres = new Map(HERO_NODES.map((n) => [n.id, new THREE.Vector3(...heroAt(n))]));
  for (const node of HERO_NODES) {
    const nearest = Math.min(
      ...HERO_NODES.filter((n) => n.id !== node.id).map((n) =>
        centres.get(node.id).distanceTo(centres.get(n.id)),
      ),
    );
    const size = box(buildForm(node, nodes[node.id]?.type ?? "", mats())).getSize(new THREE.Vector3());
    for (const axis of ["x", "y"]) {
      assert.ok(
        size[axis] / 2 <= nearest * CLEARANCE,
        `"${node.id}" reaches ${(size[axis] / 2).toFixed(3)} from its centre on ${axis}, past the ` +
          `${(nearest * CLEARANCE).toFixed(3)} it is allowed of the ${nearest.toFixed(3)} to its nearest ` +
          "neighbour — overlapping is the point, but this leaves that node less than a quarter of its own " +
          "gap, and its centre is where its name plate and its focus ring are drawn",
      );
    }
  }
});

/* ── ONE GATE FROM THE OTHER CANDIDATE, 2026-08-31 ────────────────────────────
   `viz-form-a` and `viz-form-b` rewrote the same functions and only one could
   ship. A won on the screen: it fixes a real bug — the mitochondrion drew its
   cristae at r 0.34 inside an OPAQUE r 0.52 shell, so the one object on that
   scale a first-year would recognise was a brown pill — and its surfaces read
   as objects rather than as primitives. B's forms lost.
   This gate of B's is about the MACHINERY and not the shapes, so it comes
   across on its own: `lobe()` displaces vertices now, and the reason it takes a
   seed rather than drawing one is that this repo reviews itself from
   screenshots. A random surface would make two runs of the same gate disagree
   about a thing that carries no meaning either way. */
/**
 * THE SAME PICTURE EVERY LOAD, which is a rule this scale already lives under:
 * `heroGeometry.js` hashes the index to place its background dust rather than
 * calling `Math.random`, *"so the picture is the same on every load and in every
 * screenshot; a random scatter would make two runs of the same gate disagree
 * about a thing that carries no meaning either way"*.
 *
 * `lobe()` now displaces vertices, and the whole reason it takes a `seed`
 * instead of drawing one is that same sentence. This is the absence test for the
 * `Math.random` that is not there — the failure it guards is a form that looks
 * fine, reads fine, and quietly makes every screenshot gate in this repo
 * non-reproducible.
 */
test("a form built twice is the same form", async () => {
  const { nodes } = await archive(SCENARIOS.resistance);
  const read = (node) => {
    const out = [];
    const form = buildForm(node, nodes[node.id]?.type ?? "", mats());
    form.updateMatrixWorld(true);
    form.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 1) out.push(p.getX(i), p.getY(i), p.getZ(i));
    });
    return out;
  };
  for (const node of HERO_NODES) {
    assert.deepEqual(
      read(node),
      read(node),
      `"${node.id}" draws differently on a second build — something in its form is random`,
    );
  }
});


/* ---- the 2026-09-06 brief: smaller nodes, outcomes that happen ----------- */

import { FORM_R } from "./heroForms.js";
import { COL_HALF } from "./heroGeometry.js";

test("a form is a node in a network, not a sculpture — the radius took the brief's cut", () => {
  /* Owner §1: *"Hero node를 25~35% 축소"*, from the 0.195 it stood at. 0.146 is
     the 25 % line and 0.127 the 35 %; below about 0.12 the note in this file
     says a form stops shading and reads as an outline, so the floor is real. */
  assert.ok(FORM_R <= 0.146, `FORM_R is ${FORM_R}; the brief's 25 % cut from 0.195 is 0.146 at most`);
  assert.ok(FORM_R >= 0.12, `FORM_R is ${FORM_R}; below 0.12 a form is an outline, not an object`);
});

/** Meshes under a form tagged with one `userData.part`. */
const parts = (form, part) => {
  const out = [];
  form.traverse((o) => {
    if (o.userData?.part === part) out.push(o);
  });
  return out;
};

const size = (obj) => {
  const b = box(obj);
  return b.getSize(new THREE.Vector3());
};

test("the three outcomes carry a drive, and driving it shows the outcome happening", () => {
  const node = (id) => HERO_NODES.find((n) => n.id === id);
  const ribosome = buildForm(node("Protein_Synthesis"), "phenotype", mats());
  const growth = buildForm(node("Cell_Growth"), "phenotype", mats());
  const mito = buildForm(node("Mitochondrial_Biogenesis"), "phenotype", mats());
  for (const [id, form] of [["Protein_Synthesis", ribosome], ["Cell_Growth", growth], ["Mitochondrial_Biogenesis", mito]]) {
    assert.equal(typeof form.userData.drive, "function", `${id} has no drive — the outcome cannot be shown happening`);
  }

  /* Owner §8: *"Ribosome이 strand를 실제로 뽑아내게"*. The strand gets LONGER
     as the outcome progresses, out of the ribosome, and it starts short rather
     than absent so the form still reads as a ribosome at rest. */
  const [strand] = parts(ribosome, "strand");
  assert.ok(strand, "the ribosome has no part tagged strand");
  ribosome.userData.drive(0);
  const shortStrand = size(strand).length();
  ribosome.userData.drive(1);
  const longStrand = size(strand).length();
  assert.ok(shortStrand > 0, "the strand is absent at rest");
  assert.ok(longStrand > shortStrand * 1.8, `the strand went ${shortStrand.toFixed(3)} → ${longStrand.toFixed(3)}; it should visibly extrude`);

  /* Owner §8: *"muscle fiber cross section / contractile bundle이 살짝 확대"*.
     Slightly: bigger, and not a different object. */
  const [bundle] = parts(growth, "bundle");
  assert.ok(bundle, "cell growth has no part tagged bundle");
  growth.userData.drive(0);
  const small = size(bundle);
  growth.userData.drive(1);
  const big = size(bundle);
  const grew = big.x / small.x;
  assert.ok(grew > 1.12 && grew < 1.5, `the bundle grew ${grew.toFixed(3)}x across; the brief says slightly`);
  assert.ok(parts(growth, "fibre").length >= 6, "a bundle is several fibres, not the four bars it was");

  /* Owner §8 asked for 1 → 2 → 3; pass 4 §7 revised it to *"1 → 2 ghost → 2
     solid"* — the copy count and the ghost are held by the pass-4 test below. */
  const copies = parts(mito, "mitochondrion");
  assert.equal(copies.length, 2, `the form holds ${copies.length} mitochondria`);
  mito.userData.drive(0);
  assert.equal(copies.filter((c) => c.visible && c.scale.x > 0.5).length, 1, "at rest more than one mitochondrion is already standing");

  /* And fully grown, none of them reaches its neighbour: the outcome row is
     `COL_HALF` apart and a form that grows into the next one is a fourth
     outcome. */
  for (const [id, form] of [["Protein_Synthesis", ribosome], ["Cell_Growth", growth], ["Mitochondrial_Biogenesis", mito]]) {
    form.userData.drive(1);
    const s = size(form);
    assert.ok(Math.max(s.x, s.y) < COL_HALF * 0.9, `${id} grown is ${Math.max(s.x, s.y).toFixed(3)} across and its neighbour is ${COL_HALF} away`);
  }
});

test("cell growth is a fibre cut across — a sheathed disc of fibres facing the viewer, not a bundle of rods", () => {
  /* Pass 2, 2026-09-06. The first cut was seven fibres tilted 60° and it read,
     photographed from the floor's 14°/9° camera, as a bundle of standing rods.
     A cross-section is a disc: short fibres seen end-on inside a sheath, the
     histology picture a first-year already has. So the built form is wider than
     it is deep, and it carries a sheath. */
  const growth = buildForm(HERO_NODES.find((n) => n.id === "Cell_Growth"), "phenotype", mats());
  assert.ok(parts(growth, "sheath").length >= 1, "no sheath around the fibres — a pile of fibres is not a fibre");
  const s = size(growth);
  /* 0.7, not 0.8: measured, the old 60° tilt with these short fibres gives
     0.73 and the disc 0.58, so 0.8 would have let the rod bundle through. */
  assert.ok(s.z < s.x * 0.7, `the form is ${s.z.toFixed(3)} deep against ${s.x.toFixed(3)} wide — a rod bundle, not a disc facing the viewer`);
  const fibres = parts(growth, "fibre");
  assert.ok(fibres.length >= 7, `${fibres.length} fibres`);
  /* And "facing the viewer" measured as such: a fibre's own +y — the face the
     sheath rims — points TOWARD the camera at +z, signed. The first cut had
     the sign wrong (−0.94: the back caps faced the viewer) and an unsigned
     test let it through. */
  growth.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  fibres[0].getWorldQuaternion(q);
  const towardViewer = new THREE.Vector3(0, 1, 0).applyQuaternion(q).z;
  assert.ok(towardViewer >= 0.9, `a fibre's face points ${towardViewer.toFixed(3)} along +z — the cut face is not what the viewer sees`);
  for (const f of fibres) {
    f.geometry.computeBoundingBox();
    const h = f.geometry.boundingBox.max.y - f.geometry.boundingBox.min.y;
    assert.ok(h <= 0.45 * FORM_R, `a fibre is ${h.toFixed(3)} long — that is a rod, the cut should be short`);
  }
});

/* ---- pass 4, P1 -------------------------------------------------------- */

import { kinaseForm } from "./heroForms.js";
import { buildHeroLevel } from "./heroGeometry.js";

test("JNK is a tenth more than a relay, and the two mitochondria are one then a ghost then two", () => {
  /* Owner §2: *"JNK는 8~12% larger, central placement 유지 … 평상시부터 엄청 밝게
     만들지는 마."* Size, not brightness — the rest colour is the stone's. */
  /* The tenth is applied by the geometry layer (so `buildForm` still draws by
     the archive's type); read it off the built scene's resting scale. */
  const level = buildHeroLevel({ types: { JNK: "protein" }, names: {} }, null, []);
  let jnk = null;
  level.group.traverse((o) => { if (o.userData?.role === "node-JNK") jnk = o; });
  const plain = kinaseForm(new THREE.MeshBasicMaterial());
  const ratio = jnk.scale.x / plain.scale.x;
  assert.ok(ratio >= 1.08 && ratio <= 1.12, `JNK is ${ratio.toFixed(3)}x a plain kinase; the owner asked for 8–12 %`);
  level.dispose();

  /* Owner §7: *"Mitochondria: activation에서 1 → 2 ghost → 2 solid 정도의
     reproduction visual."* Two copies: the second arrives translucent and
     solidifies. */
  const mito = buildForm(HERO_NODES.find((n) => n.id === "Mitochondrial_Biogenesis"), "phenotype", mats());
  const copies = parts(mito, "mitochondrion");
  assert.equal(copies.length, 2, `${copies.length} mitochondria; the owner asked for one becoming two`);
  const ghost = copies[1];
  const ghostMat = () => { let m = null; ghost.traverse((o) => { if (!m && o.isMesh) m = o.material; }); return m; };
  mito.userData.drive(0);
  assert.ok(!ghost.visible || ghost.scale.x < 0.05, "the second mitochondrion is already there at rest");
  mito.userData.drive(0.5);
  assert.ok(ghost.visible && ghostMat().transparent && ghostMat().opacity > 0.15 && ghostMat().opacity < 0.6, `half way the second should be a ghost, opacity ${ghostMat().opacity}`);
  mito.userData.drive(1);
  assert.ok(ghost.visible && ghostMat().opacity >= 0.95, `at the end the second should be solid, opacity ${ghostMat().opacity}`);

  /* §7 again: *"Growth: small bundle → larger bundle을 더 명확히"* — the swell
     is at least a third now. And the three outcomes carry one visual weight. */
  const growth = buildForm(HERO_NODES.find((n) => n.id === "Cell_Growth"), "phenotype", mats());
  const [bundle] = parts(growth, "bundle");
  growth.userData.drive(0); const small = size(bundle).x;
  growth.userData.drive(1); const big = size(bundle).x;
  assert.ok(big / small >= 1.35 && big / small <= 1.6, `the bundle grows ${(big / small).toFixed(2)}x`);
  const ribosome = buildForm(HERO_NODES.find((n) => n.id === "Protein_Synthesis"), "phenotype", mats());
  for (const f of [ribosome, growth, mito]) f.userData.drive(0.5);
  const widths = [ribosome, growth, mito].map((f) => Math.max(size(f).x, size(f).y));
  const spread = Math.max(...widths) / Math.min(...widths);
  assert.ok(spread <= 1.3, `the three outcomes span ${spread.toFixed(2)}x in width — not one visual weight (${widths.map((w) => w.toFixed(3)).join(", ")})`);
});
