/**
 * The signalling scale: two doors, one trunk, one room.
 *
 * THE SHAPE IS THE ARGUMENT, AND IT IS A Y. Resistance and endurance enter at
 * the top through different doors, each opens a column of nodes the other never
 * touches, both columns feed one trunk of nodes they share, and the trunk
 * arrives at twelve outputs where the two arms land on top of each other. The
 * geometry says that before anything animates; the clock then walks it, layer by
 * layer, over the model's own forty-five minutes.
 *
 * HEIGHT IS THE ONLY DATA CHANNEL. A node's mark sits at its activity, and both
 * arms are drawn at the same x — so two arms that agree are drawn in ONE PLACE
 * and two that differ are visibly apart, with no threshold anywhere in the
 * drawing. Nothing here encodes a number as size, brightness or opacity: this
 * scene is a hundred marks that have to be compared to each other, and any
 * second channel would be a second, weaker way of saying the same thing.
 *
 * THE LIT DOORS ARE NOT AN EXCEPTION TO THAT, and the distinction is worth
 * holding: hue and opacity on the ENTRY LINES carry no quantity. An edge is
 * lit or it is not, and which it is depends only on whether its source is the
 * input this arm holds at 1. Structure may be told apart; a number may not be
 * drawn twice.
 *
 * ALL THREE ARMS SIT AT THE SAME Z. The cell scale separates its two arms in
 * depth and pays for it — a perspective camera shrinks the far arm, so any
 * channel where size is data needs the depth ratio divided back out. There is no
 * depth here to divide out. The arms are told apart by hue and by mark, not by
 * distance from the camera.
 *
 * THE CONTROL IS A DIFFERENT MARK, NOT A FAINTER ONE. `fowler_rest` is the same
 * network from the same baseline with neither input on, and it does not move —
 * drift 0.0000 across every node, all run. It is drawn as a flat tick under each
 * node's pair of spheres. Faintness was available and is forbidden: opacity is
 * how uncertainty is drawn, the cell scale shipped a faded copy and a reader who
 * had never seen the model read it as a band on sight (cellGeometry.js:66).
 *
 * `update(drawn)` takes the object out of signallingBinding.js and nothing else.
 * No clock, no React, no fetch. signallingGeometry.test.js reads the picture back
 * off these meshes and requires a change in any published series to move it.
 */

import * as THREE from "three";

import { PALETTE, SURFACE, anatomyMaterial, sheathMaterial } from "../anatomyStyle.js";
import { disposeTree } from "../fiber/fiberGeometry.js";

/**
 * The five bands, top to bottom, in the order the signal walks them.
 *
 * `x` is the band's centre and `half` its half-width; `y` is the floor an
 * activity of 0 sits on and `span` the height an activity of 1 reaches. The
 * spans are equal everywhere, because a node's height is comparable across bands
 * only if the axis is the same axis — a band with its own scale would be the
 * per-track normalisation the cell panel had to print its bounds to undo.
 *
 * The two split columns are pushed out to ±0.62 and the trunk is centred and
 * wide: that is the Y, and it is legible before the first frame is drawn.
 */
/* EXPORTED FOR THE GUIDED PASS AND FOR NOTHING ELSE TO WRITE TO. `signallingTour.js`
   frames each of its beats on a band — `BANDS[band].y + SPAN / 2` is the middle of
   that band's marks — so a band moved here moves the shot with it instead of
   leaving four numbers in a storyboard that were right on the day they were typed.
   Frozen already; nothing outside this file may place a mark. */
export const SPAN = 0.3;
export const BANDS = Object.freeze({
  /* THE FIVE BANDS ARE A CELL NOW, TOP TO BOTTOM, and the owner's instruction is
     the whole of the reason: "그 3d element 자체를 바꾸라고 더 실제로 내부답게".
     They used to be `inputs / resistanceOnly / enduranceOnly / shared / outputs`
     — which arm moved a node. That is a real grouping and it is an ANALYSIS, not
     a place: it gave a visitor who had just walked through a drawn muscle cell
     one scale up a bar chart with no inside to be inside of.
     These are the compartments a signalling cascade actually runs through, and
     the assignment is the authors' own `type` column rather than ours (see
     `signallingBinding.js` on `types`, and §5 — this model has no geometry, so
     any placement WE decided would be invented anatomy).
     THE COMPARISON DID NOT GO, IT TURNED NINETY DEGREES. Which arm moved a node
     is x inside its compartment now: resistance's own on the left, endurance's
     own on the right, the ones both reach in the middle. So the picture answers
     both questions at once — how deep into the cell a thing sits, and which
     workout put it there — where before it could only answer the second. */
  /* THE FIVE FLOORS ARE SOLVED, NOT CHOSEN. Evenly spaced by 0.445, which is
     the widest even gap that keeps three things true at all four aspects the
     contract checks: the topmost mark inside |ndc.y| 0.94, the membrane plate
     inside 0.86, and the outcome plate clear of the subtitle's top edge at
     -0.538 (measured in a browser, not guessed). Wider and the destination goes
     under the sentence; narrower and the cell is squatter than it needs to be.
     The gap exceeds SPAN, so no band's marks can reach the floor above it. */
  /* Outside the cell: the exercise itself and the ligands it releases. */
  outside: { x: 0, half: 0.5, y: 1.105 },
  /* The membrane. Eight receptors, and this is where the two doors are. */
  membrane: { x: 0, half: 0.95, y: 0.66 },
  /* The cytosol — second messengers and the kinase cascades, the crowd. */
  cytosol: { x: 0, half: 1.45, y: 0.215 },
  /* Inside the nucleus: transcription factors and the genes they read. */
  nucleus: { x: 0, half: 1.05, y: -0.23 },
  /* What the cell ends up doing. Outside the nucleus again, and the end. */
  outcome: { x: 0, half: 0.95, y: -0.675 },
});

/**
 * The authors' `type` -> where that thing is in a cell.
 *
 * EVERY TYPE THE ARCHIVE SHIPS IS NAMED HERE, and one that is not falls to the
 * cytosol — the compartment that means "in the cell, unplaced" — rather than
 * disappearing from the picture. `signallingClaims.test.js` reads the shipped
 * bytes and fails if a type reaches this table without a home, so the fallback
 * is a safety net and not a shrug.
 *
 * `input` is the exercise, which is not a molecule and is not in the cell;
 * `ligand` is what it releases, outside the membrane the receptors sit in.
 * `gene` sits with the transcription factors because that is where DNA is.
 */
export const COMPARTMENT_OF = Object.freeze({
  input: "outside",
  ligand: "outside",
  receptor: "membrane",
  "second messenger": "cytosol",
  protein: "cytosol",
  "transcription factor": "nucleus",
  gene: "nucleus",
  phenotype: "outcome",
});
export const UNPLACED_COMPARTMENT = "cytosol";

/** Warm is resistance, cool is endurance, slate is the control that did nothing. */
const RESISTANCE_TINT = PALETTE.myosin;
const ENDURANCE_TINT = PALETTE.calcium;
/** The same slate the cell scale draws its control in, so the two scales agree. */
const CONTROL_TINT = "#6f6a63";   // --arm-control in cell.css; one slate, both scales (cellClaims.test.js ties them)

/**
 * 0.026 -> 0.018 on 2026-08-30, with the shared band's widening above.
 *
 * The two together are what clear the smear: widening alone leaves the band 16 %
 * overlapped and shrinking alone cannot reach — 58 marks need a half of 1.85 at
 * the old radius, and the frame stops at 1.41. At 0.018 every band clears its
 * own neighbours with air to spare, measured rather than eyeballed:
 * inputs 0.68 apart, endurance-only 0.063, resistance-only 0.043, outputs 0.131,
 * shared 0.042 — against a mark 0.036 across.
 *
 * IT MAKES THE PICTURE MORE HONEST, NOT LESS, and that is the half worth
 * checking. `ARMS_FUSE_BELOW` below is derived from this and falls with it, from
 * 0.173 to 0.12: two arms whose activities differ by 0.12 now draw as two marks
 * where they used to draw as one. The threshold the panel calls "different" is
 * 0.05, so the gap between "counted apart" and "seen apart" narrows by a third.
 * Nothing about the claim changes — it is still derived, still never typed, and
 * the paragraph below still says what it means.
 */
const MARK_R = 0.018;

/** A stalk, not a bar — a fifth of a mark's diameter. */
const STEM_W = 0.004;

/**
 * How far apart two arms' activities have to be before their MARKS stop
 * overlapping. Derived from the two constants above, never typed.
 *
 * A node's height is `k * SPAN`, so an activity gap of `d` is drawn `d * SPAN`
 * apart, and two spheres of radius MARK_R separate at `2 * MARK_R`. That is
 * 0.12 of a [0,1] activity — 2.4x the SEPARATION the panel calls "different"
 * (it was 0.173 and 3.5x until MARK_R came down on 2026-08-30).
 * Every node this screen counts as separated at 0.05 is drawn as one mark, and
 * at the run's first instant all 97 pairs are (measured on the canvas: 112 warm
 * pixels against 37,870 cool, which is antialiasing).
 *
 * THAT MEASUREMENT WAS TAKEN AT THE ONE INSTANT IT COULD BE. t = 0 is the single
 * sample of sixty-four where the two arms are bit-identical, and it is therefore
 * the only frame with no depth tie between them. At every other instant the two
 * spheres fought for the same pixels and drew a hard seam at their midpoint —
 * full contrast at a gap of 0.0002, which is a threshold in a drawing whose
 * whole claim is that it has none. `ARM_Z` is the fix and the paragraph beside
 * `write` carries it: the arms are stacked in depth, so the one behind shows a
 * crescent whose width is the gap, and a gap of zero shows nothing at all.
 *
 * NOT A LICENCE TO SPREAD THE MARKS. Offsetting the two arms by a fixed distance
 * manufactures a separation the model does not have, and fattening one under the
 * other is a halo, which is a band — both are the cell scale's range idiom
 * redrawn in a third place. The picture stays honest and the panel says what the
 * picture cannot show, which is what `coincident()` does one scale up.
 */
export const ARMS_FUSE_BELOW = (2 * MARK_R) / SPAN;

/**
 * How much of the picture is one mark wearing two colours, at one instant.
 *
 * ONE IMPLEMENTATION, TWO ROOTS. The panel and the canvas commit in different
 * React roots and cannot share a prop, and `signallingBinding.js` cannot own
 * this because the threshold is geometry's — `ARMS_FUSE_BELOW` is `2 * MARK_R`
 * over `SPAN`, which is a fact about how wide a mark is drawn, not about the
 * model. A pure function of the same `bands` object is the thing that cannot
 * disagree with itself: `SignallingReadout` had its own copy of this loop until
 * 2026-08-26, and the stage's standing note would have been a third.
 */
export function fusedMarks(bands) {
  let fused = 0;
  let drawn = 0;
  for (const band of Object.values(bands ?? {})) {
    for (let i = 0; i < band.r.length; i += 1) {
      drawn += 1;
      if (Math.abs(band.r[i] - band.e[i]) < ARMS_FUSE_BELOW) fused += 1;
    }
  }
  return { fused, drawn };
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _stem = new THREE.Vector3(1, 1, 1);
const _sp = new THREE.Vector3();

function tag(object, role, label) {
  object.userData.role = role;
  if (label) object.userData.fiberLabel = label;
  return object;
}

/**
 * Where each drawn node sits sideways.
 *
 * Spread evenly across its band, so a band's width is its population and a
 * viewer can see that the trunk is most of the network without being told. A
 * band of one would divide by zero, so it sits at its own centre.
 */
/**
 * The order slots are built in, and it is NOT the order they are drawn in.
 *
 * `drawnAt` hands every frame as `bands.{inputs,resistanceOnly,...}` — the arm
 * buckets, which are what `signallingBinding.js` measures — and `laneOf` below
 * flattens those into one run that has to line up index-for-index with `slots`.
 * So this list is the shared spine of that agreement and both ends read it.
 * `BANDS` is now the cell's compartments and says nothing about this order.
 */
const ROUTE_BANDS = Object.freeze(["inputs", "resistanceOnly", "enduranceOnly", "shared", "outputs"]);

/* PROTOTYPE 2026-08-31 — the air between the three columns. */
const COLUMN_GAP = 0.16;

/**
 * Where every drawn node sits: y from the compartment it is in, x from the
 * workout that moves it.
 *
 * TWO QUESTIONS, TWO AXES, AND NEITHER IS THE DATA CHANNEL. Depth into the cell
 * is the authors' `type` (see `COMPARTMENT_OF`); side is which arm the routes
 * measured it under, resistance to the left and endurance to the right, with
 * everything both reach down the middle. Height above the compartment's floor is
 * still activity and still the only thing that moves.
 *
 * THE TWO INPUTS TAKE THE SIDE OF THEIR OWN DOOR, read off `routes.doors` rather
 * than assumed from the order they ship in — the same rule
 * `signallingBinding.js` states for which input an arm enters at.
 */
function slotsFor(routes) {
  const side = new Map();
  for (const id of routes.resistanceOnly ?? []) side.set(id, -1);
  for (const id of routes.enduranceOnly ?? []) side.set(id, 1);
  if (routes.doors?.resistance?.input) side.set(routes.doors.resistance.input, -1);
  if (routes.doors?.endurance?.input) side.set(routes.doors.endurance.input, 1);

  // Built in ROUTE_BANDS order so `laneOf` lines up, then placed by compartment.
  const built = [];
  for (const band of ROUTE_BANDS) {
    for (const id of routes[band] ?? []) {
      const compartment = COMPARTMENT_OF[routes.types?.[id]] ?? UNPLACED_COMPARTMENT;
      /* `pathway` rides on the slot because `columnsFor` groups by it. Blank
         when the archive ships it blank, which is every mark in the nucleus and
         the outcome — see `signallingBinding.js` on why that is a fact about the
         cascades and not a gap in the data. */
      built.push({
        id,
        band,
        compartment,
        side: side.get(id) ?? 0,
        pathway: routes.pathways?.[id] ?? "",
      });
    }
  }

  const byCompartment = new Map();
  for (const slot of built) {
    if (!byCompartment.has(slot.compartment)) byCompartment.set(slot.compartment, []);
    byCompartment.get(slot.compartment).push(slot);
  }
  for (const [compartment, members] of byCompartment) {
    const { x, half, y } = BANDS[compartment];
    /* Alphabetical inside a column, so the order announces it is not a number —
       except the two inputs, which are pinned to their own column's OUTER end so
       the lit fan leaves the edge of the picture and the "enters here" plate,
       which reads its x off this slot, lands on the door it names. */
    const key = (m, s) => (m.band === "inputs" ? (s < 0 ? "\u0000" : "\uffff") : m.id);
    const cols = columnsFor(members, key);
    const present = cols.filter((c) => c.length).length;
    const usable = 2 * half - COLUMN_GAP * (present - 1);
    let cursor = x - half;
    let index = 0;
    for (const col of cols) {
      if (!col.length) continue;
      const w = (usable * col.length) / members.length;
      col.forEach((slot, i) => {
        slot.x = col.length > 1 ? cursor + (i / (col.length - 1)) * w : cursor + w / 2;
        slot.y = y;
        /* WHICH COLUMN THIS LANDED IN, WRITTEN BY THE THING THAT DECIDED IT.
           The activity-zero rule under each column is drawn from these, and it
           used to re-derive the grouping from `side` — which was the same fact
           until `columnsFor` started grouping by cascade, and then was not.
           Measured 2026-08-31: nine cascades in the cytosol, three rules, each
           one stretching across the gaps between them and gluing the nine back
           into a single row. The picture had the structure and the floor line
           painted over it. Two opinions about one grouping, so now there is
           one. */
        slot.column = index;
      });
      cursor += w + COLUMN_GAP;
      index += 1;
    }
  }
  return built;
}

/**
 * How one compartment's marks are grouped into columns.
 *
 * WHY THIS STOPPED BEING "WHICH ARM MOVED IT" — canon S1, and the owner's word
 * for it was *"아예 overhaul"*.
 *
 * Three columns — resistance's own, both, endurance's own — is a true grouping
 * and it names nothing. Screenshotted 2026-08-31 at 1280x900, the cytosol was
 * fifty-one marks spread along a gradient a visitor cannot read off the picture,
 * and the whole scale was, in the owner's words, *"막대에 공이 달린 마크가 100개
 * 넘게 흩어져"*. A position on an unlabelled continuum is not a thing you can
 * point at, and G1 is *"유저가 '이게 무엇인지' 보여야 한다"*.
 *
 * THE ARCHIVE ALREADY SHIPS THE GROUPING. Every node carries the authors'
 * `pathway`: MAPK, Calcium, PI3K/Akt, Smad, STARS, Hippo, cAMP/PKA/AMPK,
 * Integrin, NFkB. Nine named cascades, and counted from the shipped bytes they
 * live entirely in `outside`, `membrane` and `cytosol` — every one of the 57
 * blank cells is a transcription factor, a gene, a phenotype or an input. The
 * blanks are where the cascades arrive, which is why the column is empty there.
 *
 * So the crowd becomes nine things with names, and the nucleus and the outcome —
 * which have no pathway to group by — keep exactly the arrangement they had.
 * That is the shape of the sentence this scale exists to say: different doors,
 * different cascades, one room.
 *
 * AND THE OLD AXIS SURVIVES AS THE ORDER. Columns are laid left to right by how
 * far each cascade leans to resistance or to endurance, so the picture still
 * reads resistance-side on the left and endurance-side on the right — it just
 * has names on it now. The lean is OUR arithmetic over the archive's own
 * buckets, which is what `routes.resistanceOnly` already was; it decides where a
 * column sits and it is not drawn as a quantity.
 */
function columnsFor(members, key) {
  const named = [...new Set(members.map((m) => m.pathway).filter(Boolean))];
  /* Fewer than two cascades here means there is nothing to separate — the
     nucleus (43 marks, no pathway) and the outcome (12, none) take this branch
     and are laid out exactly as before. */
  if (named.length < 2) {
    return [-1, 0, 1].map((s) =>
      members.filter((m) => m.side === s).sort((a, b) => key(a, s).localeCompare(key(b, s))),
    );
  }
  const lean = (p) => {
    const own = members.filter((m) => m.pathway === p);
    return own.reduce((sum, m) => sum + m.side, 0) / own.length;
  };
  const order = named.sort((a, b) => lean(a) - lean(b) || a.localeCompare(b));
  /* Anything in this compartment with no pathway of its own goes down the
     middle, where "no cascade named" and "reached by both" have always sat. */
  const loose = members.filter((m) => !m.pathway);
  const cols = order.map((p) => members.filter((m) => m.pathway === p).sort((a, b) => key(a, 0).localeCompare(key(b, 0))));
  if (!loose.length) return cols;
  const mid = Math.ceil(cols.length / 2);
  return [...cols.slice(0, mid), loose.sort((a, b) => key(a, 0).localeCompare(key(b, 0))), ...cols.slice(mid)];
}

/**
 * The wiring, drawn once at the floor of each node's band.
 *
 * AT THE FLOOR, NOT AT THE MARKS. Height is this scene's only data channel, and
 * a line strung between two marks would move with them — a second drawing of the
 * same numbers, in a channel that already carries them, and one that would have
 * to pick an arm to follow. The wiring is a property of the network rather than
 * of a run: it is the same under resistance, under endurance and at rest. So it
 * sits under the marks and never updates, and what moves above it is the result.
 *
 * `[source, target, sign]` from the export, sign -1 for the model's `!`. Only
 * edges whose BOTH ends are drawn are drawn: 24 of the 121 nodes are below the
 * separation threshold and have no slot, and a line running to a node that is
 * not on screen would point at nothing.
 *
 * One buffer, one draw call, no per-frame work.
 */
/**
 * HOW HARD THE EDGES BOW TOWARD THE AXIS, and why they bow at all.
 *
 * 207 of the network's edges reach the scene and they were drawn as straight
 * lines between their two ends. Counted 2026-08-30 on the shipped layout: 2,059
 * pairs of them cross. That is not a diagram, it is a hairball, and it is the
 * literal content of the owner's "뭐가 뭔지 잘 안보여" — the picture's densest
 * ink was 207 diagonals going everywhere at once.
 *
 * Reordering the nodes inside each band by the standard barycentre sweep was
 * tried first and measured: 1,435 crossings, 30 % fewer, still a hairball. The
 * ordering is also the archive's own `by_measured_separation`, so it would have
 * cost a real property for a change nobody would see.
 *
 * Bundling is the move that works, and it happens to be the thing the picture is
 * already saying out loud: the conduits draw the flow through the middle and the
 * pass's line is "Both pour into the same middle". Pulling each between-band
 * edge's control point toward x = 0 turns a uniform scatter of diagonals into a
 * spine with a fan at each end — the same edges, in the same places, taking the
 * route the diagram already claims they take.
 *
 * IT IS LAYOUT, WHICH IS OURS AND SAYS SO. No edge is added, removed or
 * re-pointed; the two ENDS of every line are exactly where they were, which is
 * what a reader traces. What changed is the path between them, and this scene
 * has never claimed a path — the export ships no rate of propagation and
 * `signallingTour.js` refuses to draw one.
 */
const BUNDLE = 0.85;
/** Sampling of the bow. Eight is where the curve stops looking polygonal at the
 *  widest span this layout draws; more is more segments in the same buffer. */
export const BUNDLE_STEPS = 8;

/**
 * The path an edge takes, as points. ONE definition, because the faint layer and
 * the lit layer draw the same edges and a lit line that did not lie on top of
 * its own faint line would read as a second, different edge.
 *
 * Two ends on one floor come back as those two points: a within-band edge runs
 * ALONG the axis it belongs to, and bowing it would lift it off.
 */
function bow(ax, ay, bx, by) {
  if (ay === by) return [[ax, ay], [bx, by]];
  const cx = ((ax + bx) / 2) * (1 - BUNDLE);
  const cy = (ay + by) / 2;
  const out = [[ax, ay]];
  for (let i = 1; i <= BUNDLE_STEPS; i += 1) {
    const t = i / BUNDLE_STEPS;
    const u = 1 - t;
    out.push([u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by]);
  }
  return out;
}

function wiring(edges, slots, { colour = PALETTE.perimysium, opacity = 0.11, renderOrder = -2 } = {}) {
  const at = new Map(slots.map((s, i) => [s.id, i]));
  const points = [];
  let inhibiting = 0;
  let drawnEdges = 0;
  for (const [source, target, sign] of edges ?? []) {
    const a = at.get(source);
    const b = at.get(target);
    if (a === undefined || b === undefined || a === b) continue;
    /* Sampled into segments rather than drawn as curve objects: `LineSegments`
       stays one buffer and one draw call for the whole network. */
    const path = bow(slots[a].x, slots[a].y, slots[b].x, slots[b].y);
    for (let i = 1; i < path.length; i += 1) {
      points.push(path[i - 1][0], path[i - 1][1], 0, path[i][0], path[i][1], 0);
    }
    if (sign < 0) inhibiting += 1;
    drawnEdges += 1;
  }
  if (!points.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  /* Quieter than the lit doors over it, which is the only weight ordering left
     now that the conduits have gone (2026-08-30) — this layer IS the shape of
     the argument since the bundling, rather than the thing that competed with
     it. It answers "is this actually a network", and it has to be legible
     without drowning the marks whose height is the result.
     0.13 -> 0.20 on 2026-08-30, and the word that moved is LEGIBLE. Looked at
     rather than reasoned about: on a 1280x800 shot of the opening beat the web
     is the thing this scale is named for — the depth table's own words are "the
     signal spreading through a web" — and at 0.13 over #faf8f5 paper it read as
     paper. The ordering it was set to protect is untouched and still asserted:
     lit doors 0.55 > conduits 0.22 > this. It is the bottom of that stack, one
     step less invisible. */
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(colour),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.LineSegments(geometry, material);
  mesh.renderOrder = renderOrder;
  /* EDGES, NOT SEGMENTS. Each between-band edge is now sampled into
     `BUNDLE_STEPS` segments, so `points.length / 6` counts line pieces and the
     tests that ask "how many of the network's edges reached the scene" would
     read eight times the truth. Counted where it is known instead. */
  mesh.userData.drawn = drawnEdges;
  mesh.userData.inhibiting = inhibiting;
  return mesh;
}

/** A cascade's anchor id, from the authors' own name for it. */
export const cascadeId = (pathway) => `cascade-${pathway.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}`;

/**
 * One anchor per named cascade in the cytosol.
 *
 * WHY THE CYTOSOL AND NOT EVERY COMPARTMENT. A cascade is a column, and it is
 * only a column where the compartment has more than one — the cytosol holds all
 * nine, the membrane holds one receptor each from six of them, and outside holds
 * a ligand or two. Ringing a single mark and calling it a cascade would be
 * naming a node after the road it is on.
 *
 * WHY THESE HAVE NO STANDING PLATE. Nine names on a scale measured at exactly
 * 200 of its 200 words is not a trade this project makes; `gate-word-budget`
 * exists for it, and §9's default is empty. So a cascade is a ring you can press
 * and the name arrives with the press — canon D2ⓐ, *"조작기가 먼저 → 방문자가
 * 뭔가를 하고 → 결과가 그림에서 보이고 → 글은 그 뒤에 짧게"*, and state 4's own
 * *"each elements clickable"*. Before this the crowd was grouped and anonymous:
 * nine visible clumps that a visitor could see were separate and could not find
 * out the names of.
 *
 * THE NAME IS THE AUTHORS' AND IS NOT EDITED. `signallingBinding.js` trims it and
 * nothing else, for the reason it states about `names`.
 *
 * The ring sits at its column's centre, on the activity-zero rule the column's
 * own marks are raised from — the line that IS the group, drawn per column since
 * the same day. The plate hangs above the tallest height a mark can reach, so an
 * open cascade's name never lands on its own readings.
 */
function cascadeAnchors(slots) {
  const here = slots.filter((s) => s.compartment === "cytosol" && s.pathway);
  const byColumn = new Map();
  for (const slot of here) {
    if (!byColumn.has(slot.column)) byColumn.set(slot.column, []);
    byColumn.get(slot.column).push(slot);
  }
  return [...byColumn.values()].map((col) => {
    const xs = col.map((c) => c.x);
    return {
      id: cascadeId(col[0].pathway),
      label: col[0].pathway,
      cascade: true,
      /* THE RING IS ON ITS COLUMN. The plate is NOT, and this file says why in
         capitals two hundred lines up: ndc.y is independent of aspect and ndc.x
         is inversely proportional to it, so anchors are placed by y and stacked
         near x = 0 — five cell-scale callouts were once computed, carried,
         rendered and off the canvas because they were spread sideways at the one
         window they were fitted in. The first version of this put each cascade's
         name over its own column and `every callout lands inside the canvas`
         went red at the narrow aspects, exactly as written.
         Nothing is lost: only one cascade is ever open, its ring is the accent
         while it is, and where the name belongs is answerable by looking at
         which ring is lit. This is the same split the scale already draws
         between `focusAt` and `sayAt` — the light points, the words stand
         still. */
      /* IN THE COLUMN, NOT ON THE FLOOR UNDER IT. On the floor the ring shared a
         hit target with the colour-key rings that sit just below the cytosol:
         measured 2026-08-31 at 1280x900, `cascade-calcium` at (332, 387) against
         `split-resistance` at (342, 428), and `cascade-mapk` at (918, 387)
         against `split-endurance` at (938, 428) — 10 px and 20 px apart with
         44 px targets, which is the "two rings, one target" defect
         `fiberGeometry.js` recorded the first time. Raised to the middle of the
         column's own height, where the thing it rings is. */
      at: [(Math.min(...xs) + Math.max(...xs)) / 2, BANDS.cytosol.y + SPAN * 0.55, 0],
      plateAt: [0, BANDS.cytosol.y + SPAN + 0.08, 0],
    };
  });
}

/**
 * The same edges again, lit, with a body.
 *
 * A `LineBasicMaterial` line is one DEVICE pixel wide however far away it is —
 * `linewidth` has never been implemented on the platforms this ships to — so a
 * line is the one thing on this scale that a camera cannot approach. Measured
 * 2026-08-26, held, between the wide framing and the doors framing: the marks'
 * median horizontal run went 10 px to 16 px, and the fan's modal run stayed 2 px
 * at both. The doors beat exists to push in on these edges, and they were
 * exactly what the push did not reach.
 *
 * ONE CONSTANT RADIUS FOR ALL OF THEM. What the layer above refuses is a
 * thickness that VARIES — height is this scene's only data channel and nothing
 * else may come to look like a quantity. A single radius shared by every lit
 * edge is the same kind of number as `MARK_R` for all 97 marks and 0.016 for all
 * five conduits: it says "this is that kind of thing" and it counts nothing. It
 * does not move either, for the reason the fan was never given a pulse — this
 * export ships no rate of propagation, and `gate-no-strobe` exists.
 *
 * Ends at the band floors, like the faint layer under it and for its reason:
 * a line strung between two marks would follow them, which is the same numbers
 * drawn twice in a channel that already carries them.
 */
/* 0.0035, not the 0.005 this shipped at. The sweep round measured what giving
   these a body cost: nine of them leave one node, so near that node they
   overlap whatever their width — and doubling the half-width doubled the length
   over which adjacent edges fuse into one stroke. Counted off the doors framing
   across 220 rows of the fan, separable strokes went 2039 as hairlines to 1715
   at 0.005. At 0.0035 they come back to 1803, and the median stroke still
   answers the camera: 3 px at the doors framing against 2 px wide, where a line
   primitive was 2 px at both. 0.0025 recovers nearly all of the separability
   (1944) and gives up the camera entirely — 2 px at both framings again, which
   is the defect this whole change exists to fix. */
const LIT_R = 0.0035;

function litFan(edges, slots, { colour, opacity = 0.55, renderOrder = -1 } = {}) {
  const at = new Map(slots.map((s, i) => [s.id, i]));
  const spans = [];
  let inhibiting = 0;
  let drawnEdges = 0;
  for (const [source, target, sign] of edges ?? []) {
    const a = at.get(source);
    const b = at.get(target);
    if (a === undefined || b === undefined || a === b) continue;
    /* THE SAME BOW THE FAINT LAYER TAKES, and it has to be: this draws the same
       edges a second time on top, so a straight lit line over a bowed faint one
       would read as two different edges between the same pair of nodes. One
       cylinder per sample of the path — 9 edges become 72 instances, which is
       nothing, and the alternative is a lit layer that contradicts the layer it
       is lighting. */
    const path = bow(slots[a].x, slots[a].y, slots[b].x, slots[b].y);
    for (let i = 1; i < path.length; i += 1) {
      spans.push([
        new THREE.Vector3(path[i - 1][0], path[i - 1][1], 0),
        new THREE.Vector3(path[i][0], path[i][1], 0),
      ]);
    }
    if (sign < 0) inhibiting += 1;
    drawnEdges += 1;
  }
  if (!spans.length) return null;

  /* Open ended and six sided: 12 triangles each, and nobody ever sees an end
     cap on a 0.005 tube. Built per call rather than shared at module scope
     because `dispose()` walks the model and a shared geometry would be freed
     out from under the next one. */
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
  const material = anatomyMaterial({
    colour,
    roughness: SURFACE.roughness,
    opacity,
    /* By name, not inherited: this is a layer you read the network through. */
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, spans.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  spans.forEach(([a, b], i) => {
    dir.subVectors(b, a);
    const length = dir.length() || 1e-6;
    q.setFromUnitVectors(UP, dir.divideScalar(length));
    mesh.setMatrixAt(i, m.compose(mid.addVectors(a, b).multiplyScalar(0.5), q, scale.set(LIT_R, length, LIT_R)));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.renderOrder = renderOrder;
  /* EDGES, NOT CYLINDERS. `spans` is sub-segments of the bow since 2026-08-30;
     the tests ask how many of the input's first steps were lit. */
  mesh.userData.drawn = drawnEdges;
  mesh.userData.inhibiting = inhibiting;
  return mesh;
}

export function buildSignallingLevel(routes, edges = null) {
  const group = new THREE.Group();
  group.name = "SignallingLevel";
  const slots = slotsFor(routes);

  /* ---- the Y, drawn once and never updated ----------------------------- */

  /* THE FIVE CONDUITS ARE GONE, 2026-08-30, and their own opening line is the
     reason: "the model's own edges are not shipped to the browser, so they are
     drawn as the routes MEASURED in signallingBinding.js and nothing finer."
     The edges shipped on 2026-08-22. These five tubes were a stand-in for a
     thing that did not exist yet, and once the edges were bundled they became a
     second, cruder drawing of the same claim — band feeds band — bowed the
     OTHER way, outward, while every real edge now sweeps inward. Two gestures
     contradicting each other on one canvas.
     Compared in a browser rather than argued: with them the picture carries five
     pale arcs that read as smudges across the two lit streams; without them the
     warm and cool flows flowing from the two doors are the clearest thing on the
     screen. Nothing they said is lost — the same five hand-offs are what the
     bundled web draws, from the archive's own edges rather than from five
     hand-placed control points.
     `conduit()` went with them; `sheathMaterial` stays, it is what the band
     floors are made of. */

  /* ---- the cell itself ---------------------------------------------------
   *
   * "그 3d element 자체를 바꾸라고 더 실제로 내부답게" — the owner, 2026-08-30,
   * looking at five rows of lollipops. The compartments above put every node
   * where a cell actually keeps it; this draws the cell around them, so a
   * visitor who has just walked through a drawn muscle cell one scale up arrives
   * somewhere that looks like the inside of one rather than at a chart of it.
   *
   * TWO REAL STRUCTURES AND THREE AXES, and the difference between those is the
   * point. The plasma membrane and the nuclear envelope are THINGS — a cell has
   * them, they have a shape, and both are drawn as what they are: a bilayer, two
   * leaflets with a gap. The other three lines are not things, they are the
   * activity-zero axis each compartment's marks are raised from, and they stay
   * hairlines so nobody reads an axis as an organelle.
   *
   * BOTH BILAYERS ARE DOUBLE BECAUSE BOTH ARE DOUBLE. The plasma membrane is a
   * lipid bilayer and the nuclear envelope is two membranes; drawing them as one
   * stroke each would have been a simplification nobody asked for and the
   * doubling costs one more instance.
   */
  const cellMat = sheathMaterial({ colour: PALETTE.perimysium, opacity: 0.55 });
  const axisMat = sheathMaterial({ colour: PALETTE.perimysium, opacity: 0.3 });

  /* A LEAFLET IS A TUBE ALONG A PATH, NOT A BAR, because both of these membranes
     curve and a straight box cannot. One `TubeGeometry` per leaflet: the plasma
     membrane's path sags away at both ends, the nuclear envelope's closes on
     itself with rounded corners. */
  /* 0.009, NOT 0.0055 — canon S1. At the thinner radius the plasma membrane read
     as an axis rule on a chart rather than as the edge of the thing a visitor is
     inside: screenshotted 2026-08-31 at 1280x900, two brown hairlines under a
     row of marks, indistinguishable from the band separators they are not. The
     nuclear envelope beside it reads correctly at the same radius because it
     ENCLOSES — a closed loop is a boundary whatever its weight, and an open
     curve has only its weight to say so with. Still a line and not a wall: at
     0.009 it is 1.6 px at the standing framing, which is a drawn stroke. */
  const leafletAlong = (points, radius = 0.009) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, -0.03)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 6, false), cellMat);
    mesh.renderOrder = -3;
    return mesh;
  };

  /* THE PLASMA MEMBRANE, WIDER THAN ANYTHING INSIDE IT AND FALLING AWAY AT BOTH
     ENDS. It runs past the widest compartment on both sides, because a boundary
     that stops where its contents stop reads as one more axis rather than as a
     boundary; and it curves down at the edges, because a cell is a closed thing
     and a viewer should be able to tell they are looking at the top of one from
     inside rather than at a line drawn over some dots. The sag is a fifth of the
     compartment gap — enough to read as curvature, not so much that the
     receptors sitting on it look like they are sliding off. */
  const cellHalf = BANDS.cytosol.half * 1.1;
  const membraneY = BANDS.membrane.y;
  const sag = 0.09;
  const arc = (dy) => [
    [-cellHalf, membraneY + dy - sag],
    [-cellHalf * 0.72, membraneY + dy - sag * 0.34],
    [0, membraneY + dy],
    [cellHalf * 0.72, membraneY + dy - sag * 0.34],
    [cellHalf, membraneY + dy - sag],
  ];
  group.add(tag(leafletAlong(arc(0.015)), "membrane-outer", "cell membrane"));
  group.add(tag(leafletAlong(arc(-0.015)), "membrane-inner", "cell membrane"));

  /* THE NUCLEAR ENVELOPE, WHICH HAS TO ENCLOSE AND NOT UNDERLINE — and which is
     round, because a nucleus is. The band's marks stand up to `SPAN` above their
     floor, so an envelope along that floor would leave every transcription factor
     outside the nucleus it is in. This is a closed rounded outline around the
     whole band, drawn twice a hair apart: the nuclear envelope is two membranes,
     which is the one place this drawing gets to be doubled and be right. */
  const roundedLoop = (halfW, lo, hi, r) => {
    const cy = (lo + hi) / 2;
    const halfH = (hi - lo) / 2;
    const pts = [];
    const N = 72;
    for (let i = 0; i <= N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      /* A superellipse: round at the corners, flat along the long sides, with one
         exponent instead of four arcs and two lines. n = 4 is the shape a nucleus
         drawn in a textbook has. */
      const c = Math.cos(a), s2 = Math.sin(a);
      const k = 4;
      pts.push([
        Math.sign(c) * Math.abs(c) ** (2 / k) * halfW,
        cy + Math.sign(s2) * Math.abs(s2) ** (2 / k) * halfH,
      ]);
    }
    return pts;
  };
  for (const d of [0, 0.018]) {
    group.add(
      tag(
        leafletAlong(
          roundedLoop(BANDS.nucleus.half * 1.04 + d, BANDS.nucleus.y - 0.06 - d, BANDS.nucleus.y + SPAN + 0.06 + d),
          0.005,
        ),
        `nuclear-envelope-${d}`,
        "nuclear envelope",
      ),
    );
  }

  /* AND THE AXIS EACH COMPARTMENT'S HEIGHTS ARE READ FROM. A node's height is
     `k * SPAN` above its compartment's y, so that y is activity zero — the line
     every mark is raised from, and it had never been drawn. The membrane's own
     floor is not drawn again here: its bilayer already sits there. */
  for (const [name, band] of Object.entries(BANDS)) {
    if (name === "membrane") continue;
    const here = slots.filter((sl) => sl.compartment === name);
    for (const index of [...new Set(here.map((sl) => sl.column))].sort((a, b) => a - b)) {
      const col = here.filter((sl) => sl.column === index);
      if (!col.length) continue;
      const lo = Math.min(...col.map((c) => c.x)) - MARK_R * 1.6;
      const hi = Math.max(...col.map((c) => c.x)) + MARK_R * 1.6;
      const rule = new THREE.Mesh(new THREE.BoxGeometry(hi - lo, 0.005, 0.005), axisMat);
      rule.position.set((lo + hi) / 2, band.y, -0.031);
      rule.renderOrder = -3;
      group.add(tag(rule, `floor-${name}-${index}`));
    }
  }

  /* The model's own edges, under the marks. Absent for an export that ships
     none, which is every scenario but Fowler's — and absent reads as absent
     rather than as a crash. */
  const wires = wiring(edges, slots);
  if (wires && !globalThis.__NOWEB) group.add(tag(wires, "wiring", "the network's own edges"));

  /* WHAT FIRES, AND IT IS THE ONE THING THIS SCREEN NEVER SHOWED (fixing-prd
   * §3). The scale's whole sentence is "two doors, one room" and the picture
   * drew only the room: 264 identical faint lines, in which the nine edges
   * leaving ResistanceExercise look exactly like the nine hundredth edge
   * downstream of them. A viewer pressing the arm chips watched marks change
   * height and had no way to see that the two bouts come IN at different places.
   *
   * So the first step out of each input is drawn a second time, on top, in that
   * arm's own hue, and it goes dark when its chip does. Switching the chip is
   * now the control that answers "where does this one enter" — turn it and the
   * fan moves to the other side of the canvas, except for the four lines that
   * do not move, because four of the first steps are the same node in both
   * bouts. That coincidence is the trunk, one layer earlier than the trunk.
   *
   * THE SAME EDGES DRAWN TWICE, NOT MOVED OUT OF THE FAINT LAYER. `wiring`
   * still carries every edge with both ends on screen and
   * `signallingGeometry.test.js` still counts them there — the network stays
   * complete, and "lit" means a brighter line over a line, which is what
   * lighting something up is. Pulling them out would have made the count that
   * test checks a number about which edges we chose to feature.
   *
   * HUE AND RENDER ORDER, AND NOTHING ELSE. Not thickness, not motion: height is
   * this scene's only data channel and these lines are structure, so they may be
   * told apart but they may not be made to look like a quantity. A pulse was the
   * other option and is refused — `gate-no-strobe` and `photosensitivity` exist,
   * and a rate of propagation is exactly the thing this export does not ship. */
  const entry = {};
  for (const [key, tint] of [["resistance", RESISTANCE_TINT], ["endurance", ENDURANCE_TINT]]) {
    const input = routes.doors?.[key]?.input;
    const lit = input ? (edges ?? []).filter(([source]) => source === input) : [];
    const mesh = litFan(lit, slots, { colour: tint, opacity: 0.55, renderOrder: -1 });
    if (mesh) {
      entry[key] = mesh;
      group.add(tag(mesh, `entry-${key}`, `the doors ${key} opens`));
    }
  }

  /* ---- the marks -------------------------------------------------------- */

  const markGeo = new THREE.SphereGeometry(MARK_R, 10, 8);
  markGeo.computeBoundingSphere();
  /* A flat tick, wider than it is tall. The control's shape is its label: one
     mark at one value, which cannot be read as the edge of a range the way a
     second faint sphere can.

     AS DEEP AS IT IS TALL, which is not a detail. It was as deep as it was WIDE
     — 0.05 — and sitting at `ARM_Z.control` that put its front face at z 0.0210
     while a mark's surface out at the tick's own corner has already fallen back
     to 0.0071. Render order does not settle depth: the arms went in second and
     the tick still came through them, so every node whose bout sat at its own
     control wore a pair of slate nubs out of its sides and read as a sphere
     with a rivet in it. Face on, which is how this scale is looked at, the tick
     is its width by its height and the depth was never doing anything. */
  const tickGeo = new THREE.BoxGeometry(0.05, 0.008, 0.008);
  tickGeo.computeBoundingSphere();

  const arm = (geometry, colour, role, label) =>
    tag(
      new THREE.InstancedMesh(
        geometry,
        /* GLOSSIER THAN THE SHARED DEFAULT, for the same reason this scene
           re-weights its lights: `SURFACE.roughness` 0.62 is tuned for a muscle,
           and on a 0.036 sphere it returns a flat disc. `roughnessMembrane` is
           the existing tier for something that should catch a highlight, so this
           borrows it rather than inventing a sixth number — one specular point
           per mark is what makes a hundred and twenty of them read as round. */
        anatomyMaterial({ colour, roughness: SURFACE.roughnessMembrane, opacity: 1 }),
        slots.length,
      ),
      role,
      label,
    );

  const resistance = arm(markGeo, RESISTANCE_TINT, "arm-resistance", "resistance");
  const endurance = arm(markGeo, ENDURANCE_TINT, "arm-endurance", "endurance");
  const control = arm(tickGeo, CONTROL_TINT, "arm-control", "no-exercise control");

  /* THE STEM EACH MARK STANDS ON. A unit box scaled in y per frame — one
     geometry, one instanced draw per arm. Thin enough to be a stalk and not a
     bar: at 0.004 it is a fifth of the mark's own diameter, so the mark stays
     the thing the eye lands on and the stem is how it got there.
     Its own material rather than the mark's, because a stem catching the same
     specular highlight as the sphere on top of it reads as one fat object. */
  const stemGeo = new THREE.BoxGeometry(1, 1, 1);
  stemGeo.computeBoundingSphere();
  const stem = (colour, role) =>
    tag(
      new THREE.InstancedMesh(
        stemGeo,
        anatomyMaterial({ colour, roughness: SURFACE.roughness, opacity: 1 }),
        slots.length,
      ),
      role,
    );
  const stemR = stem(RESISTANCE_TINT, "stem-resistance");
  const stemE = stem(ENDURANCE_TINT, "stem-endurance");

  // The control goes in first so the two arms draw over it: it is the floor the
  // bout is read against, not a third result competing for the same row. The
  // stems go under all three: they are what a mark stands on, never over it.
  group.add(stemR, stemE, control, resistance, endurance);

  /**
   * THE THREE ARMS ARE STACKED IN DEPTH, AND THAT IS WHAT MAKES "ONE MARK" TRUE.
   *
   * They were all at z = 0, which is a depth TIE: two opaque spheres at nearly
   * the same height, and the one drawn second wins above their midpoint and
   * loses below it. The result is a hard horizontal seam at full contrast, and
   * its contrast does not vary with the gap — only its position does. So a pair
   * 0.0002 apart was drawn as visibly two-coloured as a pair 0.05 apart, which
   * is a threshold in a drawing whose contract says there is none anywhere.
   *
   * Measured by a design review: at the run's end, all twelve output marks read
   * between 26% and 60% warm. The 112-against-37,870 measurement this file cites
   * as evidence for "one mark" was taken at t = 0 — the single sample of
   * sixty-four where the two arms are bit-identical and the seam cannot exist.
   *
   * A depth order removes it and encodes the same quantity better: the arm in
   * front hides the one behind wherever they overlap, so what is visible of the
   * back arm is a crescent whose width IS the height gap. Zero gap draws zero
   * crescent — one mark, literally — and it grows continuously from there. No
   * threshold, and no new channel: z carries nothing on this scale, which has no
   * measured extent and says so.
   *
   * NOT THE OFFSET THE COMMENT ABOVE BANS. That one moves the arms apart in
   * HEIGHT, which is the axis carrying the number, and manufactures a separation
   * the model does not have. This moves them along the axis carrying nothing.
   */
  const ARM_Z = { control: -0.004, endurance: 0, resistance: 0.004 };

  function write(mesh, values, z = 0, stems = null) {
    for (let i = 0; i < slots.length; i++) {
      // The slot carries its own floor now: y is its compartment's, set once in
      // `slotsFor`, and the band it was measured in no longer places it.
      const floor = slots[i].y;
      // Clamped, and the clamp is a statement: these are fractional activities
      // of a normalised-Hill network, so a value outside 0..1 is not a big
      // result, it is a broken input, and letting it climb out of its band would
      // draw it as a neighbouring band's node.
      const k = Math.min(1, Math.max(0, values[i]));
      _p.set(slots[i].x, floor + k * SPAN, z);
      _m.compose(_p, _q.identity(), _s);
      mesh.setMatrixAt(i, _m);
      if (stems) {
        /* THE SAME NUMBER, IN THE SAME CHANNEL, MADE VISIBLE. A stem runs from
           the band's floor — activity zero — up to the mark, so its length IS
           the height that was already the only thing this scene encodes. That is
           a lollipop, not a second channel: position and stem are one variable,
           and reading either gives the same answer.
           WHY IT WAS NEEDED. The two input marks sit at activity 1.0, a third of
           a band above the floor their own lit fan leaves from, and read as two
           dots floating unattached over the picture. Every other mark had the
           same problem more quietly — a dot at some height over a floor a viewer
           had to find. The stem joins the mark to its own zero, which is the
           thing the pass keeps naming: "lifts this column off its ticks".
           Unit box scaled in y and re-centred at the midpoint; `_s` is the
           shared unit scale and must not be mutated, so this uses its own. */
        _stem.set(STEM_W, Math.max(k * SPAN, 1e-5), STEM_W);
        _sp.set(slots[i].x, floor + (k * SPAN) / 2, z);
        _m.compose(_sp, _q.identity(), _stem);
        stems.setMatrixAt(i, _m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (stems) stems.instanceMatrix.needsUpdate = true;
  }

  /** Flatten a frame's per-band arrays into one run in `slots` order. */
  const laneOf = (drawn, key) => {
    const out = [];
    for (const band of ROUTE_BANDS) out.push(...drawn.bands[band][key]);
    return out;
  };

  function update(drawn) {
    write(resistance, laneOf(drawn, "r"), ARM_Z.resistance, stemR);
    write(endurance, laneOf(drawn, "e"), ARM_Z.endurance, stemE);
    /* NO STEM ON THE CONTROL. It is the floor the bouts are read against, and a
       tick already says "one mark at one value" — the shape that is its label.
       Giving it a stem would make three lollipops per node where the reader
       needs one baseline and two results. */
    write(control, laneOf(drawn, "c"), ARM_Z.control);
  }

  /**
   * Which bout is on screen: "resistance", "endurance" or "both".
   *
   * VISIBILITY, AND NOTHING ELSE. Every other way of answering "which arm am I
   * looking at" is already spent: a fade is opacity, which is how uncertainty is
   * drawn (see the control, above); a nudge apart manufactures a separation the
   * model does not have; a size or a depth change is a second data channel in a
   * scene whose only one is height. An arm is drawn exactly as it always was, or
   * it is not drawn. Nothing moves when this is called.
   *
   * The no-exercise tick stays under all three states. It is the floor the bout
   * is read against, and one arm alone above nothing is a picture of a number
   * with no baseline — which is the reading `fowler_rest` exists to prevent.
   */
  function show(arm) {
    resistance.visible = arm !== "endurance";
    endurance.visible = arm !== "resistance";
    /* The lit doors follow their own arm, because they ARE that arm — an entry
       fan left burning over a hidden bout would be the picture saying a bout is
       entering that is not on screen. The faint full wiring is untouched: it is
       the network, not a run, and it is there under every state. */
    if (entry.resistance) entry.resistance.visible = resistance.visible;
    if (entry.endurance) entry.endurance.visible = endurance.visible;
    /* A stem is part of its mark, so it goes when the mark goes — a stalk left
       standing under a hidden bout would be that bout still on screen. */
    stemR.visible = resistance.visible;
    stemE.visible = endurance.visible;
  }

  /**
   * WHAT EACH BAND IS.
   *
   * CONTRACT — every anchor must project inside |ndc.x| <= 0.80 and
   * |ndc.y| <= 0.86 from SIGNALLING_CAMERA over the whole aspect range the app
   * is used at, 0.99 to 1.82. Derived points to keep in step: `<Gizmos>` in
   * SignallingScale.jsx, which renders these, and "every callout lands inside the
   * canvas" in signallingGeometry.test.js, which is where the bound is enforced.
   * (It said `<FiberLabels>` until 2026-08-31; that component is gone and the
   * bound it was named against is unchanged.)
   *
   * THE RULE THAT MAKES THAT HOLDABLE, INHERITED FROM THE CELL SCALE AT FULL
   * PRICE: ndc.y is independent of aspect and ndc.x is inversely proportional to
   * it, so anchors are placed by y and stacked near x = 0. Five cell-scale
   * callouts were computed, carried, rendered and off the canvas because they
   * were spread sideways at the one window they were fitted in.
   */
  const anchors = [
    /* The second typed count, found by the same sweep as the one below — see
       Q14 R8/R9. `"two inputs"` agreed with the archive on the day it was
       written and was nobody's count after that. */
    /* THE COUNT LEFT with every other figure (T16, `uiMode.js`). */
    /* THE PLATES NAME THE CELL NOW. They named the analysis — "the doors in",
       "resistance only", "reached by both" — which was true of the old bands and
       says nothing about where you are. A visitor arriving from a drawn muscle
       cell one scale up should be able to read the parts back: the membrane they
       came through, the cytosol, the nucleus, and what comes out.
       IDS ARE UNCHANGED ON PURPOSE. `signallingTour.js` focuses beats by id and
       `Gizmos` highlights by id; renaming them would have been a second change
       riding along with this one. What moved is where each plate sits and what
       it says. */
    { id: "doors", label: "the membrane", at: [0, BANDS.membrane.y + SPAN + 0.14, 0] },
    /* THE AUTHORS' FIGURE 6, ON THE TWO COLUMNS IT DESCRIBES. Q21 R4: Fowler's
       simplified diagram runs resistance in through integrin and endurance in
       through the β-adrenergic receptor, and both of those nodes sit in exactly
       the band the paper puts them in — `integrin` R 1.000 · E 0.000, `B_AR`
       R 0.000 · E 0.989. The two plates said "resistance only" and "endurance
       only" and named nothing, so the picture showed the paper's two pathways
       and called them counts. Now each column carries the door it enters by,
       in the paper's own word, and the record behind the badge lists the rest
       (`bandWhy`). One name each, no verb: "integrin · LPA" and "β-AR · ROS ·
       AMPK" put the scale at 210 of its 200 words and "through integrin" at
       203, and rule 1 of the third hundred says cut, not hide — the footer
       gave up four words and the plates their verb. Exactly 200. */
    /* THE NODE NAMES CAME OFF on 2026-08-30 (T16). Q21 R4 put them on for the
       authors' Figure 6, and the thirty's depth table rules the other way for
       this project: this layer teaches "different doors", not which protein
       each door is. The names stay in `bandWhy`'s record for the day the
       figures return. */
    /* THE TWO SIDE PLATES ARE THE COLOUR KEY, and they are the one pair that did
       not move in meaning: which arm owns a mark. Under the cytosol's own left
       and right ends, which is where those marks are now — and NOT above it,
       where they were first put and where they landed on the plasma membrane. */
    { id: "split-resistance", label: "resistance only", at: [-1.0, BANDS.cytosol.y - 0.14, 0], swatch: RESISTANCE_TINT },
    { id: "split-endurance", /* "beta-AR", not "β-AR": `.gizmo__name` is uppercase by design and CSS
       uppercases the Greek too, so the paper's β-adrenergic receptor rendered
       as "Β-AR" — a capital beta, which is a different letter. Spelled out,
       and the same node the paper draws first on its endurance path. */
      label: "endurance only", at: [1.0, BANDS.cytosol.y - 0.14, 0], swatch: ENDURANCE_TINT },
    /* THE FIFTH COMPARTMENT'S NAME, 2026-08-31 — canon S1, and it is the one the
       whole scale is about.

       Five bands, four names. Counted in a browser at 1280x900 in state 4: "two
       workouts enter here", "the cell's own relay", "the nucleus", "what the
       cell ends up doing" — and the MEMBRANE, unnamed. The `doors` anchor above
       carries `label: "the membrane"` and never shows it: `SignallingScale`
       rewrites that plate at render time to "two workouts enter here" or
       "<arm> enters here", which is the right sentence for where that plate
       sits (the OUTSIDE band, a compartment gap higher) and is not a name for
       the band under it.

       So a visitor arriving from a drawn muscle cell one scale up meets a
       boundary they just came through, drawn as two hairline tubes, with
       nothing saying what it is — while the nucleus below it is named AND drawn
       as an enclosure, which is exactly why the nucleus reads and this does
       not. S1's own sentence is *"가로줄 네 개가 층을 나누는데 그 층이 뭔지
       화면이 말하지 않는다"*: this is that, still true, one band later.

       NOT NEW COPY. The word is the geometry's own, already written above and
       overwritten before it reached a pixel; this gives it a plate that is not
       also carrying a count. Same convention as the three below — under its
       band's floor, so the plate row reads as a column of places. */
    { id: "membrane", label: "the membrane", at: [0, BANDS.membrane.y - 0.14, 0] },
    { id: "trunk", label: "the cell's own relay", at: [0, BANDS.cytosol.y - 0.14, 0] },
    /* THE SIXTH PLATE, AND THE COMPARTMENT THAT MOST NEEDED NAMING. Fifteen
       transcription factors and twenty-eight genes sit here, which is the half of
       the cascade a first-year has actually heard of — the orders reaching the
       DNA. It had no label at all while the bands were an analysis, because
       there was no such band. */
    { id: "nucleus", label: "the nucleus", at: [0, BANDS.nucleus.y - 0.14, 0] },
    /* COUNTED, NOT TYPED. Q14 R8, 2026-08-27: this read `"twelve outputs"` — a
       count of things drawn on the canvas beside it, spelled out in the label.
       CLAUDE.md §9 forbids exactly that ("세어 나오는 값을 글자로 박지 마라") and
       `CellReadout.jsx` states it in English three files away: "a number a
       viewer can see drawn is never also typed".
       Found by comparing the two places the number appears. The pass says it
       through a template — `At all ${outputs} outputs` — and read 12 off the
       data; the plate said `twelve` off nobody. They agreed today. An archive
       that exports a different `node_roles` would have left the plate lying and
       the pass right. */
    /* THE COUNT LEFT THE LABEL on 2026-08-30 with every other figure — the
       screens name what a thing IS now and the numbers are behind `uiMode.js`.
       "What the cell ends up doing" is what this band is; twelve is how many. */
    { id: "outputs", label: `what the cell ends up doing`, at: [0, BANDS.outcome.y - 0.14, 0] },
    ...cascadeAnchors(slots),
  ];

  return {
    group,
    update,
    show,
    anchors,
    slots,
    dispose: () => disposeTree(group),
  };
}

/**
 * Off the axis on all three, and close enough that the subject fills the frame.
 *
 * IT WAS [0, 0.08, 4.4] AND THE REASON IT WAS IS WHY THE PICTURE WAS FLAT.
 * The note here read "x = 0 so world x maps to screen x linearly: with a yaw on
 * the camera the screen x of a point depends on its z, and every anchor
 * coordinate becomes a fit that expires at the next window." Every clause of
 * that is true. It is also a description of a diagram: a camera looking straight
 * down z at an arrangement laid out in x and y draws an elevation, and an
 * elevation has no depth to read whatever is in front of it. The audit that sent
 * this lane measured what it costs — the fibre one scale up frames from
 * [1.3, 1.7, 6.1] and reads as a solid, these two read as paper.
 *
 * THE FIT IT PROTECTED AGAINST IS GONE RATHER THAN TOLERATED. What expires
 * under a yaw is a coordinate someone TYPED against one projection. The scene
 * that ships — `heroGeometry.buildHeroLevel` — types none: every node, every
 * name plate and every focus ring comes out of `heroAt`, which is `col` and
 * `row` through one surface function, so turning the camera moves the label with
 * the thing it names and there is nothing left to expire.
 * `signallingGeometry.test.js` holds that, and holds this camera to being off
 * the axis, in place of the assertion that pinned x to zero.
 *
 * 33° of yaw and 20° of pitch, at 2.75 rather than 4.4. Measured at 1280x800
 * against `heroGeometry`'s own layout: the thirteen forms cover **2.49 %** of
 * the frame where they covered 1.33, the nearest draws **52 %** larger than the
 * deepest where it drew 19, and the membrane sheet — swept in z, and a thin
 * wedge seen dead-on — turns into a floor the network hangs under. Every name
 * plate still lands inside the canvas at all four aspects the app is used at,
 * and the worst of them is shoved 6.14 % of the stage by its own depth against
 * the 8 % `gizmoLayout.test.js` allows.
 */
/* 2.75 UNTIL THE FORMS GREW. The camera lane picked 2.75 to raise the drawing's
   ink density, measured against a `FORM_R` that the shapes lane then multiplied
   by 1.75 in the same round. The two are coupled through the plate: a plate
   hangs above its node by a clearance derived from the form's radius, so bigger
   forms push the top row's callout up, and "Resistance Exercise" landed at ndc
   y 0.874 at aspect 1.1 — off the canvas. 2.85 is the smallest pull-back that
   clears it, chosen that way to give back as little density as possible. */
/* PULLED IN 0.82x, 2026-09-02. `FORM_R` is at this layout's ceiling — the gate
   in `heroForms.test.js` catches `integrin` swallowing its neighbour's centre
   one step above 0.255 — so the forms cannot carry the rest of the way to the
   fibre scale's ink. The camera can, and it costs no layout invariant: same
   drawing, more of the glass. Measured over six frames, solid-object ink 12.6 %
   -> 21.8 % on the forms alone against the fibre scale's 27.7 %. */
/* A FAINT THREE-QUARTER, 2026-09-06 — owner §10: *"기본 3/4 angle 아주 약하게 …
   3D network를 구경하는 것보다 topology를 읽는 것이 우선"*. The triple above
   stood 32° off the axis and 16° above it; this one stands 14° off and 9°
   above, at 4.2 from the origin rather than 3.41 because the rows opened from
   0.32 to 0.40 (`heroGeometry.ROW_GAP`) and the outcome captions hang under the
   bottom row: photographed at 1280x800 from 3.6 the input chevrons were cut by
   the top edge and the captions sat on the timeline. 4.2 puts the chevrons'
   tops at ndc 0.86 and the captions at −0.78, clear of both. Same three numbers, one
   place: `signalsTour.js` imports this for its wide shot and `ORBIT_LIMITS`
   below is derived from it, so the standing shot, the pass's last frame and
   the viewer's orbit cannot disagree about where the camera lives. */
/* PASS 3: 14°/9° -> 5.5°/8°, same 4.2. Owner §7 wants the three outcomes read
   as *"a proper horizontal row at roughly one y"*; through a yawed camera a
   row at one world y projects to three screen heights — the far end of the row
   is deeper, so it sits nearer the horizon — and the stagger scales with the
   row's width times the yaw. Measured at 1280x800 on the outcome captions:
   35 px at 14° on the narrow row, 31 px at 8° on the widened one, 24 px at 5°.
   5.5° is the smallest yaw that clears both yaw floors the tests hold (5° in
   signalsTour.test.js, 0.08 rad in signallingGeometry.test.js); the pitch
   stays 8°. What the yaw still buys at 5.5° is not asserted anywhere — it is
   the three planes' parallax under the sway, and a viewer's eye is the gate. */
export const SIGNALLING_CAMERA = [0.15, 0.30, 4.2]; /* 2° right, 4° up — 2026-09-07, owner (signalling S1): *"tilted forward to the right"* at 5.5°/8° */

/**
 * How far the resting shot steps back on a window narrower than the contract.
 *
 * ONE FUNCTION, THREE READERS: `SignallingScale.jsx`'s `standing` (every
 * resize), the pass (once, at mount — `signalsTour(arm, { pull })`) and the
 * framing test in `signallingGeometry.test.js`, so the frame the pass ends on,
 * the frame the viewer is handed and the frame the contract measures are one.
 *
 * THE FLOOR ROSE FROM 0.99 TO 1.05 IN PASS 3, when the network widened to fill
 * the stage (`heroGeometry.COL_HALF` 0.74 -> 1.12). Projected through this
 * camera at the shipped width, the input plates' anchors stand at |ndc x| 0.756
 * at aspect 1.1 unpulled — inside the contract's 0.8 — and first cross it at
 * aspect ≈ 1.04; 1.05 is that point, with nothing to spare and nothing wasted.
 * (1.15 was the first number, measured for a 1.4 width that never shipped; it
 * also pushed the phone's resting distance to 10.34, past OrbitControls'
 * ceiling of 10.) At 390x844 the pull is now 2.27 and the distance 9.55. Above
 * the floor this is exactly 1.
 */
export const CONTRACT_FLOOR = 1.05;
/**
 * How far back the camera stands on a NARROW stage, where the network is laid
 * out narrow and tall (`heroGeometry.layoutOf(true)`) — pass 4, P0. The narrow
 * layout is half as wide, so one step-back serves every phone aspect; measured
 * at 390x844 with `STANDING_NARROW`, 1.3 puts the outer inputs at |ndc x| 0.69
 * and the plates between y 0.52 and −0.62 (width is the binding axis: 1.15 is
 * the first pull that clears the 0.8 contract), against the 2.27 the width-fit
 * used to need for the desktop drawing — the objects come up 1.75x.
 */
export const NARROW_PULL = 1.3;
export function pullFor(size, narrow = false) {
  if (narrow) return NARROW_PULL;
  const aspect = size.height > 0 ? size.width / size.height : 1;
  return aspect > 0 && aspect < CONTRACT_FLOOR ? CONTRACT_FLOOR / aspect : 1;
}

/**
 * The floor's resting shot, whole: the camera above dropped with its aim to the
 * picture's own centre. The rows sit `Y_DROP` under zero and the outcome
 * captions hang under the bottom row, so the drawing runs further below zero
 * than above it; −0.18 is that centre, measured at 1280x800 with the input
 * chevrons at ndc 0.86 and the captions at −0.78.
 *
 * ONE SHOT, THREE READERS. `SignallingScale.jsx` stands here between passes,
 * `signalsTour.js` opens and closes its pass here, and the two used to differ by
 * a 1.08 pull-back and a 0.06 aim — a small ease at the hand-back on a floor
 * whose rule for tonight is that the tour and the resting state are ONE
 * continuous shot. Same object, no ease.
 */
/* −0.18 -> −0.24, PASS 4 §8: *"Mitochondria와 timeline이 아직 살짝 가까워 … 네
   개의 horizontal band처럼"*. Camera and aim drop together by 0.06, which lifts
   the picture in the frame ~17 px at 1280x800 (the first cut went the other
   way and measured the captions 16 px LOWER): the outcome captions end near
   678 against the axis at 761, and the top plates keep 30 px under the corner
   controls. */
export const STANDING_DROP = -0.10; /* +0.05 was 10 % lower and the owner said too low (pace 2, S1): half of it back */ /* was -0.24; +0.29 lifts camera AND target together, which puts the network 10 % of the frame LOWER — owner (S1): *"signalling 자체를 10% 내려"*. Same picture as moving the 3D down, without retyping every aim the pass holds in world units. */
export const STANDING = Object.freeze({
  camera: Object.freeze([SIGNALLING_CAMERA[0], SIGNALLING_CAMERA[1] + STANDING_DROP, SIGNALLING_CAMERA[2]]),
  lookAt: Object.freeze([0, STANDING_DROP, 0]),
});
/**
 * The phone's resting shot — pass 4, P0/§11. The narrow layout is taller and
 * its top row would otherwise stand under the shell's chips and corner buttons
 * (measured 390x844: the resistance chevron touched the SHOW plate); raising
 * camera and aim to +0.02 lowers the picture ~50 px into the room it has above
 * the axis. `restFor(narrow)` is what the page and the pass read.
 */
export const NARROW_DROP = 0.02;
export const STANDING_NARROW = Object.freeze({
  camera: Object.freeze([SIGNALLING_CAMERA[0], SIGNALLING_CAMERA[1] + NARROW_DROP, SIGNALLING_CAMERA[2]]),
  lookAt: Object.freeze([0, NARROW_DROP, 0]),
});
export const restFor = (narrow = false) => (narrow ? STANDING_NARROW : STANDING);

/**
 * How far a viewer may turn the network — owner §10: *"orbit 범위 제한, vertical
 * tilt 제한"*. Spherical about the standing shot's own angles, the way
 * `OrbitControls` measures them: ±0.62 rad of azimuth (a third of a quarter turn
 * either side), 0.36 rad up and 0.28 down in polar, so the three planes still
 * read as depth and the topology never stands on its side. Every framing the
 * pass uses sits inside these — `signalsTour.test.js` holds it — because the
 * controls clamp to them the frame they are re-enabled, and a beat outside would
 * snap at the hand-back, the one moment the tour and the resting shot have to be
 * one shot.
 */
export const ORBIT_LIMITS = (() => {
  const [x, y, z] = SIGNALLING_CAMERA;
  const azimuth = Math.atan2(x, z);
  const polar = Math.atan2(Math.hypot(x, z), y);
  return Object.freeze({
    minAzimuthAngle: azimuth - 0.62,
    maxAzimuthAngle: azimuth + 0.62,
    minPolarAngle: polar - 0.36,
    maxPolarAngle: polar + 0.28,
  });
})();

/**
 * What this scale shows, and the one thing it cannot show.
 *
 * OFF THE SCREEN SINCE 2026-08-30, AND STILL HERE ON PURPOSE. The owner cut the
 * `Field of view:` line on this scale — the first-visitor audit's "a caption
 * promising a size that then refuses one" — so this string now has exactly one
 * consumer, `signallingGeometry.test.js`, and no pixel. Named here because a
 * constant with no reader is the easy thing to delete on sight: what left is the
 * words in front of a visitor, not the position. The test still refuses a count,
 * refuses a duration and requires "no measured extent", which is the honest
 * standing of a 121-ODE network with no geometry, kept ready for whoever turns
 * the figures back on. `SignallingReadout.jsx` carries the whole reasoning.
 */
export const SIGNALLING_EXTENT =
  /* "one cell's network", not "one muscle cell's network": the descent has
     established which cell, and Q14 R1 needed the word. */
  /* THE TWO COUNTS CAME OFF on 2026-08-29 and are one press away in
     `model_version` ("121 species / 261 reaction rows, of which 259 are
     interactions … the paper's own count"). They set scale; they do not do this
     line's job, which is the seam. Q26 R3 needed the words for the sentence
     that says the authors' own parameter range moves most nodes past the
     threshold this screen decides with — a fact about what is on the screen
     now, which the counts are not. Rule 1: a scale at 200/200 pays by cutting. */
  /* "WEB", MATCHING THE PASS. T13 rewrote the pass in beginner words and its
     opening says "spreads through this web"; the gate that holds the pass and
     this line to one name went red on the mismatch. One word for one thing —
     the same rule three scales over. */
  "one cell's web of signals. " +
  "No measured extent: the layout is ours.";
/* Three clauses went and the claim stayed. "No compartments, no distances and
   no cell boundary, so every position on screen is ours" said one thing three
   ways; one way is enough, and a reader who does not wonder whether the layout
   means something was being argued with.
   "No measured extent" is kept verbatim because `signallingGeometry.test.js`
   pins it, and the precedent in TODO.md for exactly this collision — a gate that
   matches a phrase where it means to check a claim — is that restoring the words
   beats loosening the gate. Rewriting the test to make this edit pass would be
   the edit grading itself. */
