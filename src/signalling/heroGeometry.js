/**
 * The signalling scale, drawn as twelve things instead of a hundred and
 * twenty-one.
 *
 * WHAT THIS REPLACES AND WHY. The old scene drew every node the archive ships,
 * on five compartment shelves. The owner, 2026-08-31, having watched it:
 * *"분자 121개, 상호작용 259개 — 이렇다고 우리는 이걸 다 보여주는게 아니라"*, and
 * then twice, plainly: *"120개는 절대 넣지마"*. A census is not a picture. The
 * screen's job is one sentence — **the same muscle cell interprets resistance
 * and endurance exercise differently** — and a sentence needs a subject you can
 * see.
 *
 * WHICH TWELVE IS OURS; EVERY ARROW IS THE MODEL'S. `heroNetwork.js` holds the
 * choice and the measurements behind it, and `heroNetwork.test.js` fails if a
 * drawn link has no path in Fowler's own edge list. That gate exists because the
 * textbook version of this cascade is in every physiology course and three of
 * its four arrows are not in this model.
 *
 * THE REST DO NOT DISAPPEAR. The other hundred and nine sit behind as small
 * quiet dots — the owner's *"나머지 node는 배경에 작은 점으로 깔아두면 돼"* — which
 * is how a drawing says "there is more here" without claiming it is readable.
 * Nothing is deleted; the scene draws every node the archive ships, at two very
 * different weights.
 */

import * as THREE from "three";

import { PALETTE, SCENE, SHADOW, SURFACE, anatomyMaterial, sheathMaterial } from "../anatomyStyle.js";
import { disposeTree } from "../fiber/fiberGeometry.js";
import { HERO_NODES, linksOf } from "./heroNetwork.js";
import { FORM_R, buildForm } from "./heroForms.js";

/**
 * Warm is resistance, cool is endurance, slate is the control that did nothing.
 * The same three the old scene used, and the cell scale before it — SHIFTED UP IN
 * VALUE, and the shift is the point of this block.
 *
 * WHAT THE RENDER SAID, 2026-09-01: *"every form is dark brown on a pale field,
 * so you read a silhouette and never a surface"*. That is a statement about
 * exposure and it works out exactly. The stage is paper, `SCENE.background`
 * #faf8f5. `PALETTE.myosin` is #8f544c, whose red channel is 0.099 in linear
 * light; the scene's own rig is ambient 0.5, key 3.4, fill 1.2, so a face turned
 * to the key reads 0.099 * 3.9 = 0.39 linear, sRGB 168, and a face turned away
 * reads 0.099 * 0.5, sRGB 62. Sixty-two to a hundred and sixty-eight, against a
 * background of two hundred and fifty. Every part of the object is darker than
 * every part of the page, and at that separation a small form resolves as its
 * outline before it resolves as anything else — which is what a silhouette is.
 *
 * These three are ×1.23 in sRGB, which is a lift of about a third in linear
 * light. It keeps hue and it keeps the warm/cool identity that carries this
 * screen's whole sentence; what it buys is that the lit side of a form now runs
 * up near the paper while the turned-away side stays firmly under it, so the
 * SHADING is the thing with the range in it rather than the gap to the
 * background.
 *
 * NOT SHARED, AND DELIBERATELY NOT. `PALETTE.myosin` and `PALETTE.calcium` stay
 * where they are: they are the fibre scale's structural colours and the cell
 * scale's swatch language, `--arm-resistance` / `--arm-endurance` / `--arm-control`
 * in cell.css are the same hexes as text colours where the 5.04 contrast ratio
 * `cellGeometry.js` measured them for still has to hold, and none of that is
 * about an albedo under three lamps. This is a per-material exposure for one
 * scene's 3D bodies, so it lives beside those bodies.
 */
const RESISTANCE_TINT = "#b06a60";   // PALETTE.myosin #8f544c, lifted
const ENDURANCE_TINT = "#7099b3";    // PALETTE.calcium #5b7f96, lifted
/* DROPPED FROM #8a847b, WHICH WAS THIS SCENE'S EXPOSURE LIFT OF --arm-control.
   The lift is still right for the two BOUT tints — an albedo under three lamps
   has to be raised to land where it was drawn — but the quiet one is not an
   exposure question, it is the picture's floor. This scale had no dark anchor
   and the cell scale gained on every measure when its resting molecules got
   one. It also says something true here that the lift was muting: on a
   resistance screen the endurance nodes sit at the control's value all run, and
   dark IS "your workout never moves this". Frame stddev 39.0 to 44.1. */
const QUIET_TINT = "#403c36";
/* DROPPED AGAIN, 6b665e -> 57524b, AND THE STOP IS PRINCIPLED. Frame stddev
   44.4 to 48.1, past the fibre scale's own 41.9. It stops level with
   `PALETTE.zDisc` #4a4258, the darkest object albedo the benchmark itself uses:
   going darker measures better on every number and would be chasing the number
   rather than matching the thing being graded against. */

/**
 * How the twelve's own surfaces are finished, and why it is not `roughnessStatic`.
 *
 * THERE IS NO SPECULAR ANYWHERE IN THIS APP AND THIS IS THE HALF OF IT THIS LANE
 * OWNS. Audited across all three scales: no `Environment`, no PMREM, no `envMap`,
 * nothing. So `RE_IndirectSpecular` is zero everywhere and every highlight any
 * surface here can have must come from the three lamps directly. At
 * `SURFACE.roughnessStatic` = 0.72 the GGX lobe is spread so wide that the direct
 * highlight is a broad dim wash indistinguishable from the diffuse term — which
 * is the second half of *"no specular highlight anywhere — the surface is matte,
 * one flat colour with a soft gradient, so it reads as plasticine"*.
 *
 * 0.34 puts a real, compact highlight from the key onto every one of these
 * bodies. A highlight is the single cheapest cue that says "this is a lit solid
 * and not a filled shape", and it is the one cue that survives the form being
 * small — it does not need the viewer to resolve a gradient, only a bright spot.
 * The detail material is a touch glossier again, because what it draws is wet:
 * cristae, a nucleotide, the strand under a transcription factor's clamp.
 *
 * NOT LOWER THAN THIS. Under three lamps and no environment, a near-smooth
 * dielectric has two hard little dots on it and nothing between them, which reads
 * as plastic rather than as protein. `SURFACE.roughnessMembrane` is 0.45 and it
 * is what this app already calls "glossy enough that a thin film reads as wet";
 * these are solids seen small, so they sit a step under it and no further.
 *
 * WHAT WOULD ACTUALLY FIX IT AND IS NOT HERE: an irradiance environment, so
 * these surfaces have something to reflect that is not a point. It cannot be
 * dropped in from this file — `PMREMGenerator` needs the live renderer, which
 * lives in `SignallingScale.jsx`'s canvas — and it would change every scale at
 * once, including the fibre one that is already good. It is a lane of its own.
 */
/* 0.34 -> 0.28 and 0.26 -> 0.22, PASS 3 — owner §5: *"A modest roughness
   reduction plus better environment response may do more than changing the
   base colour."* The forms sit in `AnatomyEnvironment`'s room now, so a
   tighter lobe has something to reflect; still well above the plastic line
   the note above draws. */
/* 0.28 -> 0.24 and 0.22 -> 0.20, PASS 4 — owner §5: *"roughness 살짝 낮추기,
   key highlight 조금 더, AO/crevice 강화, neutral base를 아주 약간 밝게. AMPK나
   central kinase의 lobe separation이 더 잘 보여야 해."* The crevice is the
   detail material, a step darker than the body (0.72 -> 0.62 of it below). */
const FORM_ROUGHNESS = 0.24;
const DETAIL_ROUGHNESS = 0.20;

/**
 * One row of the drawing to the next, in world units.
 *
 * TIGHTER THAN IT WAS, AND THE CAMERA CAME IN WITH IT — 0.42/1.02 until
 * 2026-09-01, framed from z 4.4. Measured through that camera at 1280x800, the
 * thirteen forms covered **1.33 %** of the frame: the subject was scattered
 * across the whole stage at the size of a full stop, which is the arithmetic
 * behind the audit's ink-density reading of 0.17 against the fibre's 0.52.
 * A form's own size is `heroForms.FORM_R` and is not this file's to change, so
 * the only lever on how big a node draws is how far away the camera has to
 * stand — and that is set by how wide the drawing spreads. Shrinking the spread
 * by a quarter and walking the camera in from 4.4 to 2.75 leaves the
 * constellation inside the same canvas (ndc x −0.36..0.51, y −0.70..0.71) with
 * every form **1.37x** across, so **2.49 %** of the frame.
 * THE ONE THING IT COSTS IS ARROW LENGTH, and that is the number to watch if
 * anyone tightens this further: the shortest link — integrin to RhoA, one row
 * straight down — has 0.123 of clear rod left between its two trims and its
 * head, where it had 0.222. Under about 0.08 a link stops reading as a stroke
 * and starts reading as a smudge between two shapes.
 */

/**
 * NAMES WHOSE PRINTED FORM IS NOT THE ID OPENED OUT.
 *
 * The rule below — underscores to spaces, camel humps to spaces — is right for
 * most of the archive's ids and wrong for three, and it was wrong in the
 * direction that matters: it says "nothing else is done to the string, so the
 * word is still the authors'", and `PGC 1A` is not what the authors write. They
 * write PGC-1α. The mechanical opening was the thing changing the name.
 *
 * Measured on screen 2026-09-04: the plates read `PGC 1A`, `B AR` and `RHO A`
 * while the narrator on the same floor says PGC-1α — a visitor has to work out
 * that those are one thing. `exact` carries these past the plate's
 * `text-transform: uppercase`, because α and Α are different characters and only
 * one of them is the name.
 *
 * IT IS ALSO WHERE EACH NAME SAYS WHAT IT IS — the `\u00b7` shape the fibre has
 * used since it was drawn and the cell took on 2026-09-04. Measured the same day,
 * `gate-legibility` reported four acronyms on this scale that nobody was taught.
 * Pressing a ring says more (see `SAYS` in `SignallingScale.jsx`); the plate is
 * what a visitor reads without knowing to press.
 *
 * A table rather than a rule because there is no rule: these are how they are
 * spelled, and what they are is not derivable from an id.
 */
export const SPELLED = {
  ResistanceExercise: "Resistance exercise",
  EnduranceExercise: "Endurance exercise",
  integrin: "Integrin \u00b7 the pull sensor",
  B_AR: "\u03b2-AR \u00b7 the adrenaline door",
  ROS: "ROS \u00b7 reactive oxygen",
  RhoA: "RhoA \u00b7 a pull relay",
  AMPK: "AMPK \u00b7 the energy sensor",
  JNK: "JNK \u00b7 a stress relay",
  PGC_1a: "PGC-1\u03b1 \u00b7 the mitochondria switch",
  S6: "S6 \u00b7 protein machinery",
  Protein_Synthesis: "Protein synthesis \u00b7 making muscle",
  Cell_Growth: "Cell growth \u00b7 getting bigger",
  Mitochondrial_Biogenesis: "Mitochondria \u00b7 building more",
};

/* 0.32 -> 0.40, 2026-09-06. The tightening above was paid for by ink density
   at a node radius of 0.195; the nodes are 0.135 now (owner §1) and the same
   owner's §1 says where the room goes — *"Nodes smaller / Connections thinner /
   Whitespace larger / Signals stronger"*. At 0.32 a vertical link between two
   0.135 forms had 0.05 of path left between its trims: no path to travel. At
   0.40 it has 0.16. */
export const ROW_GAP = 0.40;
/** Half the width the drawing spreads across. `col` is in these units. */
/* NARROWED FROM 1.02 BY THE CAMERA LANE, so the camera can stand closer and the
   drawing's ink density can rise — 0.17 against the fibre scale's 0.52 was the
   measured gap, and the answer to a sparse picture is a tighter one, not a
   wider one. */
/* 0.74 -> 1.12, PASS 3 (2026-09-06; 1.4, 1.2 and 1.15 were tried first). Owner:
   *"The active network occupies maybe
   the left-middle 45% of the available canvas while the entire right side is
   mostly empty … a diagram sitting inside a giant 3D viewport rather than a
   network filling a designed stage."* The nodes stay 0.135 (§9: *"Do not enlarge
   individual nodes again"*); the footprint grows by 51 %. NOT 1.4, WHICH WAS
   THE FIRST NUMBER: measured at 1280x800 the resistance entry would stand at
   x ≈ 224 px, under the SHOW cluster's plate (12..264, 56..96); at 1.2 and
   again at 1.15 its chevron's left arm touched that plate's edge. The two top
   corners are the shell's and the explorer's, so the inputs stop 17 px short
   of them. Below aspect 1.05 the resting shot steps back
   (`signallingGeometry.pullFor`) so the framing contract holds at every window
   the app is used at. */
export const COL_HALF = 1.12;
/**
 * A drawn node. Large enough to carry a name beside it and be pressed.
 *
 * DERIVED FROM `FORM_R` NOW, NOT TYPED. This is only ever read as the clearance
 * `linkMesh` stops an arrow short by, and the thing it has to clear is a FORM.
 * It was 0.062 against a `FORM_R` of 0.072 — a ratio of 0.861 that was picked by
 * eye once and then had no way of knowing the forms had grown. `heroForms.js`
 * grew them 1.75x today, and left as a constant this would have buried every
 * arrowhead inside the node it points at while every gate in the repo stayed
 * green. The ratio is the thing that was chosen; keep the ratio.
 */
export const HERO_R = FORM_R * 0.861;
/**
 * One of the crowd — and the old value was so small the layer drew almost
 * nothing.
 *
 * IT WAS 0.013 AND THAT IS 0.27 % OF THE FRAME. Projected through
 * `SIGNALLING_CAMERA` at 1280x800, the 108 dots came out between 1.5 and 4.3 px
 * of radius and their discs summed to 0.27 % of the middle 80 % of the picture,
 * with the far two-thirds tinted to #e5e2df against #faf8f5 paper — under one
 * value step from invisible. An audit still called this the strongest depth cue
 * the scale owns, which is a statement about how bare the rest of the paper is
 * rather than about how well this worked.
 *
 * IT IS DERIVED FROM `FORM_R` NOW, FOR THE REASON `HERO_R` IS. The one property
 * this layer must never lose is that a mote cannot be mistaken for one of the
 * thirteen, and that is a RATIO. At 0.045 of `FORM_R` (0.21, then 0.09, until 2026-09-06), and with the size mix
 * below reaching 1.25, the largest mote in the scene is a ninth of a form in WORLD
 * units — and on the glass it is 0.43, because the near motes stand closer to
 * the camera than any form does and the divide gives them that back. So the
 * honest statement is the screen one: 18 px of radius against the forms' 41–63,
 * a mote under half a form across at the very worst crossing, and a quarter of
 * one everywhere else. Typed as a literal none of that would survive: the forms
 * grew 1.75x in `heroForms.js` and a literal here had no way of hearing about
 * it. `heroMotion.test.js` holds the world ratio, which is the one a gate can
 * see without a camera.
 */
/* 0.09 -> 0.045, PASS 3 — owner §4: *"40–60% smaller nodes, thinner edges,
   stronger depth fade. A field behind the main pathway, not an overlay."* */
/* 0.045 -> 0.036, PASS 4 — owner §6: *"node size 15~25% 감소 … 없애면 안 됨"*. */
const DUST_R = FORM_R * 0.036;
/**
 * HOW MUCH ONE MOTE'S SIZE MAY DIFFER FROM ANOTHER'S AT THE SAME DEPTH.
 *
 * A field of identical circles is a stipple, and a stipple is a surface — which
 * is the flat reading this layer keeps being rebuilt out of. Matter comes in
 * sizes, so the motes do.
 *
 * THE MIX IS BOUNDED BY THE DEPTH RAMP AND THAT BOUND IS THE WHOLE POINT. Size
 * is carrying depth here (see the scale ramp below, which shrinks the far end to
 * 0.55 on top of the perspective divide); a mix wide enough to make a far mote
 * bigger than a near one would spend the cue it is decorating. 0.80..1.25 is a
 * ratio of 0.64 against the ramp's 0.55, so the biggest thing at the far wall is
 * still smaller than the smallest thing at the front. `heroMotion.test.js` holds
 * that inequality, because it is the kind that reads fine and is wrong.
 */
const DUST_SIZE_MIX = [0.8, 1.25];

const ROWS = Math.max(...HERO_NODES.map((n) => n.row));
const TOP_Y = (ROWS / 2) * ROW_GAP;
/** The membrane's own width — wider than the drawing, so the cell is a closed
    thing rather than an axis. Hoisted because `heroAt` needs it now. */
const CELL_HALF = COL_HALF * 1.5;
const CELL_HALF_H = TOP_Y + ROW_GAP * 0.6;

/**
 * How far off the back the twelve stand, and how the curve is fitted.
 *
 * SAME RULE AS THE CELL SCALE ONE STEP UP — `anatomyStyle.domeZ`, which carries
 * the whole argument for why this is a dome and not data. Both screens were flat
 * grids at z 0 in front of a perspective camera that therefore did nothing, and
 * both are drawings of the inside of a cell, so both put their subjects on the
 * inside of the near wall and neither reads a number off it.
 *
 * THE DOME IS FITTED TO A CELL WIDER THAN THE DRAWING, AND THAT IS THE WHOLE OF
 * WHY THE 1.25 IS THERE. Fitted to the drawing's own half-extents, the four
 * CORNER nodes — the two exercise inputs at the top and protein synthesis and
 * mitochondrial biogenesis at the bottom — all land at radius > 1 and clamp to
 * exactly 0. That draws a flat frame around a bulge, which is a worse picture
 * than the flat one it replaced. A cell that the drawing sits inside instead of
 * filling gives every one of the twelve its own depth.
 *
 * AND A DOME ON ITS OWN IS SYMMETRIC, WHICH IS WHY IT WAS NOT ENOUGH. Turn the
 * camera off the axis and a bulge shows you the same ordinal depth twice: the
 * rim is far at the top of the picture and far again at the bottom, so nothing
 * in the arrangement says which end of the cascade is nearer. `ROW_SINK` is the
 * axis that does — each row down the drawing sits one step further back, so the
 * exercise stands outside the cell nearest the viewer and the three outcomes
 * sit deepest inside it.
 *
 * THAT IS NOT A NEW CLAIM AND IT MUST NOT BECOME ONE. `anatomyStyle.domeZ`
 * carries the rule this obeys — z is a function of where a node already sits,
 * no readout reads it, and nothing can be measured off it. Outside → membrane →
 * cytosol → nucleus is already what the vertical axis says, in the authors' own
 * `type` column; the sink says the same thing on a second axis and says nothing
 * else. Inward is inward.
 *
 * MEASURED at 1280x800 through `SIGNALLING_CAMERA`: the nearest of the thirteen
 * draws **52 %** larger than the deepest (protein synthesis and mitochondrial
 * biogenesis, both z −0.235, the bottom corners) where the square-on dome gave
 * 19 %. The doors run 0.079 to 0.235 and the three outcomes sit at −0.235 to
 * −0.103, so the sheet of membrane the doors are embedded in stands in front of
 * everything the cascade ends in.
 */
/* THE DOME IS GONE, 2026-09-06, AND THE NOTE ABOVE IS KEPT AS THE ARGUMENT IT
   ANSWERED. Owner §5: *"SIGNALS는 완전한 freeform 3D가 필요하지 않습니다 …
   shallow 3D … Z depth도 membrane/front, early signalling/middle, downstream/back
   정도로 제한 … 각 조형물이 앞뒤로 과도하게 튀어나오는 깊이는 줄입니다."* So
   depth is three planes, `PLANE` apart: the inputs and the doors in front (the
   membrane is the front of the cell), every relay in the middle, the three
   outcomes behind. The sink's axis survives — inward is still inward — and the
   bulge that gave every node its own depth does not, because the topology is
   what has to read and a node's own z was noise on top of it.
   `heroNetwork.test.js` holds all three planes flat and the whole span under
   one row. */
const PLANE = ROW_GAP * 0.42;

/**
 * Which row of the drawing a point belongs to — the inverse of `heroAt`'s y.
 *
 * Taken off y rather than passed in, so `heroLift` can put a storyboard point
 * that names no node on the same surface the nodes are on.
 */
const rowAt = (y) => ROWS / 2 - y / ROW_GAP;

/** The surface the drawing lies on: the dome, tipped back along the cascade. */
const surfaceZ = (x, y) => {
  /* Thresholds sit between rows rather than on them: `heroAt` drops the whole
     drawing by `Y_DROP` (a third of a row), so a node's `rowAt` reads 0.3 past
     its own integer, and a point a storyboard types in flat coordinates lands
     on the plane of the row it is nearest. */
  const row = rowAt(y);
  return row < 1.75 ? PLANE : row > 4.75 ? -PLANE : 0;
};

/**
 * Where z 0 is, and it is the middle of the drawing rather than its back.
 *
 * `domeZ` returns 0..RISE, so every node used to float in FRONT of z 0 and the
 * point the camera looks at sat behind the whole picture. Two things came of
 * that and both are why this is here. The camera aims at the origin, so it was
 * aiming past its own subject — a mistake that only shows once the camera
 * leaves the axis, and the camera was on the axis. And the gate that bounds how
 * far a node's depth may shove its name plate (`gizmoLayout.test.js`) measures
 * that shove against the same node drawn at z 0: tangent to the back of the
 * drawing, that reference charges the picture for its whole depth instead of
 * half of it. Measured through `SIGNALLING_CAMERA`, the identical arrangement
 * shoves its worst plate 12.15 % of the stage un-centred and 6.14 % centred,
 * against a budget of 8 — so this is not a tidying, it is the whole of what
 * pays for the tip and the turn.
 */
const Z_MID = (() => {
  const zs = HERO_NODES.map((n) => surfaceZ(n.col * COL_HALF, (ROWS / 2 - n.row) * ROW_GAP));
  return (Math.min(...zs) + Math.max(...zs)) / 2;
})();

/** How far back the deepest of the twelve stands, and how far forward a door. */
const Z_FAR = Math.min(...HERO_NODES.map((n) => surfaceZ(n.col * COL_HALF, (ROWS / 2 - n.row) * ROW_GAP))) - Z_MID;
const DOOR_NEAR =
  Math.max(
    ...HERO_NODES.filter((n) => n.kind === "door").map((n) =>
      surfaceZ(n.col * COL_HALF, (ROWS / 2 - n.row) * ROW_GAP),
    ),
  ) - Z_MID;

/**
 * How deep the picture goes, in four numbers — and every one of them is now a
 * clearance off the drawing rather than a number typed against one layout.
 *
 * THEY WERE LITERALS AND THE LITERALS EXPIRED THE MOMENT THE LAYOUT MOVED.
 * `MEMBRANE_FRONT` was 0.86, written to clear the nearest receptor at z 0.593
 * — correct, on the day, for a drawing whose rows were 0.42 apart and whose
 * dome floated entirely in front of z 0. Tip the drawing back and centre it and
 * the same 0.86 is a sheet standing a third of a unit in FRONT of everything,
 * which is the receptor-outside-its-own-membrane defect the leaflets below
 * already carry a scar for, restored by arithmetic nobody would have looked at.
 * Written as clearances they cannot expire: the same fractions of `ROW_GAP` and
 * of the cell's own half-height that were measured, taken off wherever the
 * doors and the deepest node actually end up.
 *
 * `MEMBRANE_FRONT` clears the nearest door so the receptors are embedded in the
 * sheet rather than standing in front of it. `DUST_NEAR` used to be BEHIND the
 * deepest of the twelve so that nothing in the background layer could be
 * mistaken for something in the foreground one; it is the membrane's own front
 * now, and the note at `DUST_NEAR` carries the argument for the swap and the
 * argument that was there before it. `DUST_FAR` is how deep the cell's contents
 * go, and it is deliberately NOT `MEMBRANE_BACK` — see there.
 */
const MEMBRANE_FRONT = DOOR_NEAR + ROW_GAP * 0.64;
/**
 * HOW MUCH OF THE SHEET IS DRAWN — not how deep the cell is, which is the
 * mistake the first number here was.
 *
 * It was set to `DUST_FAR` on the reasoning that the membrane and the crowd are
 * both "the far side of the cell". They are not the same claim: the crowd is the
 * cell's CONTENTS and the membrane is its boundary, so how far back the contents
 * go says nothing about how much of the boundary is worth drawing.
 *
 * AND THE SECOND HALF OF THIS NOTE USED TO OVERSTATE THE DIFFERENCE, which is
 * worth leaving in because it is the shape of mistake this whole pass keeps
 * making — an eyeballed consequence written down as if it had been measured. It
 * said a sheet running to −2.5 was "a wedge covering everything between the door
 * row and the middle of the frame … the fog over the anatomy `App.jsx` names".
 * Worked properly, through the square-on camera it was measured at: the sheet's
 * near edge at +0.86 projected 0.451 of the stage's half-height off centre and
 * its far edge 0.231 at −2.5, against 0.275 at −1.4. So it was a band covering
 * 22 % of the half-height rather than 17 %, and it stopped well short of the
 * middle of the frame either way. The shorter sheet is still the one to draw —
 * a patch of boundary is honest and a fifth less veil over the door row is a
 * fifth less veil — but the reason is a modest one and it should not be dressed
 * up as a rescue.
 *
 * IT IS THE SAME FRACTION OF THE CELL IT WAS, and it is now written as one:
 * −1.4 against a cell 1.302 half-tall. Which matters more than it did, because
 * the camera has left the axis — a sheet swept in z reads as a thin wedge
 * dead-on and as a floor the network hangs under from anywhere else, so how far
 * back it runs is now something a viewer can see rather than infer.
 */
const MEMBRANE_BACK = -CELL_HALF_H * 1.075;
/**
 * THE CROWD COMES IN FRONT OF THE THIRTEEN NOW, AND THE NOTE ABOVE SAYS WHY IT
 * DID NOT — so this is the argument against that one, left beside it.
 *
 * It was `Z_FAR - ROW_GAP * 1.09`: behind the deepest of the thirteen with a row
 * to spare, so that no mote could ever be mistaken for a node. That is a real
 * worry with the wrong guard on it. What separates a mote from a node is SIZE —
 * `DUST_R` is 0.045 of `FORM_R` and the ramp only ever shrinks it, so a mote is
 * at most a fifth of a form across from any distance — and size holds at every
 * depth, where an ordering only holds while the layer stays behind. The
 * ordering bought nothing the size was not already buying, and it COST the one
 * cue this scene had no other source for.
 *
 * OCCLUSION IS THE CUE, and it is ordinal and unambiguous in a way neither
 * shading nor parallax is: a mote that passes across a form is nearer than it,
 * full stop, and no interpretation of the picture survives disagreeing. The
 * scene forbade itself the only depth statement it could have made for free.
 * `depthWrite` was already on (see the material below, and the reason there),
 * so the near motes occlude correctly the moment they are allowed in front —
 * this is one constant, not a mechanism.
 *
 * AND THE BOUND IS THE MEMBRANE'S OWN LEADING EDGE, not a number picked to look
 * right. The crowd is the cell — the rest of the network the thirteen were cut
 * from — so the front of the drawn cell is exactly how far forward it may come,
 * and `MEMBRANE_FRONT` is where the sheet starts. A literal here would expire
 * the next time the drawing tips; this cannot.
 */
/* AND BEHIND AGAIN, 2026-09-06 — this time by the owner's eye rather than by
   the ordering worry the paragraph above defused. §7: *"random gray sphere가
   많으면 ENERGY의 cytosol particle과 다시 비슷해질 수 있습니다 … 메인 hero path
   뒤에 작은 dim nodes, hairline edges."* The occlusion cue the note above bought
   was real and it cost the picture its subject: motes crossing the forms read
   as more forms. Context stands behind what it is context for, half a row
   clear of the deepest of the thirteen. `heroMotion.test.js` holds it there. */
/* AND FARTHER BACK AGAIN, PASS 3 — §4 *"farther z"*: a row and a fifth behind
   the deepest of the thirteen, where it was half a row. */
const DUST_NEAR = Z_FAR - ROW_GAP * 1.2;
const DUST_FAR = -CELL_HALF_H * 1.92;

/**
 * TWO LAYOUTS OF ONE TOPOLOGY — pass 4, P0, the owner's §11: *"390×844에서 network
 * 전체를 살리려고 camera가 너무 멀리 가서 … 모든 object가 너무 작아짐. Desktop
 * coordinates를 그대로 두고 camera만 빼는 방식의 한계야. geometry 재설계는 불필요,
 * layout coordinates만 바꿔. Desktop: wide + shallow / Mobile: narrow + tall."*
 * And §10: *"Desktop layout은 lock해도 됨."*
 *
 * So the constants above stay exactly what they are — they ARE the wide layout,
 * `layoutOf(false)` reproduces them number for number and `heroAt`/`heroLift`
 * still answer for the desktop — and a narrow stage gets the same rows and
 * columns on a half-width, taller grid. Everything that hangs off the grid
 * (membrane height, the outcome divider, the dust field's box, the three
 * planes) is derived per layout here rather than read from the module
 * constants, so a phone cannot inherit a desktop membrane over a phone
 * network. `heroNetwork.test.js` holds the two layouts to the same topology
 * and the desktop one to `heroAt`.
 */
export const LAYOUTS = Object.freeze({
  wide: Object.freeze({ colHalf: COL_HALF, rowGap: ROW_GAP }),
  /* Half the width, a quarter more row: the owner's sketch — the V compressed,
     the depth used. At 0.55 the two doors still clear each other and the
     receptors' bundles do not touch. */
  narrow: Object.freeze({ colHalf: 0.55, rowGap: 0.50 }),
});
const layoutCache = new Map();
export function layoutOf(narrow = false) {
  const key = narrow ? "narrow" : "wide";
  if (layoutCache.has(key)) return layoutCache.get(key);
  const { colHalf, rowGap } = LAYOUTS[key];
  const rows = ROWS;
  const topY = (rows / 2) * rowGap;
  const cellHalf = colHalf * 1.5;
  const cellHalfH = topY + rowGap * 0.6;
  const plane = rowGap * 0.42;
  const rowAt = (y) => rows / 2 - y / rowGap;
  const surfaceZ = (x, y) => {
    const row = rowAt(y);
    return row < 1.75 ? plane : row > 4.75 ? -plane : 0;
  };
  const gridZ = (n) => surfaceZ(n.col * colHalf, (rows / 2 - n.row) * rowGap);
  const zs = HERO_NODES.map(gridZ);
  const zMid = (Math.min(...zs) + Math.max(...zs)) / 2;
  const zFar = Math.min(...zs) - zMid;
  const doorNear = Math.max(...HERO_NODES.filter((n) => n.kind === "door").map(gridZ)) - zMid;
  const lift = (at) => (at ? [at[0], at[1], surfaceZ(at[0], at[1]) - zMid] : at);
  const L = Object.freeze({
    key,
    narrow,
    colHalf,
    rowGap,
    rows,
    topY,
    cellHalf,
    cellHalfH,
    plane,
    zMid,
    zFar,
    doorNear,
    membraneFront: doorNear + rowGap * 0.64,
    membraneBack: -cellHalfH * 1.075,
    /* PASS 4 §6 *"z를 더 뒤로"*: 1.2 -> 1.8 rows behind the deepest node. */
    dustNear: zFar - rowGap * 1.8,
    dustFar: -cellHalfH * 1.92,
    rowAt,
    surfaceZ,
    lift,
    at: (node) => lift([node.col * colHalf, (rows / 2 - node.row) * rowGap - Y_DROP]),
  });
  layoutCache.set(key, L);
  return L;
}

/**
 * ── WHAT MOVES, AND WHICH OF THE TWO KINDS EACH ONE IS ──────────────────────
 *
 * This scene was a still. Every number the archive ships landed on hue and on
 * nothing else, so the drawing had the one depth cue a photograph has — a lit
 * surface — and not the one it does not, which is what a thing looks like from
 * a slightly different angle a moment later. That is structure from motion, and
 * without a stereo display it is the strongest cue there is. Measured over 9 s
 * at 1280x800 before this: 0.14 % of the frame's pixels changed. The fibre
 * scale, which does move, changes 31.6 %.
 *
 * §5 splits what may be added into two kinds and they are not mixed:
 *
 *   MEASURED — the twelve turn. A node's TURN RATE is its own activity at this
 *   instant, the same number the colour already carries, out of `heroReading`
 *   (`signallingBinding.js`) reading the authors' own 45-minute series. The one
 *   thing it claims is "faster ↔ more active", and the claim it makes best is
 *   the one colour makes worst: a node this bout never touches never moves AT
 *   ALL. Under resistance `B_AR` and `ROS` are flat at exactly 0 for all 64
 *   samples of `fowler_resistance.json`, so they sit dead still beside a `JNK`
 *   that turns steadily — a difference nobody has to read a legend to see.
 *
 *   THAT ROTATION WAS REMOVED ON 2026-09-05 AND THE PARAGRAPH ABOVE IS KEPT
 *   BECAUSE ITS ARGUMENT SURVIVED ITS MECHANISM. What replaced it is `BUMP_GAIN`
 *   and the two constants beside it: a node responds to its own RISE and is
 *   still otherwise. The claim quoted above — "a node this bout never touches
 *   never moves AT ALL" — is not weakened by the change, it is sharpened, because
 *   stillness is no longer the bottom of a continuum every other node is
 *   somewhere on. NO RATE IS ATTRIBUTED TO THE MODEL either way: the archive
 *   ships fractional activations, not kinetics.
 *
 *   AMBIENT — the crowd drifts and the membrane sways. Neither carries a number
 *   and that is on the record already: the 108 background dots are scattered
 *   from a hash because "the scatter is not data" (see below), and the
 *   membrane's sag was fitted on screen. Nothing was measured, so nothing is
 *   claimed; this is the interior being alive, the way a room's dust is.
 *   What it BUYS is the depth the still frame could not give. The crowd's dots
 *   orbit through x AND z, so they pass in front of and behind each other, and
 *   the near ones swing further in world units than the far ones on top of the
 *   perspective divide already making them swing further on the glass — near
 *   0.100 against far 0.038 in world, which through this camera is 3.7x the
 *   screen travel. That ratio IS motion parallax and it is the whole reason the
 *   layer moves at all.
 *
 * ONE CLOCK, AND IT IS THE RUN'S. `reading.t` is already on the payload, so
 * nothing new is threaded through `SignallingScale`. It means the scene holds
 * perfectly still when the viewer pauses and works faster when they turn the
 * speed up, which is what the fibre scale does with `state.current.time` and
 * what this screen's own prose says it is: a picture on the network's clock.
 * `phase` accumulates CLAMPED forward steps rather than reading `t` directly,
 * so neither the loop's seam nor a scrub snaps the crowd sideways.
 *
 * NOTHING HERE GOES NEAR THE FLASH BAND. `gate-no-strobe.spec.js` measures this
 * scale on the WALL clock for the reason it gives, so that is the axis these
 * have to be quoted on: the fastest cycle on screen is a form at activity 1,
 * 3.5 s, which is 0.29 Hz, and the crowd's shortest orbit is 3.0 s. At the
 * viewer's top replay speed of 3x that is 0.87 Hz against a band that starts at
 * 3. There is no rate in this file a chip can push into it.
 *
 * WHAT IT COMES TO, PROJECTED THROUGH `SIGNALLING_CAMERA` AT 1280x800 OVER 9 s:
 * the nearest crowd dot travels 38.7 px and the farthest 9.4 — the parallax,
 * 4.1x — and ten of the thirteen forms reach the full arc. The three that do
 * not are `EnduranceExercise`, `B_AR` and `ROS`, which are exactly the three
 * the resistance bout never touches. About 2.7 % of the frame changes against
 * the 0.14 % it changed before. That is a fifth of the fibre scale's 31.6 % and
 * it is not a shortfall to fix by moving things harder: this scene is small
 * objects on open paper, so nearly every pixel that CAN move now does.
 */
/**
 * The arc, and the rate at full activity.
 *
 * ±0.45 rad is 26°, so a kinase's two lobes swing 52° between the extremes —
 * enough for the cleft to open and close in depth and for a chevron to show it
 * has a front, and far short of an angle that could turn an input arrow round.
 *
 * The rate is set by the ONE node at the top of the scale, not by an average: a
 * full cycle at activity 1 is 2π / (0.030 · 60) = 3.5 viewer-seconds at 1x, and
 * the busiest node in the run touches exactly 1 (`integrin` under resistance).
 * A node at the middle of the range takes 7. The first cut ran at 0.042, which
 * puts the hardest-driven forms extreme-to-extreme in 0.8 s — that is a
 * vibration, and a vibrating molecule is decoration whatever number is driving
 * it. THIS IS THE ONE CONSTANT IN THIS FILE A GATE CANNOT SETTLE: green means
 * the rate is the activity, and only an eye on the rendered scene can say
 * whether it reads as an interior or as a shiver.
 */
/*
 * THE ROCK IS GONE, 2026-09-05, AND WHAT REPLACED IT IS AN EVENT.
 *
 * `ROCK_ARC` and `ROCK_RATE` turned every node continuously, at a rate that was
 * its own activity. The brief's rule 8 refuses exactly that: *"nodes should not
 * continuously rock merely because they have a value. Activity should create
 * meaningful event-driven responses."* And the reading was right — a network of
 * thirteen things all turning is a screen where nothing is happening, loudly.
 * Worse, it was least honest where it moved most steadily: the archive's series
 * are mostly plateaus, so a node that had finished changing rocked exactly as
 * hard as one still climbing.
 *
 * WHAT THE RESPONSE IS NOW. A node swells and brightens on its own RISE — the
 * positive change in its activity over the frame's run-seconds — and the
 * response decays on its own. So the sequence a viewer sees is the one the brief
 * asks for: a pulse travels down the link, the node it reaches swells as its
 * value climbs, and it settles. A node on a plateau is still. A door the other
 * workout owns never moves at all, which was true before and is now the only
 * kind of stillness on screen rather than one shade of a general wobble.
 *
 * THESE THREE ARE DISPLAY CONSTANTS in the sense the colour ramp's endpoints
 * are: they say how a change is drawn, and nothing about the model. `BUMP_GAIN`
 * is what one unit of rise per run-second is worth, `BUMP_MAX` caps it so a
 * scrub cannot inflate a form, and `BUMP_DECAY` is how long the response lasts
 * in run-seconds.
 */
const BUMP_GAIN = 0.35;
const BUMP_MAX = 0.11;
const BUMP_DECAY = 12;
/* HOW FAR A NODE OFF THE SELECTED PATH DROPS. *"Everything unrelated fades
   SLIGHTLY"* — the brief's word, and it is doing work: at a heavier fade the
   selection stops being a highlight and becomes a different picture, which
   throws away the context that made the network worth showing. */
const FADE_UNRELATED = 0.22;
/** Bigger than any honest frame: 0.05 s clamped, 3x, 60 run-s per viewer-s. */
const MAX_RUN_STEP = 10;
const DUST_ORBIT = 0.1;
const DUST_PERIOD = [180, 420];
const MEMBRANE_SWAY = 0.05;
const MEMBRANE_TILT = 0.012;

/**
 * A point typed in the flat drawing's coordinates, put on the near wall.
 *
 * WHY A STORYBOARD NEEDS THIS AND WHY IT IS NOT THE STORYBOARD'S JOB. A beat
 * says where its subject is with `focusAt`, and every one of those is two
 * numbers off a band with a 0 after them — correctly, because a beat is about a
 * ROW of this drawing and a row has no depth. The drawing does now. Left
 * unlifted, `FocusRing` (billboarded, `depthTest` off, so it still draws on top)
 * pulses at where that row would project if it were flat, and the node it is
 * circling projects further out. Measured back when the camera was square-on at
 * z 4.4 (fov 38 vertical): a subject at x ±1.02 on the cytosol row sat at z
 * 0.559 and projected 0.771 of the stage's half-height off centre where the
 * flat beacon projected 0.673 — a gap of 0.098, 44 px on a 900 px stage. The
 * camera is off the axis now, so the same gap is horizontal as well and larger.
 * That is the same defect `focusAt` was added to fix one axis over, so
 * fixing it by hand-typing z into eight beats would be repeating the mistake the
 * comment there warns about — a fit that expires the next time the geometry
 * moves. The scene lifts, the storyboard stays about rows.
 *
 * IT IS THE ONE PLACEMENT FUNCTION NOW. `heroAt` was a second copy of the same
 * two lines, and the two would have parted the first time one of them learned
 * about the tip. A node is a point in the flat drawing like any other.
 */
export function heroLift(at, narrow = false) {
  return layoutOf(narrow).lift(at);
}

/** Where a hero node stands, from its row and column. */
/**
 * HOW FAR THE WHOLE DRAWING SITS BELOW THE FRAME'S MIDDLE.
 *
 * The rows are centred on y 0, which was right while every name plate hung
 * ABOVE its node: the drawing's real top was the top row's plate and its real
 * bottom was the bottom row's form, and those roughly balanced. The top row's
 * plates hang UNDERNEATH now — there is nothing above the two inputs to hang
 * them over — so the drawing's real top became the forms themselves and the
 * whole thing rode up into the headline while the paper below it stayed empty.
 * Half a plate's lift is exactly what the top gave up, so that is what it drops.
 */
const Y_DROP = FORM_R * 0.75;

export function heroAt(node, narrow = false) {
  return layoutOf(narrow).at(node);
}

/**
 * A deterministic 0..1 from an index and a salt.
 *
 * `Math.random` IS THE ONE THING THIS MUST NOT BE, and the reason is the same
 * one the lattice this replaces was written for: the background crowd carries no
 * meaning, so two runs of the same gate must not disagree about it and two
 * screenshots must not differ. What CHANGED is that a lattice plus a jitter is
 * still visibly a lattice — rows and columns you can count, which is what made
 * the crowd read as dirt on the lens rather than as the rest of the network
 * standing behind the subject. A hash gives the same guarantee with none of the
 * order: one integer mix (xorshift-multiply, the `hash32` everybody uses), three
 * salts, three axes.
 *
 * (The layer is 108 marks. This file's prose says 109 in three places, written
 * when `HERO_NODES` held twelve and not the thirteen it holds now. Left alone —
 * `heroNetwork.js` is the honesty layer and its census is not this lane's to
 * edit — but the number is not repeated in anything written here.)
 */
function rnd(i, salt) {
  let h = Math.imul(i ^ salt, 2654435761);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * A flat sheet swept back in z, from a curve.
 *
 * `TubeGeometry` gives a rod and there is no core geometry that gives a ribbon,
 * so this is the eight lines that do: two rows of vertices along the curve, one
 * at each depth, stitched. `computeVertexNormals` is enough because the strip is
 * planar in y at every span — the normals come out ±y and the sheath material is
 * double sided, so both faces shade.
 */
function sheet(curve, zNear, zFar, material, segs = 48) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segs; i += 1) {
    const p = curve.getPoint(i / segs);
    pos.push(p.x, p.y, zNear, p.x, p.y, zFar);
  }
  for (let i = 0; i < segs; i += 1) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * The two ways a link is drawn, and there are exactly two.
 *
 * The owner asked for it in those words — *"→ activation, ─| inhibition, 딱 두
 * 종류만 설명"* — and the model has exactly two signs, so this is a case where
 * the simplification and the data agree. An activation ends in a cone; an
 * inhibition ends in a crossbar, which is the notation every biology textbook
 * uses and the one thing on this screen a reader may already know.
 *
 * AND A LINK IS LIT NOW, WHERE IT WAS `MeshBasicMaterial` — unlit by definition.
 *
 * That was defensible while every arrow lay in the same plane pointing the same
 * two directions: an unlit stroke and a lit one look alike when nothing about
 * the geometry varies. It stopped being defensible the moment the nodes went
 * onto the dome. These arrows now run through z as well as x and y, so no two of
 * them face the key the same way — which is a depth cue the geometry is already
 * paying for and an unlit material throws away. A lit rod also has a top and a
 * side, which is the difference between a cylinder and a drawn line.
 *
 * SAME EXPOSURE AS THE NODE BODIES, deliberately: same constructor, same
 * roughness, same three lights. An arrow should be exactly as bright as a node
 * of its own colour would be — quieter than the nodes only because its tint
 * stays quiet until the link lights, and because it is transparent underneath
 * them. An earlier version added `emissive` at 0.45 as a floor against the
 * signalling scene's low ambient, and it was wrong in the way that is easy to
 * miss: emissive is not affected by opacity or by the light rig, so it made the
 * ARROWS brighter than the things they join. The connective tissue outshining
 * the subject is worse than an arrow being dim.
 *
 * `depthWrite` IS PASSED RATHER THAN LEFT TO THE OPACITY RULE. `anatomyMaterial`
 * decides it once from the opacity it is built with, and `update` drives this
 * one from 0.26 to 0.86 — across that threshold. Arrows cross each other and
 * cross the forms; none of them may punch a hole in what is behind it.
 */
/** How thick a stroke between two nodes is, as a share of the thing it joins. */
/* THICKENED 0.11 -> 0.19, 2026-09-02. Judged on the screen, not on a metric:
   at 0.11 the arrows on both deep scales are pale rods a viewer has to look for,
   and the owner's reading of the cell picture found them last of everything on
   it. An arrow nobody sees is a relation nobody reads, and these arrows ARE the
   claim — which node feeds which. Still well under half a link's own head
   (`LINK_R * 2.5`), so a link still reads as a line with a point on it rather
   than as a limb. */
/* ITS OWN DIAL SINCE 2026-09-05, AND THAT IS THE POINT OF THE CHANGE. It was
   `FORM_R * 0.19`, which tied the stroke to the sculpture and meant the only way
   to make connections matter was to make nodes bigger — the opposite of what
   SIGNALS is for. The brief's line is *"connections and travelling signals are
   the protagonists"*, so the two are now independent numbers and this one is set
   against the ROW, not against the form: 0.055 is a sixth of `ROW_GAP`, so a
   link reads as a conduit with width rather than as a drawn line.
   Node diameter went 0.51 -> 0.39 and link diameter 0.097 -> 0.110 in the same
   edit, so the ratio between them went 5.3 : 1 to 3.5 : 1. */
/* 0.055 -> 0.016, 2026-09-06, AND THE ARGUMENT ABOVE INVERTS. It thickened the
   conduit so the connection would matter; the owner's §3 says the connection
   matters by what TRAVELS on it — *"Thin curved paths + travelling signal
   packets … 큰 arrowhead는 없어도 됩니다. 움직임 자체가 방향을 말하게"*. So the
   path is a hairline of a tube and the packets (`PULSE_R`) are half again as
   wide as it: at rest a line, under signal a line with things moving on it. */
const LINK_R = 0.016;
/* THE ENDING'S ARCS (fifth brief §1): around the outcome, not on it — 1.8 R
   clears the grown growth disc and the budded mitochondrion — thinner than a
   path, and at most 149° each so the two never meet at the sides and read as
   a ring. The fade runs on the viewer's seconds because the clock stands
   still at the ending. */
export const ARC_R = FORM_R * 1.8;
const ARC_TUBE = LINK_R * 0.6;
const ARC_SWEEP = 2.6;
const END_TAU = 0.13;
/* OUT FASTER THAN IN. The run leaves its last sample on the cut frame, under
   the paper sheet (`runVeil.js`), and the sheet is off 250 ms later; at the
   fade-in constant an arc was still at 0.13 of its opacity when the 0-minute
   picture came back (reviewed 2026-09-06). 0.05 s is 95 % gone in 150 ms. */
const END_TAU_OUT = 0.05;
/** How far a path bows off its chord, as a share of its length, and the least it bows. */
const LINK_BOW = 0.16;
const LINK_BOW_MIN = LINK_R * 3.6;

function linkMesh(from, to, { sign, direct }, colour, opacity) {
  const group = new THREE.Group();
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const along = new THREE.Vector3().subVectors(b, a);
  const length = along.length();
  if (!(length > 0)) return group;
  const dir = along.clone().normalize();
  /* Stop short of both ends so the line does not run under the forms it
     joins — a stroke that disappears into a node reads as one object. */
  const head = sign < 0 ? 0.03 : 0;
  const start = a.clone().addScaledVector(dir, HERO_R * 1.05);
  const stop = b.clone().addScaledVector(dir, -(HERO_R * 1.05 + head));
  const span = start.distanceTo(stop);

  /* A CURVED PATH, NOT A ROD — owner §3, 2026-09-06. One quadratic bend, bowed
     in the picture plane AWAY from the axis, so the two arms' routes read as
     the "╲ ╱" of a convergence rather than as a wiring diagram. The bow is a
     share of the span with a floor, because the short vertical links would
     otherwise be straight to the eye while the long diagonals curved. The same
     curve carries the packets: `userData.path` is what `buildHeroLevel` rides
     them along, so a path and its traffic cannot disagree about where the
     connection is. */
  const perp = new THREE.Vector3(-dir.y, dir.x, 0);
  if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
  perp.normalize();
  const midX = (from[0] + to[0]) / 2;
  const away = Math.sign(perp.x * midX) || 1;
  const control = start
    .clone()
    .lerp(stop, 0.5)
    .addScaledVector(perp, away * Math.max(LINK_BOW * span, LINK_BOW_MIN));
  const path = new THREE.QuadraticBezierCurve3(start, control, stop);
  group.userData.path = path;
  group.userData.perp = perp;

  /* LIT, NOT `MeshBasicMaterial` — see the note above `linkMesh`. Same finish
     as the forms, so the connective tissue and the subject share one light. */
  const material = anatomyMaterial({
    colour,
    roughness: FORM_ROUGHNESS,
    opacity,
    depthWrite: false,
  });

  if (span > 0) {
    /* ONE LANGUAGE — pass 4, P0, the owner's §1: *"Path = line, quiet /
       Information = moving bead, active … 구슬 여러 개를 이어서 line 자체를 만드는
       건 제거."* The two collapsed multi-step links used to be bead chains and
       read as stalled signals. They are lines now — at 0.7 of a direct edge's
       radius, so the approximation still shows as a lighter stroke — and the
       fact that they stand for several of the model's edges is said once, in
       the link's own label (`B_AR to AMPK · 4 steps`, below), which is where
       `heroNetwork.linksOf`'s `steps` reaches a reader. §5: be an
       approximation, say so once. */
    group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 24, direct ? LINK_R : LINK_R * 0.7, 8, false), material));
  }

  /* THE INHIBITION BAR STAYS AND THE ARROWHEAD DOES NOT — see the 2026-09-05
     note this replaces: direction is the packets' to say, but "suppresses" is
     a claim of the archive's that motion cannot carry. Set across the path's
     own tangent at its end. */
  if (sign < 0) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(LINK_R * 3.6, LINK_R * 0.75, LINK_R * 0.75), material);
    const end = path.getTangentAt(1);
    bar.position.copy(stop).addScaledVector(end, head * 0.5);
    bar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-end.y, end.x, 0).normalize());
    group.add(bar);
  }
  return group;
}

/**
 * A wrapper the pointer goes straight through.
 *
 * NOT SPECULATIVE — this is a landmine being defused as it is laid. Nothing on
 * either deep scale raycasts today: `Handle` puts its button in an `<Html>`
 * layer the canvas never sees, and R3F skips the raycast entirely while no
 * object carries a handler. But canon G1's state 4 is *"each elements
 * clickable"*, both scales already draw a handle per node, and the first thing
 * that moves a picker into the canvas meets a double-sided surface standing in
 * front of every one of them. A full-frame wrapper that swallows every click is
 * a bug nobody would look for in a file about depth.
 */
function blind(object) {
  object.raycast = () => {};
  return object;
}

function tag(object, role, label) {
  object.userData.role = role;
  if (label) object.userData.fiberLabel = label;
  return object;
}

/**
 * Build the scene.
 *
 * @param routes  `routesOf(arms)` — for `types`, `names` and the arm buckets
 * @param edges   the archive's own edge list; without it there are no links
 * @param dust    ids of every node NOT drawn large, for the background layer
 */
export function buildHeroLevel(routes, edges = null, dust = [], { narrow = false } = {}) {
  const group = new THREE.Group();
  group.name = "HeroSignalling";

  /* WHICH GRID — see `layoutOf`. Everything below that depends on the grid
     reads `L`, never the module constants, which are the wide layout only. */
  const L = layoutOf(narrow);
  const at = new Map(HERO_NODES.map((n) => [n.id, L.at(n)]));
  const rows = L.rows;
  const topY = L.topY;
  const bottomY = -L.topY;

  /* ---- the cell the network is inside ---------------------------------- */

  /* THE MEMBRANE, AND THE NETWORK IS UNDER IT. The doors are receptors, so the
     boundary belongs between the inputs and the doors — one row gap up from the
     door row. It runs wider than the drawing and falls away at both ends,
     because a cell is a closed thing and a line that stops where its contents
     stop reads as an axis. Kept from the scene this replaces, where it was
     measured; the only change is which row it sits above. */
  /* 0.62 -> 0.34, PASS 4 §4: *"membrane이 약간 강함 … Network path보다 강하면
     안 돼."* Measured as luminance contrast x opacity, a leaflet at 0.62 weighed
     0.52 against a resting path's 0.30 — twice the path. 0.34 puts it under
     (0.28); `heroMotion.test.js` holds the order. */
  const cellMat = sheathMaterial({ colour: QUIET_TINT /* stone, not the warm arm — owner, SIGNALS 21 */, opacity: 0.29 /* 0.34 -> 0.29: the stone is darker than the warm brown, so the same opacity weighed 0.304 against a resting path's 0.302 */ });
  /* AT THE DOOR ROW, NOT ABOVE IT. The first version put the bilayer halfway
     between the inputs and the doors, and screenshotted at 1280x900 that left
     `integrin` and `B_AR` hanging UNDER a membrane they are supposed to cross —
     a receptor drawn below its own membrane is the one thing about a receptor
     that everybody knows, drawn wrong. The row's own y, so the helices straddle
     it and the outside domain is genuinely outside. */
  const doorRow = Math.min(...HERO_NODES.filter((n) => n.kind === "door").map((n) => n.row));
  /* MINUS `Y_DROP`, 2026-09-06 — `heroAt` drops every form by it and this did
     not follow, so the bilayer ran 0.10 above the doors' centres and grazed the
     receptors' heads instead of crossing their middles. The owner's §5 sketch
     puts MEMBRANE as the drawing's top boundary with the receptors in it. */
  const membraneY = (rows / 2 - doorRow) * L.rowGap - Y_DROP;
  const cellHalf = L.cellHalf;
  const sag = 0.11;
  const curveAt = (dy) =>
    new THREE.CatmullRomCurve3(
      [
        [-cellHalf, membraneY + dy - sag],
        [-cellHalf * 0.72, membraneY + dy - sag * 0.34],
        [0, membraneY + dy],
        [cellHalf * 0.72, membraneY + dy - sag * 0.34],
        [cellHalf, membraneY + dy - sag],
      ].map(([x, y]) => new THREE.Vector3(x, y, 0)),
    );
  const leaflet = (dy) => {
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curveAt(dy), 64, 0.008, 6, false),
      cellMat,
    );
    mesh.renderOrder = -4;
    return mesh;
  };
  /* THE BOUNDARY IS ONE OBJECT SO IT CAN SWAY AS ONE. Two leaflets and the
     sheet between them are one surface, and a bilayer whose halves drifted
     apart would be drawing a hole in the cell. One parent, one transform. */
  const membrane = new THREE.Group();
  membrane.name = "Membrane";
  group.add(membrane);
  membrane.add(tag(leaflet(0.016), "membrane-outer", "cell membrane"));
  membrane.add(tag(leaflet(-0.016), "membrane-inner", "cell membrane"));

  /* AND A MEMBRANE IS A SURFACE, NOT A PAIR OF WIRES.
     The two leaflets above are the bilayer's SILHOUETTE and they are correct as
     lines; what they were not is a boundary anything could be on a side of. Both
     sat at z −0.05 and every node sat at z 0, so the picture had no inside: the
     receptors were beside the membrane rather than through it, and there was
     nothing for the depth the twelve now have to be depth INTO.
     One sheet, swept from in front of the nearest receptor to behind the far
     wall of the cell, so the doors are genuinely embedded in it — dead-on it
     shows as a thin wedge that thickens toward the ends where the sag is
     steepest, which is a surface receding; turned even slightly it is a floor
     the network hangs under. Faint, because it runs across the whole frame and
     it is atmosphere rather than a mark: the leaflets sit at 0.34 (pass 4)
     and this keeps well under it. */
  const filmMat = sheathMaterial({ colour: QUIET_TINT /* stone, not the warm arm — owner, SIGNALS 21 */, opacity: 0.09 });
  const film = sheet(curveAt(0), L.membraneFront, L.membraneBack, filmMat);
  film.renderOrder = -4;
  membrane.add(blind(tag(film, "membrane-sheet", "cell membrane")));

  /* ---- the hundred and nine -------------------------------------------- */

  /* SCATTERED, AND THE SCATTER IS NOT DATA. These carry no position the model
     could justify — that is the whole reason they are dust rather than marks.
     What they are is a true statement about size: the network the twelve are cut
     from has this many more things in it.

     IT WAS A LATTICE ON ONE PLANE AND IT READ AS DIRT ON THE LENS. Every one of
     them sat at z −0.16, on a grid of `perRow` columns with a ±0.03 jitter
     that is far too small to hide the rows — so they were an even stipple across
     a flat rectangle, at one size and one value, sixteen hundredths of a unit
     behind the subject. Nothing about that says "behind": the eye reads an even
     texture at a constant size as a surface, and a surface in front of nothing
     is a mark on the glass.
     FOUR THINGS MAKE IT A CROWD INSTEAD, and each is one line:
       · DEPTH, AND IT NOW STARTS IN FRONT OF THE SUBJECT. Spread from the
         membrane's own leading edge to the far wall of the cell, so they occupy
         2.3 units of z rather than a plane. The near ones read as objects and
         the far ones as a haze, from the same geometry — and the nearest of them
         cross the thirteen, which is the one depth statement the scene used to
         forbid itself. `DUST_NEAR` carries that argument.
       · THE FRUSTUM WIDENS WITH DISTANCE and so does the crowd. A perspective
         camera 4.4 away sees 55 % more height at the far wall than at z 0, so a
         field that kept the same world width would shrink into a plaque in the
         middle of the frame. `spread` opens it at the same rate the view does,
         which is what fills the corners and makes the picture read as a window
         rather than as a card.
       · IT COMES IN SIZES. One radius for every mote is a stipple and a stipple
         is a surface; `DUST_SIZE_MIX` gives each one its own, off a second hash,
         inside a bound narrow enough that the depth ramp below still wins.
       · IT RECEDES IN SIZE AND IN VALUE. Perspective already shrinks the far
         ones; `s` shrinks them again so the gradient is unmistakable, and each
         instance is tinted toward the stage's own paper by how far back it is.
         That is the atmospheric falloff `SCENE.background` exists for, done per
         instance rather than with `THREE.Fog` — which was tried first and is
         wrong here: fog is measured from the camera and `OrbitControls` lets a
         viewer travel from 1.4 to 10 away, so any near/far pair that reads
         correctly at rest is either switched off entirely when they zoom in or
         a whiteout when they pull back. A tint baked into the instance is fixed
         to the SCENE and cannot be zoomed out of.
     LIT, NOT `MeshBasicMaterial`. A field of unlit discs is a field of discs;
     the same spheres under the same three lights as everything else pick up the
     key and read as balls. `instanceColor` multiplies the
     material's own colour in the shader, so the material is left white and every
     instance carries its own — one draw call either way. */
  let driftDust = null;
  if (dust.length) {
    const geo = new THREE.SphereGeometry(DUST_R, 6, 5);
    const material = anatomyMaterial({
      colour: "#ffffff",
      roughness: SURFACE.roughnessStatic,
      /* OPAQUE, 2026-09-02, AND THE CELL SCALE ALREADY WROTE THIS ARGUMENT.
         `cellChainGeometry.js` says of its own crowd: "OPAQUE, WHERE THE
         SIGNALLING CROWD IS TRANSPARENT AT 0.62 ... the recession is carried
         entirely by the tint, which is where the signalling scale's own note
         says the falloff belongs."
         The note at `DUST_NEAR` above spent a constant to put these motes IN
         FRONT of the thirteen, calling occlusion "the one depth statement the
         scene could have made for free" — and then blended them at 0.62, so a
         near mote tinted the form it crossed instead of covering it. The
         statement was bought and never collected. This REMOVES a translucency
         rather than adding one, so it does not touch the uncertainty channel. */
      opacity: 1,
      /* DEPTH-WRITING THOUGH IT IS TRANSPARENT, AND THAT IS THE POINT. All 108
         are one `InstancedMesh`, so three sorts them against other OBJECTS and
         never against each other — instances draw in index order. With no depth
         write, an instance at the far wall drawn after one at −0.24 blends OVER
         it, and the whole depth grading this layer was rebuilt for is undone at
         every overlap by the draw order.
         Sorting the instances back-to-front at build time was the other answer
         and it is the wrong one: `OrbitControls` is enabled here, so a sort
         baked for the default camera is wrong the moment anybody turns the
         scene. Writing depth is view-independent and free — the crowd renders
         first (renderOrder −5) and everything else in the scene is in front of
         it, so nothing it occludes is anything a viewer should have seen. */
      depthWrite: true,
    });
    const mesh = new THREE.InstancedMesh(geo, material, dust.length);
    const m = new THREE.Matrix4();
    const quiet = new THREE.Color(QUIET_TINT);
    const paper = new THREE.Color(SCENE.background);
    const tint = new THREE.Color();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    /* WHERE EACH ONE SITS WHEN NOTHING HAS MOVED YET, kept because the drift
       below is an OFFSET from it. Writing the drift into the matrix in place
       would compound its own rounding over a long visit and walk the crowd off
       the frame; an absolute base plus a bounded offset cannot drift anywhere. */
    const base = new Float32Array(dust.length * 3);
    /* Per dot: orbit radius, angular rate, starting angle, and the scale the
       build already gave it (`m.compose` overwrites scale, so it has to be
       carried rather than recomputed from a hash every frame). */
    const orbit = new Float32Array(dust.length * 4);
    for (let i = 0; i < dust.length; i += 1) {
      const d = rnd(i, 0x9e37);
      const spread = 1 + d * 0.55;
      base[i * 3] = (rnd(i, 0x85eb) - 0.5) * cellHalf * 2.3 * spread;
      base[i * 3 + 1] = (rnd(i, 0xc2b2) - 0.5) * (topY - bottomY + L.rowGap) * 1.05 * spread;
      base[i * 3 + 2] = L.dustNear + d * (L.dustFar - L.dustNear);
      /* THINNER RIGHT BEHIND THE PATH — PASS 4 §6: *"hero path 주변 density 약간
         감소"*. A mote whose scatter lands within 0.22 of a hero node's own x,y
         — measured with its own drift swing inside the radius, since the orbit
         below carries it up to `DUST_ORBIT` off this base — is moved radially
         to just outside that radius and checked against every node again (the
         door row is dense enough that a push along x alone ping-ponged between
         ROS and B_AR). The count stays the archive's and the scatter a hash. */
      {
        const swing = DUST_ORBIT * (1 - 0.62 * d) * 1.1;
        for (let pass = 0; pass < 6; pass += 1) {
          let hit = null;
          for (const [, [hx, hy]] of at) {
            const dx = base[i * 3] - hx;
            const dy = base[i * 3 + 1] - hy;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.22 + swing) { hit = [dx, dy, dist]; break; }
          }
          if (!hit) break;
          const [dx, dy, dist] = hit;
          const step = 0.22 + swing - dist + 0.02;
          base[i * 3] += (dist > 1e-6 ? dx / dist : 1) * step;
          base[i * 3 + 1] += (dist > 1e-6 ? dy / dist : 0) * step;
        }
      }
      /* NEAR SWINGS FURTHER THAN FAR, IN WORLD UNITS, ON TOP OF THE PERSPECTIVE
         DIVIDE ALREADY DOING THAT ON THE GLASS. This is the parallax and it is
         the only reason this layer moves; a crowd drifting by one constant
         amplitude reads as a texture sliding, which is the flat thing the
         scatter was rebuilt to stop being. */
      orbit[i * 4] = DUST_ORBIT * (1 - 0.62 * d);
      orbit[i * 4 + 1] =
        (Math.PI * 2) / (DUST_PERIOD[0] + rnd(i, 0x1b7f) * (DUST_PERIOD[1] - DUST_PERIOD[0]));
      orbit[i * 4 + 2] = rnd(i, 0x51ed) * Math.PI * 2;
      /* THE DEPTH RAMP TIMES ONE MOTE'S OWN SIZE, and the ramp is the term that
         has to win — see `DUST_SIZE_MIX`, and the gate that holds the
         inequality. Two hashes, two different things: `d` is where it stands and
         this is how big it is, and a field where those were the same number
         would be a size chart rather than a crowd. */
      orbit[i * 4 + 3] =
        (1 - 0.45 * d) *
        (DUST_SIZE_MIX[0] + rnd(i, 0x27d4) * (DUST_SIZE_MIX[1] - DUST_SIZE_MIX[0]));
      /* THE FAR END STOPS SHORT OF THE PAPER, WHICH THE FIRST RAMP DID NOT.
         It ran `0.1 + 0.72 * d`, and 0.72 is not a wash toward the paper — it is
         a wash INTO it. Measured: the deepest instances came out #e5e2df, and
         then the material's own 0.62 opacity washes them again, so what actually
         reached the glass was about #eaeae7 against #faf8f5 — sixteen values off
         the background, on a mote four pixels across. Two thirds of this layer
         was drawing nothing at all, which is most of why the field's discs
         summed to 0.27 % of the picture.
         0.55 leaves the far end near #d9d7d3 on the glass: about a third of the
         near motes' separation from the paper, so the gradient is still steep
         and unmistakably receding, and the far half is now haze rather than
         absence. The near end is where it was. THIS IS CONTRAST, NOT FILL — the
         paper is untouched and stays the pale thing it is; what changed is that
         the objects standing on it are visible at both ends of the depth. */
      /* THE RAMP MOVED WITH THE OPACITY, 2026-09-02, AND NOT MOVING IT WAS A BUG
         I SHIPPED FOR ONE COMMIT. The note above states the coupling out loud —
         "then the material's own 0.62 opacity washes them again" — so this ramp
         was tuned to be blended. The material went opaque so the near motes
         would OCCLUDE what they cross instead of tinting it, and this line was
         left where it was: every mote suddenly carried its full albedo. On the
         screen the near ones read as heavy grey marbles competing with the
         thirteen, which is the opposite of what the crowd is for.
         Re-derived rather than re-guessed. `QUIET_TINT` #403c36 at 0.62 over
         #faf8f5 paper landed near #878480, which needs a lerp of 0.42 to reach
         from an opaque albedo; the far end landed near #cfcdc9, which needs
         0.77. So 0.42 + 0.35d puts both ends of the gradient back exactly where
         they were on the glass, with the occlusion kept. */
      /* FAINTER STILL, 2026-09-06 — owner §7: *"아주 faint한 network
         constellation"*. The whole layer now stands behind the thirteen, so it
         no longer has to hold its own against them; it has to read as a haze
         with structure. 0.62..0.88 of the way to the paper. */
      /* PASS 3: 0.84..0.98 of the way to the paper — §3's ladder puts the
         background at a tenth of the weight of the hero topology. */
      /* PASS 4 §6 *"depth fade 강화"*: 0.88..0.98 of the way to the paper. */
      mesh.setColorAt(i, tint.copy(quiet).lerp(paper, 0.88 + 0.1 * d));
    }
    /* THE TINT IS NOT REWRITTEN AS THEY MOVE, and that is a rounding rather
       than a hole: the orbit is at most 0.1 deep against the 2.26 of z the
       falloff is graded over, so a dot's haze is out by under 5 % of one step
       at the extreme of its swing. Rewriting `instanceColor` every frame to
       chase that would cost a second buffer upload for a difference nothing
       can see. */
    /* HAIRLINE EDGES, SO THE CROWD IS A NETWORK AND NOT DUST — owner §7:
       *"random sphere 대신 아주 faint한 network constellation … 작은 dim nodes,
       hairline edges … 이건 더 큰 network의 일부다"*. Each mote is wired to its
       two nearest neighbours in the scatter (deterministic, off the same hashed
       positions), deduplicated, and drawn as one `LineSegments` — a hairline is
       a GL line, one pixel at any distance, which is exactly the weight the
       word asks for and is not a weight a tube can hold at this size. THE WIRES
       ARE NOT DATA any more than the scatter is: which mote sits next to which
       is a hash, so which is joined to which is too. They say "the rest of the
       network has connections", which is true, and nothing about any one. Their
       endpoints are rewritten every frame from the same drift, so the
       constellation moves as one thing; `heroMotion.test.js` holds the
       endpoints on the motes at build and after a drift. */
    const NEIGHBOURS = 2;
    const pairs = [];
    {
      const seen = new Set();
      for (let i = 0; i < dust.length; i += 1) {
        const near = [];
        for (let j = 0; j < dust.length; j += 1) {
          if (j === i) continue;
          const d2 =
            (base[i * 3] - base[j * 3]) ** 2 +
            (base[i * 3 + 1] - base[j * 3 + 1]) ** 2 +
            (base[i * 3 + 2] - base[j * 3 + 2]) ** 2;
          near.push([d2, j]);
        }
        near.sort((u, v) => u[0] - v[0]);
        for (const [, j] of near.slice(0, NEIGHBOURS)) {
          const key = i < j ? `${i}:${j}` : `${j}:${i}`;
          if (seen.has(key)) continue;
          seen.add(key);
          pairs.push([i, j]);
        }
      }
    }
    const cur = new Float32Array(dust.length * 3);
    const wirePos = new Float32Array(pairs.length * 6);
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute("position", new THREE.BufferAttribute(wirePos, 3));
    const wires = new THREE.LineSegments(
      wireGeo,
      new THREE.LineBasicMaterial({
        /* Photographed at 0.55 over a 0.6 lerp: the wires read before the
           network did. Owner §7's word is *"아주 faint"*. */
        color: tint.copy(quiet).lerp(paper, 0.78),
        transparent: true,
        /* PASS 3: 0.32 -> 0.22 — the wires that crossed the active structure
           were the loudest thing in the background layer; at 0.16 the field
           vanished altogether, photographed. */
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    wires.frustumCulled = false;
    wires.renderOrder = -5;
    group.add(blind(tag(wires, "background-edges", "the rest of the network")));

    driftDust = (at) => {
      for (let i = 0; i < dust.length; i += 1) {
        const a = orbit[i * 4];
        const angle = orbit[i * 4 + 2] + orbit[i * 4 + 1] * at;
        /* A CIRCLE IN x AND z, not a slide across the frame. Half of every
           orbit is travel through depth, so a dot changes size, changes which
           of its neighbours it is in front of, and turns round at two points a
           viewer can see — none of which a motion in the picture plane does. */
        p.set(
          base[i * 3] + a * Math.cos(angle),
          base[i * 3 + 1] + a * 0.4 * Math.sin(angle * 0.73),
          base[i * 3 + 2] + a * Math.sin(angle),
        );
        s.setScalar(orbit[i * 4 + 3]);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        cur[i * 3] = p.x;
        cur[i * 3 + 1] = p.y;
        cur[i * 3 + 2] = p.z;
      }
      mesh.instanceMatrix.needsUpdate = true;
      for (let k = 0; k < pairs.length; k += 1) {
        const [i, j] = pairs[k];
        wirePos[k * 6] = cur[i * 3];
        wirePos[k * 6 + 1] = cur[i * 3 + 1];
        wirePos[k * 6 + 2] = cur[i * 3 + 2];
        wirePos[k * 6 + 3] = cur[j * 3];
        wirePos[k * 6 + 4] = cur[j * 3 + 1];
        wirePos[k * 6 + 5] = cur[j * 3 + 2];
      }
      wireGeo.attributes.position.needsUpdate = true;
    };
    driftDust(0);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.renderOrder = -5;
    group.add(tag(mesh, "background-nodes", "the rest of the network"));
  }

  /* THE GROUND, AND IT IS ONLY A SHADOW — see `cellChainGeometry.js` for the
     whole argument, which is the same one: `ShadowMaterial` draws nothing but
     what falls on it, so a catcher needs no colour and cannot get the page's
     theme wrong.
     NO SHAPE CUT OUT OF IT HERE, unlike the cell scale. That one has a closed
     outline to clip against and a shadow outside it would be a shadow on open
     paper; this screen's only boundary is the membrane arc across the top and
     the cytosol under it is drawn as open, so the plane is a plain rectangle and
     its edges never show — a `ShadowMaterial` is invisible everywhere a shadow
     is not.
     Just behind the twelve rather than at the far wall, for the reason the cell
     scale measured: `SHADOW.projector` throws 0.183 across and 0.300 down per
     unit of gap, so the plane's depth sets the whole range. Three quarters of a
     row behind the DEEPEST of the twelve, which is where −0.10 was when the
     drawing floated in front of z 0 and where a literal would no longer be: the
     gaps run 0.24 to 0.71 of a unit, so the throws run 0.07 to 0.21 down, 0.23
     to 0.67 of one row. The widest is B_AR, at the membrane and nearest the
     viewer. At the far wall the same twelve would throw past a row and land
     their shadows under other nodes. */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(cellHalf * 3, (topY - bottomY) * 1.8),
    new THREE.ShadowMaterial({ opacity: SHADOW.catcher, depthWrite: false }),
  );
  ground.position.z = L.zFar - L.rowGap * 0.75;
  ground.renderOrder = -3;
  group.add(blind(tag(ground, "cell-ground")));

  /* ---- the floor the outcomes stand on ---------------------------------- */

  /*
   * WHY THE BOTTOM ROW GETS A SURFACE AND NO OTHER ROW DOES.
   *
   * The brief's rule 7: *"outcomes must look different from relay nodes …
   * should visually feel like consequences rather than another row of
   * molecules."* Half of that was already true — `heroForms.js` draws a ribosome
   * with a strand coming off it, a fibre cross-section and a dividing
   * mitochondrion, so the three SHAPES are not relays. What was missing is that
   * they sat in the same empty space as every relay above them, so the drawing
   * said "row six" where it meant "this is where it all ends up".
   *
   * A SHELF IS THE CHEAPEST TRUE THING TO DRAW. It is not a compartment and does
   * not claim to be one — `SIGNALLING_EXTENT` still says this model has no
   * measured geometry, and the membrane above is the only boundary the cell
   * actually has. This is a floor: the composition's bottom, under the three
   * things the whole descent has been travelling toward, so a viewer arriving at
   * the outcome row can see they have arrived somewhere rather than at more
   * network. It carries no value, no arm and no number.
   *
   * SET OFF THE ROW, NOT TYPED. It sits half a row under the outcome row's own
   * y, so moving a node between rows cannot leave the shelf behind.
   */
  /* THE SHELF AND ITS LIP ARE GONE, 2026-09-06 — owner §8: *"현재 아래쪽 pink
     rectangle과 label은 임시 debug shelf처럼 보입니다 … 큰 border rectangle을 그릴
     필요는 없습니다."* What separates the outcomes from the network now is one
     hairline across the drawing between the last relay row and the outcome
     row, on the outcome plane — the owner's own sketch, `────────────`, with the
     word OUTCOMES hung off its left end by the page (`zone`, returned below).
     Set off the rows, not typed, so a moved row moves it. */
  const outcomeRow = Math.max(...HERO_NODES.filter((n) => n.kind === "outcome").map((n) => n.row));
  const zoneY = (rows / 2 - (outcomeRow - 0.5)) * L.rowGap - Y_DROP;
  const zoneHalf = cellHalf * 0.78;
  const zoneZ = -L.plane;
  const zoneLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0035, zoneHalf * 2, 5),
    anatomyMaterial({ colour: QUIET_TINT, roughness: FORM_ROUGHNESS, opacity: 0.34, depthWrite: false }),
  );
  zoneLine.rotation.z = Math.PI / 2;
  zoneLine.position.set(0, zoneY, zoneZ);
  zoneLine.renderOrder = -4;
  group.add(blind(tag(zoneLine, "outcome-line", "what the cell ends up doing")));
  const zone = { at: [-zoneHalf, zoneY, zoneZ], half: zoneHalf, y: zoneY, z: zoneZ };

  /* ---- the links -------------------------------------------------------- */

  const links = linksOf(edges ?? []).filter(Boolean);
  const linkGroups = new Map();
  for (const link of links) {
    const from = at.get(link.from);
    const to = at.get(link.to);
    if (!from || !to) continue;
    const mesh = linkMesh(from, to, link, QUIET_TINT, 0.3);
    mesh.renderOrder = -1;
    linkGroups.set(`${link.from} ${link.to}`, { mesh, link });
    group.add(
      tag(mesh, `link-${link.from}-${link.to}`, `${link.from} to ${link.to}${link.direct ? "" : ` \u00b7 ${link.steps} steps`}`),
    );
  }

  /* ---- what travels along them ------------------------------------------ */

  /*
   * BEADS ON THE LIT LINKS, AND WHY THIS IS NOT THE THING THIS FILE FORBIDS.
   *
   * The rule a few hundred lines up is exact and it stands: *"the archive ships
   * activities, not fluxes, so how much of a node's rise came down any one
   * arrow is not a number this model has."* That forbids a MAGNITUDE — a bead
   * whose rate, spacing or count stands for how much signal went down an edge.
   *
   * It does not forbid movement. A link already lights on
   * `min(activity[from], activity[to])`, and this file already calls that "the
   * only claim the drawing can support". These beads carry exactly that claim
   * and no other: they exist in proportion to the same k, so a link the bout
   * never drives shows nothing at all, and they travel at ONE constant display
   * speed that is the same on every edge in the picture. A viewer can read
   * "this connection is carrying" off them and cannot read "this one carries
   * more than that one", because it does not.
   *
   * SPEED IS A DISPLAY CONSTANT, the same kind of number as `BUMP_GAIN`. It says
   * how fast a thing that is travelling is drawn as travelling, and nothing
   * about the model. Four per edge per arm so the eye reads a direction rather
   * than a blinking dot, spaced evenly so no gap can be mistaken for a rate.
   */
  /* TWO STREAMS ON ONE NETWORK, WHICH IS THE WHOLE FLOOR — 2026-09-05.
     This layer used to draw one bout's beads in one colour, because the scene
     drew one bout. The SIGNALS brief makes both arms the default and the
     non-negotiable is rule 1: *"both resistance and endurance must be visible
     together by default"*, with rule 2 asking that they be told apart by warm
     and cool. So every link now carries up to two streams, offset to either
     side of its own axis, and a viewer reads divergence and convergence off
     WHICH streams are running on which link rather than off a legend.
     · a link only resistance drives shows one warm stream
     · a link only endurance drives shows one cool stream
     · a link both drive shows both, side by side, travelling together
     That last case is `JNK`, and it is the convergence beat drawn rather than
     narrated.
     THE CLAIM IS UNCHANGED AND SO IS THE RULE ABOVE IT. A stream exists in
     proportion to `min(activity[from], activity[to])` for ITS OWN arm, and
     every pulse on every edge travels at one display speed. So a viewer can
     read "this connection is carrying, for this workout" and still cannot read
     "this one carries more than that one" — the archive ships activities, not
     fluxes, and nothing here has started claiming otherwise. What is new is
     that the question now has two answers on screen at once, which is the only
     way a comparison can be seen instead of asserted. */
  /* SPACED BY LENGTH RATHER THAN COUNTED PER LINK, and a screenshot is why.
     Four per edge is right for the long ones and wrong for the short: the input
     to door links are about 0.3 long, and four pulses at this radius on 0.3 of
     travel touch each other and pile onto the node, which photographed as a red
     and blue barber pole wrapped round the receptor rather than as anything
     travelling. One pulse per `PULSE_EVERY` of link, floored at two so a short
     edge still shows a direction, capped at six so a long one is not a rope. */
  /* ONE BEAD PER ARM PER EDGE — owner §1: *"한 edge에 이동 packet 1~3개 정도"*,
     and he counts per EDGE, not per arm. Two per arm on the long diagonals put
     FOUR on a shared long path under Both (S6 → Protein, PGC-1α → mitochondria;
     his list of 2026-09-06). One per arm is one or two per edge everywhere,
     and it is what makes the turns below even: with one bead each, the cool
     stream half a crossing behind the warm one lands exactly between two warm
     landings. `heroMotion.test.js` counts per edge. */
  /* STRONGER THAN THE PATH, 2026-09-06 — owner §1's last line, *"Signals
     stronger"*, against a path that is now a hairline (`LINK_R`). A packet is
     1.6 of the path's radius: the thing travelling is the thing seen. */
  /* 1.6 -> 1.9, PASS 3 — §3 *"Signal packet strongest of all"*: at 1.6 the
     packets photographed as 7 px dots on a widened stage. */
  const PULSE_R = LINK_R * 1.9;
  /** Fraction of a link crossed per run-second. One number, every edge, both arms. */
  const PULSE_SPEED = 0.011;
  /* HOW FAR OFF THE PATH EACH STREAM RIDES. Just past its own radius, so the two
     streams clear the path and each other without reading as two separate
     paths — they are two things travelling down one pipe, which is what they
     are. At 0 the pair would occlude each other and the whole comparison would
     collapse into whichever arm drew last. */
  const PULSE_OFFSET = PULSE_R * 1.15;

  /* ON THE CURVE, NOT THE CHORD. `linkMesh` hands back the path it drew, and
     the packets take their positions from that same curve (`getPointAt`, arc
     length), so what a viewer sees moving is moving along the line they can
     see. `heroMotion.test.js` holds every packet within a hair of a path. */
  const pulseLinks = [];
  for (const [, { mesh, link }] of linkGroups) {
    const path = mesh.userData.path;
    const perp = mesh.userData.perp;
    if (!path || !perp) continue;
    const n = 1;
    pulseLinks.push({ link, path, perp, n });
  }

  let driftPulses = null;
  /* WHICH LINKS ARE CARRYING, THIS FRAME, PER ARM. Written by the pulse pass and
     read by the node pass just below it, so a node can be told that something
     reached it without either pass recomputing the other's numbers. */
  const carrying = new Map();
  /* WHICH NODE A BEAD LANDED ON THIS FRAME, AND WHOSE — `id -> 0 (warm) | 1
     (cool)`, written by the pulse pass when a bead's position wraps from the
     end of its path to the start, read by the node pass (see NO PURPLE). */
  const arrivals = new Map();
  if (pulseLinks.length) {
    /* ONE MESH, TWO COLOURS, SET ONCE. `instanceColor` multiplies the material's
       own colour per instance, so the material stays white and the warm/cool
       identity is baked at build — it is an identity and not a reading, so
       nothing rewrites it per frame. Still one draw call for both arms. */
    const pulseMat = anatomyMaterial({ colour: "#ffffff", roughness: FORM_ROUGHNESS });
    const total = pulseLinks.reduce((t, l) => t + l.n, 0) * 2;
    const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(PULSE_R, 10, 8), pulseMat, total);
    pulses.frustumCulled = false;
    pulses.renderOrder = 1;
    const _m = new THREE.Matrix4();
    const _p = new THREE.Vector3();
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3();
    /* Each bead's position along its path last frame, so a wrap is an arrival. */
    const prevU = new Float32Array(total).fill(-1);
    const armColour = [new THREE.Color(RESISTANCE_TINT), new THREE.Color(ENDURANCE_TINT)];
    /* Instances are laid out link by link, arm by arm, `n` at a time — the
       colour index has to follow that order and not alternate, or half of the
       warm stream would be cool. The old `i % 2` was that bug, hidden while
       every link had an even count. */
    {
      let i = 0;
      for (const { n } of pulseLinks) {
        for (let arm = 0; arm < 2; arm += 1) {
          for (let k = 0; k < n; k += 1) {
            pulses.setColorAt(i, armColour[arm]);
            i += 1;
          }
        }
      }
    }
    if (pulses.instanceColor) pulses.instanceColor.needsUpdate = true;

    driftPulses = (runPhase, rAct, eAct, show, lit = null) => {
      let i = 0;
      carrying.clear();
      arrivals.clear();
      for (const { link, path, perp, n: count } of pulseLinks) {
        /* A PATH THE SELECTION FADES CARRIES SMALLER PACKETS, 2026-09-06. The
           links off the selected node's paths drop toward the paper (the node
           pass, `FADE_UNRELATED`); their packets used to ride on at full size in
           full colour, so a selection dimmed the network and left its traffic
           shouting. Half size keeps them moving — direction is still theirs to
           say — and keeps the claim: size is still linear in k, on a path the
           viewer has set aside. */
        const aside = lit && !(lit.has(link.from) && lit.has(link.to)) ? 0.5 : 1;
        const kr =
          show === "endurance"
            ? 0
            : Math.min(1, Math.max(0, Math.min(rAct[link.from] ?? 0, rAct[link.to] ?? 0)));
        const ke =
          show === "resistance"
            ? 0
            : Math.min(1, Math.max(0, Math.min(eAct[link.from] ?? 0, eAct[link.to] ?? 0)));
        carrying.set(`${link.from} ${link.to}`, { kr, ke });
        for (let arm = 0; arm < 2; arm += 1) {
          const k = arm === 0 ? kr : ke;
          const side = arm === 0 ? -1 : 1;
          for (let n = 0; n < count; n += 1) {
            /* ONE SPEED PER EDGE, DIVIDED BY THE STEPS IT STANDS FOR. Every
               model edge is crossed in the same run-time; a COLLAPSED path
               (B_AR → AMPK is four edges, `link.steps`) takes that many
               crossings, so the line's thinness, its label's "4 steps" and the
               bead's motion say the same thing — measured at single-edge speed
               the label said four and the motion said one hop. Still not a
               claim about the archive's kinetics; it is the picture agreeing
               with itself.
               The cool stream rides HALF A CROSSING behind the warm one — a
               display offset so the two arms' beads land on a shared node in
               turn and hold it for equal halves (see NO PURPLE); it says
               nothing about timing, which `min(from, to)` cannot. */
            const u = ((runPhase * PULSE_SPEED) / link.steps + n / count + (arm === 1 ? 0.5 / count : 0)) % 1;
            /* A WRAP IS AN ARRIVAL: the bead just reached `link.to`. */
            if (k > 0 && prevU[i] >= 0 && u < prevU[i]) arrivals.set(link.to, arm);
            prevU[i] = u;
            _p.copy(path.getPointAt(u)).addScaledVector(perp, side * PULSE_OFFSET * (k > 0 ? 1 : 0));
            /* SIZE IS THE CLAIM AND IT IS LINEAR IN k, unchanged from the layer
               this replaces: at k 0 a pulse is scaled to nothing, so an arm that
               does not drive an edge puts visibly nothing on it. That zero is
               what draws the divergence — resistance's stream simply is not
               there on the endurance doors, and a viewer sees an empty pipe. */
            _s.setScalar(k * aside);
            _m.compose(_p, _q, _s);
            pulses.setMatrixAt(i, _m);
            i += 1;
          }
        }
      }
      pulses.instanceMatrix.needsUpdate = true;
    };
    group.add(blind(tag(pulses, "link-pulses")));
  }

  /* ---- the twelve ------------------------------------------------------- */

  /* EACH ONE IS DRAWN AS WHAT IT IS — `heroForms.js`, and the owner's
     *"저 핵심 12개를 실제로 그려서 만들라고 그냥 점이 아니라"*. Twelve spheres
     with names beside them answer "how many" and never "what is this", which is
     canon G1's whole complaint. The FORM is chosen by the authors' own `type`
     column, the same column this scale already trusts for where a thing lives,
     so a receptor is drawn crossing a membrane because the archive calls it a
     receptor and not because we decided it looked like one.
     Two materials per node, not one: `body` takes the arm's tint and `detail`
     carries the inside of a thing — cristae, a nucleotide, the strand a
     transcription factor is clamped onto — at a fixed darker weight, so a lit
     mitochondrion still reads as folded rather than going flat. */
  /* ---- and NO paired meter beside each one, 2026-09-06 --------------------- */

  /*
   * THE TWO BARS PER NODE ARE GONE. Owner §4: *"현재 node마다 작은 vertical red /
   * blue bar가 붙어 있는데 3D scene + dashboard UI가 어색하게 섞인 느낌 … Default
   * state에서는 제거합니다. 사용자가 node를 click했을 때만 paired comparison"*.
   * The comparison a click shows is the page's card (`.sig-pick` in
   * `SignallingScale.jsx`): the name, the sentence, and the two lengths with
   * their numbers — which is the owner's own sketch of it, line for line. A
   * second copy of the same pair standing in the scene beside the node was the
   * dashboard-in-the-3D the brief objects to, gated rather than removed, and it
   * disagreed with the card whenever TRACE was set to the whole network.
   * `heroMotion.test.js` holds the absence. The argument the meters were built
   * on — length as the honest second channel for differences too small for a
   * tint (`heroWalk.js`'s PGC-1α 25.8 % against 25.7 %) — stands, and the card
   * is where it is made.
   */

  const marks = new Map();
  for (const node of HERO_NODES) {
    const body = anatomyMaterial({ colour: QUIET_TINT, roughness: FORM_ROUGHNESS });
    const detail = anatomyMaterial({ colour: QUIET_TINT, roughness: DETAIL_ROUGHNESS });
    detail.color.multiplyScalar(0.62);
    const form = buildForm(node, routes?.types?.[node.id] ?? "", { body, detail });
    const [nx, ny, nz] = at.get(node.id);
    form.position.set(nx, ny, nz);
    /* A TENTH MORE FOR THE MEETING NODE — PASS 4 §2: *"JNK는 8~12% larger,
       central placement 유지 … 평상시부터 엄청 밝게 만들지는 마. 도착 순간에
       hero가 되는 것이 중요해."* Size only, applied here so `buildForm` keeps
       drawing by the archive's type; the colour stays the stone's until a bead
       lands (the kick below). */
    if (node.id === "JNK") form.scale.multiplyScalar(1.1);


    /* `rest` IS THE FORM'S OWN SCALE AT BUILD, kept so the arrival bump below is
       a multiplier on it rather than an absolute the forms do not share — the
       twelve are built at different sizes by `buildForm`. `bump` is the current
       response and it decays; `last` is the previous frame's activity, which is
       what makes the response an EVENT rather than a level. */
    marks.set(node.id, {
      form,
      body,
      detail,
      rest: form.scale.clone(),
      bump: 0,
      /* The arrival response and the turn: `kick` is the short swell a landing
         bead gives, `side` is where the colour stands between warm (0) and
         cool (1) on a node both arms reach, `sideTarget` the arm that landed
         last. */
      kick: 0,
      side: null,
      sideTarget: null,
      shown: null,
      last: null,
      node,
      /* THE ENDING'S TWO ARCS, outcomes only — see ARC_R. `end` is how far the
         outcome has gone over to its ending state (0..1, wall time). */
      arcs: null,
      end: 0,
    });
    group.add(tag(form, `node-${node.id}`, routes?.names?.[node.id] || node.id));
    if (node.kind === "outcome") {
      /* STONE, PLUS A THIN WARM ARC ABOVE AND A THIN COOL ARC BELOW — the owner's
         fifth brief §1, his sketch exactly. At the last sample every outcome was
         whichever arm's bead landed last, which is the shared-node rule doing
         its job and, at the final payoff, reading as "Resistance made these"
         under a sentence that says two routes reached almost the same place.
         The three outcomes ALONE leave that rule on the last sample: the form
         goes back to the stone and two arcs say what each arm's ending was,
         each sized against the other's — near-equal because the archive's
         endings are (0.545 / 0.531, 0.387 / 0.385), not because the arcs are
         drawn equal. JNK and S6 keep taking turns. No number bars. */
      marks.get(node.id).arcs = [RESISTANCE_TINT, ENDURANCE_TINT].map((colour, arm) => {
        const mat = anatomyMaterial({ colour, roughness: FORM_ROUGHNESS, opacity: 0.001 });
        mat.opacity = 0;
        const arc = new THREE.Mesh(new THREE.TorusGeometry(ARC_R, ARC_TUBE, 8, 48, ARC_SWEEP), mat);
        arc.position.copy(form.position);
        arc.rotation.z = (arm ? -Math.PI / 2 : Math.PI / 2) - ARC_SWEEP / 2;
        arc.userData.sweep = ARC_SWEEP;
        arc.visible = false;
        group.add(tag(arc, `arc-${arm ? "cool" : "warm"}-${node.id}`, `${node.id} ${arm ? "endurance" : "resistance"} ending`));
        return arc;
      });
    }
  }

  /* ---- per frame -------------------------------------------------------- */

  const quiet = new THREE.Color(QUIET_TINT);
  const scratch = new THREE.Color();
  const seamTint = new THREE.Color();
  /* FOUR STONES, AND THEY ARE ALL LIGHTER THAN `QUIET_TINT`.
     THE FIRST TWO CUTS OF THIS BLOCK WERE BOTH WRONG, IN OPPOSITE DIRECTIONS,
     and the second is the one worth writing down. Cut one kept `QUIET_TINT` and
     scaled it: photographed, thirteen black blobs on pale paper. Cut two lifted
     the albedos to #a79d90 and #c2b8a9 — and photographed, the whole scene was
     washed out to near white, forms and links alike, with no shading left on
     any of them.
     THE ARITHMETIC I SKIPPED BOTH TIMES IS IN THIS FILE'S OWN HEADER. Ambient
     0.5, key 3.4, fill 1.2, so a face turned to the key receives about 3.9x IN
     LINEAR LIGHT. An albedo of #a79d90 is 0.386 linear; times 3.9 is 1.5, which
     clips. Every lit face in cut two was pure white and the "surface" I thought
     I was buying was a blown highlight. Lifting an albedo under a 3.9x key is
     not a small adjustment — it is most of the way to clipping before it looks
     bright on paper.
     THESE FOUR ARE DERIVED RATHER THAN PICKED, at a target of about sRGB 160 to
     235 on the key side and 60 to 90 in shadow — visible as objects at both
     ends, clipping at neither:
       NODE_REST #55504a  linear 0.093 -> key 0.36 -> sRGB 161, shadow 59
       NODE_LIT  #7d766c  linear 0.203 -> key 0.79 -> sRGB 232, shadow 89
       LINK_REST #6b655c  linear 0.148 -> key 0.58 -> sRGB 200
       LINK_LIT  #837c71  linear 0.226 -> key 0.88 -> sRGB 242
     THE LINK STONES SIT ABOVE THE NODE STONES DELIBERATELY. That is the
     hierarchy the brief asked for — connections over sculptures — done in value
     rather than in size, so the forms keep the volume that makes them objects. */
  /* LIFTED AND WARMED, 2026-09-06 — owner §2: *"거의 검정색 material 완화 …
     warm neutral charcoal / taupe … 현재 black보다 약 25~35% 밝은 쪽"*. #55504a
     -> #6e675e is +29 % in sRGB value and stays under the paper on every face:
     linear 0.156 on the key side -> 0.61 -> sRGB 205, shadow ~ 80. The link
     stone comes up with it. `NODE_LIT` is gone: a node no longer brightens with
     its level, it TAKES ITS WORKOUT'S COLOUR as the signal reaches it — the
     owner's own words, *"signal이 들어올 때만 Resistance → warm, Endurance → cool
     … inactive structure = visible, active signal = obvious"*. Which reverses
     the 2026-09-05 rule quoted in `update`'s header; the owner watched that
     picture and asked for this one. */
  /* PASS 3: a step lighter again (§5 *"Lighten them a little — not white; a
     warm stone/taupe with clearer highlights"*), still under the 1.9x ceiling
     `heroMotion.test.js` holds against the old near-black. AND THE LINK STONES
     TURN ROUND: at rest a path is now LIGHTER than the nodes and half
     transparent (the 35 % rung), and a path that is carrying darkens to the
     node stone at full opacity, tinted a third toward the arm that is on it
     (the 100 % rung) — §3's ladder, *"hero topology 35 % / currently carrying
     data 100 %"*. The packets stay the saturated marks on top. */
  /* #736c64 -> #766f67, PASS 4 §5 — "아주 약간 밝게": 1.99x the old near-black
     by the test's own luminance; the 1.9x ceiling in `heroMotion.test.js`
     moved to 2.0 with it, and that is the whole of the room left — the next
     step lighter is the washed-out cut this file's header records. */
  const NODE_REST = new THREE.Color("#766f67");
  const LINK_REST = new THREE.Color("#a49c91");
  /* LIGHTER THAN THE NODE STONE, deliberately: the packets are the strongest
     mark on a path (§3), and measured by luminance a path darker than #8f887d
     would out-weigh the warm packet riding it. */
  const LINK_LIT = new THREE.Color("#8f887d");
  const WARM = new THREE.Color(RESISTANCE_TINT);
  const COOL = new THREE.Color(ENDURANCE_TINT);
  /* NO PURPLE, 2026-09-06 — owner, on SHOW = Both: *"purple element들이 ㅈㄴ
     purple이 별로야"*. A node both workouts reach shows ONE workout's colour at a
     time. AND THE TURNS ARE ARRIVALS, PASS 4 §3: *"일정 간격으로 warm/cool/warm/
     cool 하면 decorative animation처럼 보여. warm packet arrives → warm pulse,
     cool packet arrives → cool pulse 처럼 실제 arrival timing에 맞춰 교대하게 해.
     그러면 color가 state가 아니라 history를 보여주는 셈이 돼."* So the stream
     pass reports which arm's bead landed on which node this frame (`arrivals`),
     the node eases to that arm's colour over ~9 run-seconds and gives a short
     swell (`kick`, §2's "짧은 response"), and shows it AT THAT ARM'S OWN
     PROGRESS — never the other's. Nothing moves while the clock is held,
     because nothing lands. A node one arm alone reaches stays that arm's
     colour with no turns at all. The cool stream rides half a crossing behind
     the warm one on every path, so on a shared node the two land in turn and
     each holds it for half of every crossing; that offset is a display choice
     and says nothing about timing in the archive (`min(from, to)` cannot).
     Paths tint toward whichever arm last reached their far end. (Before
     2026-09-06 the offset was an eighth of the path and JNK read as
     endurance's, 12/88 — the meeting node of the whole floor, held by one
     side.) The dwell is not a statement about how far either arm moved the
     node; that is the strength the colour is shown at. */
  const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
  /* THE STAGE'S OWN GROUND, which is what "faded" means here — see the fade in
     the node pass. Read from `SCENE` rather than typed so a stage that ever
     changes colour cannot leave the fade washing toward the wrong one. */
  const PAPER = new THREE.Color(SCENE.background);

  /**
   * Draw both workouts travelling through one network, at one instant of one run.
   *
   * @param reading `{ t, r: {id: 0..1}, e: {id: 0..1}, show?, focus? }`
   *   `r` and `e` are the two arms' activities at `t`, read from the two
   *   archives by `signallingBinding.heroPair`. `show` is the viewer's SHOW
   *   control — `"both"` (the default), `"resistance"` or `"endurance"` — and it
   *   HIDES a stream rather than changing what the other one is. `focus` is a
   *   node id when the viewer has selected one, and it dims what that node is
   *   not connected to.
   *
   * THE SINGLE-ARM SHAPE STILL WORKS AND IS NOT THE DEFAULT ANY MORE. A caller
   * passing `{ arm, activity }` gets that arm drawn alone; it is what
   * `heroWalk`-era callers and the cell scale's preview disc hand in. Kept
   * because it costs one branch and removing it would break a floor this lane
   * does not own.
   *
   * WHAT A NODE'S APPEARANCE MEANS, AND IT CHANGED TODAY. It used to take the
   * bout's tint and turn continuously in proportion to its activity. Both are
   * gone, and the brief names both:
   *   · rule 8 — *"nodes should not continuously rock merely because they have a
   *     value. Activity should create meaningful event-driven responses."* So
   *     the form's motion is now its own RISE, not its level: a node that is
   *     climbing swells, a node sitting on a plateau is still. Mitochondrial
   *     biogenesis spends the whole run inside 0.357..0.387 and is now visibly
   *     doing nothing, which is true and was previously drawn as a permanent
   *     wobble.
   *   · the visual language — *"nodes are relatively quiet, connections and
   *     travelling signals are the protagonists"*. So a form no longer takes an
   *     arm's colour at all. It stays `QUIET_TINT` and only brightens, by
   *     whichever arm is driving it harder. The warm/cool identity lives on the
   *     pulses and the meters, which is where a comparison can actually be read.
   */
  let lastT = null;
  let phase = 0;

  function update(reading) {
    /* THE LEGACY SHAPE, FOLDED IN AT THE DOOR so nothing below has two paths.
       One arm's activity becomes that arm's map and an empty map for the other,
       which draws exactly the old picture: one set of streams, one set of bars
       standing on their rail beside empty ones. */
    let rAct = reading?.r ?? {};
    let eAct = reading?.e ?? {};
    if (reading?.arm && reading?.activity) {
      rAct = reading.arm === "endurance" ? {} : reading.activity;
      eAct = reading.arm === "endurance" ? reading.activity : {};
    }
    const show = reading?.show ?? "both";
    const focus = reading?.focus ?? null;
    /* THE NODE UNDER THE POINTER, so the form itself can say "pressable" now
       that the ring no longer does — the orchestrator's note of 2026-09-06. */
    const hover = reading?.hover ?? null;
    /* `{ r: {id: 0..1}, e: {id: 0..1} }` — each arm's rise over its own run,
       `signallingBinding.heroProgress`. What colours a node and what drives an
       outcome's form. Absent (the legacy single-arm callers), the activity
       stands in, which is the old picture exactly. */
    const progress = reading?.progress ?? null;
    /* THE RUN STANDS ON ITS LAST SAMPLE (the page knows the run's length; this
       scene does not) — the outcomes' ending state, fifth brief §1. `wall` is
       the frame's wall seconds for the fades that have to run while the clock
       is held. `seam` is the colour the floor above drew AMPK in and how much
       of it is still held — fifth brief §3; the page owns the hold and the
       650 ms ease, this scene only paints. */
    const ended = !!reading?.ended;
    const wallDt = Number.isFinite(reading?.wall) ? Math.max(0, reading.wall) : 1 / 60;
    const seam = reading?.seam ?? null;

    /* CLAMPED, AND FORWARD ONLY. The run loops and the viewer can scrub, so a
       raw `t - lastT` is negative at the seam and enormous after a seek; either
       one teleports the crowd. Backwards is worth NOTHING and a jump is worth
       exactly one frame — the drift carries on from where it was rather than
       landing somewhere it was never seen to travel to. `heroMotion.test.js`
       pins both halves, the second by driving a scrub and a single maximum
       frame into two scenes and requiring the same 108 positions out. */
    const t = reading?.t;
    const dt =
      Number.isFinite(t) && lastT !== null ? Math.min(Math.max(t - lastT, 0), MAX_RUN_STEP) : 0;
    if (Number.isFinite(t)) lastT = t;
    phase += dt;

    /* THE STREAMS FIRST, because the node pass reads what they wrote — a node's
       arrival response is gated on something actually reaching it. */
    /* WHICH NODES THE SELECTION LEAVES BRIGHT — computed BEFORE the streams
       now, because the streams read it too (below). Rule: *"click a node —
       everything unrelated fades slightly … only connected paths remain
       bright"*. One hop,
       not the whole reachable set: two hops from AMPK is most of the drawing and
       would fade nothing. Built per frame off `links`, which is thirteen nodes
       and twelve edges — cheaper than keeping a second index in sync. */
    let lit = null;
    if (focus) {
      lit = new Set([focus]);
      for (const link of links) {
        if (link.from === focus) lit.add(link.to);
        if (link.to === focus) lit.add(link.from);
      }
    }

    /* THE STREAMS, after `lit` and before the node pass, which reads what they
       wrote — a node's arrival response is gated on something actually
       reaching it. */
    if (driftPulses) driftPulses(phase, rAct, eAct, show, lit);

    for (const [id, mark] of marks) {
      const kr = show === "endurance" ? 0 : Math.min(1, Math.max(0, rAct[id] ?? 0));
      const ke = show === "resistance" ? 0 : Math.min(1, Math.max(0, eAct[id] ?? 0));
      const k = Math.max(kr, ke);

      /* THE EVENT, AND IT IS THE RISE RATHER THAN THE LEVEL. `dt` is run-seconds,
         so the derivative is per run-second and a scrub cannot manufacture a
         response it did not earn — a viewer who drags the timeline sees the
         nodes that were climbing over that span swell, which is what happened.
         The bump DECAYS on its own clock so a single sample's rise reads as a
         reaction with a shape rather than as one frame's flicker. */
      /* THE FIRST READING IS A BASELINE AND NOT AN EVENT, and getting that
         wrong flashed the whole network on arrival. `update(null)` runs at build
         with no activity at all, and it used to record a `last` of 0 for every
         node — so the first real frame read every node's t=0 value as a rise
         from nothing and every form in the picture swelled at once, on the one
         frame a viewer is most likely to be looking at it. A reading with no
         data is not a reading: it leaves `last` null, and the first frame that
         HAS data sets the baseline the second frame is measured against. */
      const rose = mark.last === null || !reading ? 0 : Math.max(0, k - mark.last);
      if (reading) mark.last = k;
      /* A RATE, AND THEN ITS SQUARE ROOT — both corrections came off a failing
         case rather than off taste.
         PER RUN-SECOND, NOT PER FRAME. `rose` alone is a frame delta, so the
         same climb drawn at 120 fps responds half as hard as at 60. Dividing by
         `dt` makes the response a property of the archive instead of a property
         of the machine.
         AND SUBLINEAR, BECAUSE THE RANGE IS FOUR ORDERS WIDE. Measured: integrin
         opens at about 0.083 per run-second and RhoA climbs at about 0.0002.
         Linear, with any gain that lets a relay move at all, every door pins the
         cap — `heroMotion.test.js` failed exactly there, with a rise five times
         another's producing an identical response because both saturated. A
         square root keeps the ORDER, which is the whole claim ("this one rose
         harder"), and compresses the range enough for both ends to be drawn. It
         is a display mapping of the same kind as the colour ramp's endpoints;
         no rate is attributed to the model. */
      const rate = dt > 0 ? rose / dt : 0;
      mark.bump = Math.max(
        mark.bump * Math.exp(-dt / BUMP_DECAY),
        Math.sqrt(rate) * BUMP_GAIN,
      );
      /* AND A STEP UP UNDER THE POINTER — the object saying "pressable" now
         that the ring does not: 6 % bigger and a little lit, on top of whatever
         its own rise is doing. Photographed without it, the colour lift alone
         was too quiet to find with the eye. */
      const lift = hover === id ? 1.06 : 1;
      /* THE LANDING — PASS 4 §2 *"두 signal이 도착할 때 짧은 response"*: a bead
         that reaches this node swells it 7 % and lets it settle on the same
         clock as the rise response. Event, not level: a held clock lands
         nothing. */
      const pr = show === "endurance" ? 0 : clamp01(progress?.r?.[id] ?? kr);
      const pe = show === "resistance" ? 0 : clamp01(progress?.e?.[id] ?? ke);
      const reach = Math.max(pr, pe);
      const share = reach > 0 ? pr / (pr + pe) : 0;
      /* A LANDING COUNTS ONLY FOR AN ARM THAT HAS MOVED THIS NODE — the same
         number that colours it. A bead of an arm the archive says never moved
         the node (B_AR under lifting) lands and does nothing, or the swell
         would answer the bead and not the archive (reviewed). */
      const landed = arrivals.get(id);
      if (landed !== undefined && (landed === 0 ? pr : pe) > 0) {
        mark.kick = Math.max(mark.kick, 0.07);
        mark.sideTarget = landed;
      }
      mark.kick *= Math.exp(-dt / BUMP_DECAY);
      const swell = (1 + Math.min(BUMP_MAX, mark.bump + mark.kick)) * lift;
      /* MULTIPLIED COMPONENT-WISE, NOT `setScalar`. Caught by
         `heroMotion.test.js`: `buildForm` gives some of the thirteen a
         non-uniform scale — the input chevrons are 1.11 in x and not in y — and
         `setScalar(rest.x * swell)` wrote that one number into all three axes,
         so the first frame silently reshaped the form. A response that changes
         a form's PROPORTIONS is not a response, it is a different object. */
      mark.form.scale.set(mark.rest.x * swell, mark.rest.y * swell, mark.rest.z * swell);

      /* QUIET IN HUE, BRIGHT IN VALUE. The form keeps the slate every other form
         is; what changes is how lit it is. `dim` is the selection's fade and it
         multiplies rather than replaces, so a dimmed node that is working still
         reads as working — the fade says "not on this path", not "off". */
      const dim = lit && !lit.has(id) ? FADE_UNRELATED : 1;
      /* THE FORMS ARE NEUTRAL AND THEY ARE NOT DARK, and the second half of that
         cost a screenshot to learn. The first cut kept `QUIET_TINT` and scaled
         it — #403c36 times 0.55 to 1.3 — which is the slate the LINKS are drawn
         in, and against #faf8f5 paper it made every form a black blob. The file
         header already had the measurement and I did not apply it: at that
         separation "a small form resolves as its outline before it resolves as
         anything else", which is the silhouette failure this scene was rebuilt
         out of once already.
         `NODE_REST` is a mid stone that sits under the paper at every face, so
         the key still shades across it, and `NODE_LIT` is the same stone lifted.
         Activity moves between them. The hue stays neutral either way — the
         warm/cool identity is the pulses' and the meters', which is the whole
         hierarchy this floor was rebuilt for. */
      /* THE FADE GOES TOWARD THE PAPER, AND THE FIRST CUT SENT IT THE OTHER WAY.
         `multiplyScalar(0.55 + 0.45 * dim)` DARKENS an unrelated node, and on a
         #faf8f5 stage darker is louder — photographed, selecting a node made the
         rest of the network slightly more prominent, which is the opposite of
         what a fade is for. On a pale ground, receding means going toward the
         ground. `PAPER` is the stage's own background, so this is the same
         atmospheric wash the background crowd already recedes with. */
      /* THE COLOUR IS THE SIGNAL'S ARRIVAL, NOT THE LEVEL. The archive's series
         start well above zero — JNK at 0.51, PGC-1α at 0.71 — so a tint by
         level would colour half the network before anything has travelled.
         Progress is each arm's rise over its own run (0 at the first sample, 1
         at the last), so a node goes warm or cool as, and only as, its workout
         moves it; a node an arm never moves stays the stone under that arm
         (B_AR under lifting; AMPK under lifting, which falls). Where both arms
         reach a node the two colours take turns (on arrivals), and the node is
         painted in the arm being shown AT THAT ARM'S OWN PROGRESS — during the
         cool turn at `pe`, during the warm turn at `pr` — so a turn never
         overstates the arm it shows. */
      /* WHICH ARM'S COLOUR, AND HOW FAR TOWARD IT. One arm alone — or one
         the other arm has moved under a twentieth as far — that arm, no turns.
         Both: ease toward the arm whose bead landed last (about nine
         run-seconds, through the stone and never through a mix); before anything
         has landed, the arm that has moved the node further. `shown` is what
         the paths read, so a path is never coloured by a number the node did
         not show. */
      let side;
      if (share > 0.05 && share < 0.95) {
        if (mark.side === null) mark.side = pe > pr ? 1 : 0;
        const target = mark.sideTarget ?? mark.side;
        mark.side += (target - mark.side) * Math.min(1, dt / 3);
        side = mark.side;
      } else {
        side = share <= 0.05 ? 1 : 0;
        mark.side = null;
        mark.sideTarget = null;
      }
      mark.shown = side;
      /* NEVER THROUGH THE MIX. `side` eases 0 → 1 across a hand-over, and a
         colour lerped BY side went warm → mauve → cool on the way — a still
         caught JNK and S6 at the midpoint (p4-07, 2026-09-06), the purple the
         owner refused. So the hue is one arm's or the other's, and what eases
         is how far from the stone it stands: full at either end, nothing at
         the midpoint. The hand-over reads as a dip toward the stone and a rise
         in the other hue. The paths below do the same; `heroMotion.test.js`
         samples every frame of the ease against the two rays. */
      const hold = Math.abs(2 * side - 1);
      /* THE ENDING (outcomes only): on the last sample the tint goes back to
         the stone and the two arcs below carry the comparison. Eased on wall
         time — the clock is held there, so run-seconds would never move it. */
      if (mark.arcs) mark.end += ((ended ? 1 : 0) - mark.end) * Math.min(1, wallDt / (ended ? END_TAU : END_TAU_OUT));
      const end = mark.arcs ? mark.end : 0;
      scratch.copy(NODE_REST);
      if (reach > 0) scratch.lerp(side < 0.5 ? WARM : COOL, (side < 0.5 ? pr : pe) * hold * (1 - end));
      /* THE FORM SAYS "PRESSABLE" ITSELF: the one under the pointer lifts a
         step toward the paper, which on this ground is a highlight. */
      if (hover === id) scratch.lerp(PAPER, 0.28);
      scratch.lerp(PAPER, (1 - dim) * 0.82);
      /* THE SEAM — fifth brief §3: *"ENERGY purple AMPK → camera pullback →
         same purple AMPK → 500–800ms → neutral SIGNALS stone"*. AMPK, and only
         AMPK, is painted as far toward the colour it was handed as the page
         still holds it. Colour only; the form is the same object. */
      if (seam && id === "AMPK" && seam.k > 0) scratch.lerp(seamTint.set(seam.tint), Math.min(1, seam.k));
      mark.body.color.copy(scratch);
      if (mark.arcs && (end > 0.01 || mark.arcs[0].visible)) {
        /* Each arc's sweep is its arm's ending against the larger of the two,
           so the pair says "almost the same" only when the archive does. Under
           one arm alone the other arc has no length. Rebuilt only when the
           sweep moves, which at a held ending is once. */
        const levels = [kr, ke];
        const top = Math.max(kr, ke);
        mark.arcs.forEach((arc, arm) => {
          const sweep = top > 0 ? ARC_SWEEP * (levels[arm] / top) : 0;
          if (Math.abs(sweep - arc.userData.sweep) > 0.01) {
            arc.geometry.dispose();
            arc.geometry = new THREE.TorusGeometry(ARC_R, ARC_TUBE, 8, 48, Math.max(sweep, 1e-3));
            arc.userData.sweep = sweep;
            arc.rotation.z = (arm ? -Math.PI / 2 : Math.PI / 2) - sweep / 2;
          }
          arc.material.opacity = 0.92 * end * dim;
          arc.visible = end > 0.01 && sweep > 0.01;
        });
      }
      /* THE OUTCOMES HAPPEN — `heroForms.js` gives the three a `drive`, and it
         takes the same reach: the strand extrudes, the bundle thickens, the
         mitochondrion buds a second, as far as the shown workout has moved
         that outcome over its own run. */
      mark.form.userData.drive?.(reach);
      /* THE EMISSIVE IS WHERE THE SWELL IS SEEN. A scale change of a few percent
         is hard to catch on a small form; the same event brightening the surface
         is not. Both come off `bump`, so they are one response in two channels
         rather than two claims. */
      /* THE EMISSIVE CARRIES THE EVENT AND NOTHING ELSE NOW. It used to carry
         activity too, and under a 3.9x key that is a second lift on top of an
         albedo already near its ceiling — the washed-out frame cut two produced
         was this term as much as the albedos. A node's LEVEL is the albedo lerp
         above and its EVENT is here, which keeps the two readings on two
         channels instead of stacking them into a clip. */
      mark.body.emissive
        ?.copy(scratch)
        .multiplyScalar((Math.min(BUMP_MAX, mark.bump + mark.kick) * 1.8 + (hover === id ? 0.12 : 0)) * dim);
      /* The detail stays a fixed step darker than the body rather than lerping
         to its own colour: it is there to keep the silhouette readable, and a
         detail that brightens with the body would erase the shape it is drawing
         at exactly the moment the node matters most. */
      mark.detail.color.copy(scratch).multiplyScalar(0.62);

    }

    /* THE AMBIENT PAIR. Both are zero at `phase` 0, so the first update draws
       what the build drew and there is no step onto the screen. The two periods
       are 320 and 207 run-seconds and share no factor a viewer could catch, so
       the boundary never visibly repeats. */
    if (driftDust) driftDust(phase);
    membrane.position.z = MEMBRANE_SWAY * Math.sin(phase / 51);
    membrane.rotation.x = MEMBRANE_TILT * Math.sin(phase / 33);

    /* THE CONDUITS ARE A LIGHT STONE AT REST AND THE TRAFFIC ON THEM IS NOT. A
       link used to take the bout's tint outright, which meant a link carrying
       both arms had to pick one — the exact failure the brief opens on. It is a
       pipe: it darkens to full weight when anything is going through it and
       leans 0.3 of the way toward the arm whose packets are on it — taking
       turns where both are, exactly as the nodes do — so the active route reads
       as a route and never as a darker wire. */
    for (const [key, { mesh, link }] of linkGroups) {
      const carried = carrying.get(key) ?? { kr: 0, ke: 0 };
      const k = Math.min(1, Math.max(0, Math.max(carried.kr, carried.ke)));
      const dim = lit && !(lit.has(link.from) && lit.has(link.to)) ? FADE_UNRELATED : 1;
      /* THE CONDUIT IS A LIGHTER STONE THAN THE NODES IT JOINS, which inverts
         what this scene used to do and is the point of the rebuild: a link a
         viewer cannot see is a relation a viewer cannot read, and the brief puts
         the connections above the sculptures. It brightens with traffic and is
         never the black the first cut made everything. */
      scratch.copy(LINK_REST).lerp(LINK_LIT, k);
      /* 0.3 OF THE WAY TOWARD WHOEVER IS ON IT, at that arm's own strength —
         `carried` knows which arm's packets are running. */
      if (k > 0) {
        /* Toward whichever arm last reached the far end — the node's own turn. */
        /* A PATH ONE ARM ALONE TRAVELS LEANS TOWARD THAT ARM, ALWAYS. Only a
           path both arms travel follows the far node's turn. Fifth brief §2:
           ROS → JNK carries cool beads only, and following JNK's turns it lost
           its lean on every warm turn and fell to bare stone — the right-hand
           route "thinning" at the meeting. */
        const far = marks.get(link.to);
        const shared = carried.kr > 0 && carried.ke > 0;
        const side = shared ? (far?.shown ?? 0.5) : (carried.ke > carried.kr ? 1 : 0);
        /* One hue, held as far as the node holds it — NEVER THROUGH THE MIX. */
        const hold = Math.abs(2 * side - 1);
        scratch.lerp(side < 0.5 ? WARM : COOL, 0.3 * (side < 0.5 ? carried.kr : carried.ke) * hold);
      }
      scratch.lerp(PAPER, (1 - dim) * 0.82);
      mesh.traverse((child) => {
        if (!child.material) return;
        child.material.color.copy(scratch);
        /* 0.5 at rest, 1 when carrying — the two rungs of §3's ladder. */
        child.material.opacity = 0.5 + 0.5 * k;
      });
    }
  }

  update(null);

  /* ONE ANCHOR PER DRAWN NODE, WHICH IS WHAT MAKES THE TWELVE THE CLICKABLE
     THINGS. State 4 is *"each elements clickable"*, and on this scale the
     elements are now these and not a hundred and twenty-one marks. The label is
     the archive's ID rather than its long name — `AMPK`, not "AMP activated
     protein kinase" — because a plate is a name tag and the sentence belongs in
     the record behind it. `readable` turns the archive's underscores into
     spaces and does nothing else, so the word on screen is still the authors'.
     Hung a little above each form so the plate clears the shape it names, and
     the shapes have different heights, so the offset is the form's allowance
     rather than one number that suits the smallest of them. */
  /* THE PLATE AND THE RING TAKE THE FORM'S z WITH THEM. `Gizmos` places a 2D
     plate by projecting this point, so a name left at z 0 over a node that moved
     forward points past its own subject — and `FocusRing` would lasso the paper
     beside the thing the sentence is about, which is the exact defect `focusAt`
     was added to fix one axis over.
     THE MEASUREMENT MOVED WITH THE CAMERA, 2026-09-01. It read "RhoA and AMPK
     move furthest at 38.2 px … this scale ships at 5.1 %", measured square-on,
     where the drift was purely radial and peaked at the mid-ring because the
     dome trades radius against z. Off the axis it is a shear as well, so the
     worst mover is now the DEEPEST node rather than a middling one: protein
     synthesis, 46.5 px on a 758 px stage. `gizmoLayout.test` gates it at 8 % of
     the stage and this scale ships at 6.14 %, which is paid for by centring the
     drawing on z 0 — see `Z_MID`, without which the same picture measures
     12.15 % and the gate is right to refuse it. */
  const anchors = HERO_NODES.map((node) => {
    const [x, y, z] = at.get(node.id);
    return {
      id: node.id,
      /* THE ARCHIVE'S ID, OPENED OUT — underscores to spaces, and a camel hump
         to a space too. `PGC_1a` is a name with an underscore in it and
         `ResistanceExercise` is two words with no separator at all, which
         rendered as `RESISTANCEEXERCISE` in a plate that uppercases: measured on
         screen, unreadable. Nothing else is done to the string, so the word is
         still the authors'. */
      /* THE PLATE SAYS THE NAME, THE CARD SAYS THE REST — owner 2026-09-07 (last pass, L1):
         *"3d model 위에 name tag는 이름만"*. `SPELLED` keeps "Name · what it is" for the card. */
      label: (SPELLED[node.id] ?? String(node.id).replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")).split(" \u00b7 ")[0],
      /* Keeps its own case through the plate's uppercase — see `SPELLED`. */
      exact: node.id in SPELLED,
      kind: node.kind,
      /* TWO POINTS. The name hangs above the form so it clears the shape it
         names; the RING goes around the form's own centre, because a control
         that circles a thing says "this thing" and a control parked above it
         says "something up here". The forms differ in height, so the plate's
         lift is the allowance every form fits inside rather than a number
         measured off the tallest. */
      /* ABOVE UNLESS THERE IS NOTHING ABOVE. Hung uniformly above, the top
         row's two plates were the binding constraint on this whole picture:
         "Resistance Exercise" projected to ndc y 0.929 against an envelope of
         0.86, and every attempt to grow the drawing — bigger forms, tighter
         rows, a closer camera — died on that one plate rather than on anything
         about the drawing. The two inputs are the top row and there is nothing
         over them; there IS clear space between them and the membrane. So a
         node with no row above it wears its name underneath, which still points
         at it and is what a layout does when it runs out of sky. */
      /* THE LIFT MUST STAY INSIDE A ROW, AND IT HAD STOPPED BEING INSIDE ONE.
       This was tuned at a form radius of 0.16: 0.16 x 1.5 = 0.240 against a
       ROW_GAP of 0.32, four fifths of a row, so a plate sat above its own node
       and below the node above it. The radius then grew to reach the fibre
       scale's ink and this lift grew with it to 0.383 — 1.20 ROWS. Every plate on
       the scale was anchored past the node above its own, which is exactly
       what a viewer reads as a label pointing at nothing: measured on the
       shipped frame at 1280x800, ATP's and PCr's plates sat in the headline
       band with their molecules a row and a third below them.
       Scaled at the rate that puts it back inside a row. The plate still
       clears the form — 0.94 of the radius against a form that reaches about
       half of one — so nothing it was doing is lost. */
    /* THE TOP ROW'S PLATES HANG CLEAR UNDER THE CHEVRONS, PASS 3 — at 0.94 the
       plate sat inside the chevron's lower half and, with the entries pushed to
       the sides, the running plate ran into the shell's Go Home button
       (measured 1016..1190 against 1182.. at 1280x800). 1.35 is the middle of
       the clear band between the chevron's bottom (0.94 R) and the door's top
       (1.71 R) — reviewed: 1.85 put the anchor ON the door's top edge, 7 px
       from the door's own plate anchor. With the entries at 1.12 the plates
       clear the corner controls in x (running plate ends at 1163 against the
       ways column's 1175), so y only has to clear the forms. */
    at: [x, node.row === 0 ? y - FORM_R * 1.35 : y + FORM_R * 0.94, z],
      ringAt: [x, y, z],
    };
  });

  return {
    group,
    update,
    anchors,
    at,
    links,
    membraneY,
    /** The outcome divider — where the page hangs the word OUTCOMES. */
    zone,
    extent: { half: [cellHalf, (topY - bottomY) / 2 + L.rowGap * 0.6], centre: [0, 0] },
    layout: L,
    dispose: () => disposeTree(group),
  };
}

/**
 * Which of the anchors stand labelled, and it is one rule in one place.
 *
 * Owner §9, 2026-09-06: *"Default state에서는 Resistance, Endurance, 필요하면
 * AMPK 정도만 항상 보입니다. 나머지는 Hover → node name / Click → name +
 * description + paired comparison / Guided tour → 현재 말하는 object만 label."*
 *
 * So: while the pass is speaking, the part it is speaking about and nothing
 * else — not even the two workouts, because a plate that is not the subject is
 * a plate over the subject. Otherwise the two inputs and AMPK, plus whatever
 * the viewer is pointing at, has pressed, or has open. `SignallingScale.jsx`
 * feeds the result to `Gizmos` and keeps no filter of its own;
 * `signallingClaims.test.js` holds that absence and `heroMotion.test.js` this
 * rule.
 */
/* PASS 3 §8: *"Persistent: Resistance exercise and Endurance exercise. That is
   enough. The AMPK label should appear during the tour, on hover, on selection
   — not always."* */
/* EMPTY SINCE 2026-09-07 — owner, SIGNALS 20/24: the cell's way, *"main screen에 각 파트 별로 name tag가 안떠있고 누르면 설명 뜨는게"*. A plate stands only while its part is hovered, selected or open. */
const ALWAYS = new Set();
export function platesShown(anchors, { touring = false, tourFocus = null, hovered = null, selected = null, open = null } = {}) {
  if (touring) return anchors.filter((a) => a.id === tourFocus);
  const asked = new Set([hovered, selected, open].filter(Boolean));
  return anchors.filter((a) => ALWAYS.has(a.id) || asked.has(a.id));
}
