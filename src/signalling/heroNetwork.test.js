import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { HERO_IDS, HERO_NODES, linksOf } from "./heroNetwork.js";
import { SCENARIOS } from "./signallingBinding.js";

/**
 * The picture may choose WHICH twelve. It may not choose the arrows.
 *
 * This file exists because a simplified diagram is the easiest place in the
 * whole project to draw something true-sounding and absent. The textbook version
 * of this cascade — resistance to Akt to mTOR to protein synthesis, endurance to
 * AMPK to PGC-1a to mitochondrial biogenesis — is in every physiology course and
 * three of its four arrows are NOT in Fowler's model. Nothing but a gate stops
 * that story being drawn over the model's own.
 */
/* `SCENARIOS` holds bare ids, not paths — the app's loader adds the directory
   and the extension. Read the same way here so a moved archive moves both. */
const archive = async (id) =>
  JSON.parse(await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"));

const load = async () => {
  const arms = await Promise.all([SCENARIOS.resistance, SCENARIOS.endurance, SCENARIOS.control].map(archive));
  return { resistance: arms[0], endurance: arms[1], control: arms[2] };
};

test("every node the picture draws is a node the archive ships", async () => {
  const { resistance } = await load();
  for (const id of HERO_IDS) {
    assert.ok(
      resistance.nodes[id],
      `"${id}" is drawn and is not in the model — the archive's own ids are the only names this ` +
        "screen may use, and a renamed node has to move the drawing rather than be spelled around",
    );
  }
});

test("every link the picture draws is a link the model has", async () => {
  const { resistance } = await load();
  const links = linksOf(resistance.edges);
  const missing = links
    .map((l, i) => (l ? null : i))
    .filter((i) => i !== null);
  assert.deepEqual(
    missing,
    [],
    "a drawn link has no path in the model at all — that arrow is invented, and this is the gate " +
      "that exists to catch exactly that",
  );
  for (const link of links) {
    assert.ok(
      link.sign === 1 || link.sign === -1,
      `"${link.from}" -> "${link.to}" resolved to sign ${link.sign}; the picture draws exactly two ` +
        "kinds of arrow and a third value has nowhere to go",
    );
    assert.ok(link.steps >= 1, `"${link.from}" -> "${link.to}" resolved to ${link.steps} steps`);
  }
});

/**
 * THE THREE ARROWS THE TEXTBOOK HAS AND THIS MODEL DOES NOT, pinned as absences
 * so that nobody adds them back from memory. Measured 2026-08-31 against the
 * shipped bytes. If a future archive DOES contain them this test goes red, which
 * is the right outcome: the drawing should then change, and knowingly.
 */
test("the textbook cascade is still absent from the model, so the picture still may not draw it", async () => {
  const { resistance } = await load();
  const has = new Set(resistance.edges.map(([s, t]) => `${s} ${t}`));
  for (const [from, to] of [
    ["Akt", "mTOR"],
    ["mTOR", "Protein_Synthesis"],
    ["PGC_1a", "Mitochondrial_Biogenesis"],
  ]) {
    assert.ok(
      !has.has(`${from} ${to}`),
      `the archive now HAS "${from}" -> "${to}". It did not on 2026-08-31, which is why the picture ` +
        "collapses or omits that step. Re-read heroNetwork.js's note and redraw it deliberately",
    );
  }
});

/**
 * AMPK IS THE SPLIT *INSIDE THE CELL*, and it is the only one.
 *
 * The first version of this test asked which HERO nodes only one bout moves and
 * expected `["AMPK"]`. It went red, and it was the test that was wrong: the two
 * inputs and the three doors split by construction — an input is the bout, and
 * `integrin` / `B_AR` / `ROS` are drawn precisely BECAUSE they are one bout's
 * own. Asking the question of them proves nothing.
 *
 * The claim worth holding is about the relay, which is the part of the picture
 * that looks the same on both sides: of everything downstream of the doors, AMPK
 * is the one node the two bouts do not share. If that stops being true, which
 * side of the screen a relay node belongs on has to be re-measured rather than
 * assumed.
 */
test("AMPK is the one relay node only one bout moves", async () => {
  const { resistance, endurance, control } = await load();
  const rise = (arm, id) => Math.max(...arm.series[id]) - Math.max(...control.series[id]);
  const relays = HERO_NODES.filter((n) => n.kind === "relay").map((n) => n.id);
  const split = relays.filter(
    (id) =>
      (rise(endurance, id) > 0.05 && rise(resistance, id) <= 0.005) ||
      (rise(resistance, id) > 0.05 && rise(endurance, id) <= 0.005),
  );
  assert.deepEqual(
    split,
    ["AMPK"],
    "which relay nodes one bout moves alone has changed; the drawing puts AMPK on the endurance " +
      "side because it measured as the only one",
  );
});

/** And the doors ARE one bout's own, which is the other half of the same fact. */
test("each drawn door belongs to the bout it is drawn under", async () => {
  const { resistance, endurance, control } = await load();
  const rise = (arm, id) => Math.max(...arm.series[id]) - Math.max(...control.series[id]);
  for (const [id, mover, other] of [
    ["integrin", resistance, endurance],
    ["B_AR", endurance, resistance],
    ["ROS", endurance, resistance],
  ]) {
    assert.ok(
      rise(mover, id) > 0.5 && rise(other, id) <= 0.005,
      `"${id}" is drawn as one bout's own door and the archive no longer separates it: ` +
        `${rise(mover, id).toFixed(3)} against ${rise(other, id).toFixed(3)}`,
    );
  }
});

/** The layout has to be readable as rows, or the arrows cross their own nodes. */
test("the drawing runs top to bottom, inputs first and outcomes last", () => {
  const rowOf = Object.fromEntries(HERO_NODES.map((n) => [n.id, n.row]));
  for (const kind of ["input", "door", "relay", "outcome"]) {
    assert.ok(HERO_NODES.some((n) => n.kind === kind), `no ${kind} in the drawing`);
  }
  const inputs = HERO_NODES.filter((n) => n.kind === "input").map((n) => n.row);
  const outcomes = HERO_NODES.filter((n) => n.kind === "outcome").map((n) => n.row);
  assert.ok(Math.max(...inputs) < Math.min(...outcomes), "an input is drawn below an outcome");
  assert.equal(rowOf.JNK < rowOf.S6, true, "the relay is out of order");
});

/* ---- the 2026-09-06 brief: split → converge, on three planes ------------- */

import { heroAt, ROW_GAP } from "./heroGeometry.js";

test("the two workouts enter at mirrored doors and first meet on the axis — split, then converge", () => {
  const x = Object.fromEntries(HERO_NODES.map((n) => [n.id, heroAt(n)[0]]));
  /* Owner, 2026-09-06 §6: *"초반에는 두 path가 의도적으로 좌우 대칭처럼 시작하게
     … split → converge가 spatial composition 자체로 읽혀야"*. Mirrored means
     mirrored — the same distance off the axis, not roughly. */
  for (const [l, r] of [
    ["ResistanceExercise", "EnduranceExercise"],
    ["integrin", "B_AR"],
    ["RhoA", "AMPK"],
    ["Protein_Synthesis", "Mitochondrial_Biogenesis"],
  ]) {
    assert.ok(x[l] < 0 && x[r] > 0, `${l} (${x[l]}) and ${r} (${x[r]}) are not on opposite sides`);
    assert.ok(Math.abs(x[l] + x[r]) < 1e-9, `${l} at ${x[l]} and ${r} at ${x[r]} are not mirrored`);
  }
  /* The convergence is JNK — `heroNetwork.js` says so — and a convergence drawn
     off to one side reads as one arm joining the other rather than as two
     meeting. Its spine (S6, cell growth) stays on the axis under it. */
  for (const id of ["JNK", "S6", "Cell_Growth"]) {
    assert.ok(Math.abs(x[id]) < 1e-9, `${id} sits at x ${x[id]} rather than on the axis`);
  }
  /* The second endurance door fans in toward the middle, so EnduranceExercise
     visibly SPLITS into two before either route has gone anywhere. */
  assert.ok(x.ROS > 0 && x.ROS < x.B_AR, `ROS at ${x.ROS} is not between the axis and B_AR at ${x.B_AR}`);
});

test("depth is three planes and nothing more — membrane in front, relays in the middle, outcomes behind", () => {
  const z = (n) => heroAt(n)[2];
  const ofKind = (...kinds) => HERO_NODES.filter((n) => kinds.includes(n.kind)).map(z);
  const front = ofKind("input", "door");
  const mid = ofKind("relay");
  const back = ofKind("outcome");
  const flat = (arr) => Math.max(...arr) - Math.min(...arr) < 1e-6;
  /* Owner §5: *"Z depth도 membrane/front, early signalling/middle, downstream/back
     정도로 제한 … 각 조형물이 앞뒤로 과도하게 튀어나오는 깊이는 줄입니다."* A
     plane is a plane: every node on it at the same z, so depth says which
     stage a thing belongs to and never anything about the thing itself. */
  assert.ok(flat(front), `the membrane plane is not flat: ${front.map((v) => v.toFixed(3))}`);
  assert.ok(flat(mid), `the relay plane is not flat: ${mid.map((v) => v.toFixed(3))}`);
  assert.ok(flat(back), `the outcome plane is not flat: ${back.map((v) => v.toFixed(3))}`);
  assert.ok(front[0] > mid[0] && mid[0] > back[0], `the planes are out of order: ${front[0]}, ${mid[0]}, ${back[0]}`);
  const span = front[0] - back[0];
  assert.ok(span > 0 && span <= ROW_GAP, `the drawing is ${span.toFixed(3)} deep against a row of ${ROW_GAP} — shallow 3D, not a dome`);
});

test("the network fills the stage — entries at the sides, relays stepping inward, outcomes as wide as the inputs", () => {
  /* Owner, pass 3 §1/§9: *"Move Resistance entry further left, Endurance entry
     further right, then let the paths naturally converge toward the centre …
     larger network, smaller nodes."* His sketch steps each arm inward once
     before the shared relay. */
  const x = Object.fromEntries(HERO_NODES.map((n) => [n.id, heroAt(n)[0]]));
  /* 1.1, not the 1.4 first tried (then 1.2, 1.15, 1.12): measured at 1280x800
     the entries have to clear the shell's top-corner controls and the
     explorer's plate. */
  assert.ok(Math.abs(x.ResistanceExercise) >= 1.1, `the resistance entry stands at x ${x.ResistanceExercise.toFixed(2)} — not at the side of the stage`);
  /* A STEP, not a nudge: the relay stands at most three quarters of the door's
     distance from the axis (his sketch draws it about half-way), and stays off
     the axis so the convergence still has somewhere to go. */
  assert.ok(Math.abs(x.RhoA) <= 0.75 * Math.abs(x.integrin) && Math.abs(x.RhoA) > 0.4, `RhoA at ${x.RhoA.toFixed(2)} does not step inward from integrin at ${x.integrin.toFixed(2)}`);
  assert.ok(Math.abs(x.AMPK) <= 0.75 * Math.abs(x.B_AR) && Math.abs(x.AMPK) > 0.4, `AMPK at ${x.AMPK.toFixed(2)} does not step inward from B_AR at ${x.B_AR.toFixed(2)}`);
  assert.ok(Math.abs(Math.abs(x.Protein_Synthesis) - Math.abs(x.ResistanceExercise)) < 1e-9, "the outcome row is not as wide as the inputs");
});

/* ---- pass 4, P0 — a second layout for narrow stages ---------------------- */

import { layoutOf, buildHeroLevel } from "./heroGeometry.js";

test("a phone gets the same topology laid out narrow and tall, not the desktop drawing seen from further away", () => {
  /* Owner, pass 4 §11 (P0): *"Desktop coordinates를 그대로 두고 camera만 빼는
     방식의 한계야. geometry 재설계는 불필요, layout coordinates만 바꿔 … Desktop:
     wide + shallow / Mobile: narrow + tall."* And §10 locks the desktop. */
  const wide = layoutOf(false), narrow = layoutOf(true);
  const xs = (L) => HERO_NODES.map((n) => L.at(n)[0]);
  const ys = (L) => HERO_NODES.map((n) => L.at(n)[1]);
  const width = (L) => Math.max(...xs(L)) - Math.min(...xs(L));
  const height = (L) => Math.max(...ys(L)) - Math.min(...ys(L));
  assert.ok(width(narrow) <= width(wide) * 0.6, `narrow is ${width(narrow).toFixed(2)} wide against the desktop's ${width(wide).toFixed(2)} — the V is not compressed`);
  assert.ok(height(narrow) >= height(wide) * 1.15, `narrow is ${height(narrow).toFixed(2)} tall against the desktop's ${height(wide).toFixed(2)} — the depth is not used`);
  /* Desktop is locked — §10, *"Desktop layout은 lock해도 됨"* — and the lock is
     these numbers, pinned as numbers (reviewed: comparing heroAt to layoutOf
     compared a function to itself). Move one and this fails on purpose. */
  const LOCKED = {
    ResistanceExercise: [-1.12, 0.89875, 0.168], EnduranceExercise: [1.12, 0.89875, 0.168],
    integrin: [-1.12, 0.49875, 0.168], B_AR: [1.12, 0.49875, 0.168], ROS: [0.56, 0.49875, 0.168],
    RhoA: [-0.672, 0.09875, 0], AMPK: [0.672, 0.09875, 0],
    JNK: [0, -0.30125, 0], PGC_1a: [0.672, -0.30125, 0], S6: [0, -0.70125, 0],
    Protein_Synthesis: [-1.12, -1.10125, -0.168], Cell_Growth: [0, -1.10125, -0.168], Mitochondrial_Biogenesis: [1.12, -1.10125, -0.168],
  };
  for (const n of HERO_NODES) {
    const got = heroAt(n);
    for (let k = 0; k < 3; k += 1) assert.ok(Math.abs(got[k] - LOCKED[n.id][k]) < 1e-9, `${n.id} moved on the desktop: ${got} against ${LOCKED[n.id]}`);
  }
  /* Same topology: the mirror and the axis hold in both. */
  for (const L of [wide, narrow]) {
    const x = Object.fromEntries(HERO_NODES.map((n) => [n.id, L.at(n)[0]]));
    for (const [l, r] of [["ResistanceExercise", "EnduranceExercise"], ["integrin", "B_AR"], ["RhoA", "AMPK"], ["Protein_Synthesis", "Mitochondrial_Biogenesis"]]) {
      assert.ok(Math.abs(x[l] + x[r]) < 1e-9 && x[l] < 0, `${l}/${r} not mirrored in the ${L === wide ? "wide" : "narrow"} layout`);
    }
    assert.ok(Math.abs(x.JNK) < 1e-9 && Math.abs(x.S6) < 1e-9, "the convergence left the axis");
  }
  /* And the scene builds on it: anchors follow the narrow layout. */
  const model = buildHeroLevel({ types: {}, names: {} }, null, [], { narrow: true });
  for (const n of HERO_NODES) {
    const a = model.anchors.find((k) => k.id === n.id);
    assert.deepEqual(a.ringAt, narrow.at(n), `${n.id}'s ring is not where the narrow layout puts it`);
  }
  model.dispose();
});
