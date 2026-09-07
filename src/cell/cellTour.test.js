import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { TOGETHER, FRAME_SLIP_MS, readingMs } from "../tour.js";
import { REPS, REP_SECONDS } from "./cellBinding.js";
import { ENERGY_CAMERA, ENERGY_VIEW_DIR } from "./cellChainGeometry.js";
import { cellTour, energyResult, energyTour } from "./cellTour.js";

/**
 * The storyboard is checked for SHAPE and for the two things a sentence cannot
 * verify about itself: that its beat stays up long enough to be read, and that
 * what it points at is a thing the geometry can point at.
 *
 * The bout is the shipped file, read raw, so `t0`/`tEnd` are the archive's.
 * The anchors are the ENERGY.md layout typed out — the geometry lane owns the
 * real ones; `three` loads only because `ENERGY_VIEW_DIR` lives beside them
 * in `cellChainGeometry.js`, and the perspective test needs the real vector
 * rather than a copy that could drift. The instants are the values
 * `instantsOf` sweeps off this file (measured 2026-09-05: onset 0.078,
 * pcrSteepest 0.130, ampMax 6.191, responseMax 13, caPeakRep1 0.153, still
 * 12.98); for this test only the fact that they sit inside the grid matters —
 * the sweep itself is `energyBinding.test.js`'s to hold.
 */
const BOUT = JSON.parse(
  await readFile(new URL("../../public/scenarios/ampk_francis_soce_on.json", import.meta.url), "utf8"),
);
const T = BOUT.series.t;
const T0 = T[0];
const T_END = T[T.length - 1];

const ANCHORS = [
  { id: "atp", label: "ATP", at: [-1.2, 0.55, 0] },
  { id: "pcr", label: "PCr", at: [-0.35, 0.6, 0] },
  { id: "adp", label: "ADP", at: [-1.2, -0.15, 0] },
  { id: "amp", label: "AMP", at: [-1.15, -0.7, 0] },
  { id: "ca", label: "Ca²⁺", at: [1.35, 1.1, 0] },
  { id: "camkk2", label: "CaMKK2", at: [1.1, 0.2, 0] },
  { id: "ampk", label: "AMPK", at: [0.3, -0.45, 0] },
  { id: "demand", label: "ATP demand", at: [0, 1.2, 0] },
];
const IDS = ANCHORS.map((a) => a.id);

const INSTANTS = { onset: 0.078, pcrSteepest: 0.13, ampMax: 6.191, responseMax: 13, caPeakRep1: 0.153, still: 12.98 };
const SPAN = 0.1074;

const tour = () => energyTour(BOUT, ANCHORS, INSTANTS, { span: SPAN });
const result = (calciumShare) => energyResult(BOUT, ANCHORS, INSTANTS, { calciumShare });

const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

function wellFormed(name, beats) {
  assert.ok(beats.length > 0, `${name} built no storyboard`);
  /* PINNED, NOT JUST NON-EMPTY: the orchestrator found two root gates grading
     an empty or default array while green. The pass is eight beats and the
     result four; a guard that starts returning [] fails here by number. */
  /* 8 / 4 until 2026-09-07 — owner (cell C2, C5): two relevance beats each, on the same shots. */
  assert.equal(beats.length, name === "tour" ? 12 : 6, `${name} has ${beats.length} beats`);
  beats.forEach((b, i) => {
    const tag = `${name} beat ${i} ("${b.line ?? ""}")`;
    assert.ok(IDS.includes(b.focus), `${tag} focuses "${b.focus}", which is not an anchor`);
    assert.ok(isVec3(b.camera), `${tag} has no camera`);
    assert.ok(isVec3(b.lookAt), `${tag} has no lookAt`);
    assert.ok(isVec3(b.focusAt), `${tag} has no focusAt`);
    /* a held beat (`holds`) inherits the clock — no seek, by design (2026-09-07) */
    if (!b.holds) assert.ok(Number.isFinite(b.seek), `${tag} seek is ${b.seek}`);
    if (!b.holds) assert.ok(b.seek >= T0 && b.seek <= T_END, `${tag} seeks ${b.seek}, outside [${T0}, ${T_END}]`);
    assert.ok(Number.isFinite(b.speed) && b.speed >= 0, `${tag} speed is ${b.speed}`);
    assert.ok(
      b.ms >= readingMs(b.line) + FRAME_SLIP_MS,
      `${tag} shows for ${b.ms} ms and needs ${Math.ceil(readingMs(b.line) + FRAME_SLIP_MS)}`,
    );
    /* A beat is a change: either the camera went somewhere or the run did. */
    const prev = beats[i - 1];
    if (prev) {
      const moved = prev.camera.some((v, k) => Math.abs(v - b.camera[k]) > 1e-9);
      const played = prev.seek !== b.seek || prev.speed !== b.speed;
      /* `holds`: a second message on the same shot — owner 2026-09-07: *"그 shot에서 시간을 더 보내고 두개의 메시지를"*. */
      if (b.holds) return;
      assert.ok(moved || played, `${tag} changes neither camera nor seek/speed from the beat before it`);
    }
  });
}

test("the tour: every beat is well formed and ends on the invitation to test", () => {
  const beats = tour();
  wellFormed("tour", beats);
  assert.match(beats.at(-1).line, /^Test it yourself/);
  assert.ok(
    beats.reduce((s, b) => s + b.ms, 0) < 62_000,
    "the pass runs past the 62 s `tourPace.test.js` holds this pass to (2026-09-07: four held messages)",
  );
});

test("the tour: the during-the-set beat plays the whole set at 1.5x", () => {
  const set = tour().filter((b) => b.speed === 1.5 && b.seek === T0 && /reserve \(PCr\) drains/.test(b.line)); /* 1x until 2026-09-07 */
  assert.equal(set.length, 1, "exactly one beat runs the set");
  /* The floor's state 3 is the last beat — the whole picture at 1× under the
     invitation — and it says so with `part: TOGETHER`, which is what
     `stepsOf` reads for a pass's whole-run half. */
  assert.equal(tour().at(-1).part, TOGETHER, "the invitation beat is the pass's together-half");
  /* at 1.5x since 2026-09-07 (owner: the opening ran long) */
  assert.ok(set[0].ms >= (REPS * REP_SECONDS * 1000) / 1.5, `${set[0].ms} ms cannot show a ${REPS * REP_SECONDS} s set at 1.5x`);
});

test("the tour: the sensor beat ends where AMP peaks, with the ring still climbing", () => {
  const ampk = tour().find((b) => b.focus === "ampk" && /expect/.test(b.line));
  assert.ok(ampk, "no beat about the expectation");
  const end = ampk.seek + ampk.speed * (ampk.ms / 1000);
  assert.ok(Math.abs(end - INSTANTS.ampMax) < 1e-6, `window ends at ${end}, not at ampMax ${INSTANTS.ampMax}`);
  assert.ok(ampk.seek < INSTANTS.ampMax, "the window has no length");
});

test("the tour: the calcium beat runs at least to the first rep's calcium peak", () => {
  const ca = tour().find((b) => b.focus === "camkk2" && /calcium signal/.test(b.line));
  assert.ok(ca, "no beat about the calcium input");
  assert.ok(ca.seek + ca.speed * (ca.ms / 1000) >= INSTANTS.caPeakRep1);
});

test("the result: well formed, branches on calciumShare, ends on AMPK", () => {
  for (const share of [0.9, 0.2]) {
    const beats = result(share);
    wellFormed(`result(${share})`, beats);
    assert.equal(beats.at(-1).focus, "ampk");
    assert.match(beats.at(-1).line, /network/);
    const verdict = beats.find((b) => /doing most of the pushing/.test(b.line ?? ""));
    assert.ok(verdict, `result(${share}) never says what is pushing`);
    assert.match(verdict.line, share > 0.5 ? /calcium/ : /energy state/);
  }
  /* The replay is silent, and long enough for the run to reach `still` at 2x. */
  const replay = result(0.9)[0];
  assert.equal(replay.line, null);
  assert.equal(replay.speed, 5); /* 2 until 2026-09-07: the lines after the toggle came too late */
  assert.ok(replay.seek + replay.speed * (replay.ms / 1000) >= INSTANTS.still); /* the replay reaches the still at its own speed */
});

/* ONE PERSPECTIVE, 2026-09-06. Rule 4 of the owner's brief: the picture after
   the pass is the opening picture at the SAME ANGLE. `useCameraTransition`
   eases position and target separately, so a close-up taken square-on (+z)
   while the room is seen obliquely (`ENERGY_CAMERA`) swings on the way in and
   snaps on the first frame after the pass (orchestrator's warning). Every shot
   therefore dollies along `ENERGY_VIEW_DIR`; the anchors typed above are flat
   on purpose — a z of 0 is enough to catch a square-on shot. */
test("every beat is seen from the floor's one perspective", () => {
  const angleDeg = (a, b) => {
    const l = Math.hypot(...a);
    const dot = a.reduce((s, v, i) => s + (v / l) * b[i], 0);
    return (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
  };
  for (const [name, beats] of [["tour", tour()], ["result(0.9)", result(0.9)], ["result(0.2)", result(0.2)]]) {
    beats.forEach((b, i) => {
      const dir = b.camera.map((v, k) => v - b.lookAt[k]);
      const off = angleDeg(dir, ENERGY_VIEW_DIR);
      assert.ok(off < 1, `${name} beat ${i} ("${b.line ?? ""}") looks ${off.toFixed(2)}° off the floor's perspective`);
    });
  }
  const wides = [...tour(), ...result(0.9)].filter((b) => b.lookAt.every((v) => v === 0));
  assert.ok(wides.length >= 3, `expected the wide framings, found ${wides.length}`);
  for (const w of wides) assert.deepEqual(w.camera, ENERGY_CAMERA);
});

test("the guard: a missing anchor or instant, or a non-finite one, builds nothing", () => {
  assert.deepEqual(energyTour(BOUT, ANCHORS.filter((a) => a.id !== "pcr"), INSTANTS, { span: SPAN }), []);
  assert.deepEqual(energyTour(BOUT, ANCHORS, { ...INSTANTS, still: undefined }, { span: SPAN }), []);
  assert.deepEqual(energyTour(BOUT, ANCHORS, { ...INSTANTS, onset: NaN }, { span: SPAN }), []);
  assert.deepEqual(energyTour(BOUT, ANCHORS, { ...INSTANTS, ampMax: T_END + 1 }, { span: SPAN }), []);
  assert.deepEqual(energyTour(BOUT, ANCHORS, INSTANTS, { span: 0 }), []);
  assert.deepEqual(energyTour(null, ANCHORS, INSTANTS, { span: SPAN }), []);
  assert.deepEqual(energyResult(BOUT, ANCHORS.slice(0, 3), INSTANTS, { calciumShare: 0.9 }), []);
  assert.deepEqual(energyResult(BOUT, ANCHORS, INSTANTS, { calciumShare: NaN }), []);
  /* The root tests' call shape: `cellTour(bout, anchors)` under foreign anchors. */
  assert.deepEqual(cellTour(BOUT, ANCHORS), []);
  assert.equal(cellTour, energyTour);
});

test("the loaded-run shape (`series(name).values`) builds the same beats as the raw file", () => {
  const loaded = { series: (name) => ({ values: BOUT.series[name] }) };
  assert.deepEqual(energyTour(loaded, ANCHORS, INSTANTS, { span: SPAN }), tour());
});

/* PASS 6: three shots are composed, not centred. */
test("the AMPK beats are framed for the trimer: subject on a third, arcs with headroom", () => {
  const at = Object.fromEntries(ANCHORS.map((a) => [a.id, a.at]));
  const beats = tour();
  const sensor = beats.find((b) => b.focus === "ampk" && /expect/.test(b.line));
  const dAmpk = Math.hypot(sensor.lookAt[0] - at.ampk[0], sensor.lookAt[1] - at.ampk[1]);
  const dAmp = Math.hypot(sensor.lookAt[0] - at.amp[0], sensor.lookAt[1] - at.amp[1]);
  assert.ok(dAmpk < dAmp, "the AMP + AMPK pair does not look toward its subject");
  const last = result(0.9).at(-1);
  assert.ok(last.lookAt[1] > at.ampk[1], "the AMPK close has no headroom for the arcs");
  const back = Math.hypot(...last.camera.map((v, i) => v - last.lookAt[i]));
  assert.ok(back > 1.6, `the AMPK close is ${back.toFixed(2)} back — the silhouette will not fit with its arcs`);
});
