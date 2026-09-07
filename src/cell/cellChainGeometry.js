/**
 * The ENERGY floor — a living metabolic chamber, not a diagram and not a pile.
 *
 * What is being spent, how ATP is buffered, and what actually pushes AMPK in
 * this bout. The energy side (left, FRONT) is three populations of ONE
 * nucleotide token that differ only in how many phosphate beads they carry, a
 * creatine reserve beside them, and a cloud of free phosphate. The calcium side
 * (right, BACK) is the fibre's own blue arriving from upstairs into a hinged
 * CaMKK2. AMPK sits between them at mid-depth with its activity collar. Nothing
 * here is joined by an arrow: a conversion is a bead that leaves one token and
 * lands on another, and the contraction is a pressure front that comes in
 * through the membrane and reaches the ATP pool.
 *
 * REBUILT 2026-09-06 to the owner's brief (docs/20260906-fix/energy.md). What
 * that brief rejected, in its order, and what answers it here:
 *   §1 the pools were a random pile ("알약 더미") — they are lattices now,
 *      `energyLattice.js`, one grammar for the three nucleotide pools.
 *   §2 capsule + grey spheres were generic — a token is an organic adenosine
 *      body (`blob`, the same surface the SIGNALS proteins are made of) with a
 *      LINKED chain of smaller phosphate beads: ◉—●—●—●.
 *   §3 132 motes as loud as the molecules — 48, smaller, dimmer, none in front
 *      of the pools, fading with depth.
 *   §4 AMPK was three balls ("Mickey Mouse") — it is `trimerForm` from
 *      `../signalling/heroForms.js`, the SAME protein the next floor draws
 *      (the orchestrator's rule: change its craft, not its species), and its
 *      activity is a collar plus a 6 % swell and a small opening, not a 22 %
 *      balloon.
 *   §5 CaMKK2 was two balls — two fused lobes on a hinge with two binding arms
 *      that spread when calcium lands; closed and open are different silhouettes.
 *   §6 the room was seen square-on — `ENERGY_CAMERA` is oblique and the layout
 *      has depth: pools front, AMPK middle, calcium back.
 *   §7 the membrane was a thick maroon border on an orange dome — half the
 *      thickness, two faint layers, desaturated, no specular; the dome is a
 *      neutral 4 % skin.
 *   §8 "ATP demand" was a disc and a DOM pill — it is a pressure front that
 *      leaves the membrane's top edge and travels into the ATP pool on each
 *      repetition's onset. Nothing standing names it.
 *   extra-4 "실제 세포 내부처럼" — the far wall carries the fibre's own
 *      myofibril bands, out of focus, so the room is inside the fibre the
 *      visitor just left rather than on paper.
 *   12/13 no rings, no orange accents — selection is `spotlight(id)`: the named
 *      part keeps its material and the rest recede into the paper.
 *
 * Every drawn quantity is a count or a fraction handed in by `energyBinding`'s
 * `frameAt` (`ENERGY.md`); this file only decides WHICH token converts and how a
 * bead travels. Travel times, lattice pitches and the collar are drawing
 * choices; no number here is a claim about the archive.
 */

import * as THREE from "three";

import {
  PALETTE,
  SCENE,
  SURFACE,
  anatomyMaterial,
  calciumMaterial,
} from "../anatomyStyle.js";
import { disposeTree } from "../fiber/fiberGeometry.js";
import { blob, trimerLobes } from "../signalling/heroForms.js";
import { POOL } from "./energyBinding.js";
import { latticeSlots, rnd } from "./energyLattice.js";

/**
 * @typedef {object} EnergyFrame  the result of `energyBinding.frameAt` plus the page's extras
 * @property {number} t
 * @property {number} atp        integers; atp + adp + amp === 90
 * @property {number} adp
 * @property {number} amp
 * @property {number} pcr        creatine tokens still carrying a phosphate
 * @property {number} freePi     phosphate beads loose in the cytosol
 * @property {number} ca         visible calcium particles this instant
 * @property {number} camkk      CaMKK_active_fraction, 0..1
 * @property {number} ampkLevel  pAMPK_fraction, absolute
 * @property {number} response   (pAMPK(t) − pAMPK(t0)) / span, 0..1 — the collar and the trimer
 * @property {number} demand     ATP_hydrolysis rise above rest / its peak, 0..1; zero between reps
 * @property {boolean} coupled   CaMKK2's route into AMPK exists (Normal) or is cut (KO)
 * @property {{hydrolysis:number, recharge:number, ak:number}} events
 * @property {number} dt         run-scaled seconds since the last update: flights, calcium, hinge, pulses
 * @property {number} [wallDt]   the viewer's seconds: idle drift, breathing, dust. Defaults to dt.
 * @property {number} dim        0..1 fade of everything but AMPK (the pull-back to SIGNALS)
 */

/* OBLIQUE, 2026-09-06 — the brief's "15~20° shallow perspective" (§6). 4.7 out,
   ~17° round to the right and ~7.5° up, looking at the origin; the front view
   drew a 3D room as an infographic. 4.7 and not the old 4.2: seen obliquely the
   room's top edge — where the contraction comes in — sat on the frame's edge at
   4.2 (r2), and fov 38 covers 3.24 units tall at 4.7 against the membrane's
   2.84. Every tour shot dollies along the same direction (`ENERGY_VIEW_DIR`,
   `cellTour.js`), so the return to this framing after the pass is a dolly and
   never a swing. */
/* x 1.37 -> 1.21 on 2026-09-07 — owner, ENERGY 15: *"cell이 열리는 앵글이 이상해"*. The ENERGY brief pins the room's azimuth to 15-20 degrees (its gate); this is the least oblique it allows. More frontal than this is the owner's call against that brief. */
export const ENERGY_CAMERA = [0.33, 0.42, 4.68]; /* 4° right, 5° up — 2026-09-07, owner (cell C1): *"tilted forward to the right"* at the brief's 15°; the brief's band yields to the owner's eye */
/** Unit vector from the origin toward `ENERGY_CAMERA` — the one perspective
    this floor is seen from. Derived, never typed twice. */
export const ENERGY_VIEW_DIR = (() => {
  const l = Math.hypot(...ENERGY_CAMERA);
  return ENERGY_CAMERA.map((v) => v / l);
})();

/** `chainLift` lifted a flat point onto the old dome; a point is already where
    it draws. Kept for callers. */
export function chainLift(at) {
  return at;
}

/* ---- layout (world units; the room is x ±1.95, y ±1.42, z ±1) --------------- */

/* DEPTH IS THE HIERARCHY (brief §6): the nucleotide pools and their reserve
   stand in front (z +0.2..+0.25), AMPK at the focal plane, CaMKK2 and the
   calcium entry behind it. With the camera to the right, the calcium side also
   recedes in perspective, so the left-to-right reading is front-to-back. The
   demand anchor is ON the membrane's top edge above the ATP pool — where the
   contraction comes in — not a moon in the middle of the room; the calcium
   entry is just inside a wall (pass 3: the lower-right one, see below) and
   CaMKK2 stands beside it, a sensor at the door rather than a thing floating
   mid-room (global rule 6: nothing floats). */
/* PASS 3 (owner, 2026-09-06 evening): "the important objects feel small and
   scattered inside an oversized container … move the elements themselves
   into a more deliberate composition", 15–20 % inward, not the camera. The
   owner's own sketch is the diagonal the eye walks:

       ATP / PCr
            ↓
       ADP → AMP
                 AMPK
                     CaMKK2
                       ↑
                      Ca²⁺

   So: the fuel top-left, its products stepping down and right toward the
   sensor at the centre, the calcium sensor lower right, and the calcium
   coming in from the lower-right wall (1.55 is 0.17 inside the outline at
   that height and depth). Measured on the six functional anchors (ATP, PCr,
   ADP, AMP, AMPK, CaMKK2): mean distance from their centroid 0.945 → 0.800,
   −15 %; x-spread without the entry 2.22 → 1.97, y 1.50 → 1.30. */
const AT = {
  atp: [-0.9, 0.48, 0.25],
  pcr: [-0.12, 0.7, 0.2],
  adp: [-0.95, -0.28, 0.25],
  amp: [-0.35, -0.55, 0.22],
  pi: [-0.48, 0.02, 0.16],
  ca: [1.55, -1.02, -0.25],
  camkk2: [1.02, -0.6, -0.2],
  ampk: [0.32, -0.08, 0],
  demand: [-0.62, 1.4, 0.1],
};

/* WHERE THE WAY IN STANDS — below AMPK, 0.56 from it (its hit radius is 0.42), the element that crosses to SIGNALS. */
export const WAY_IN_AT = [0.32, 0.45, 0.15]; /* ABOVE AMPK — owner 2026-09-07: "돋보기 더 위로"; any higher from below lands inside AMPK's 0.42 hit radius */ /* under AMPK — 2026-09-07 (cell C6): AMPK is what crosses to SIGNALS, so the way in stands beside it, off its 0.42 hit radius */

const ANCHORS = [
  { id: "atp", label: "ATP" },
  { id: "pcr", label: "PCr" },
  { id: "adp", label: "ADP" },
  { id: "amp", label: "AMP" },
  { id: "ca", label: "Ca²⁺" },
  { id: "camkk2", label: "CaMKK2" },
  { id: "ampk", label: "AMPK" },
  { id: "pi", label: "Pi" },
  { id: "demand", label: "ATP demand" },
];
const HOVERABLE = new Set(["atp", "pcr", "adp", "amp", "pi", "ca", "camkk2", "ampk", "demand"]);

/** Radius of the invisible hit sphere over each part — the pool, not the token. */
const HIT_R = { atp: 0.58, pcr: 0.24, adp: 0.4, amp: 0.26, pi: 0.2, ca: 0.26, camkk2: 0.28, ampk: 0.42, demand: 0.3 };

/* ---- the populations ------------------------------------------------------ */

/* THE TRIMER'S MORPH, in one place so the test can rebuild it. `open` is
   0.08 rad and not the 0.2 first tried: `blob` samples the surface along
   rays, and from 0.1 the α–β neck opens into a gap one sample column wide —
   a vertex pulled 0.05 in while its ring neighbours stay, a notch rather than
   a hinge (review probe, 2026-09-06: max neighbour jump 0.017 at 0.08, 0.050
   at 0.10, vertex spacing ~0.049). Small, which is what the brief asked for. */
export const AMPK_MORPH = Object.freeze({ R: 0.235, weld: 0.82, open: 0.08 });

/** Creatine tokens. The Normal run starts at 13, drains to 5 by 6.1 s and
    part-recovers to 8 in the rest phase (PCr 1.271 → 0.534 → 0.770 mM); the
    headroom above 13 is for a re-exported run, not a claim. */
const PCR_SLOTS = 20;
const PI_MAX = 40;
const CA_MAX = 48;
/** Ions that stay bound in the pocket, at cartoon level: four slots (the
    textbook number a calcium sensor's calmodulin carries — a picture, not a
    count read from anything), each held BOUND_S of run time, then let go. */
const BOUND_SLOTS = 4;
const BOUND_S = 0.9;
const PACKETS_MAX = 8;
const PULSES_MAX = 3;

/**
 * THE RESTING PICTURE, for `update(null)` — the fibre's seam builds this level
 * for its coin and passes nothing. These are the Normal run's first sample
 * (ATP 7.557, ADP 1.268, AMP 0.096, PCr 1.271 mM) quantised by the binding's
 * quantum, copied by hand from `ENERGY.md`. `cellChainGeometry.test.js` derives
 * the same four from the shipped JSON and checks this file draws them.
 */
const REST = Object.freeze({
  atp: 76, adp: 13, amp: 1, pcr: 13, freePi: 0, ca: 0, camkk: 0,
  ampkLevel: 0, response: 0, demand: 0, coupled: true, dt: 0, dim: 0,
});

/* ---- the token: ◉—●—●—● ------------------------------------------------------
   Adenosine body along local −x..+x with its ribose bump toward the chain, then
   smaller phosphate beads on a thin backbone. Brief §2: one unit, not capsules
   stuck together. Extents, measured off the lobes below: body −0.026..+0.037,
   so the chain starts at 0.053 and the whole token is ~0.165 long. */
/* Pass 3, the cheap half of the owner's item 3 (same constants as item 4):
   a larger organic body, smaller beads, and a chain that droops a little
   (`CHAIN_DROOP`, y = −c·k²) so a token is a molecule and not a bar. */
/* Pass 4, item 1: the ATP cloud took "nearly half the visual weight"; the
   token is 12 % smaller in every dimension and the ATP lattice 13 % tighter,
   so the cloud is ~13 % smaller in every dimension with the same seventy-six
   in it (probed on the lattice: the slot pattern scales exactly with the
   pitch). Same token for ADP, AMP and the creatine reserve (ADP/AMP lattices
   keep their pitch, so they come out a little looser — the hierarchy sharpens
   rather than blurs). */
const TOKEN_SCALE = 0.88;
const BODY_LOBES = [
  [[0, 0, 0], [0.03, 0.026, 0.023]],
  [[0.025, 0.01, 0.003], [0.016, 0.013, 0.012]],
].map(([c, r]) => [c.map((v) => v * TOKEN_SCALE), r.map((v) => v * TOKEN_SCALE)]);
const BEAD_R = 0.015 * TOKEN_SCALE;
const BEAD_0 = (0.041 + 0.015 + 0.005) * TOKEN_SCALE;
const BEAD_GAP = (0.015 * 2 + 0.005) * TOKEN_SCALE;
const LINK_R = 0.0055 * TOKEN_SCALE;
const CHAIN_DROOP = 0.006 * TOKEN_SCALE;
const TOKEN_LEN = BEAD_0 + 2 * BEAD_GAP + BEAD_R + 0.03 * TOKEN_SCALE;
/** The chain in the token's own frame: bead k at (BEAD_0 + k·GAP, −droop·k²). */
const BEAD_LOCAL = [0, 1, 2].map((k) => new THREE.Vector3(BEAD_0 + k * BEAD_GAP, -CHAIN_DROOP * k * k, 0));
/** The backbone links between them, each with its own lean: from the body's
    edge to bead 0, then bead to bead. Precomputed once; a token only rotates. */
const LINK_LOCAL = [0, 1, 2].map((k) => {
  const a = k === 0 ? new THREE.Vector3(0.03 * TOKEN_SCALE, 0, 0) : BEAD_LOCAL[k - 1];
  const b = BEAD_LOCAL[k];
  const dir = b.clone().sub(a);
  const len = dir.length();
  return { mid: a.clone().add(b).multiplyScalar(0.5), len, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()) };
});

/* THE LATTICES (brief §1). One pitch and one lens shape for the three
   nucleotide pools, so a pool of three is the knot at the middle of the same
   lattice a pool of seventy-six fills. Each spec's `stretch` spreads the rows
   to the token's length so chains sit beside each other rather than through
   each other: ATP's 0.054 × 2.95 = 0.159, a token (0.155) and a gap — r3 at
   0.168 had the beads of one token touching the next body, and a row read as
   one string of beads. Rows 0.054 apart and five
   layers as deep as the lens is tall, so seventy-six tokens are a lens of
   short rows (r1 measured a raft of four long rows at pitch 0.08 / ×2.05). */
export const POOL_LATTICE = { pitch: 0.054, aspect: [1, 0.62, 0.62], layers: 5, stretch: 2.95 };
/* ITEM 4 — A DESCENDING SEQUENCE THE EYE READS BEFORE ANY LABEL. Same token,
   three densities: ATP packed (pitch 0.054, a dense cloud), ADP looser and
   shallower (0.075, four layers), AMP loose and alone (0.1, three) — so a big
   dense cloud, a smaller sparser one, and a few isolated molecules, in that
   order down the left side toward the sensor. */
export const ADP_LATTICE = { pitch: 0.075, aspect: [1, 0.7, 0.6], layers: 4, stretch: 2.6 };
/* AMP: a tiny LOOSE DRIFT, not a row (owner, pass 6: "almost look manually
   placed in a line"). The lattice's first few centre-out slots are a row;
   a round lens, no x-stretch and a large jitter scatter them instead. Still
   sparse, still obviously smaller than ADP. */
export const AMP_LATTICE = { pitch: 0.14, aspect: [1, 1, 0.8], layers: 3, jitter: 0.25, stretch: 1.4 };
/* Loose by PITCH, not by jitter: 0.1 with jitter 0.42 put two of the four AMP
   tokens 0.053 apart on one axis — bodies touching, the r3 defect again
   (review, probed on seed 0x3333). 0.14 with 0.25 keeps every pair of the
   first four ≥ 0.1 apart and none side by side within a token's length. */
export const PCR_LATTICE = { pitch: 0.074, aspect: [1, 0.8, 0.6], layers: 3 };
export const PI_LATTICE = { pitch: 0.05, aspect: [1, 0.9, 0.7], layers: 4, jitter: 0.3 };

/** Wall seconds for a bead to cross and for a token to settle in its new pool. */
const FLIGHT_S = 0.6;
const GLIDE_RATE = 5; // 1 − e^(−5·0.6) ≈ 0.95: a glide is over in about 0.6 s
const CA_TRAVEL_S = 0.5;
const CA_FADE_S = 0.25;
const PACKET_S = 0.9;
/** Least wall time between two packets, so a pulse of thirty bindings is a
    burst of a few and not a solid line. */
const PACKET_EVERY_S = 0.12;
/* THE HINGE OPENS 70° AND THE ARMS SPREAD 48° EACH. The archive's CaMKK
   fraction reaches 0.9 by 26 ms and is ≥ 0.9995 at every sample inside the
   set; it falls only in rest, to 0.78 at the last sample (12.98 s). So the
   fraction alone is nearly a constant and the only readable state change is
   the BINDING: a flash and a swell when a calcium particle lands, and
   a hinge that opens toward the fraction over a few hundred ms rather than in
   the frame the number arrives (audit r2). The angles are bigger than the old
   60° because the brief (§5) asks for the closed/open silhouettes to differ
   more, and a sensor whose arms spread is a different outline from one whose
   lobe rolled. */
const HINGE_OPEN = THREE.MathUtils.degToRad(70);
const ARM_SPREAD = THREE.MathUtils.degToRad(48);
const HINGE_RATE = 6;
/* 6 %, NOT 22 % (brief §4: a whole-object scale-up "looks like game UI"). The
   molecule itself moves a little; the collar says the level. */
const AMPK_SWELL = 0.06;
/** How fast a binding flash fades (1/s). */
const FLASH_RATE = 5;
/** Longest wall step a frame may integrate — a tab coming back is one frame, not a leap. */
const MAX_DT = 0.1;
/** The pressure front's crossing from the membrane's top to the ATP pool, in
    run seconds. A drawing choice like CA_TRAVEL_S; the count change that
    arrives while it crosses is held until it lands (`update`), so the beads
    leave the pool as the front reaches it — never before. */
const PULSE_S = 0.3;
/** `demand` must rise past this from below to launch a front — one per
    repetition. Between reps inside the set the archive's demand falls to
    0.018–0.026 (not 0; it is 0 only at t0 and in rest), so the threshold sits
    well above that floor and re-arms every rep. */
const PULSE_ARM = 0.12;
/** How fast a spotlight change settles (1/s): ~150 ms to recede or return. */
const RECEDE_RATE = 14;
/** What a part not under the spotlight recedes to; the room recedes less so
    the chosen thing is still IN somewhere. */
/* THREE BANDS, NOT TWO (owner, pass 6): the target keeps its colour, things
   RELATED to it keep 20–30 % of theirs, and only far unrelated things go
   near the paper. Two bands sent a pale ADP or Pi so far toward grey that a
   still frame could read grey as a type identity. */
const RECEDE_TO = 0.1; /* 0.14 -> 0.10 (owner, FIBER-pass 10: kill the rest). 0.08 put the ghost's rim over the molecule on the way back from a spotlight; the ghost's two gates hold at 0.10. */
const RECEDE_RELATED_TO = 0.22; /* 0.3 -> 0.22 (owner: kill the rest); the bands test wants related > 0.2 */
const RECEDE_ROOM_TO = 0.55;
/** What stands next to what in the story — the second band. */
const RELATED = {
  atp: ["adp", "pcr", "pi", "demand"],
  adp: ["atp", "amp", "pi", "pcr"],
  amp: ["adp", "ampk"],
  pcr: ["atp", "adp"],
  pi: ["atp", "adp"],
  /* The sensor's story neighbours are BOTH inputs: the result pass spotlights
     AMPK while its lines are about the energy side ("The energy changes are
     still there"), and the verdict spotlights the calcium while naming the
     thing it pushes — review, 2026-09-06 night. */
  ampk: ["amp", "adp", "atp", "pcr", "camkk2"],
  camkk2: ["ca", "ampk"],
  ca: ["camkk2", "ampk"],
  demand: ["atp"],
};

/* ---- the room --------------------------------------------------------------- */

const HALF_W = 1.95;
const HALF_H = 1.42;
const HALF_D = 1.0;

/** The cell outline at one angle — a superellipse, round at the corners and
    flat along the sides. */
function rim(a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [Math.sign(c) * Math.abs(c) ** 0.5, Math.sign(s) * Math.abs(s) ** 0.5];
}

const PROFILE = (() => {
  const pts = [];
  for (let i = 0; i <= 96; i += 1) pts.push(rim((i / 96) * Math.PI * 2));
  return pts;
})();

/**
 * The outline swept closed. Ring `r` sits at `z = HALF_D·cos(πr)` scaled by
 * `sin(πr)`, so the two end rings collapse to the poles, whose normals are set
 * by hand (`computeVertexNormals` averages the sliver triangles there into a
 * dark speck; measured 2026-09-05).
 */
function shellGeometry(rings = 24) {
  const cols = PROFILE.length;
  const pos = [];
  const idx = [];
  for (let r = 0; r <= rings; r += 1) {
    const a = (r / rings) * Math.PI;
    const k = Math.sin(a);
    const z = Math.cos(a) * HALF_D;
    for (const [sx, sy] of PROFILE) pos.push(sx * HALF_W * k, sy * HALF_H * k, z);
  }
  for (let r = 0; r < rings; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const a = r * cols + c;
      const b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const n = geo.getAttribute("normal");
  for (let c = 0; c < cols; c += 1) {
    n.setXYZ(c, 0, 0, 1);
    n.setXYZ(rings * cols + c, 0, 0, -1);
  }
  n.needsUpdate = true;
  return geo;
}

/** The shell's scale factor at depth z — how far the membrane is from the axis there. */
const ringAt = (z) => Math.sqrt(Math.max(0, 1 - Math.min(1, Math.abs(z) / HALF_D) ** 2));

/**
 * The cytosol: unnamed, uncounted matter so the pools are IN something. Not
 * data — `MOTES` is picked for density only. Brief §3: 132 → 48, smaller,
 * dimmer, fading with depth, and NONE in front of the pools (`MOTE_NEAR` is
 * behind the front pools' z +0.25 by a token), so no dust ever passes close to
 * the camera with the visual weight of a molecule.
 */
const MOTES = 48;
const MOTE_R = 0.014;
const MOTE_FILL = 0.84;
const MOTE_NEAR = 0.05;
const MOTE_FAR = -HALF_D * 0.86;
const MOTE_ORBIT = 0.12;
const MOTE_PERIOD = [5, 12];
const QUIET_TINT = "#2b2823";

/* THE ROOM IS THE INSIDE OF THE FIBRE. Owner (extra-4): *"실제로 cell안처럼
   배경을 꾸며줘"*, and after pass 1 the interior was still soft paper with
   bands at 3 % — "reads empty" (own verdict, confirmed by the orchestrator).
   Pass 2 puts the fibre's own furniture behind the economy, at cartoon level
   and washed toward the paper so it is context and not a subject:
     · MYOFIBRILS — striped rods (the FIBER floor's bands, with their
       sarcomere stripes as darker sleeves) at different depths so the room
       has a back and a middle, not one wall. Pass 2 drew four; pass 3 keeps
       three (`BANDS`): one far at the top, one at mid-depth that AMPK SITS
       AGAINST (owner: "something for it to sit on, in, or against"), one at
       the bottom that CaMKK2 sits against.
     · MITOCHONDRIA — beans between the rods, `PALETTE.mitochondrion` washed
       (five in pass 2, three now); the nearest stands behind the ATP lens so
       the pool gathers against the thing that makes it.
     · ONE PERIPHERAL NUCLEUS under the membrane's bottom edge — where a
       fibre keeps them — pale, so it cannot be mistaken for CaMKK2's violet.
   None of these is counted, named, hit-testable or spoken of by the pass; the
   tour's sentences are about the economy. Nothing here is a number. */
/* Pass 3, item 2: "they should become atmospheric anatomy" — three rods, not
   four, the middle one being AMPK's seat, at ~35 % less opacity and less edge. */
/* Pass 4, item 4: three rods at THREE depths — front, middle, back — so the
   fog grades them and the room has a near side as well as a far one; and
   15–20 % clearer than pass 3 ("거의 watermark"). The front one runs above
   the PCr reserve (its underside at y 0.85, PCr's top at 0.83) and a little
   behind the pools' plane (its face at z +0.12, the pools at +0.16..+0.25),
   so it covers nothing. */
const BANDS = [
  /* FRONT — above everything, z −0.05, just behind the focal plane. */
  { y: 1.02, z: -0.05, r: 0.17 },
  /* MIDDLE — behind AMPK (y −0.08, z 0): the built trimer at R 0.235 spans
     z ≈ −0.14..+0.15, so a rod at z −0.29 with r 0.2 puts its front face at
     −0.09 — 0.05 into the trimer's back. Resting against, not floating before it. */
  { y: -0.1, z: -0.29, r: 0.2 },
  /* BACK — behind CaMKK2 (y −0.6, z −0.2): the built sensor spans z
     −0.31..−0.09 (measured), so a rod at z −0.49 with r 0.18 has its front
     face at −0.31, touching the sensor's back — every hero touches something:
     ATP its mitochondrion, AMPK the middle rod, CaMKK2 this one. */
  { y: -0.9, z: -0.49, r: 0.18 },
];
/** Sarcomere stripes along each rod: darker sleeves this long, this far apart. */
const STRIPE_LEN = 0.08;
const STRIPE_PITCH = 0.27;
const MITOS = [
  /* Behind the ATP lens (z +0.25 ± 0.14): its front face reaches z ~0.07. */
  { at: [-1.15, 0.46, -0.06], rot: 0.25, scale: 1.05, near: true },
  { at: [0.45, 0.78, -0.5], rot: 0.35, scale: 0.95 },
  { at: [0.15, -1.08, -0.5], rot: -0.3, scale: 0.85 },
];
const NUCLEUS = { at: [-0.85, -1.12, -0.28], r: [0.44, 0.22, 0.2] };

function blind(object) {
  object.raycast = () => {};
  return object;
}

function tag(object, role, label) {
  object.userData.role = role;
  if (label) object.userData.fiberLabel = label;
  return object;
}

/** Give every instance a colour at build time, so `instanceColor` exists
    before the first frame writes it — three.js creates the attribute lazily on
    the first `setColorAt`, and a population that starts empty (free Pi,
    calcium) never called it and had nothing to mark `needsUpdate` on. */
function coloured(mesh, colour = "#ffffff") {
  const c = new THREE.Color(colour);
  for (let i = 0; i < mesh.count; i += 1) mesh.setColorAt(i, c);
  return mesh;
}

/** A small wet form: the fibre's material, weighing the room a little harder. */
const wet = (colour, extra = {}) =>
  anatomyMaterial({ colour, roughness: SURFACE.roughnessForm, envMapIntensity: 1.4, ...extra });

/** A membrane layer: desaturated, translucent, no highlight (brief §7). */
const skin = (colour, opacity) =>
  anatomyMaterial({ colour, opacity, roughness: 0.8, envMapIntensity: 0.4, depthWrite: false });

/** A lattice for a pool: `latticeSlots` about the pool's own anchor, the
    nucleotide ones stretched along x to the token's length. */
function poolSlots(id, n, seed) {
  const spec = { atp: POOL_LATTICE, adp: ADP_LATTICE, amp: AMP_LATTICE, pcr: PCR_LATTICE, pi: PI_LATTICE }[id];
  const { stretch = 1, ...lattice } = spec;
  const at = AT[id];
  return latticeSlots({ at, n, seed, ...lattice }).map(([x, y, z]) => [at[0] + (x - at[0]) * stretch, y, z]);
}

export function buildCellChainLevel() {
  const group = new THREE.Group();
  group.name = "Energy";

  /* ---- the spotlight: every drawn thing belongs to a part ------------------ */

  /* SELECTION IS THE OBJECT ITSELF (owner 12/13: no rings, no orange). Each
     drawn thing is registered under a part id with the material or the
     instanced mesh that draws it; `spotlight(id)` sets a target weight per
     part and the frame loop settles toward it. A plain mesh recedes by
     opacity; an instanced population recedes by its instance colours lerping
     toward the paper — the same disappearance, in the only channel each has. */
  const PART_IDS = ["atp", "adp", "amp", "pcr", "pi", "ca", "camkk2", "ampk", "demand", "room"];
  const weight = Object.fromEntries(PART_IDS.map((p) => [p, 1]));
  const applied = Object.fromEntries(PART_IDS.map((p) => [p, -1]));
  /** `{ part → [{ material, base }] }` for opacity fades. */
  const faders = Object.fromEntries(PART_IDS.map((p) => [p, []]));
  const fades = (part, material) => {
    faders[part].push({ material, base: material.opacity });
    return material;
  };
  /** Instanced populations, with the parts they draw: hidden outright when
      every one of those parts has receded to nothing (the pull-back), since a
      paper-coloured sphere under three lamps still shades. */
  const hides = [];
  const hidesWith = (mesh, parts) => {
    hides.push({ mesh, parts });
    return mesh;
  };
  let spotlightId = null;
  let dimmed = 0;
  const PAPER = new THREE.Color(SCENE.background);
  const C = new THREE.Color();

  /* ---- scratch ---------------------------------------------------------- */

  const M = new THREE.Matrix4();
  const P = new THREE.Vector3();
  const P2 = new THREE.Vector3();
  const Q = new THREE.Quaternion();
  const S = new THREE.Vector3();
  const V = new THREE.Vector3();
  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
  /** A unit cylinder along y turned to lie along x. */
  const Y_TO_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);

  /* ---- the room -------------------------------------------------------- */

  /* THE MEMBRANE, THINNER AND DOUBLED (brief §7). The outline tube is half its
     old radius (0.018 → 0.009), the colour is the sarcolemma's washed a third
     toward the paper, and a second, fainter line runs just inside it — a bilayer
     read at this scale — so the edge is a membrane and not a UI border. The
     inner line sits at the same z, 4 % inward. */
  const MEMBRANE = new THREE.Color(PALETTE.sarcolemma).lerp(PAPER, 0.3).getStyle();
  const loop = PROFILE.map(([sx, sy]) => new THREE.Vector3(sx * HALF_W, sy * HALF_H, 0));
  const outline = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), 160, 0.009, 6, true),
    fades("room", skin(MEMBRANE, 0.62)),
  );
  outline.renderOrder = -4;
  group.add(blind(tag(outline, "cell-boundary", "one muscle cell")));
  const inner = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop.map((v) => v.clone().multiplyScalar(0.96)), true), 160, 0.006, 6, true),
    fades("room", skin(MEMBRANE, 0.28)),
  );
  inner.renderOrder = -4;
  group.add(blind(tag(inner, "cell-boundary-inner", "one muscle cell")));

  /* THE DOME IS A 7 % WARM-NEUTRAL SKIN, NOT AN ORANGE ONE. It was the
     perimysium colour at 10 %, which over the paper read as *"이상한 오렌지색
     dome"* (owner, extra-4). It stays — it is what makes the motes' parallax
     read as depth inside a volume — at a tint that separates inside from
     outside without naming a colour (r1 at 4 % grey left the room as white as
     the paper around it). */
  const shell = new THREE.Mesh(
    shellGeometry(),
    fades("room", anatomyMaterial({
      colour: "#d6c3ba", opacity: 0.07, roughness: 0.9, envMapIntensity: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    })),
  );
  shell.renderOrder = 2;
  group.add(blind(tag(shell, "cell-body", "one muscle cell")));

  /* The fibre's furniture — see BANDS / MITOS / NUCLEUS. All "room": the
     spotlight recedes them to 0.6, the pull-back to nothing. */
  {
    const rodTint = new THREE.Color(PALETTE.myofibril).lerp(PAPER, 0.55).getStyle();
    /* Opacities measured down twice: p2r1 (0.17 / 0.16) was zebra bacon,
       pass 2 shipped 0.14 / 0.085, and the owner's pass 3 asked for another
       30–40 % off and less edge — 0.09 / 0.05, tints further into the paper. */
    /* Pass 4: 0.09 / 0.05 read as a watermark — 0.105 / 0.06, +17 % / +20 %,
       inside the owner's 15–20 %. */
    const rodMat = fades("room", anatomyMaterial({ colour: rodTint, opacity: 0.105, roughness: 0.95, envMapIntensity: 0.15, depthWrite: false }));
    const stripeMat = fades("room", anatomyMaterial({ colour: new THREE.Color(PALETTE.myofibril).lerp(PAPER, 0.4).getStyle(), opacity: 0.07, roughness: 0.95, envMapIntensity: 0.15, depthWrite: false }));
    const stripes = [];
    for (const { y, z, r } of BANDS) {
      const k = ringAt(z);
      /* Each rod spans the membrane's width at its own height and depth. */
      const sy = Math.min(0.999, (Math.abs(y) + 0.6 * r) / (HALF_H * k));
      /* To the wall, not short of it and not through it: a rod that stops
         inside the room shows its rounded end and reads as a pill on a shelf
         (p2r1); one that overshoots pierces the membrane. The outline is
         x⁴ + y⁴ = 1, so its half-width at height sy is (1 − sy⁴)^¼ (the sqrt
         first written here understated it by ~0.14), and the capsule's caps
         add r each end, so r comes off the cylinder's half-length; the wall
         is read at the rod's upper edge (|y| + 0.6 r) so the corners stay
         inside where it curves in. */
      const halfX = HALF_W * k * (1 - sy ** 4) ** 0.25 - r;
      if (halfX <= r) continue;
      const rod = new THREE.Mesh(new THREE.CapsuleGeometry(r, halfX * 2, 6, 24), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, y, z);
      rod.renderOrder = -6;
      group.add(blind(tag(rod, "cell-myofibril")));
      for (let x = -halfX + STRIPE_PITCH * 0.5; x < halfX - STRIPE_LEN; x += STRIPE_PITCH) stripes.push([x, y, z, r]);
    }
    const sleeves = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), stripeMat, Math.max(1, stripes.length));
    stripes.forEach(([x, y, z, r], n) => {
      M.compose(P.set(x, y, z), Y_TO_X, S.set(r * 1.01, STRIPE_LEN, r * 1.01));
      sleeves.setMatrixAt(n, M);
    });
    sleeves.count = stripes.length;
    sleeves.instanceMatrix.needsUpdate = true;
    sleeves.renderOrder = -6;
    sleeves.frustumCulled = false;
    group.add(blind(tag(sleeves, "cell-sarcomere-stripes")));

    const mitoTint = new THREE.Color(PALETTE.mitochondrion).lerp(PAPER, 0.5).getStyle();
    const mitoFar = fades("room", anatomyMaterial({ colour: mitoTint, opacity: 0.13, roughness: 0.9, envMapIntensity: 0.2, depthWrite: false }));
    const mitoNear = fades("room", anatomyMaterial({ colour: mitoTint, opacity: 0.2, roughness: 0.9, envMapIntensity: 0.2, depthWrite: false }));
    MITOS.forEach(({ at, rot, scale, near }, n) => {
      const bean = blob(near ? mitoNear : mitoFar, [
        [[0, 0, 0], [0.24, 0.13, 0.12]],
        [[0.16, 0.03, 0], [0.17, 0.11, 0.1]],
        [[-0.14, -0.02, 0.01], [0.15, 0.1, 0.1]],
      ], { seed: 11.3 + n, dents: 0.07, radial: 24, rings: 18 });
      bean.position.set(...at);
      bean.rotation.z = rot;
      bean.scale.setScalar(scale);
      bean.renderOrder = -7;
      group.add(blind(tag(bean, "cell-mitochondrion")));
    });

    const nucleus = blob(
      fades("room", anatomyMaterial({ colour: "#b8b0bd", opacity: 0.1, roughness: 0.95, envMapIntensity: 0.15, depthWrite: false })),
      [[[0, 0, 0], NUCLEUS.r]],
      { seed: 5.5, dents: 0.05, radial: 28, rings: 20 },
    );
    nucleus.position.set(...NUCLEUS.at);
    nucleus.renderOrder = -7;
    group.add(blind(tag(nucleus, "cell-nucleus")));
  }

  const motes = new THREE.InstancedMesh(
    new THREE.SphereGeometry(MOTE_R, 6, 5),
    anatomyMaterial({ colour: "#ffffff", roughness: SURFACE.roughnessForm, opacity: 0.55, depthWrite: false }),
    MOTES,
  );
  const moteBase = new Float32Array(MOTES * 3);
  const moteOrbit = new Float32Array(MOTES * 4);
  const moteTint = [];
  {
    const quiet = new THREE.Color(QUIET_TINT);
    for (let i = 0; i < MOTES; i += 1) {
      const d = Math.sqrt(rnd(i, 0x9e37));
      const z = MOTE_NEAR + d * (MOTE_FAR - MOTE_NEAR);
      const swing = MOTE_ORBIT * (1 - 0.62 * d);
      const scale = 1 - 0.55 * d;
      /* The shell's ring at the deepest point of this mote's own orbit, so it
         is inside the membrane everywhere on its path and not only at rest. */
      const reach = (Math.abs(z) + swing + MOTE_R * scale) / HALF_D;
      const k = Math.sqrt(Math.max(0, 1 - Math.min(1, reach) ** 2));
      const [sx, sy] = rim(rnd(i, 0x85eb) * Math.PI * 2);
      const f = Math.sqrt(rnd(i, 0xc2b2)) * MOTE_FILL;
      moteBase[i * 3] = sx * HALF_W * k * f;
      moteBase[i * 3 + 1] = sy * HALF_H * k * f;
      moteBase[i * 3 + 2] = z;
      moteOrbit[i * 4] = swing;
      moteOrbit[i * 4 + 1] =
        (Math.PI * 2) / (MOTE_PERIOD[0] + rnd(i, 0x1b7f) * (MOTE_PERIOD[1] - MOTE_PERIOD[0]));
      moteOrbit[i * 4 + 2] = rnd(i, 0x51ed) * Math.PI * 2;
      moteOrbit[i * 4 + 3] = scale;
      /* Deeper is paler: the far ones are nearly the paper (brief §3). */
      moteTint.push(quiet.clone().lerp(PAPER, 0.4 + 0.55 * d));
      motes.setColorAt(i, moteTint[i]);
    }
  }
  motes.renderOrder = -5;
  motes.frustumCulled = false;
  hidesWith(motes, ["room"]);
  group.add(blind(tag(motes, "cell-cytosol")));

  /* ---- nucleotide tokens: body, beads, links --------------------------------- */

  /* Per-instance colour on every population so the spotlight can recede one
     pool while another stays: the material is white and each instance carries
     the colour the material used to. */
  const ATP_TINT = new THREE.Color(PALETTE.atp);
  const BEAD_TINT = new THREE.Color("#b0a495");
  const LINK_TINT = new THREE.Color("#a3968a");
  const bodyGeo = blob(new THREE.MeshBasicMaterial(), BODY_LOBES, { seed: 3.1, dents: 0.11, radial: 18, rings: 12 }).geometry;
  const bodies = hidesWith(coloured(new THREE.InstancedMesh(bodyGeo, wet("#ffffff"), POOL)), ["atp", "adp", "amp"]);
  bodies.frustumCulled = false;
  group.add(blind(tag(bodies, "nucleotide", "nucleotide")));

  const BEADS = POOL * 3 + PCR_SLOTS;
  const beads = hidesWith(coloured(new THREE.InstancedMesh(new THREE.SphereGeometry(BEAD_R, 20, 14), wet("#ffffff"), BEADS)), ["atp", "adp", "amp", "pcr"]);
  beads.frustumCulled = false;
  group.add(blind(tag(beads, "phosphate", "phosphate")));

  const LINKS = POOL * 3;
  const links = hidesWith(coloured(new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1), wet("#ffffff"), LINKS)), ["atp", "adp", "amp"]);
  links.frustumCulled = false;
  group.add(blind(tag(links, "phosphate-backbone")));

  const slots = {
    atp: poolSlots("atp", POOL, 0x1111),
    adp: poolSlots("adp", POOL, 0x2222),
    amp: poolSlots("amp", POOL, 0x3333),
  };
  /** Which token holds each slot of each pool, so a joining token takes the lowest free one. */
  const slotOf = { atp: new Array(POOL).fill(-1), adp: new Array(POOL).fill(-1), amp: new Array(POOL).fill(-1) };
  const POOL_OF_BEADS = { 3: "atp", 2: "adp", 1: "amp" };

  /* ONE GRAMMAR (brief §1): every token lies along x with a small, fixed tilt,
     so a pool reads as a population that agrees about which way it points. The
     old ±0.25/0.35/0.2 rad scatter was what made the pile. */
  const tokens = [];
  for (let i = 0; i < POOL; i += 1) {
    /* ±15° in the picture plane (owner, item 3: "±15° orientation variation
       so it feels molecular without becoming random noise"), a little roll
       and yaw as before. */
    const tilt = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rnd(i, 0x71) - 0.5) * 0.5, (rnd(i, 0x72) - 0.5) * 0.36, (rnd(i, 0x73) - 0.5) * 0.52),
    );
    tokens.push({ beads: 0, pool: null, slot: -1, pos: new THREE.Vector3(), tilt, linkQ: LINK_LOCAL.map((l) => tilt.clone().multiply(l.q)) });
  }

  function takeSlot(pool) {
    const held = slotOf[pool];
    const s = held.indexOf(-1);
    return s < 0 ? POOL - 1 : s;
  }

  /** Put token `i` in the pool its bead count names, taking the nearest free slot. */
  function restate(i, count, snap = false) {
    const tk = tokens[i];
    const pool = POOL_OF_BEADS[count];
    if (tk.pool !== pool) {
      if (tk.pool) slotOf[tk.pool][tk.slot] = -1;
      tk.slot = takeSlot(pool);
      slotOf[pool][tk.slot] = i;
      tk.pool = pool;
    }
    tk.beads = count;
    if (snap) tk.pos.set(...slots[pool][tk.slot]);
  }

  /** World position of bead `k` on token `i` right now. */
  const beadAt = (i, k, out) => out.copy(BEAD_LOCAL[k]).applyQuaternion(tokens[i].tilt).add(tokens[i].pos);

  /** The token in `pool` nearest `to`. */
  function nearest(pool, to) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < POOL; i += 1) {
      if (tokens[i].pool !== pool) continue;
      const d = tokens[i].pos.distanceTo(to);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /* ---- PCr reserve ------------------------------------------------------ */

  /* Creatine is a different molecule and a different shape: a compact single
     lobe (no bump, no chain), one phosphate held close. The chain is what says
     "nucleotide"; its absence is what says "not one". */
  const PCR_TINT = new THREE.Color("#b58a6e");
  const PCR_SPENT = PCR_TINT.clone().lerp(PAPER, 0.7);
  const pcrGeo = blob(new THREE.MeshBasicMaterial(), [[[0, 0, 0], [0.031, 0.026, 0.025].map((v) => v * TOKEN_SCALE)]], { seed: 6.2, dents: 0.13, radial: 16, rings: 11 }).geometry;
  const pcrs = hidesWith(coloured(new THREE.InstancedMesh(pcrGeo, wet("#ffffff"), PCR_SLOTS)), ["pcr"]);
  pcrs.frustumCulled = false;
  group.add(blind(tag(pcrs, "creatine", "PCr")));
  const pcrSlots = poolSlots("pcr", PCR_SLOTS, 0x4444);
  /** Per creatine: has its phosphate. Spent ones keep a faint shell. */
  const pcrHas = new Array(PCR_SLOTS).fill(false);
  const pcrTilt = [];
  for (let p = 0; p < PCR_SLOTS; p += 1) {
    pcrTilt.push(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, (rnd(p, 0x81) - 0.5) * 1.2, 0.6 + (rnd(p, 0x82) - 0.5) * 0.4)),
    );
  }
  const pcrBeadAt = (p, out) => out.set(0.05 * TOKEN_SCALE, 0, 0).applyQuaternion(pcrTilt[p]).add(P2.set(...pcrSlots[p]));

  /* ---- free phosphate --------------------------------------------------- */

  /* FREE PHOSPHATE IS THE ONE DRAWN QUANTITY THAT IS OUR OWN ARITHMETIC
     (conservation over the drawn species — its hover line says so), and it
     read as just another grey cluster beside ADP. It is set apart the way
     it is different: LOOSE — the beads a fifth larger and paler than the ones
     on a chain, drifting further, so the cloud reads as phosphate let go
     rather than a fourth pool of something. */
  const pis = hidesWith(coloured(new THREE.InstancedMesh(new THREE.SphereGeometry(BEAD_R * 1.1, 16, 12), wet("#ffffff", { roughness: 0.5 }), PI_MAX)), ["pi"]);
  const PI_TINT = BEAD_TINT.clone().lerp(PAPER, 0.35);
  pis.frustumCulled = false;
  group.add(blind(tag(pis, "free-phosphate", "phosphate")));
  const piSlots = poolSlots("pi", PI_MAX, 0x5555);

  /* ---- calcium ---------------------------------------------------------- */

  const CA_TINT = new THREE.Color(PALETTE.calcium);
  /* Diffuse white so the instance colour carries the blue (and the spotlight
     can wash it); the emissive stays the calcium blue — a white emissive on
     paper is no glow at all (r2: the ions read pale). */
  const caMat = calciumMaterial();
  caMat.color.set("#ffffff");
  const cas = hidesWith(coloured(new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 16, 12), caMat, CA_MAX + BOUND_SLOTS), PALETTE.calcium), ["ca"]);
  cas.frustumCulled = false;
  group.add(blind(tag(cas, "calcium-ion", "Calcium")));
  /** Live particles: age in wall seconds and a per-particle jitter seed. */
  const caLive = [];
  /** Ions held in the pocket: slot and age since binding. */
  const caBound = [];
  let caSeed = 0;
  const CA_FROM = new THREE.Vector3(...AT.ca);
  const CA_TO = new THREE.Vector3();

  /* ---- CaMKK2: two fused lobes on a hinge, two binding arms ------------------ */

  /* Brief §5: "calcium arrives → sensor changes state", and the closed and
     open silhouettes have to differ. The C-lobe stands; the N-lobe rides a
     hinge at their waist and rolls back; two organic fingers on the N-lobe —
     the calcium-binding reach, drawn at cartoon level and claimed as nothing
     more — CLOSE OVER THE TOP at rest, tips meeting in an arch, and swing
     outward when calcium lands. Closed it is a compact fist; open it is the
     owner's own sketch, `\   /` over a body, with the pocket between the
     fingers where the particles land (`pocketAt`). r1 drew the arms as two
     straight sticks standing up from a snowman, which read as ears. */
  const camkk = new THREE.Group();
  camkk.position.set(...AT.camkk2);
  /* Turned toward its input: the calcium door is at the lower-right wall
     (pass 3, the owner's sketch), 128° clockwise from +y as seen from the
     sensor; the open V's axis sits 42° past the closed one, so a closed lean
     of 86° (−1.5 rad) puts the OPEN V on the door. Pass 2's −0.55 faced the
     old top-right door; after the move the calcium arrived 76° off the V
     (review). Bolt upright, two stacked lobes read as a figure (r2). */
  camkk.rotation.z = -1.5;
  const lobeMat = wet(PALETTE.nucleus, { emissive: PALETTE.calcium, emissiveIntensity: 0 });
  /* ONE BILOBAL BODY, not two balls: the C-lobe wide and oblate, the N-lobe
     smaller and forward in z, fused through a waist — the kinase silhouette
     `heroForms.kinaseForm` describes, at this floor's size. */
  const lobeA = blob(fades("camkk2", lobeMat), [
    [[0, -0.05, 0], [0.15, 0.1, 0.11]],
    [[0.01, 0.075, 0.03], [0.1, 0.07, 0.08]],
  ], { seed: 4.4, dents: 0.07, radial: 32, rings: 24 });
  const hinge = new THREE.Group();
  hinge.position.set(0.0, 0.09, 0.03);
  const lobeB = blob(lobeMat, [[[0, 0, 0], [0.085, 0.06, 0.07]]], { seed: 7.7, dents: 0.09, radial: 24, rings: 18 });
  lobeB.position.set(0.0, 0.05, 0.01);
  hinge.add(lobeB);
  const armMat = wet(PALETTE.nucleus, { emissive: PALETTE.calcium, emissiveIntensity: 0 });
  fades("camkk2", armMat);
  const arms = [];
  /* Each finger is short and stout, pivoting at the N-lobe's shoulder; at
     rest it leans INWARD so the two tips meet over the lobe (a closed clamp),
     and the spread rotates it outward into the V. */
  /* PASS 3, ITEM 6 — the silhouette change must read without colour: the
     fingers swing 82° (lean-in 0.6 → lean-out 0.84), the N-lobe rolls back
     0.6 of the hinge and lifts, and the cleft between them shows a blue
     interior that is nothing while closed. */
  const ARM_REST = 0.6;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.06, 0.07, 0.02);
    const finger = blob(armMat, [[[0, 0.045, 0], [0.036, 0.062, 0.034]], [[0, 0.1, 0.004], [0.03, 0.028, 0.028]]], { seed: 9.1 + side, dents: 0.1, radial: 16, rings: 14 });
    pivot.add(finger);
    hinge.add(pivot);
    arms.push({ pivot, side });
  }
  /* The exposed interior: a small calcium-blue form in the cleft, scaled by
     the opening, invisible shut. */
  const cleftMat = fades("camkk2", anatomyMaterial({ colour: PALETTE.calcium, emissive: PALETTE.calcium, emissiveIntensity: 0.6, roughness: 0.5, opacity: 0.9, depthWrite: false }));
  const cleft = blob(cleftMat, [[[0, 0, 0], [0.05, 0.032, 0.03]]], { seed: 3.3, dents: 0.08, radial: 16, rings: 12 });
  /* z 0.08, not 0.045: at 0.045 every vertex of it sat inside the opaque
     N-lobe at every opening (raycast probe, pass-3 review) and no blue ever
     showed; at 0.08 most of it stands proud of the lobe's front face. */
  cleft.position.set(0.0, 0.085, 0.08);
  cleft.scale.setScalar(0.001);
  hinge.add(cleft);
  camkk.add(lobeA, hinge);
  group.add(tag(camkk, "camkk2", "CaMKK2"));
  /* Its contact shadow on the rod behind (item 7), placed after the halo
     texture exists — see the AMPK block for the texture. */
  let camkkShadow = null;
  const LOBE_REST = new THREE.Color(PALETTE.nucleus);
  const LOBE_LIT = new THREE.Color(PALETTE.calcium);
  /** Where a calcium particle lands: between the fingers, in world space, this frame. */
  const POCKET_LOCAL = new THREE.Vector3(0, 0.17, 0.04);
  const pocketAt = (out) => {
    hinge.updateWorldMatrix(true, false);
    return out.copy(POCKET_LOCAL).applyMatrix4(hinge.matrixWorld);
  };
  /** The four seats around the pocket, in the hinge's frame — between the fingers. */
  const BOUND_LOCAL = [
    new THREE.Vector3(-0.034, 0.15, 0.05),
    new THREE.Vector3(0.034, 0.15, 0.05),
    new THREE.Vector3(-0.018, 0.19, 0.06),
    new THREE.Vector3(0.018, 0.19, 0.06),
  ];
  const boundAt = (slot, out) => out.copy(BOUND_LOCAL[slot]).applyMatrix4(hinge.matrixWorld);

  /* ---- the route CaMKK2 → AMPK: packets when coupled, a cut line when not -- */

  const route = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(AT.camkk2[0] - 0.12, AT.camkk2[1] - 0.1, AT.camkk2[2] + 0.06),
    new THREE.Vector3((AT.camkk2[0] + AT.ampk[0]) / 2, (AT.camkk2[1] + AT.ampk[1]) / 2 + 0.26, (AT.camkk2[2] + AT.ampk[2]) / 2),
    new THREE.Vector3(AT.ampk[0] + 0.22, AT.ampk[1] + 0.12, AT.ampk[2] + 0.05),
  );
  const packetMat = calciumMaterial(0.9);
  packetMat.color.set("#ffffff");
  const packets = hidesWith(coloured(new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 16, 12), packetMat, PACKETS_MAX), PALETTE.calcium), ["camkk2"]);
  packets.frustumCulled = false;
  group.add(blind(tag(packets, "camkk2-signal", "signal")));
  const packetAge = [];
  let packetClock = 0;

  const cut = new THREE.Group();
  const cutMat = new THREE.LineDashedMaterial({
    color: QUIET_TINT, dashSize: 0.035, gapSize: 0.03, transparent: true, opacity: 0.45, depthWrite: false,
  });
  const cutLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(route.getPoints(32)), fades("camkk2", cutMat));
  cutLine.computeLineDistances();
  cut.add(cutLine);
  const xMat = fades("camkk2", anatomyMaterial({ colour: QUIET_TINT, roughness: SURFACE.roughnessForm, opacity: 0.85 }));
  const xAt = route.getPoint(0.14);
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), xMat);
    bar.position.copy(xAt);
    bar.rotation.z = angle;
    cut.add(bar);
  }
  cut.visible = false;
  group.add(blind(tag(cut, "camkk2-route-cut", "route cut")));

  /* ---- AMPK: the same protein as downstairs, wearing a collar ---------------- */

  /* THE TRIMER IS `heroForms.trimerLobes` — α 0.60 / β 0.38 / γ 0.50 at
     their three centres, the ONE spec both floors draw AMPK from (the
     orchestrator's rule: change its craft, not its species; pass 1 had copied
     the three lines into this file and the copy was already different). The
     craft here: `weld` 0.82, because at this floor's size and light the lobes
     at their SIGNALS spacing drew three teardrops meeting at a point (r1: a
     clover); the dents are a little softer. The reading (`response`, the
     Normal run's rise normalised to its own peak, `energyBinding.js`) is
     carried four ways, none of them a dial:
       · colour and emissive on the trimer;
       · a 6 % swell and a 5° turn;
       · THE CLEFT HINGING OPEN — `open` on the same spec as a morph target;
       · THE HALO AND THE ARCS — a soft glow behind the molecule that is nothing
         at rest and a warm light at full response, and two arcs ◜ ◝ over the
         shoulders. Brief §4: "activity halo / collar … 상태를 더 명확하게". Not
         a ring standing off the object (r1's collar at 1.6 R read as Saturn's).
     THE TEST SURVIVED THE DIAL AND THE BALLOON. "The AMPK response mostly
     disappears" needs the thing it disappeared from: the ghost is the same
     trimer at the size, light and opening the Normal run would have reached at
     this instant, on the live one's own axis and carried by its outline (pass
     4, below), drawn only while the calcium path is off. */
  /* THIS FLOOR'S OWN SIZE, not `FORM_R`: the SIGNALS floor shrank its nodes
     30 % in its own pass and this floor's hero followed it down the import —
     the seam identity is the SHAPE, the size is each room's. 0.19 is pass 1's
     FORM_R (0.195 at 12a930e), rounded, kept here so a later shrink downstairs
     does not follow the import. THE SHAPE IS SHARED: `trimerLobes` is the one
     spec of α/β/γ (heroForms.js); `weld` 0.82 is this floor's craft and `open`
     is the conformational opening, built as a MORPH TARGET — the same surface
     with α turned about the junction, toward γ and away from β, so the α–β
     neck opens — and with `response` the cleft actually hinges instead of the
     body stretching. See `AMPK_MORPH` for why 0.08 and not more. */
  const { R, weld: WELD, open: OPEN } = AMPK_MORPH;
  const trimerGeometry = (detail) => {
    const opts = { seed: 1.9, dents: 0.07, radial: detail, rings: Math.round(detail * 0.74) };
    const lobes = trimerLobes(R, { weld: WELD });
    const closed = blob(new THREE.MeshBasicMaterial(), lobes, opts).geometry;
    const open = blob(new THREE.MeshBasicMaterial(), trimerLobes(R, { weld: WELD, open: OPEN }), opts).geometry;
    closed.morphAttributes.position = [open.attributes.position];
    closed.morphAttributes.normal = [open.attributes.normal];
    /* Subunit variation and the cleft's occlusion, as vertex colour: each
       vertex takes the lightness of its nearest lobe (α 1.00, β 0.92, γ 1.05)
       times a darkening toward the junction where the three necks meet. */
    const centres = lobes.map(([c]) => new THREE.Vector3(...c));
    const junction = centres.reduce((a, c) => a.add(c), new THREE.Vector3()).multiplyScalar(1 / 3);
    const LOBE_LIGHT = [1.0, 0.92, 1.05];
    const pos = closed.attributes.position;
    const colour = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      let nearest = 0;
      let best = Infinity;
      centres.forEach((c, k) => {
        const d = v.distanceTo(c) / lobes[k][1][0];
        if (d < best) { best = d; nearest = k; }
      });
      const dj = v.distanceTo(junction) / R;
      const ao = 1 - 0.38 * THREE.MathUtils.smoothstep(1 - dj, 0.5, 0.92);
      const l = LOBE_LIGHT[nearest] * ao;
      colour[i * 3] = l; colour[i * 3 + 1] = l; colour[i * 3 + 2] = l;
    }
    closed.setAttribute("color", new THREE.BufferAttribute(colour, 3));
    return closed;
  };
  const trimer = (material, detail) => {
    const mesh = new THREE.Mesh(trimerGeometry(detail), material);
    mesh.morphTargetInfluences[0] = 0;
    return mesh;
  };
  const ampk = new THREE.Group();
  ampk.position.set(...AT.ampk);
  /* PASS 3, ITEM 5 — "more visual authority": 13 % larger (R 0.19 → 0.215,
     `AMPK_MORPH`), more central (AT), and the material: less saturated, a
     tighter highlight (roughness 0.26, the room weighed 1.9×), and vertex
     colours that vary the three subunits by a few percent of lightness and
     darken the junction — a baked cleft occlusion. "Not three different
     colours — just enough variation to show structure." */
  const AMPK_REST = new THREE.Color("#7f5f7b");
  /* Same hue, two steps up in lightness. Not lerped toward orange: on this
     floor orange is a nucleotide, and an AMPK that turned orange as it
     activated would be saying it had become one. */
  const AMPK_LIT = new THREE.Color("#b587af");
  /* Pass 4, item 2 — "balloon-like": the surface, not the shape. The weld
     cannot open further (`blob` is star-shaped about the junction and at
     0.85 the junction already thins to 0.05 R — probed), so the necks are
     read through LIGHT: roughness 0.18 and the room at 2.3× put a highlight
     on every lobe with a dark line between them, the baked cleft occlusion
     goes 0.24 → 0.38 and reaches a little further out, and the dents come up
     a hair so the skin is not a pillow. */
  const ampkMat = wet("#7f5f7b", { emissive: "#7f5f7b", emissiveIntensity: 0, roughness: 0.18, envMapIntensity: 2.3 });
  ampkMat.vertexColors = true;
  fades("ampk", ampkMat);
  const live = new THREE.Group();
  const liveBody = trimer(ampkMat, 40);
  live.add(liveBody);
  const collarMat = fades("ampk", anatomyMaterial({
    colour: "#c98fc2", emissive: "#c98fc2", emissiveIntensity: 0.1, roughness: 0.4, opacity: 0.05, depthWrite: false,
  }));
  /* Two arcs, ◜ ◝ — the owner's own mark for activity — over the molecule's
     shoulders in the picture plane, not a hoop around its waist (r2's hoop
     read as Saturn's ring, which is the dial again). */
  const collar = new THREE.Group();
  for (const a0 of [Math.PI * 0.62, Math.PI * 0.12]) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(R * 1.3, 0.011, 8, 32, Math.PI * 0.26), collarMat);
    arc.rotation.z = a0;
    collar.add(arc);
  }
  collar.position.set(0, 0.02, R * 0.4);
  /* The halo: a radial falloff in a DataTexture (no canvas — this file is
     built under node for its tests). NORMAL blending, not additive: additive
     light on near-white paper is invisible (r2 measured nothing at 0.2), so
     the aura is a tint laid over the paper, which on this ground is what a
     glow looks like. */
  const haloTex = (() => {
    const N = 64;
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
      const dx = (x + 0.5) / N - 0.5;
      const dy = (y + 0.5) / N - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      const a = (1 - r) ** 2.2;
      const o = (y * N + x) * 4;
      data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = Math.round(255 * a);
    }
    const t = new THREE.DataTexture(data, N, N);
    t.needsUpdate = true;
    return t;
  })();
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, color: "#c98fc2", transparent: true, opacity: 0, depthWrite: false, depthTest: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.set(0, 0, -0.05);
  halo.scale.setScalar(R * 4.5);
  halo.renderOrder = 3;
  /* THE GHOST IS A COUNTERFACTUAL, NOT A SECOND MOLECULE (pass 4, item 5):
     it sits on EXACTLY the live trimer's axis, its fill is nearly nothing
     (0.06), and what carries it is an OUTLINE — the same geometry a hair
     larger, drawn back-face so only its silhouette shows around the live
     body — plus the activity arcs, sharper than before. At the knockout's
     end the live trimer is at rest and the ghost is at the Normal run's
     opening and swell, so the outline stands just outside the real one:
     "actual AMPK vs would-have-been AMPK". */
  const ghostMat = anatomyMaterial({ colour: "#8a5a86", roughness: SURFACE.roughnessForm, opacity: 0.06, depthWrite: false });
  const ghostRimMat = anatomyMaterial({ colour: "#c98fc2", emissive: "#c98fc2", emissiveIntensity: 0.35, roughness: 0.6, opacity: 0.55, side: THREE.BackSide, depthWrite: false });
  const ghostCollarMat = anatomyMaterial({ colour: "#c98fc2", emissive: "#c98fc2", emissiveIntensity: 0.3, roughness: 0.4, opacity: 0.1, depthWrite: false });
  const ghost = new THREE.Group();
  /* Full detail, not 24: the rim is an outline and a low-poly outline shows
     its polygons (p4r1). */
  const ghostBody = trimer(ghostMat, 40);
  const ghostRim = new THREE.Mesh(ghostBody.geometry, ghostRimMat);
  ghostRim.scale.setScalar(1.035);
  ghost.add(ghostBody, ghostRim);
  const ghostCollar = new THREE.Group();
  for (const arc of collar.children) {
    const g = new THREE.Mesh(arc.geometry, ghostCollarMat);
    g.rotation.copy(arc.rotation);
    ghostCollar.add(g);
  }
  ghostCollar.position.copy(collar.position);
  ghost.add(ghostCollar);
  ghost.position.set(0, 0, 0);
  ghost.visible = false;
  /* ITEM 7 — A CONTACT SHADOW where the sensor meets its rod: a dark soft
     disc on the rod's face behind the trimer, so the two touch rather than
     hover. The same falloff texture as the halo, dark, normal blending. */
  /* Registered under "room", not "ampk": it is the ROD's darkening, so it goes
     when the rod goes (under the pull-back it hung behind the trimer over bare
     paper when it was AMPK's — review). */
  const shadowMat = fades("room", new THREE.SpriteMaterial({ map: haloTex, color: "#2d2426", transparent: true, opacity: 0.2, depthWrite: false }));
  const shadow = new THREE.Sprite(shadowMat);
  shadow.position.set(0.02, -0.04, -0.065);
  shadow.scale.set(R * 3.1, R * 2.5, 1);
  shadow.renderOrder = -1;
  ampk.add(shadow, halo, ghost, live, collar);
  group.add(tag(ampk, "ampk", "AMPK"));
  /* And one under the ATP lens where it lies against its mitochondrion. */
  const lensShadowMat = fades("atp", new THREE.SpriteMaterial({ map: haloTex, color: "#2d2426", transparent: true, opacity: 0.13, depthWrite: false }));
  const lensShadow = new THREE.Sprite(lensShadowMat);
  lensShadow.position.set(AT.atp[0] + 0.02, AT.atp[1] - 0.03, 0.085);
  lensShadow.scale.set(1.35, 0.46, 1);
  lensShadow.renderOrder = -1;
  group.add(blind(tag(lensShadow, "atp-contact")));
  camkkShadow = new THREE.Sprite(fades("camkk2", new THREE.SpriteMaterial({ map: haloTex, color: "#2d2426", transparent: true, opacity: 0.18, depthWrite: false })));
  camkkShadow.position.set(AT.camkk2[0] + 0.02, AT.camkk2[1] - 0.05, AT.camkk2[2] - 0.05);
  camkkShadow.scale.set(0.62, 0.5, 1);
  camkkShadow.renderOrder = -1;
  group.add(blind(tag(camkkShadow, "camkk2-contact")));

  /* ---- demand: a front from the membrane into the pool --------------------- */

  /* Brief §8. The old disc hung in the middle of the room under a DOM pill.
     Now the contraction ARRIVES: on each repetition's onset a translucent bow
     leaves the membrane's top edge above the ATP pool and crosses to the pool
     over PULSE_S, and the count change waits for it to land. It wears the ATP
     colour, so what comes in is read as the thing that will be spent. (A
     ripple on the edge, sized by `demand`, was drawn from pass 1 to pass 4 and
     added nothing at the wide frame.) */
  const pulseTint = new THREE.Color(PALETTE.atp).lerp(PAPER, 0.35).getStyle();
  /* NO RIPPLE ON THE MEMBRANE ANY MORE (2026-09-06 night, own call, owner's
     "your call"): the two half-rings on the top edge added nothing at the
     wide frame — the bow crossing to the pool is what reads. The anchor and
     its hover stay; the front is the whole of the event now. */
  const frontMat = fades("demand", anatomyMaterial({
    colour: pulseTint, emissive: pulseTint, emissiveIntensity: 0.25, roughness: 0.6, opacity: 0.55, depthWrite: false,
  }));
  /* The front is the same arc, let go: a wide low bow that travels to the
     pool and fades. Only the bow — a lens under it (r4) read as a puddle. */
  const fronts = [];
  for (let i = 0; i < PULSES_MAX; i += 1) {
    const front = new THREE.Group();
    const bow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.014, 8, 48, Math.PI), frontMat);
    bow.rotation.z = Math.PI;
    front.add(bow);
    front.visible = false;
    group.add(blind(tag(front, "demand-front", "ATP demand")));
    fronts.push({ front, bow });
  }
  const pulses = [];
  /* THE OPENER'S ECHO (owner, pass 6, optional): beat 0 holds the first
     instant under its line and nothing moved — "text over a frozen frame".
     One bow leaves the membrane and fades on the VIEWER's clock while the
     run stands still: the residue of the last pull upstairs. Drawn on its
     own mesh at half the front's strength; not a demand event, spends nothing. */
  const echoes = [];
  /* 1.2 s at 0.35, and NOT scaled by the demand part's weight: the opener
     spotlights ATP, which sends `demand` to the related band, and the one
     frame the echo plays on was the one frame that faded it (review: 0.13 for
     most of its life). Its visibility still follows the pull-back gate. */
  const ECHO_S = 1.2;
  const echoMat = anatomyMaterial({
    colour: pulseTint, emissive: pulseTint, emissiveIntensity: 0.25, roughness: 0.6, opacity: 0.35, depthWrite: false,
  });
  const echoBow = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 48, Math.PI), echoMat);
  echoBow.rotation.z = Math.PI;
  echoBow.visible = false;
  group.add(blind(tag(echoBow, "demand-echo")));
  const PULSE_FROM = new THREE.Vector3(...AT.demand);
  /** The front lands on the top of the ATP lens, not its centre. */
  const PULSE_TO = new THREE.Vector3(AT.atp[0] + 0.15, AT.atp[1] + 0.2, AT.atp[2]);
  let demandWas = 0;

  /* ---- hit meshes -------------------------------------------------------- */

  /* ONE OBJECT, NOT UNDER `group`. The page mounts this as its own
     `<primitive>` with the pointer handlers on it; a mesh that was also a child
     of `group` would be re-parented out of it on mount. The hit group copies
     the drawn group's transform at build time; nothing moves `group` after. */
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Group();
  hit.name = "energy-hit";
  for (const { id } of ANCHORS) {
    if (!HOVERABLE.has(id)) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(HIT_R[id], 12, 8), hitMat);
    /* The two big pools are lenses, not balls: a sphere the lens's width
       swallowed the top of the Pi cloud after the inward move (review). */
    if (id === "atp" || id === "adp") m.scale.set(1, 0.5, 0.6);
    m.position.set(...AT[id]);
    m.userData.part = id;
    hit.add(m);
  }
  hit.position.copy(group.position);
  hit.rotation.copy(group.rotation);
  hit.scale.copy(group.scale);

  /* ---- animation state ---------------------------------------------------- */

  /** A bead crossing: bead instance `inst` drawn from `from` toward `to()` over FLIGHT_S. */
  const flights = [];
  /* One flight per bead instance: a token converted twice inside FLIGHT_S
     restarts its bead's crossing rather than doubling it. */
  const launch = (inst, from, to) => {
    const n = flights.findIndex((fl) => fl.inst === inst);
    if (n >= 0) flights.splice(n, 1);
    flights.push({ inst, from: from.clone(), to, age: 0 });
  };
  const toBead = (i, k) => () => beadAt(i, k, P);
  const toPcr = (p) => () => pcrBeadAt(p, P);
  const toPi = (n) => () => P.set(...piSlots[n % PI_MAX]);
  const fromPi = (n) => new THREE.Vector3(...piSlots[n % PI_MAX]);
  let piCursor = 0;

  const count = (pool) => tokens.reduce((n, tk) => n + (tk.pool === pool), 0);
  const pcrCount = () => pcrHas.reduce((n, h) => n + h, 0);

  /**
   * Make the tokens say what the frame says, and draw each change as a bead.
   *
   * COUNT-DRIVEN, NOT EVENT-DRIVEN. `events` only carries net changes, so it
   * cannot tell a rep that spent two and recharged two from a rep that did
   * nothing. The PCr count can: a creatine that lost its phosphate handed it to
   * an ADP, so recharges are read off PCr, and whatever ATP is then still
   * missing was spent (bead to the phosphate cloud) or, in recovery, rebuilt
   * from it. AMP is made by two ADP swapping a bead and unmade the same way
   * back. Which token converts is the nearest one — a drawing choice.
   */
  /* A SEEK OR A CUT IS A NEW STILL PICTURE. `reset()` arms `snapNext`, and the
     next reconcile re-states every token in place instead of flying the
     difference between the instant left and the instant arrived at — the
     'easing the quantities back' that `runLoop.js` rejects, which the count-
     driven loops below would otherwise draw on every seek and, on the one-rep
     loop, at every cut (review, 2026-09-06: 33 flights on a seek to t0). */
  let snapNext = false;
  function reconcile(f) {
    const snap = f === null || snapNext;
    snapNext = false;
    const want = { atp: f?.atp ?? REST.atp, adp: f?.adp ?? REST.adp, amp: f?.amp ?? REST.amp };
    const pcrWant = Math.max(0, Math.min(PCR_SLOTS, f?.pcr ?? REST.pcr));

    /* AMP up: two ADP → ATP + AMP, one bead hopping between them. */
    for (let n = want.amp - count("amp"); n > 0 && count("adp") >= 2; n -= 1) {
      const a = nearest("adp", P.set(...AT.amp));
      restate(a, 1, snap);
      const b = nearest("adp", tokens[a].pos);
      restate(b, 3, snap);
      if (!snap) launch(b * 3 + 2, beadAt(a, 1, P), toBead(b, 2));
    }
    /* AMP down: adenylate kinase running back — AMP + ATP → 2 ADP, one bead
       hopping from an ATP onto the AMP. The model removes AMP only this way. */
    for (let n = count("amp") - want.amp; n > 0 && count("atp") > 0; n -= 1) {
      const a = nearest("amp", P.set(...AT.adp));
      const b = nearest("atp", tokens[a].pos);
      restate(a, 2, snap);
      restate(b, 2, snap);
      /* The destination's own instance flies, as in every other branch — the
         donor's bead was drawn arriving on top of a bead already home. */
      if (!snap) launch(a * 3 + 1, beadAt(b, 2, P), toBead(a, 1));
    }
    /* PCr spent: its bead lands on an ADP, which is ATP now. */
    for (let n = pcrCount() - pcrWant; n > 0 && count("adp") > 0; n -= 1) {
      const p = pcrHas.indexOf(true);
      pcrHas[p] = false;
      const a = nearest("adp", P.set(...AT.pcr));
      restate(a, 3, snap);
      if (!snap) launch(a * 3 + 2, pcrBeadAt(p, P), toBead(a, 2));
    }
    /* PCr refilled: creatine takes a phosphate from an ATP (creatine kinase, in
       reverse) — recovery of the reserve is paid for by the fuel. */
    for (let n = pcrWant - pcrCount(); n > 0; n -= 1) {
      const p = pcrHas.indexOf(false);
      if (p < 0) break;
      pcrHas[p] = true;
      const a = nearest("atp", P.set(...pcrSlots[p]));
      if (a >= 0) {
        restate(a, 2, snap);
        if (!snap) launch(POOL * 3 + p, beadAt(a, 2, P), toPcr(p));
      } else if (!snap) launch(POOL * 3 + p, fromPi(piCursor++), toPcr(p));
    }
    /* ATP short: spent — the third bead leaves for the cloud. */
    for (let n = count("atp") - want.atp; n > 0; n -= 1) {
      const a = nearest("atp", P.set(...AT.adp));
      restate(a, 2, snap);
      if (!snap) launch(a * 3 + 2, beadAt(a, 2, P), toPi(piCursor++));
    }
    /* ATP long: rebuilt from the cloud. */
    for (let n = want.atp - count("atp"); n > 0 && count("adp") > 0; n -= 1) {
      const a = nearest("adp", P.set(...AT.pi));
      restate(a, 3, snap);
      if (!snap) launch(a * 3 + 2, fromPi(piCursor++), toBead(a, 2));
    }
    /* ponytail: the loops above cover every move this run makes; if the data
       ever asks for something they cannot reach (AMP with no ADP to pair),
       re-state the remainder silently rather than drift. Bounded by POOL. */
    const BEADS_OF = { atp: 3, adp: 2, amp: 1 };
    for (let guard = 0; guard < POOL; guard += 1) {
      const short = ["atp", "adp", "amp"].find((q) => count(q) < want[q]);
      const long = ["atp", "adp", "amp"].find((q) => count(q) > want[q]);
      if (short === undefined || long === undefined) break;
      restate(nearest(long, P.set(...AT[short])), BEADS_OF[short], true);
    }
  }

  /* ---- per frame ---------------------------------------------------------- */

  let last = { atp: -1, adp: -1, amp: -1, pcr: -1 };
  /** The most creatine ever drawn this visit — spent ones keep a faint shell. */
  let pcrPeak = 0;
  /** Viewer seconds, for everything that breathes. */
  let phase = 0;
  let ampkResponse = 0;
  let hingeAngle = 0;
  /** A binding's afterglow on the lobes, 1 at the landing, fading at FLASH_RATE. */
  let flash = 0;
  /* THE CONTACT EVENT (pass 4, item 3): a landing kicks the hinge and the
     fingers a step past where the fraction holds them and lets them settle
     back — a snap, gone in ~0.2 s — while the packet it releases leaves. So
     the last ion into the cleft is SEEN to be the one that opens it. */
  let snap = 0;
  const SNAP_RATE = 9;
  /* WHETHER ANY CALCIUM HAS LANDED SINCE THE LAST SEEK. The archive's fraction
     is 0.78–1.0 from 26 ms into the run, so a hinge that followed it opened
     before the drawn particles had crossed. The fraction still says HOW FAR it opens;
     the first landing says WHEN — never more than CA_TRAVEL_S of wall time. */
  let bound = false;

  /* AMP REACHES TOWARD THE SENSOR AS IT ACCUMULATES — the AMPK beat: "AMP
     approaches AMPK", so the visitor can form the expectation the next beat
     overturns. Proximity, not a claim: the knot slides up to AMP_REACH toward
     AMPK with the count, in BOTH conditions alike. At one token (rest) it sits
     home. */
  const AMP_REACH = 0.14;
  const AMP_REACH_FULL = 4;
  const ampDir = new THREE.Vector3(...AT.ampk).sub(new THREE.Vector3(...AT.amp)).normalize();
  /* The knot's hit sphere goes with it, so hovering the visible tokens finds
     them (review, 2026-09-06: at 0.3 of reach the pool had left its own sphere). */
  const ampHit = hit.children.find((m) => m.userData.part === "amp");

  /** Instance colour for a token's population, under its part's weight. */
  const tint = (base, part) => C.copy(base).lerp(PAPER, 1 - weight[part]);

  function drawTokens(dt, wallDt) {
    /* The glide and the idle drift settle on the viewer's clock: a held beat
       keeps the pools alive; Pause (both clocks 0) keeps them still. */
    const k = 1 - Math.exp(-GLIDE_RATE * wallDt);
    const inFlight = new Set(flights.map((fl) => fl.inst));
    const reach = AMP_REACH * Math.min(1, Math.max(0, ((last?.amp ?? REST.amp) - 1) / (AMP_REACH_FULL - 1)));
    if (ampHit) ampHit.position.set(AT.amp[0] + ampDir.x * reach, AT.amp[1] + ampDir.y * reach, AT.amp[2] + ampDir.z * reach);
    for (let i = 0; i < POOL; i += 1) {
      const tk = tokens[i];
      const s = slots[tk.pool][tk.slot];
      const r = tk.pool === "amp" ? reach : 0;
      /* A very slow idle drift (±0.008) so a pool is alive without moving. */
      V.set(
        s[0] + ampDir.x * r + 0.008 * Math.sin(phase * 0.7 + i),
        s[1] + ampDir.y * r + 0.008 * Math.sin(phase * 0.5 + i * 1.7),
        s[2] + 0.008 * Math.sin(phase * 0.6 + i * 2.3),
      );
      tk.pos.lerp(V, k);
      S.setScalar(1);
      M.compose(tk.pos, tk.tilt, S);
      bodies.setMatrixAt(i, M);
      bodies.setColorAt(i, tint(ATP_TINT, tk.pool));
      /* The chain: a bead where the count says, a link behind every bead that
         is home. A bead in flight takes its link with it (hidden), so the
         chain visibly shortens at the moment the phosphate leaves. */
      for (let b = 0; b < 3; b += 1) {
        const inst = i * 3 + b;
        const home = b < tk.beads && !inFlight.has(inst);
        if (home) {
          /* Unit scale, every bead: `S` still holds the previous link's
             (r, len, r) here, and beads 1 and 2 of every token were drawn at
             0.0055 wide — invisible — from pass 2 to the pass-3 review. ATP,
             ADP and AMP all showed one phosphate; the owner's "identical
             orange bars" was this. */
          S.setScalar(1);
          M.compose(beadAt(i, b, P), Q, S);
          beads.setMatrixAt(inst, M);
          beads.setColorAt(inst, tint(BEAD_TINT, tk.pool));
          V.copy(LINK_LOCAL[b].mid).applyQuaternion(tk.tilt).add(tk.pos);
          S.set(LINK_R, LINK_LOCAL[b].len, LINK_R);
          M.compose(V, tk.linkQ[b], S);
          links.setMatrixAt(inst, M);
          links.setColorAt(inst, tint(LINK_TINT, tk.pool));
        } else {
          beads.setMatrixAt(inst, HIDDEN);
          links.setMatrixAt(inst, HIDDEN);
        }
      }
    }
    for (let p = 0; p < PCR_SLOTS; p += 1) {
      const inst = POOL * 3 + p;
      /* Only the slots the reserve can reach are drawn; the rest stay hidden. */
      const shown = p < pcrPeak;
      if (!shown) {
        pcrs.setMatrixAt(p, HIDDEN);
        beads.setMatrixAt(inst, HIDDEN);
        continue;
      }
      S.setScalar(1);
      M.compose(P.set(...pcrSlots[p]), pcrTilt[p], S);
      pcrs.setMatrixAt(p, M);
      pcrs.setColorAt(p, tint(pcrHas[p] ? PCR_TINT : PCR_SPENT, "pcr"));
      if (pcrHas[p] && !inFlight.has(inst)) {
        M.compose(pcrBeadAt(p, P), Q, S);
        beads.setMatrixAt(inst, M);
        beads.setColorAt(inst, tint(BEAD_TINT, "pcr"));
      } else beads.setMatrixAt(inst, HIDDEN);
    }
    pcrs.instanceMatrix.needsUpdate = true;
    pcrs.instanceColor.needsUpdate = true;

    for (let n = flights.length - 1; n >= 0; n -= 1) {
      const fl = flights[n];
      fl.age += dt;
      const u = Math.min(1, fl.age / FLIGHT_S);
      const e = u * u * (3 - 2 * u);
      const to = fl.to();
      V.lerpVectors(fl.from, to, e);
      V.y += 0.08 * Math.sin(u * Math.PI);
      S.setScalar(1);
      M.compose(V, Q, S);
      beads.setMatrixAt(fl.inst, M);
      beads.setColorAt(fl.inst, BEAD_TINT);
      if (u >= 1) flights.splice(n, 1);
    }
    bodies.instanceMatrix.needsUpdate = true;
    bodies.instanceColor.needsUpdate = true;
    beads.instanceMatrix.needsUpdate = true;
    beads.instanceColor.needsUpdate = true;
    links.instanceMatrix.needsUpdate = true;
    links.instanceColor.needsUpdate = true;
  }

  function drawPi(n) {
    for (let i = 0; i < PI_MAX; i += 1) {
      if (i >= n) {
        pis.setMatrixAt(i, HIDDEN);
        continue;
      }
      const s = piSlots[i];
      V.set(
        s[0] + 0.04 * Math.sin(phase * 0.4 + i * 1.3),
        s[1] + 0.04 * Math.sin(phase * 0.3 + i * 2.1),
        s[2] + 0.03 * Math.sin(phase * 0.35 + i * 0.7),
      );
      S.setScalar(1);
      M.compose(V, Q, S);
      pis.setMatrixAt(i, M);
      pis.setColorAt(i, tint(PI_TINT, "pi"));
    }
    pis.instanceMatrix.needsUpdate = true;
    pis.instanceColor.needsUpdate = true;
  }

  /** Particles that reached CaMKK2 this frame — the binding events. */
  let bindings = 0;
  /** Of those, the ones that took a seat in the cleft — the contact events. */
  let seated = 0;
  function drawCalcium(n, dt) {
    bindings = 0;
    seated = 0;
    /* Held ions age and let go. THE HINGE IS NOT THEIRS TO CLOSE: it follows
       the archive's CaMKK fraction once any calcium has landed since the seek
       (`bound` latches on the first landing). Measured on the shipped run,
       the fraction is 1.000 through the set and still 0.79 at 12.9 s while
       the drawn calcium is 0.13–0.35 µM — zero particles — in every rest
       frame; a hinge that shut when the last ion left drew the sensor
       inactive where the archive says 0.9 (pass 2, first cut). So the seats
       are a picture of the landings, with a dwell that is a drawing choice,
       and the opening is the data's. */
    for (let i = caBound.length - 1; i >= 0; i -= 1) {
      caBound[i].age += dt;
      if (caBound[i].age > BOUND_S + CA_FADE_S) caBound.splice(i, 1);
    }
    for (let i = caLive.length - 1; i >= 0; i -= 1) {
      const before = caLive[i].age;
      caLive[i].age += dt;
      if (before < CA_TRAVEL_S && caLive[i].age >= CA_TRAVEL_S) {
        bindings += 1;
        bound = true;
        /* A landing takes a free seat and stays; with all four taken it
           flashes and fades as before. */
        const taken = new Set(caBound.map((b) => b.slot));
        const slot = [0, 1, 2, 3].find((k) => !taken.has(k));
        if (slot !== undefined) {
          caBound.push({ slot, age: 0 });
          caLive.splice(i, 1);
          seated += 1;
          continue;
        }
      }
      if (caLive[i].age > CA_TRAVEL_S + CA_FADE_S) caLive.splice(i, 1);
    }
    const travelling = caLive.filter((c) => c.age < CA_TRAVEL_S).length;
    for (let k = travelling; k < Math.min(n, CA_MAX) && caLive.length < CA_MAX; k += 1) {
      caLive.push({ age: 0, seed: caSeed++ });
    }
    pocketAt(CA_TO);
    for (let i = 0; i < CA_MAX; i += 1) {
      const c = caLive[i];
      if (!c) {
        cas.setMatrixAt(i, HIDDEN);
        continue;
      }
      const u = Math.min(1, c.age / CA_TRAVEL_S);
      const jx = (rnd(c.seed, 0x91) - 0.5) * 0.22;
      const jy = (rnd(c.seed, 0x92) - 0.5) * 0.22;
      const jz = (rnd(c.seed, 0x93) - 0.5) * 0.18;
      V.lerpVectors(CA_FROM, CA_TO, u);
      /* The stream narrows into the pocket: jitter dies out toward the landing. */
      V.x += jx * (1 - u * 0.85);
      V.y += jy * (1 - u * 0.85) + 0.08 * Math.sin(u * Math.PI);
      V.z += jz * (1 - u * 0.85);
      const fade = c.age < CA_TRAVEL_S ? 1 : 1 - (c.age - CA_TRAVEL_S) / CA_FADE_S;
      S.setScalar(Math.max(0.001, fade));
      M.compose(V, Q, S);
      cas.setMatrixAt(i, M);
      cas.setColorAt(i, tint(CA_TINT, "ca"));
    }
    for (let k = 0; k < BOUND_SLOTS; k += 1) {
      const b = caBound[k];
      const i = CA_MAX + k;
      if (!b) {
        cas.setMatrixAt(i, HIDDEN);
        continue;
      }
      boundAt(b.slot, V);
      const fade = b.age < BOUND_S ? 1 : 1 - (b.age - BOUND_S) / CA_FADE_S;
      S.setScalar(Math.max(0.001, fade) * 1.15);
      M.compose(V, Q, S);
      cas.setMatrixAt(i, M);
      cas.setColorAt(i, tint(CA_TINT, "ca"));
    }
    cas.instanceMatrix.needsUpdate = true;
    cas.instanceColor.needsUpdate = true;
    caMat.emissiveIntensity = 0.55 * weight.ca;
  }

  /** Bindings that have not yet been sent down the route. */
  let pending = 0;
  /* A SIGNAL TRAVELS ONLY ON AN EVENT (doc §5): a packet leaves only when a
     calcium particle has landed on CaMKK2, and the coupling decides whether it
     leaves at all. */
  function drawRoute(coupled, events, dt) {
    cut.visible = !coupled;
    packetClock += dt;
    pending = coupled ? Math.min(PACKETS_MAX, pending + events) : 0;
    if (pending > 0 && packetClock >= PACKET_EVERY_S && packetAge.length < PACKETS_MAX) {
      packetClock = 0;
      pending -= 1;
      packetAge.push(0);
    }
    for (let i = packetAge.length - 1; i >= 0; i -= 1) {
      packetAge[i] += dt;
      if (packetAge[i] > PACKET_S || !coupled) packetAge.splice(i, 1);
    }
    for (let i = 0; i < PACKETS_MAX; i += 1) {
      if (i >= packetAge.length) {
        packets.setMatrixAt(i, HIDDEN);
        continue;
      }
      const u = packetAge[i] / PACKET_S;
      route.getPoint(u, V);
      S.setScalar(1 - 0.4 * u);
      M.compose(V, Q, S);
      packets.setMatrixAt(i, M);
      packets.setColorAt(i, tint(CA_TINT, "camkk2"));
    }
    packets.instanceMatrix.needsUpdate = true;
    packets.instanceColor.needsUpdate = true;
    packetMat.emissiveIntensity = 0.9 * weight.camkk2;
  }

  /** The contraction arriving: fronts from the membrane's top edge into the pool. */
  function drawDemand(d, dt, wallDt) {
    for (let i = echoes.length - 1; i >= 0; i -= 1) {
      echoes[i].age += wallDt;
      if (echoes[i].age > ECHO_S) echoes.splice(i, 1);
    }
    const ec = echoes[0];
    echoBow.visible = !!ec && weight.demand > 0.02;
    if (ec) {
      const u = ec.age / ECHO_S;
      const e = 1 - (1 - u) * (1 - u);
      echoBow.position.lerpVectors(PULSE_FROM, PULSE_TO, e);
      echoBow.scale.set(0.26 + 0.3 * u, 0.15 + 0.06 * u, 1);
      echoMat.opacity = 0.35 * (1 - u * u);
    }
    /* One front per onset: `demand` crossing PULSE_ARM from below. */
    if (d >= PULSE_ARM && demandWas < PULSE_ARM && dt > 0 && pulses.length < PULSES_MAX) pulses.push({ age: 0 });
    demandWas = d;
    for (let i = pulses.length - 1; i >= 0; i -= 1) {
      pulses[i].age += dt;
      if (pulses[i].age > PULSE_S) pulses.splice(i, 1);
    }
    for (let i = 0; i < PULSES_MAX; i += 1) {
      const pu = pulses[i];
      const { front, bow } = fronts[i];
      if (!pu) {
        front.visible = false;
        continue;
      }
      const u = pu.age / PULSE_S;
      const e = 1 - (1 - u) * (1 - u);
      front.visible = weight.demand > 0.02;
      front.position.lerpVectors(PULSE_FROM, PULSE_TO, e);
      /* The bow widens and flattens as it goes. */
      bow.scale.set(0.22 + 0.32 * u, 0.13 + 0.06 * u, 1);
      frontMat.opacity = 0.55 * (1 - u * u) * weight.demand;
    }
  }

  function driftMotes() {
    for (let i = 0; i < MOTES; i += 1) {
      const a = moteOrbit[i * 4];
      const angle = moteOrbit[i * 4 + 2] + moteOrbit[i * 4 + 1] * phase;
      P.set(
        moteBase[i * 3] + a * Math.cos(angle),
        moteBase[i * 3 + 1] + a * 0.4 * Math.sin(angle * 0.73),
        moteBase[i * 3 + 2] + a * Math.sin(angle),
      );
      S.setScalar(moteOrbit[i * 4 + 3]);
      M.compose(P, Q, S);
      motes.setMatrixAt(i, M);
      motes.setColorAt(i, tint(moteTint[i], "room"));
    }
    motes.instanceMatrix.needsUpdate = true;
    motes.instanceColor.needsUpdate = true;
  }

  /** Settle every part's weight toward its target and apply the fades. */
  function settleWeights(wallDt) {
    const k = wallDt > 0 ? Math.min(1, wallDt * RECEDE_RATE) : 1;
    for (const part of PART_IDS) {
      let want = 1;
      if (spotlightId && spotlightId !== part) {
        want = part === "room" ? RECEDE_ROOM_TO : RELATED[spotlightId]?.includes(part) ? RECEDE_RELATED_TO : RECEDE_TO;
      }
      if (dimmed > 0 && part !== "ampk") want = Math.min(want, 1 - dimmed);
      weight[part] += (want - weight[part]) * k;
      if (Math.abs(weight[part] - want) < 0.003) weight[part] = want;
      if (Math.abs(weight[part] - applied[part]) < 0.002) continue;
      applied[part] = weight[part];
      for (const { material, base } of faders[part]) {
        material.opacity = base * weight[part];
        material.transparent = weight[part] < 1 || base < 1;
        material.visible = weight[part] > 0.005;
      }
    }
    for (const { mesh, parts } of hides) mesh.visible = parts.some((p) => weight[p] > 0.005);
  }

  /** @param {EnergyFrame|null} frame — `null` draws the resting picture. */
  function update(frame) {
    const f = frame ?? null;
    const dt = Math.min(MAX_DT, Math.max(0, f?.dt ?? 0));
    const wallDt = Math.min(MAX_DT, Math.max(0, f?.wallDt ?? dt));
    phase += wallDt;
    dimmed = THREE.MathUtils.clamp(f?.dim ?? REST.dim, 0, 1);
    settleWeights(wallDt);

    /* The front first, because the beads wait for it (see drawDemand). */
    drawDemand(THREE.MathUtils.clamp(f?.demand ?? REST.demand, 0, 1), dt, wallDt);

    const counts = { atp: f?.atp ?? REST.atp, adp: f?.adp ?? REST.adp, amp: f?.amp ?? REST.amp, pcr: f?.pcr ?? REST.pcr };
    /* THE PULSE SPENDS THE ATP, BY CONSTRUCTION. The archive's demand rises
       26–52 ms before its first token drop in every rep, so the front is
       already crossing when the count change arrives; the change is held
       until the front lands, and the beads leave as it does. A latency of at
       most PULSE_S of run time, the same kind of drawing decision as the hinge
       waiting for its calcium — and the review of 2026-09-06 measured the
       opposite order before this: beads at 0.078 s, front landing at 0.366 s. */
    const frontInFlight = pulses.some((pu) => pu.age < PULSE_S);
    const changed = counts.atp !== last.atp || counts.adp !== last.adp || counts.amp !== last.amp || counts.pcr !== last.pcr;
    if (changed && (!frontInFlight || snapNext)) {
      reconcile(f);
      last = counts;
      pcrPeak = Math.max(pcrPeak, Math.min(PCR_SLOTS, counts.pcr));
    }

    /* CaMKK2 first: the pocket the calcium flies to depends on the hinge. */
    const camkkK = THREE.MathUtils.clamp(f?.camkk ?? REST.camkk, 0, 1);
    const openK = bound ? camkkK : 0;
    /* Eased only — no snap on a dt-0 frame: Pause hands in dt 0 too, and a
       snap there threw a half-open hinge to 70° on the pause frame (review,
       2026-09-06). A rebuilt or held frame draws whatever the ease has reached,
       which after a seek is closed. */
    hingeAngle += (openK * HINGE_OPEN - hingeAngle) * Math.min(1, dt * HINGE_RATE);
    /* The snap rides on top of the fraction's opening: +0.22 of the swing the
       frame an ion takes a SEAT (the owner's "last one or two Ca²⁺ entering
       the cleft" — not every landing: on the shipped run 5–9 particles land
       per rep and most find the seats full, which read as a 10 Hz twitch),
       decaying at SNAP_RATE. Updated here, before `open` is read, so the kick
       is drawn on the same frame as the swell and never during a Pause. */
    snap = Math.max(0, snap - snap * Math.min(1, dt * SNAP_RATE));
    if (seated > 0) snap = 1;
    const open = Math.min(1.25, hingeAngle / HINGE_OPEN + 0.22 * snap);
    /* The N-lobe rolls back 0.6 of the hinge (pass 3; was 0.35) and lifts;
       the fingers do the rest: from leaning in (tips meeting) to leaning out
       — the V. */
    hinge.rotation.z = -HINGE_OPEN * open * 0.6;
    lobeB.position.y = 0.05 + 0.04 * open;
    for (const { pivot, side } of arms) pivot.rotation.z = side * (ARM_REST - (ARM_REST + ARM_SPREAD) * open);
    cleft.scale.setScalar(Math.max(0.001, open));
    cleft.visible = open > 0.03;
    flash = Math.max(0, flash - flash * Math.min(1, dt * FLASH_RATE));
    if (bindings > 0) flash = 1;
    const swell = 1 + 0.12 * flash;
    lobeA.scale.setScalar(swell);
    lobeB.scale.setScalar(swell);
    lobeMat.emissiveIntensity = 0.45 * open + 1.3 * flash;
    lobeMat.color.copy(LOBE_REST).lerp(LOBE_LIT, 0.7 * open);
    armMat.emissiveIntensity = 0.6 * open + 1.3 * flash;
    armMat.color.copy(LOBE_REST).lerp(LOBE_LIT, 0.85 * open);

    drawTokens(dt, wallDt);
    drawPi(Math.max(0, Math.min(PI_MAX, Math.round(f?.freePi ?? REST.freePi))));
    drawCalcium(Math.round(f?.ca ?? REST.ca), dt);
    if (bindings > 0) flash = 1;

    const coupled = f?.coupled ?? REST.coupled;
    drawRoute(coupled, bindings, dt);

    /* THE READING IS THE MOLECULE AND ITS COLLAR. `response` is the raw
       pAMPK_fraction with its floor subtracted and its span normalised
       (`energyBinding.js`) — the only form of it a viewer can see. */
    const response = THREE.MathUtils.clamp(f?.response ?? REST.response, 0, 1);
    ampkResponse = response;
    ampkMat.color.copy(AMPK_REST).lerp(AMPK_LIT, response);
    ampkMat.emissiveIntensity = 0.55 * response;
    /* 6 % swell, a 5° turn, and the cleft hinging open on the morph. */
    live.scale.setScalar(1 + AMPK_SWELL * response);
    live.rotation.z = THREE.MathUtils.degToRad(5) * response;
    liveBody.morphTargetInfluences[0] = response;
    /* The collar: lit, thicker and turning with the level; breathing gently at
       rest so the molecule is never a still object. */
    collarMat.opacity = (0.05 + 0.6 * response) * weight.ampk;
    collarMat.emissiveIntensity = 0.1 + 1.2 * response;
    /* The arcs breathe outward with the level, and do not turn — an arc that
       orbits the molecule is a satellite, not a mark on it. */
    const breathe = 1 + (0.02 + 0.04 * response) * Math.sin(phase * 1.9);
    collar.scale.setScalar((1 + 0.12 * response) * breathe);
    haloMat.opacity = 0.65 * response * weight.ampk;
    halo.scale.setScalar(R * (3.6 + 1.6 * response) * (1 + 0.03 * Math.sin(phase * 1.3)));
    const refK = f?.responseNormal;
    ghost.visible = !coupled && Number.isFinite(refK) && weight.ampk > 0.5;
    if (ghost.visible) {
      const g = THREE.MathUtils.clamp(refK, 0, 1);
      ghost.scale.setScalar(1 + AMPK_SWELL * g);
      ghost.rotation.z = THREE.MathUtils.degToRad(5) * g;
      ghostBody.morphTargetInfluences[0] = g;
      ghostRim.morphTargetInfluences[0] = g;
      /* Scaled by the part's weight like the live collar and halo, so on
         the way back from a spotlight the counterfactual is never brighter
         than the actual molecule (review). */
      ghostMat.opacity = 0.06 * weight.ampk;
      ghostRimMat.opacity = (0.2 + 0.45 * g) * weight.ampk;
      ghostCollarMat.opacity = (0.1 + 0.6 * g) * weight.ampk;
      ghostCollarMat.emissiveIntensity = 0.1 + 0.9 * g;
      ghostCollar.scale.setScalar(1 + 0.12 * g);
    }

    driftMotes();
  }

  /* The first frame is the resting picture, snapped: every token in its pool
     before anything is drawn, the reserve full, nothing in flight. */
  for (let p = 0; p < REST.pcr; p += 1) pcrHas[p] = true;
  for (let i = 0; i < POOL; i += 1) {
    restate(i, i < REST.atp ? 3 : i < REST.atp + REST.adp ? 2 : 1, true);
  }
  last = { atp: REST.atp, adp: REST.adp, amp: REST.amp, pcr: REST.pcr };
  pcrPeak = REST.pcr;
  update(null);

  const anchors = ANCHORS.map(({ id, label }) => ({ id, label, at: [...AT[id]] }));

  /** Read-only, for the gate: what the picture currently states. */
  function debug() {
    const t = { 3: 0, 2: 0, 1: 0 };
    for (const tk of tokens) t[tk.beads] += 1;
    return {
      tokens: t,
      pcr: pcrCount(),
      flights: flights.length,
      ca: caLive.length,
      caBound: caBound.length,
      packets: packetAge.length,
      routeCut: cut.visible,
      ampkResponse,
      ampkEmissive: ampkMat.emissiveIntensity,
      ampkScale: Math.max(live.scale.x, live.scale.y, live.scale.z),
      ampkOpen: liveBody.morphTargetInfluences[0],
      ghostAt: ghost.position.toArray(),
      ghostRimOpacity: ghostRimMat.opacity,
      rodDepths: BANDS.map((b) => b.z),
      hinge: hingeAngle,
      snap,
      collarOpacity: collarMat.opacity,
      /* The nearest mote to the camera, so a test can hold that the dust never
         stands in front of the pools (brief §3). */
      moteMaxZ: MOTE_NEAR,
      /* The fibre's furniture, by role, so a test can hold that the room is
         furnished and that none of it is hit-testable. */
      furniture: group.children.reduce((n, o) => n + /^cell-(myofibril|mitochondrion|nucleus)$/.test(o.userData.role ?? ""), 0),
      poolMinZ: Math.min(AT.atp[2], AT.adp[2], AT.amp[2], AT.pcr[2], AT.pi[2]),
      dimmed,
      ampkOpacity: ampkMat.opacity,
      spotlight: spotlightId,
      weights: { ...weight },
      motes: MOTES,
      phase,
      pulses: pulses.length,
      echoes: echoes.length,
    };
  }

  /** The opener's one ambient cue: a bow that leaves the membrane and fades on
      the viewer's clock. Idempotent while one is in flight. */
  function echo() {
    if (!echoes.length) echoes.push({ age: 0 });
  }

  /** The selection mark of this floor: `id` keeps its material, the rest
      recede into the paper; `null` restores everything. */
  function spotlight(id) {
    spotlightId = id && PART_IDS.includes(id) ? id : null;
  }

  /** A seek is a new picture: nothing mid-flight belongs to the instant left. */
  function reset() {
    flights.length = 0;
    caLive.length = 0;
    caBound.length = 0;
    packetAge.length = 0;
    pulses.length = 0;
    echoes.length = 0;
    demandWas = 0;
    pending = 0;
    packetClock = 0;
    flash = 0;
    snap = 0;
    bindings = 0;
    seated = 0;
    bound = false;
    snapNext = true;
    /* And the seeds: two seeks to the same instant draw the same calcium
       stream and the same Pi slots, so a still can be diffed against a still. */
    caSeed = 0;
    piCursor = 0;
    /* And the lobes snap shut: an eased close over the next frames would be a
       sensor letting go of calcium that is no longer in the picture. */
    hingeAngle = 0;
  }

  return {
    group,
    anchors,
    update,
    reset,
    spotlight,
    echo,
    hit,
    debug,
    dispose: () => {
      /* `disposeTree` frees geometries and materials; a material does not free
         its map and an InstancedMesh's instance buffers go only through its own
         dispose (review, 2026-09-06 — this level is also built by the fibre's
         coin, so it leaked per visit on two floors). */
      haloTex.dispose();
      group.traverse((o) => o.isInstancedMesh && o.dispose());
      disposeTree(group);
      disposeTree(hit);
    },
  };
}
