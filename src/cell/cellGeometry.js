/**
 * The cell scale: the interstice between two myofibrils, and what is in it.
 *
 * ARRIVAL. The two walls are `rod()` over `myofibrilShape()` — the fibre level's
 * own geometry, at 3.5x radius — so the corridor is literally the gap the scale
 * above draws mitochondria into, and the descent lands somewhere the viewer has
 * already seen. Nothing is claimed about coordinates: the AMPK model is
 * well-mixed and carries no geometry at all, so the spacing here is the fibre
 * level's and the transition is Magic School Bus, a cut to the compartment
 * rather than a zoom to a location.
 *
 * LAYOUT, and the one rule that makes the picture readable: NEAR IS THE BOUT,
 * FAR IS THE CONTROL. Both arms are drawn, always, in the same shapes at the
 * same places, separated only in z. The control is the identical model on the
 * identical calcium with the ATP demand held flat, so the difference between the
 * two rows is the energy cost of the bout and nothing else. Drawing the bout
 * alone would show the control's own drift as though the exercise caused it.
 *
 * WHAT MOVES IS PHOSPHATE. A nucleotide is drawn as one body with its phosphate
 * groups on it: three for ATP, two for ADP, one for AMP. Species is not a colour
 * — it is a count, which is what the difference between the three molecules
 * actually is, so ATP becoming ADP is a phosphate leaving rather than a bead
 * changing hue. 36 bodies, because this model conserves ATP+ADP+AMP at 8.92 mM
 * and 0.25 mM per bead makes the pool 36 (cellBinding.js).
 *
 * THE SENSOR ROWS SIT ON TOP OF EACH OTHER, and that is the result. AMPK
 * phosphorylation under our protocol separates the two arms by 2.2e-5 at its
 * widest: it is driven by calcium through CaMKK, and calcium is identical in
 * both arms by construction. Both rows are drawn anyway, so the day they part is
 * a day you can see.
 *
 * AND THE ROW BETWEEN THEM IS THE CAUSE. `CaMKK_active_fraction` shipped in all
 * five scenario files and was read by nothing, so the sensor came on and the
 * screen could not say what brought it on. It is drawn the way the sensor is —
 * a published fraction of a conserved pool, as a count of markers — and the two
 * rows are deliberately OUT OF STEP: the calcium arm is full 26 ms into the run
 * and the sensor does not move for another 1.85 s. That gap is the whole claim.
 * A viewer watches it because `runLoop.js` holds the first archived sample still
 * for 0.9 s before the run starts, so the snap has a "before" to snap out of.
 *
 * `update(drawn)` takes the object out of cellBinding.js and nothing else. No
 * clock, no React, no fetch. cellGeometry.test.js reads the picture back off
 * these meshes and requires a 10x change in any published input to move it.
 */

import * as THREE from "three";

import { PALETTE, SURFACE, anatomyMaterial, sheathMaterial } from "../anatomyStyle.js";
import { rod, myofibrilShape, disposeTree, noise as hash, relax } from "../fiber/fiberGeometry.js";
import { POOL_BEADS, AMPK_MOLECULES, CAMKK_MOLECULES, PEAK_DEMAND_mM_PER_S } from "./cellBinding.js";

/**
 * Half the corridor's height, and the ceiling every drawn molecule stays under.
 *
 * The walls' axes sit at ±0.62 — the fibre level's own myofibril site spacing
 * carried down — and their radius is 3.5x a myofibril's, which leaves the gap
 * between the two surfaces. `nothing drawn leaves the corridor` in the test
 * beside this file holds every instance inside it: a molecule above the wall is
 * a molecule inside the myofibril, which is a claim about location that a
 * well-mixed model is not entitled to make.
 */
export const CORRIDOR_HALF_Y = 0.86;
const WALL_R = 3.5;
const WALL_LEN = 5.0;
/** Where the two arms sit. Near is the bout; far, in slate, is the control. */
const BOUT_Z = 0.42;
const CONTROL_Z = -0.78;

/**
 * Where the camera frames the corridor. Side-on: a corridor viewed down its axis
 * is a dot. It sits here rather than at the foot of the file because the two z
 * above and DEPTH_FIX below are all read against it.
 *
 * SQUARE-ON AND FAR ENOUGH BACK TO HAVE A MARGIN. This was [0.42, 0.1, 2.85],
 * and both numbers were wrong in a way that only shows up as a missing label. At
 * 2.85 the geometry itself overflowed a 1024-wide stage — max |ndc.x| 1.245, the
 * outer beads of the pool and the AMPK row cut off — so there was no empty band
 * anywhere for a callout to sit in, and four of five landed outside the canvas.
 * And x = 0.42 put a yaw on the scene, which makes the screen x of a point depend
 * on its z: the two arms' labels shear apart with depth, so any coordinate fitted
 * by eye at one aspect is wrong at the next. At x = 0 world x maps to screen x
 * linearly and the anchors below can be a rule instead of a fit.
 */
/* THE ENERGY FLOOR'S CAMERA, RE-EXPORTED UNDER THE OLD NAME — 2026-09-05. The
   fibre's seam and the gizmo gate import `CELL_CAMERA` for the coin of the room
   a visitor is about to enter, and that room is `buildCellChainLevel` now, so
   the camera has to be that level's own or the coin frames a scene nobody
   sees. Imported rather than `export ... from` because the depth arithmetic
   below still reads it. One direction only: `cellChainGeometry.js` never
   imports this file. */
import { ENERGY_CAMERA as CELL_CAMERA } from "./cellChainGeometry.js";
export { CELL_CAMERA };

/* THE SIZE ORDER WAS UPSIDE DOWN, 2026-08-30. Owner: "그 3d element 자체를
   바꾸라고 더 실제로 내부답게". Measured on the shipped frame: the nucleotide
   bodies drew at 23.2 px and AMPK's subunits at 14.8, so the smallest molecule
   in the corridor was the largest object in the picture and the sensor the scale
   is named after was among the smallest. AMPK αβγ is about 130 kDa and ATP is
   507 Da; nothing here claims a length, but a picture that puts them the other
   way round is teaching the wrong thing for free.

   Not scaled to the real ratio — at ~8:1.5 the fuel would be 6 px and its
   phosphates uncountable, and the COUNT is what this row is drawn for
   (cellBinding.js). The order is corrected, not the ratio, and the pool stops
   being the heaviest thing on screen: 36 bodies and 108 phosphates per arm is
   more than half of everything drawn here.

   The chain offsets come down with the body because they are independent
   constants and would otherwise leave the phosphates floating off it — the same
   0.76 the body took. That also tightens the pool, which had spread 155 px. */
const NUCLEOTIDE_R = 0.038;
const PHOSPHATE_R = 0.021;
/** Phosphates per body: ATP 3, ADP 2, AMP 1. */
const MAX_PHOSPHATES = 3;
const AMPK_SUBUNITS = 3;

/**
 * The control is a SECOND CONDITION, not a blur of the first.
 *
 * It used to be the bout's own shapes and hues at 0.26 opacity, offset in z, and
 * the reasoning was that a second colour would read as a second quantity. What a
 * faint offset copy of the same mark actually reads as is a drop shadow, a
 * motion blur, or a probability cloud — and the last one is fatal here, because
 * the control's phosphate COUNT differs from the bout's. A viewer who reads the
 * fuzzy twin as uncertainty reads "there might be one more phosphate than we
 * drew": an error bar on a countable quantity, with no posterior behind it
 * (science/ampk/tests/test_no_band_ships.py). Reported by a reader who had never
 * seen the model.
 *
 * So the far row is flat slate, and it is NAMED in the scene. Different mark,
 * same shapes, same places.
 *
 * AND IT IS NOT FAINT. Retinting fixed the hue and left the grammar behind:
 * identical shapes at identical places with one of them translucent is what an
 * estimate and its envelope look like, whatever colour they are in. That was the
 * last range-idiom on this screen, so the far row is drawn at full opacity and
 * the two arms are separated by colour and by depth only. The constant is kept —
 * as a 1, named for what it is — rather than deleted, because it is the one place
 * that says so, against the six sites a future edit would re-fade one at a time.
 */
const CONTROL_OPACITY = 1;
/* THE CONTROL ARM LEFT THE BLUES ON 2026-08-31, and the pair it was closest to
   was not the one anybody had written down. TODO called it "control 톤 vs 인산기
   표지"; `#5b7f96` is `PALETTE.calcium`, not phosphate. So the two things ten
   points apart were **the arm that did not exercise** and **calcium** — in a
   picture whose entire subject is telling two arms apart, on a scale where
   calcium is what makes the sensor come on.

   Measured across everything this scale draws (ΔE, CIE76): control was 10.4
   from calcium and 12.4 from the nucleus, against 15.5 for the zDisc/mLine pair
   that was judged a defect and fixed, and 31.2 for actin/myosin. It was the
   tightest pair in the app.

   `#6f6a63` is the warm neutral that maximises the WORST clash rather than any
   one of them: nearest is the nucleus at 18.1, and calcium goes to 22.3. It also
   says the right thing — the control is the arm that did nothing, and a neutral
   is what nothing looks like next to two casts.

   CALCIUM DID NOT MOVE, and that was the choice. It is used on two scales and
   carries a chain of meaning the copy leans on ("CaMKK2 · calcium switch", the
   store's own colour); the control tint is one arm's tick on one scale. Moving
   the shared word to spare the local one is how a palette loses its nouns.

   THE FIRST REPLACEMENT WAS `#77726b` AND IT MISSED BY A HUNDREDTH: 4.49 on
   `--panel`'s `#f7f8fa` against AA's 4.50, which `textClearsItsPaper` caught
   before a browser could. This token is not only a 3D material — the arm's name
   is written in it at 11px — so the separation search had to clear the text
   floor first and maximise the worst pair second. `#6f6a63` reads 5.04, with
   room, and is better than what it replaces on every axis rather than trading
   one for another. */
const CONTROL_TINT = "#6f6a63";   // --arm-control in cell.css; one tone, both scales (cellClaims.test.js ties them)

/**
 * THE SENSOR GETS A COLOUR OF ITS OWN, 2026-08-30.
 *
 * Owner: *"뭐가 뭔지 잘 안보여"*. Measured at the shipped camera on a 1201x630
 * stage: AMPK's subunits draw at 14.8 px and CaMKK's bodies at 13.9, four
 * species of sphere within 3 px of each other, ~500 of them in frame — so at
 * this size hue is the only thing left doing the telling apart, and between
 * these two it was not. `PALETTE.troponin` #a06a5e against
 * `PALETTE.tropomyosin` #9a7057 is ΔE 6.7 and ΔRGB 16, under this project's own
 * floor of 30 (`groupPalette.test.js`, quoting `anatomyStyle.test.js`: "at the
 * eleven pixels these are drawn at, three mechanisms become one repeated part").
 * The two rows the whole scale is about were one brown cloud.
 *
 * THE PALETTE DOC LICENSES THE FIX AND NAMES IT. `anatomyStyle.js`: identity is
 * answered by hue and load by the warm ramp, and *"if a later view needs to
 * distinguish fiber TYPES, that is an identity question and should borrow the
 * group palette instead"*. This scale is identity — AMPK, CaMKK, the fuel and
 * the demand are different machines, not one machine under more load — and it
 * had been wearing the sarcomere's activation language, where separation is
 * deliberately by value inside one warm family. Right there, wrong here.
 *
 * WHY THE SENSOR RATHER THAN THE SWITCH. CaMKK wears calcium markers on its own
 * bodies and calcium is this system's one cool colour, so a cool CaMKK would
 * merge with the thing it is carrying. AMPK is also the subject of the scale,
 * so it is the one that should be findable first.
 *
 * WHY NOT `PALETTE.nucleus` (#7f6f86), which was the first thing I reached for
 * as an in-family violet: it is ΔE 12 from `CONTROL_TINT`, so the exercising
 * sensor would have matched the un-exercised ARM — the one confusion this scene
 * can least afford. Measured before it shipped, not after. #8a5a86 sits at a
 * minimum ΔE of 29.9 against every other mark on this scale including the
 * control, and the categorical palette this borrows from already carries
 * violets (#9b7ede, #b07ecf, #c86fb8).
 *
 * Local rather than a new `PALETTE` entry, because it is this scale's identity
 * decision and the fibre scale's troponin must not move with it.
 */
const AMPK_COLOUR = "#8a5a86";

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * The two ends of the demand ramp, as COLOUR RATHER THAN LIGHT.
 *
 * Read the note in `update` before changing these. On this scene's #faf8f5
 * paper, "more" has to mean darker and bigger; it cannot mean brighter, because
 * brighter is the direction of the background. Rest is the resting tissue tone,
 * peak is the same tone the body scale uses for a muscle at full effort.
 */
const DEMAND_REST = new THREE.Color(PALETTE.mitochondrion);
const DEMAND_PEAK = new THREE.Color(PALETTE.tissuePeak);
const WALL_REST = new THREE.Color(PALETTE.reticulum);
/** Bead size at zero demand and at this run's peak. Area, so the ramp reads. */
const FLASH_SCALE = [0.5, 1.7];

/**
 * The control arm's markers, enlarged by exactly the amount perspective shrinks
 * them — and ONLY here, where size is a data channel.
 *
 * The two z are a representation, not a position: this model is well-mixed and
 * has no geometry, so the depth exists only so both arms can be seen at once. The
 * projection does not know that. It shrinks the far row by
 * (camZ - CONTROL_Z)/(camZ - BOUT_Z) = 1.34x, and for the pool and the sensor
 * that is free, because a bead's size carries nothing there — the quantity is the
 * COUNT of beads, and a count survives being drawn smaller.
 *
 * The demand flash is the exception, and it is the whole reason this constant
 * exists: FLASH_SCALE makes size mean the hydrolysis rate over a 3.4x range, so a
 * 1.34x depth shrink is a 40% error inside a channel a reader is being asked to
 * compare across the two arms. Uncorrected, the control at its full rate draws
 * the same size as the bout at about half of one.
 *
 * Derived from CELL_CAMERA, never written down, so moving the camera cannot
 * silently re-open it. cellGeometry.test.js projects both rows and requires them
 * equal at one published rate.
 *
 * AND THAT IMMUNITY WAS THE WRONG WAY ROUND. Deriving it from `CELL_CAMERA`
 * protects against someone EDITING `CELL_CAMERA`; it does nothing about a camera
 * that MOVES, which is what the guided pass added. Measured across the pass's
 * framings: the true ratio is 1.759 at the calcium beat, 1.484 at the sensor
 * beat and 1.417 at the conclusion, against the 1.340 being applied — so at the
 * closest beat the control's demand markers were drawn 31% small, inside the one
 * channel on this screen where size IS the quantity, and the correction existed
 * to stop exactly that. `cellGeometry.test.js` could not see it either: it
 * divides by `CELL_CAMERA[2] - z`, so it only ever checks the wide frame.
 *
 * `depthFixAt` takes the camera's actual z. The constant stays as the default
 * for anything that has no camera to ask.
 */
export const depthFixAt = (cameraZ) => {
  const z = Number.isFinite(cameraZ) ? cameraZ : CELL_CAMERA[2];
  const near = z - BOUT_Z;
  return near > 0 ? (z - CONTROL_Z) / near : 1;
};

const DEPTH_FIX = depthFixAt(CELL_CAMERA[2]);

function tag(object, role, label) {
  object.userData.role = role;
  if (label) object.userData.fiberLabel = label;
  return object;
}

/**
 * A PROTEIN IS NOT A BALL, and this scene had been drawing five of them as one.
 *
 * Owner, 2026-08-30: *"색만 바꾸는게 중요한게 아니라 그 3d element 자체를 바꾸라고
 * 더 실제로 내부답게"*. Measured before: AMPK's subunits, CaMKK's bodies, the
 * demand markers and the phosphates all draw between 12.0 and 14.8 px, and every
 * one of them was `SphereGeometry`. Four mechanisms, one mark, ~500 of it — a
 * viewer is not looking at a cell interior, they are looking at a bead spill.
 *
 * A globular protein is lumpy and asymmetric, so this is an icosahedron pushed
 * in and out by a smooth function of the surface DIRECTION. Direction and not
 * vertex index, because `IcosahedronGeometry` is non-indexed and duplicates the
 * corner of every face: displacing by index moves the copies apart and opens
 * cracks along every edge. By direction they move together.
 *
 * IT ONLY EVER PUSHES INWARD — the radius runs [0.74r, r] and never past r. That
 * is not an aesthetic choice, it is what keeps `nothing drawn leaves the
 * corridor` honest: that test measures reach as `geometry.boundingSphere.radius`,
 * so a shape that bulged past its nominal radius would silently widen every
 * containment margin in this file.
 *
 * One geometry per species, shared by every instance of it — 80 triangles total
 * whatever the instance count. What stops it reading as one stamp is that the
 * instances are turned; see `place`.
 */
function globule(radius, seed) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).normalize();
    const lumps =
      Math.sin(v.x * 2.9 + seed) + Math.sin(v.y * 3.3 + seed * 1.3) + Math.sin(v.z * 2.1 + seed * 0.7);
    v.setLength(radius * (0.74 + 0.26 * ((lumps / 3 + 1) / 2)));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * `spin` is a seed, not an angle: pass the instance's own index and it gets its
 * own attitude, deterministically. A lumpy shape drawn at one attitude in twenty
 * places is still one mark stamped twenty times — the complaint `AMPK_SITES`
 * already answers for POSITION, answered here for ORIENTATION.
 */
function place(mesh, i, x, y, z, scale = 1, spin = null) {
  _p.set(x, y, z);
  _s.setScalar(scale);
  if (spin === null) {
    _q.identity();
  } else {
    _e.set(hash(spin, 11) * Math.PI * 2, hash(spin, 12) * Math.PI * 2, hash(spin, 13) * Math.PI * 2);
    _q.setFromEuler(_e);
  }
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
}

/**
 * Where the 36 bodies sit — and why this is not six columns of six.
 *
 * IT WAS. A grid of 6x6 with a jitter of ±0.035, which is a jitter you can
 * measure and cannot see: the drawn pool came out with a four-fold order
 * parameter of 0.569, meaning most of the 36 had their nearest neighbour dead
 * along a shared pair of axes. A reader who had never seen the model called this
 * scale "a translucent salmon anatomy field, not a person", and this is the half
 * of that no caption could have fixed.
 *
 * The fibre study one scale up spent three treatments learning the general form
 * of it: *a perfect extruded cylinder is still a perfect extruded cylinder under
 * any shading.* Materials, depth and motion all failed against that wall and only
 * silhouette work moved it. Spheres on a lattice are the same wall — the
 * repeating thing is the ARRANGEMENT, so the arrangement is what has to stop
 * repeating.
 *
 * A GOLDEN-ANGLE FILL, THEN BROKEN AGAIN. Vogel's construction puts the i-th of
 * n points at radius sqrt(i/n) and bearing i x 137.5°, which has no rows and no
 * columns anywhere — but 36 of them is few enough that its own spiral becomes the
 * new regularity, so each point is then displaced by its own hash. The ellipse is
 * the pool's old extent, near enough: half-width 0.86 and half-height 0.33 about
 * y = -0.17, which keeps the top of the pool at y ~ 0.16 and the empty band the
 * two arm labels sit in exactly where cellGeometry's anchors expect it.
 *
 * `the pool and the sensor are suspensions, not lattices` in cellGeometry.test.js
 * measures this off the drawn matrices, not off this function.
 */
const POOL_A = 0.86;
const POOL_B = 0.33;
const POOL_Y = -0.30;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * The pool's 36 sites, laid out once. `poolSite` used to run Vogel's formula 36
 * times inside `writePool`, which is 36 sin, 36 cos and 36 sqrt every frame for
 * an answer that never changes.
 */
const POOL_SITES = relax(
  Array.from({ length: POOL_BEADS }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / POOL_BEADS);
    const theta = i * GOLDEN_ANGLE;
    return [
      POOL_A * r * Math.cos(theta) + (hash(i, 1) - 0.5) * 0.19,
      POOL_Y + POOL_B * r * Math.sin(theta) + (hash(i, 2) - 0.5) * 0.1,
    ];
  }),
  // Two bodies touch at 0.10. The floor is BELOW that on purpose: molecules in a
  // compartment do crowd, and a floor at the touching distance is a floor every
  // pair ends up sitting on — measured, 0.115 collapsed the spacing spread from
  // 0.338 back to 0.115, which is a crystal again with the corners rounded off.
  // This only separates the pairs that were drawing as one lump.
  0.085,
  (q) => {
    q[0] = Math.min(POOL_A, Math.max(-POOL_A, q[0]));
    q[1] = Math.min(POOL_Y + POOL_B, Math.max(POOL_Y - POOL_B - 0.06, q[1]));
  },
  30,
);

const poolSite = (i) => POOL_SITES[i];

/**
 * The sensor's 20 sites. STILL A BAND, and deliberately: the AMPK callout points
 * at it, it has to stay clear of the pool below and of the anchor above, and a
 * sensor scattered as widely as its fuel is a sensor a viewer cannot tell from
 * its fuel — which is the exact complaint the labels were added to answer.
 *
 * IT IS ALSO STILL TWO DEEP, and that is arithmetic rather than taste: a molecule
 * is 0.11 across and twenty of them in a band 1.76 wide would sit 0.088 apart, so
 * one row of twenty cannot be drawn without them merging. The old drawing solved
 * that with two rows at one spacing each. This keeps the two levels and takes the
 * regularity out of both — the x are stratified, one molecule per slot displaced
 * inside its own slot, the two levels are offset by half a slot so no molecule
 * sits directly above another, and each level's y carries its own wobble.
 *
 * A single golden-ratio walk was tried here first and read as clumps with holes
 * in them: it clusters, and there is no room in this band to cluster.
 */
/**
 * How far a molecule may be displaced inside its own slot, in x and in y.
 *
 * Swept rather than picked, over five pairs, reading the drawn matrices back:
 *
 *   [0.04, 0.095]  spread 0.177  four-fold 0.395  nearest column 0.063
 *   [0.045, 0.09]  spread 0.173  four-fold 0.334  nearest column 0.060
 *   [0.05, 0.085]  spread 0.168  four-fold 0.351  nearest column 0.056
 *   [0.06, 0.08]   spread 0.162  four-fold 0.285  nearest column 0.050  <- this
 *   [0.055, 0.07]  spread 0.151  four-fold 0.390  nearest column 0.053
 *
 * The four-fold order is the number that matters and it is not monotonic in
 * either knob, which is exactly why this was swept instead of reasoned about. x
 * is bounded above by the half-slot offset it must not cancel and y by the 0.132
 * between the levels against the 0.078 a molecule is tall.
 */
const AMPK_JITTER = [0.06, 0.08];

/**
 * The two heights the sensor's twenty sites sit at, and the one thing a camera
 * that means to look at them should aim between.
 *
 * Named because a guided pass aimed at the AMPK ANCHOR instead — `at: [0, 0.74]`
 * — which is where the label hangs, 0.24 above the molecules. Measured by a
 * design review: that framing put `FLASH_BASE_Y` (0.792, the demand markers)
 * within 0.05 of dead centre in the beat whose whole subject is the sensor, so
 * the loudest thing on screen was the one the beat was not about.
 */
/* PUSHED APART WITH THE SIZES, 2026-08-30. Measured on the shipped frame, the
   clear space between the drawn bands was 6 px from AMPK's lowest subunit to
   CaMKK's highest calcium marker and 14 px from CaMKK's lowest body to the top
   of the pool — against marks 12–15 px across. Three rows touching is one cloud,
   which is what "뭐가 뭔지 잘 안보여" was looking at. Growing the marks without
   growing the gaps would have made it worse, so both moved in the same edit. */
export const AMPK_ROW_Y = [0.478, 0.610];
export const AMPK_ROW_MID = (AMPK_ROW_Y[0] + AMPK_ROW_Y[1]) / 2;

const AMPK_SITES = relax(
  Array.from({ length: 20 }, (_, i) => {
    const level = i % 2;
    const slot = Math.floor(i / 2);
    return [
      ((slot + 0.5 + level * 0.5) / 10 - 0.5) * 1.74 + (hash(i, 5) - 0.5) * AMPK_JITTER[0],
      (level ? AMPK_ROW_Y[1] : AMPK_ROW_Y[0]) + (hash(i, 7) - 0.5) * AMPK_JITTER[1],
    ];
  }),
  0.105,
  /* THE BAND'S OWN EDGES, DERIVED — and this was a hand-copy that cost an hour.
     It read `Math.min(0.6, Math.max(0.4, q[1]))`, which is `AMPK_ROW_Y`'s old
     [0.435, 0.567] plus its jitter, rounded and typed in. Moving the rows up on
     2026-08-30 left the clamp behind, so the upper level was pinned at 0.6: its
     ten molecules flattened onto one y and `the pool and the sensor are
     suspensions, not lattices` went from passing to a four-fold order of 0.567.
     A translation that cannot change a translation-invariant metric changed it,
     which is what said the clamp was reading a constant nobody had moved.
     Derived from the row and its jitter now, the way the rest of this file
     derives its bounds, so the band's edges follow the band. */
  (q) => {
    q[0] = Math.min(0.88, Math.max(-0.88, q[0]));
    q[1] = Math.min(AMPK_ROW_Y[1] + AMPK_JITTER[1] / 2, Math.max(AMPK_ROW_Y[0] - AMPK_JITTER[1] / 2, q[1]));
  },
  30,
);

/**
 * THE CALCIUM ARM, IN THE ONE BAND LEFT.
 *
 * Ten CaMKK bodies, always drawn, with a calcium marker on the ones the
 * published `CaMKK_active_fraction` says are active. The pool is there at rest
 * and the calcium is what comes and goes — a row that appeared out of nothing
 * would be drawing the kinase as absent before the bout, which the model does
 * not say.
 *
 * WHY IT IS HERE AND WHY IT IS NARROW. Measured off the drawn matrices, the
 * corridor is full: the adenine pool reaches y 0.149, the sensor starts at
 * 0.337, the demand markers own 0.683 upward and the mirror of that below. The
 * band between fuel and sensor is the only gap, it is 0.188 tall, and it already
 * carries the two arm anchors at (-0.6, 0.26) and (0.42, 0.26). So the row is
 * one level, centred, and stops at x = ±0.362 — clear of both anchors, so
 * neither arm's leader line lands on a CaMKK body and names it "bout".
 *
 * NOT A THIRD WIDE BAND. The pool and the sensor both span the full width; a
 * third one would flatten the composition into three stripes. A short row reads
 * as a different KIND of thing, which is what it is.
 *
 * The x are stratified one body per slot and displaced inside it, and the y
 * carries its own wobble — the same treatment the pool and the sensor got, for
 * the same reason: ten markers at one spacing on a straight line is the even row
 * this scene has removed everywhere else.
 */
const CAMKK_Y = 0.243;   // held: the pool moved down instead, which is where the room was
const CAMKK_SPAN = 0.68;
const CAMKK_JITTER = [0.022, 0.012];
const CAMKK_R = 0.036;
/** Where the calcium sits on the body. Small enough that the lit row stays under
 *  the sensor: 0.255 + 0.036 + the marker's 0.026 is 0.317 against the sensor's
 *  0.337, and `the calcium row keeps out of the fuel and the sensor` holds it. */
const CAMKK_CALCIUM_AT = [0.014, 0.036];

const CAMKK_SITES = Array.from({ length: CAMKK_MOLECULES }, (_, i) => [
  ((i + 0.5) / CAMKK_MOLECULES - 0.5) * CAMKK_SPAN + (hash(i, 11) - 0.5) * CAMKK_JITTER[0],
  CAMKK_Y + (hash(i, 12) - 0.5) * CAMKK_JITTER[1],
]);

/**
 * The three phosphates of one nucleotide, in a line off the body — at the body's
 * OWN bearing.
 *
 * Every chain used to point along +x. Thirty-six bodies each trailing an
 * identical tail in an identical direction is one mark stamped thirty-six times,
 * and the outline is what the eye counts: scattering the bodies while leaving the
 * attitudes identical would have bought half the fix. A molecule in a well-mixed
 * compartment has no preferred attitude either, so this is the more honest
 * drawing as well as the less mechanical one.
 *
 * The bearing is bounded away from straight up and straight down — |sin| <= 0.62
 * — because the chain reaches 0.15 and the AMPK row's lowest subunit sits at
 * y = 0.399. A pool molecule near the top of the ellipse spearing a full 0.15
 * upwards would put a phosphate inside the sensor, which is two different
 * quantities drawn in one place.
 */
const PHOSPHATE_OFFSET = [0.048, 0.082, 0.116];
const CHAIN_TILT = 0.62;

function chainBearing(i) {
  const t = (hash(i, 3) - 0.5) * 2;
  return Math.atan2(CHAIN_TILT * t, Math.sign(hash(i, 4) - 0.5) * Math.sqrt(1 - (CHAIN_TILT * t) ** 2));
}

/**
 * The 24 demand markers, twelve along each wall.
 *
 * Held clear of CORRIDOR_HALF_Y by the largest radius they can reach, because
 * these grow now, and a marker that grows out through the wall is the
 * scale-appropriate form of a muscle leaving the body. `nothing drawn leaves the
 * corridor` includes them.
 *
 * THE CLEARANCE IS DERIVED, and it has to be: it was the literal 0.065, which
 * was right until DEPTH_FIX made the control's markers 1.34x larger and left
 * 0.0012 of margin — an invariant surviving on a rounding. The reach is the
 * sphere's radius times the largest scale any arm can be drawn at.
 */
const FLASH_R = 0.028;
const FLASH_REACH = FLASH_R * FLASH_SCALE[1] * Math.max(1, DEPTH_FIX);
/**
 * The last even row on this screen, and it was the tell: twelve markers at one
 * spacing on a straight line, twice, next to a pool that had just stopped being a
 * grid. Same disease, smaller organ.
 *
 * Both displacements are INWARD or sideways only. The clearance above is derived
 * from the largest scale a marker can be drawn at, and it survives on a margin of
 * 0.004 — a jitter that could push one outward would be spending an invariant on
 * an appearance. The wall's own bow varies along its length anyway, so markers
 * pulled in by different amounts read as sitting on a surface rather than on a
 * ruler drawn beside it.
 */
const FLASH_BASE_Y = CORRIDOR_HALF_Y - FLASH_REACH - 0.004;
const flashSite = (i) => [
  ((i % 12) - 5.5) * 0.19 + (hash(i, 8) - 0.5) * 0.1,
  (i < 12 ? 1 : -1) * (FLASH_BASE_Y - hash(i, 9) * 0.045),
];

export function buildCellLevel() {
  const group = new THREE.Group();
  group.name = "CellLevel";

  /* ---- the corridor -------------------------------------------------- */

  /* The fibre level's myofibrils, magnified. Two different shape indices, so the
     two walls taper and bow differently and the corridor is not a symmetrical
     slot — a real interstice is bounded by two different myofibrils. */
  /* The demand is written into `wallMat.color`, not into an emissive intensity.
     Two earlier versions of this line were wrong in opposite directions and both
     are worth keeping: the first wrote an intensity onto an emissive that
     `sheathMaterial` leaves black, so the seam was live and invisible; the
     second gave it a colour to emit, so the seam moved — and moved the wrong
     way, adding light to a light surface on lighter paper. Colour is the channel
     that has a defined sign here. */
  const wallMat = sheathMaterial({ colour: PALETTE.reticulum, opacity: 0.26 });
  const wallMeshes = [];
  [0, 3].forEach((seed, side) => {
    const shape = myofibrilShape(seed);
    const wall = new THREE.Mesh(
      rod(WALL_LEN, (u) => shape.radiusAt(u) * WALL_R, shape.bowAt, 28, 40),
      wallMat,
    );
    // Pushed out by its own radius so the SURFACE, not the axis, bounds the gap.
    wall.position.set(0, (side === 0 ? 1 : -1) * (CORRIDOR_HALF_Y + shape.radiusAt(0.5) * WALL_R), 0);
    tag(wall, "myofibril-wall", "Myofibril");
    group.add(wall);
    wallMeshes.push(wall);
  });

  /* ---- ATP demand, on the wall surface -------------------------------- */

  /* The one exported series that is an INPUT to the AMPK model rather than a
     state of it: the hydrolysis rate the integrator was driven by. It belongs on
     the walls because that is where it comes from — the myofibril's ATPases are
     what spends it — and it is drawn as emission rather than as a bar because
     the scene already has the readout for magnitudes and needs the walls to say
     "this is where the cost is being incurred". */
  const flashGeo = new THREE.SphereGeometry(FLASH_R, 8, 6);
  flashGeo.computeBoundingSphere();
  const flash = (opacity) =>
    new THREE.InstancedMesh(
      flashGeo,
      anatomyMaterial({
        colour: PALETTE.mitochondrion,
        opacity,
        roughness: SURFACE.roughnessStatic,
      }),
      24,
    );
  const demandFlash = tag(flash(1), "demand-flash", "ATP demand");
  const demandFlashControl = tag(flash(CONTROL_OPACITY), "demand-flash-control", "ATP demand · control");
  group.add(demandFlash, demandFlashControl);

  /* ---- the adenine pool ----------------------------------------------- */

  const bodyGeo = new THREE.SphereGeometry(NUCLEOTIDE_R, 12, 9);
  bodyGeo.computeBoundingSphere();
  const phosGeo = new THREE.SphereGeometry(PHOSPHATE_R, 8, 6);
  phosGeo.computeBoundingSphere();

  const pool = (z, control) => {
    const opacity = control ? CONTROL_OPACITY : 1;
    const bodies = new THREE.InstancedMesh(
      bodyGeo,
      anatomyMaterial({ colour: control ? CONTROL_TINT : PALETTE.actin, roughness: 0.5, opacity }),
      POOL_BEADS,
    );
    // The cool accent means a bond, not an ion in transit (anatomyStyle.js) —
    // and a terminal phosphate is exactly a bond, which is the whole subject of
    // this scale.
    const phosphates = new THREE.InstancedMesh(
      phosGeo,
      anatomyMaterial({ colour: control ? CONTROL_TINT : PALETTE.calcium, roughness: 0.35, opacity }),
      POOL_BEADS * MAX_PHOSPHATES,
    );
    for (let i = 0; i < POOL_BEADS; i++) {
      const [x, y] = poolSite(i);
      place(bodies, i, x, y, z, 1);
    }
    bodies.instanceMatrix.needsUpdate = true;
    return { bodies, phosphates, z };
  };

  const bout = pool(BOUT_Z, false);
  const control = pool(CONTROL_Z, true);
  group.add(
    tag(bout.bodies, "nucleotide", "Adenine nucleotide"),
    tag(bout.phosphates, "phosphate", "Phosphate"),
    tag(control.bodies, "nucleotide-control", "Adenine nucleotide · control"),
    tag(control.phosphates, "phosphate-control", "Phosphate · control"),
  );

  /* ---- AMPK ------------------------------------------------------------ */

  /* Twenty molecules, three subunits each (α β γ) in warm structural tones. The
     phosphate on α is the drawn quantity: `pAMPK_fraction` x 20, rounded. */
  const subunitGeo = globule(0.04, 3.1);
  /* TEN ACROSS BY TWO IS WHAT THIS WAS, and its sixty subunits measured a
     nearest-neighbour spread of exactly 0.000 — one spacing, repeated, which is
     the definition of a crystal and the reason the sensor read as apparatus
     rather than as protein. The row is still a row, because the sensor has to
     stay a legible band the AMPK callout can point at and has to stay clear of
     the pool below and the anchor above; only its regularity is gone. x walks by
     the golden ratio so no two gaps repeat, y rides a slow wave with its own
     wobble, and each molecule is turned on its own axis. */
  const ampkSite = (i) => AMPK_SITES[i];
  /* One molecule's three subunits, α on top. Turned per molecule for the reason
     the phosphate chains are: twenty identical triangles in twenty identical
     attitudes is one mark stamped twenty times. */
  /* Scaled with the subunit (x1.25) so the trefoil stays a trefoil rather than
     three balls that have drifted apart. */
  const SUBUNIT_AT = [
    [0, 0.045],
    [-0.049, -0.026],
    [0.049, -0.026],
  ];
  const turned = (i, [dx, dy]) => {
    const a = hash(i, 6) * Math.PI * 2;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  };

  const sensorRow = (z, control) => {
    const opacity = control ? CONTROL_OPACITY : 1;
    const subunits = new THREE.InstancedMesh(
      subunitGeo,
      anatomyMaterial({ colour: control ? CONTROL_TINT : AMPK_COLOUR, roughness: 0.45, opacity }),
      AMPK_MOLECULES * AMPK_SUBUNITS,
    );
    const phosphates = new THREE.InstancedMesh(
      phosGeo,
      anatomyMaterial({ colour: control ? CONTROL_TINT : PALETTE.calcium, roughness: 0.35, opacity }),
      AMPK_MOLECULES,
    );
    for (let i = 0; i < AMPK_MOLECULES; i++) {
      const [x, y] = ampkSite(i);
      SUBUNIT_AT.forEach((at, k) => {
        const [dx, dy] = turned(i, at);
        place(subunits, i * AMPK_SUBUNITS + k, x + dx, y + dy, z, 1, i * AMPK_SUBUNITS + k);
      });
    }
    subunits.instanceMatrix.needsUpdate = true;
    return { subunits, phosphates, z, sites: ampkSite, n: AMPK_MOLECULES, at: [0.022, 0.072] };
  };

  const sensor = sensorRow(BOUT_Z, false);
  const sensorControl = sensorRow(CONTROL_Z, true);
  group.add(
    tag(sensor.subunits, "ampk-subunit", "AMPK αβγ"),
    tag(sensor.phosphates, "ampk-phosphate", "Phosphorylated AMPK"),
    tag(sensorControl.subunits, "ampk-subunit-control", "AMPK αβγ · control"),
    tag(sensorControl.phosphates, "ampk-phosphate-control", "Phosphorylated AMPK · control"),
  );

  /* ---- CaMKK, the calcium arm ------------------------------------------ */

  /* ONE BODY, NOT THREE. The sensor is drawn as αβγ because the phosphate lands
     on a named subunit of it; nothing in this export says anything about CaMKK's
     structure, so a subunit count here would be invented detail. A different
     shape for a different thing is also what stops a reader counting the two
     rows as one population.

     THE BODY IS TROPOMYOSIN'S TONE AND THE MARKER IS CALCIUM'S, and that pairing
     is already this project's: `anatomyStyle.js` gives troponin its own entry
     because it is the calcium sensor and lerps toward the cool accent as calcium
     binds. CaMKK is the same kind of object one scale down. The accent is not
     borrowed decoration — the marker IS the ion, and it is the same blue the
     fibre scale's calcium beads arrive in, which is the scale a viewer came
     from. The far row is slate like every other far row: colour and depth carry
     the arm, and nothing here is faint. */
  const camkkGeo = globule(CAMKK_R, 7.4);
  const camkkSite = (i) => CAMKK_SITES[i];

  const camkkRow = (z, control) => {
    const opacity = control ? CONTROL_OPACITY : 1;
    const bodies = new THREE.InstancedMesh(
      camkkGeo,
      anatomyMaterial({ colour: control ? CONTROL_TINT : PALETTE.tropomyosin, roughness: 0.45, opacity }),
      CAMKK_MOLECULES,
    );
    const phosphates = new THREE.InstancedMesh(
      phosGeo,
      anatomyMaterial({ colour: control ? CONTROL_TINT : PALETTE.calcium, roughness: 0.35, opacity }),
      CAMKK_MOLECULES,
    );
    for (let i = 0; i < CAMKK_MOLECULES; i++) {
      const [x, y] = camkkSite(i);
      place(bodies, i, x, y, z, 1, i + 40);
    }
    bodies.instanceMatrix.needsUpdate = true;
    return { subunits: bodies, phosphates, z, sites: camkkSite, n: CAMKK_MOLECULES, at: CAMKK_CALCIUM_AT };
  };

  const camkk = camkkRow(BOUT_Z, false);
  const camkkControl = camkkRow(CONTROL_Z, true);
  group.add(
    tag(camkk.subunits, "camkk", "CaMKK"),
    tag(camkk.phosphates, "camkk-calcium", "Calcium on CaMKK"),
    tag(camkkControl.subunits, "camkk-control", "CaMKK · control"),
    tag(camkkControl.phosphates, "camkk-calcium-control", "Calcium on CaMKK · control"),
  );

  /* ---- per-frame ------------------------------------------------------- */

  /**
   * Scale 0 is how a phosphate is absent, and it is load-bearing: the test
   * beside this file counts instances whose scale survived, so a phosphate that
   * were merely moved off-screen or left at full size in a dark material would
   * be counted as drawn. Absent means absent.
   */
  function writePool({ phosphates }, z, counts) {
    let n = 0;
    for (let i = 0; i < POOL_BEADS; i++) {
      const [x, y] = poolSite(i);
      // Species by index: the first `atp` bodies carry three phosphates, the
      // next `adp` carry two, the rest one. So a bead losing its terminal
      // phosphate IS the hydrolysis, in the same place, rather than a colour
      // change somewhere else in the pool.
      const carried = i < counts[0] ? 3 : i < counts[0] + counts[1] ? 2 : 1;
      const bearing = chainBearing(i);
      const [cx, cy] = [Math.cos(bearing), Math.sin(bearing)];
      for (let k = 0; k < MAX_PHOSPHATES; k++) {
        const at = i * MAX_PHOSPHATES + k;
        if (k < carried) {
          place(phosphates, at, x + PHOSPHATE_OFFSET[k] * cx, y + PHOSPHATE_OFFSET[k] * cy, z, 1);
          n++;
        } else {
          phosphates.setMatrixAt(at, HIDDEN);
        }
      }
    }
    phosphates.instanceMatrix.needsUpdate = true;
    return n;
  }

  /**
   * The demand, as size and as darkness. `k` is the published rate over this
   * run's own peak, already clamped to 0..1 by the caller.
   *
   * Both channels move the same way and both increase contrast against the
   * paper. The bead never shrinks to nothing — a demand of zero is still a
   * myofibril wall that is there, and hiding it would say the wall left.
   */
  function writeDemand(mesh, z, k, depthFix = 1) {
    const scale = (FLASH_SCALE[0] + (FLASH_SCALE[1] - FLASH_SCALE[0]) * k) * depthFix;
    for (let i = 0; i < mesh.count; i++) {
      const [x, y] = flashSite(i);
      place(mesh, i, x, y, z, scale);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.material.color.copy(DEMAND_REST).lerp(DEMAND_PEAK, k);
  }

  /**
   * How many of a row's molecules carry their mark. One function for both rows:
   * the sensor's phosphate and CaMKK's calcium are the same drawing of the same
   * kind of quantity — a published fraction of a conserved pool, as a count —
   * and a second copy of this loop is a second place for `HIDDEN` to be
   * forgotten, which is how a hidden instance ends up counted as drawn.
   */
  function writeSensor({ phosphates, sites, n, at }, z, count) {
    for (let i = 0; i < n; i++) {
      const [x, y] = sites(i);
      if (i < count) place(phosphates, i, x + at[0], y + at[1], z, 1);
      else phosphates.setMatrixAt(i, HIDDEN);
    }
    phosphates.instanceMatrix.needsUpdate = true;
  }

  /* `cameraZ` is the live camera's distance, handed in by the frame loop so the
     depth correction is the one this frame actually needs. Optional: a caller
     with no camera gets the wide-frame constant, which is what every caller got
     before the pass started moving. */
  function update(drawn, cameraZ) {
    writePool(bout, BOUT_Z, [drawn.atpBeads, drawn.adpBeads, drawn.ampBeads]);
    writePool(control, CONTROL_Z, [drawn.atpBeadsControl, drawn.adpBeadsControl, drawn.ampBeadsControl]);
    writeSensor(sensor, BOUT_Z, drawn.pAMPK);
    writeSensor(sensorControl, CONTROL_Z, drawn.pAMPKControl);
    /* THE CAUSE IS WRITTEN BEFORE THE EARLY RETURN BELOW, and that is not
       housekeeping: the runs a switch reaches publish no demand and return out
       of this function, and a calcium row written after it would go dark on
       exactly the three runs whose whole lesson is that it stays dark for a
       reason the data gives. */
    writeSensor(camkk, BOUT_Z, drawn.camkk);
    writeSensor(camkkControl, CONTROL_Z, drawn.camkkControl);

    /* DEMAND IS DRAWN AS SIZE AND AS DARKNESS, AND BOTH SIGNS COST US A DAY.
       This used to be `emissiveIntensity = demand / 2.0`. Two defects in one
       line:

       The scale was the authors' quoted threshold, and CellReadout now says in
       so many words that our spike and their five-second hold are not on one
       axis. A picture normalised by a comparison we refuse to print in words is
       still making the comparison. The full scale is our own published peak.

       The sign was BACKWARDS ON SCREEN. Measured against this scene's own paper
       (#faf8f5): demand rose 4.05x from rest to bout and the mean contrast of
       the flash beads FELL from 3.02 to 2.05, 32% fainter at the moment the bout
       costs the most. Emissive adds light, and adding light to a light-orange
       bead on near-white paper walks it into the background. Nothing was
       disconnected — six tests asked whether the seam moves and it moved. None
       asked which way. So the channels are now size and darkness, both of which
       increase contrast against a light ground monotonically. */
    /* AND A RUN THAT PUBLISHES NO RATE DRAWS NO MARKER. The knockout switches
       reach the authors' 2-DG stress, which is driven by a glycolysis cut and
       carries no ATP_hydrolysis_total column; `cellBinding.drawnAt` hands back
       `null` rather than a zero for it. Drawing the markers at k=0 would put
       this scale's smallest, palest demand on screen as a reading — a resting
       rate the run never reported — and the wall would take its rest tone for
       the same false reason. So they go, and the corridor stays as it is. */
    if (drawn.demand === null) {
      for (const mesh of [demandFlash, demandFlashControl]) {
        for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, HIDDEN);
        mesh.instanceMatrix.needsUpdate = true;
      }
      wallMat.color.copy(WALL_REST);
      return;
    }

    const k = Math.min(1, Math.max(0, drawn.demand / PEAK_DEMAND_mM_PER_S));
    const kC = Math.min(1, Math.max(0, drawn.demandControl / PEAK_DEMAND_mM_PER_S));
    writeDemand(demandFlash, BOUT_Z, k);
    writeDemand(demandFlashControl, CONTROL_Z, kC, depthFixAt(cameraZ));
    // The corridor warms with the bout's rate by darkening toward the peak
    // tissue tone — the walls are where the ATPases that spend it live.
    wallMat.color.copy(WALL_REST).lerp(DEMAND_PEAK, k * 0.55);
  }

  /**
   * WHAT EACH CLUMP IS. Built here since the first commit and rendered by
   * nothing until CellScale asked FiberLabels for them — the sixth time this
   * project computed something that reached no pixel, and the loudest, because a
   * reader who had never seen the model reported being unable to tell the sensor
   * from the fuel, or the corridor wall from the demand.
   *
   * The last two name the ARMS, and they carry the weight the colour cannot: the
   * far row is a second condition, and until it says so a viewer is free to read
   * it as a shadow of the near one. Each carries the swatch its row is drawn in,
   * so the name in the viewport and the line in the panel's legend are visibly
   * one system rather than two vocabularies for the same pair.
   *
   * CONTRACT — every anchor must project inside |ndc.x| <= 0.80 and
   * |ndc.y| <= 0.86 from CELL_CAMERA over the whole aspect range the app is used
   * at, 0.99 to 1.82. Derived points to keep in step: `<Gizmos>` in
   * CellScale.jsx, which renders these, and "every callout lands inside the
   * canvas" in cellGeometry.test.js, which is where the bound is enforced.
   * (It said `<FiberLabels>` until 2026-08-31. That component drew one flat
   * plate per anchor and was replaced by the single solved overlay; the bound
   * is the same bound and the renderer is not.)
   *
   * THE RULE THAT MAKES THAT HOLDABLE: ANCHORS ARE PLACED BY Y, NOT BY X. ndc.y
   * is independent of aspect and ndc.x is inversely proportional to it, so a
   * layout that spreads sideways is a layout that survives only the window it was
   * fitted in — which is how the previous five (x = ±1.9, ±1.42) came to be
   * built, carried, rendered and off-screen. These stack vertically near x = 0.
   * The two arm names are the one exception, split across the empty band between
   * the pool's top (y ~ 0.16) and the AMPK row's bottom (0.367).
   */
  const anchors = [
    /* THE NOUN AND WHAT IT IS — the fibre scale's `A-band · never changes
       length` shape, brought here for the same reason. Q11: a visitor arriving
       at this scale has never met AMPK or CaMKK, and the plates were bare
       names. The clauses are the words this scale's own copy already uses —
       `cellBinding.js` says "Most of the AMPK sensor is already on" — so
       nothing new is being introduced, only said where the thing is drawn.
       Widths measured in the browser against `gizmo.css`'s 400 px cap rather
       than guessed, because the plates that carry a number have the least room:
       `AMPK · energy sensor` 361 px and `CaMKK · calcium switch` 375 (that
       plate reads `CaMKK2 · calcium switch` from 2026-08-30 — one character
       wider. The 361/375 pair was measured with the value and unit rendered;
       with `SHOW_FIGURES` off the same two plates measure 146 and 168 in the
       browser, so the cap has room either way. Re-measure against the widest
       VALUE, not this, if the figures come back on).

       MEASURE AGAINST THE WIDEST VALUE THE PLATE CAN EVER SHOW, not the one on
       screen when you measure. This cost two rounds of the same mistake. The
       clause was `· calcium turns it on` (397 px), then `· the calcium switch`
       (393 px) — both under the 400 cap at the instant they were measured,
       because CaMKK read `0 of 10` then. It counts UP: at `10 of 10` the same
       plate is 403 px and the NAME is what ellipsises, so the clause vanished
       exactly when the thing it explains was happening. The probe substitutes
       the maximum before measuring now, and `gate-legibility` reads after the
       pass has run rather than at t=0.
       `Myofibril · what contracted upstairs` 278, `bout · this exercise run`
       204. Both of the two this comment once left owing are done — the fuel
       plate below, and `flat-demand control`, which was renamed rather than
       explained.
       (`bout · this exercise run` was itself renamed to `bout · exercising` on
       2026-08-30 — see the anchor below. The 204 px above is the measurement of
       the string it replaced; the shorter one cannot be wider.) */
    { id: "myofibril-wall", label: "Myofibril · what contracted upstairs", at: [-0.62, 1.02, 0] },
    { id: "ampk-subunit", label: "AMPK · energy sensor", at: [0, 0.74, BOUT_Z] },
    /* THE ANCHOR IS THE LABEL'S PLACE, NOT THE MOLECULES'. It sits 0.24 above
       them so the plate has somewhere to point from — which is right for a
       callout and wrong for a camera. A design review found the guided pass
       framing this y and therefore centring `FLASH_BASE_Y` (0.792), the demand
       markers, in the beat whose subject is the sensor 0.24 lower. `AMPK_ROW_Y`
       is what a shot of the sensor should aim at. */
    /* A BARE NOUN, ON PURPOSE. `gizmoContract.js` is explicit that a callout
       with no `value` makes no claim and needs no evidence word, and the count
       here is the one number on this screen that is genuinely better left to
       the picture: the row goes from nought to nine lit markers in 26 ms, which
       is a thing you watch, not a digit you read. Printing "9 of 10" beside it
       would be the receipt for a moment the eye already had — and it is what a
       viewer could count. What they cannot do is know the row's name. */
    /* `CaMKK2`, NOT `CaMKK`, FROM 2026-08-30 (first-visitor audit). The chip
       under the stage says "CaMKK2 off" and this plate said "CaMKK", and both
       are on screen at once the moment a switch is pressed — one thing wearing
       two spellings, with nothing saying they are the same thing. The isoform
       is the honest one to keep: the scenario is `..._camkk2_ko`, the model
       condition is `CaMKK2_KO`, and the paper's Figure 8C says "CaMKK2
       knockout". `CaMKK_active_fraction` stays the series id, which is internal
       and reaches no screen. One character, and it costs 8 px of a 400 cap. */
    { id: "camkk", label: "CaMKK2 · calcium switch", at: [0, 0.24, BOUT_Z] },
    /* "this exercise run" LEFT 2026-08-30 (first-visitor audit). A plate's NAME
       is drawn whatever `SHOW_FIGURES` says — `Gizmos.jsx` gates only the value,
       the unit and the badge — so this was the one protocol claim that survived
       into minimal mode, and it was a false possessive. `RUNS.none.bout` is the
       constant `ampk_francis_soce_on` for EVERY exercise the body scale offers,
       and that archive is the authors' running stimulus. A visitor who
       descended from a lunge was being handed a run of somebody else's
       gastrocnemius and told it was theirs. "exercising" keeps the contrast
       with `control · no exercise`, which is the whole job of the pair, and
       claims nothing about which exercise. Which run is actually drawn is worth
       saying once, on the fibre scale where the descent passes through it —
       not four times, and not here. */
    { id: "arm-bout", label: "bout · exercising", at: [-0.6, 0.26, BOUT_Z], swatch: PALETTE.actin },
    { id: "arm-control", label: "control · no exercise", at: [0.42, 0.26, CONTROL_Z], swatch: CONTROL_TINT },
    /* THE CLAUSE GOES FIRST HERE, because the name is already three names.
       `ATP · ADP · AMP · the fuel` puts four separators in a row and the reader
       has to decide which one is the explanation; `The fuel · ATP · ADP · AMP`
       says what it is and then names its three forms, in the order the value
       counts them — `30 · 5 · 1 of 36`. Measured against the widest value the
       plate can show (`36 · 36 · 36`): 378 px, where `· the fuel, spent` is 425
       and `· fuel and leftovers` 452. */
    { id: "nucleotide", label: "The fuel · ATP · ADP · AMP", at: [0, -0.68, BOUT_Z] },
  ];

  return {
    group,
    update,
    anchors,
    walls: wallMeshes,
    dispose: () => disposeTree(group),
  };
}

/**
 * What this scale shows, stated the way the fibre levels state theirs — and
 * stating the one thing it cannot.
 */
/* EIGHT WORDS CAME OFF THE END on 2026-08-29, to pay for eight the footer
   needed more. "…so the spacing is the fibre level's own" was a SECOND seam
   sentence inside a line whose first half already says "No measured extent",
   and the fact it carried — that the spacing is inherited from the scale above
   — is in the badge and in this module's own header. What it bought the
   footer is the thing no screen said at all: which fibre, and which data, the
   models were fitted to (Q25 R5-R6). A scale at 198 of 200 pays for a fix by
   cutting, not by filing it in a record — that is the third hundred's first
   rule. */
export const CELL_EXTENT =
  "the interstice between two myofibrils — where the fibre scale draws mitochondria. " +
  "No measured extent: the AMPK model is well-mixed and carries no geometry.";
