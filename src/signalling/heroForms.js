/**
 * The twelve, drawn as the things they are.
 *
 * WHY THIS FILE EXISTS. The owner, 2026-08-31, after the twelve were picked:
 * *"저 핵심 12개를 실제로 그려서 만들라고 그냥 점이 아니라"*. Twelve identical
 * spheres with names beside them is a labelled scatter plot — it answers "how
 * many" and never "what is this". Canon G1 is *"유저가 '이게 무엇인지' 보여야
 * 한다"* and canon G2 is the permission: *"3D element는 아예 새로 만들어도 된다.
 * 과학적으로 너무 틀리지만 않으면 된다."* This is that.
 *
 * THE SHAPE IS CHOSEN BY THE AUTHORS' OWN `type` COLUMN, NOT BY US. Every node
 * in Fowler's species sheet ships a type — `input`, `receptor`,
 * `second messenger`, `protein`, `transcription factor`, `gene`, `phenotype` —
 * and `signallingBinding.js` already argues at length why that column is the one
 * honest basis for anything spatial on this scale: the model has no geometry, so
 * a placement or a form WE invented would be anatomy we made up. The same
 * argument carries here. A receptor is drawn crossing a membrane because the
 * archive calls it a receptor; a gene is drawn as a piece of DNA because the
 * archive calls it a gene. Change the column and the picture changes with it.
 *
 * WHERE A FORM SAYS MORE THAN THE TYPE, IT IS BECAUSE THE MOLECULE IS FAMOUS FOR
 * IT — and only then, and only where a first-year textbook draws the same thing:
 *
 *   · `B_AR` is a seven-transmembrane G-protein-coupled receptor, so it is seven
 *     helices through the bilayer. `integrin` is a two-legged heterodimer, so it
 *     is two. That difference is what makes the two doors of this screen look
 *     like two different doors rather than two copies of one.
 *   · A protein KINASE is bilobal with a cleft between the lobes, which is where
 *     ATP sits and is the first picture anybody is shown of one. `JNK` and `S6`'s
 *     kinases get that silhouette.
 *   · `AMPK` is a heterotrimer — alpha, beta, gamma — and drawing three fused
 *     lobes is both true and the one thing that tells it apart from every other
 *     protein on the screen. It is also the only node here that one bout moves
 *     and the other does not, so being recognisable earns its place.
 *   · `RhoA` is a small GTPase and its defining feature is the nucleotide in its
 *     pocket, so it carries one.
 *
 * WHAT IS NOT CLAIMED. None of these is a structure. They are silhouettes at the
 * level a textbook cartoon works at, and the scale says so once rather than
 * beside each one. No count here is data: seven helices is what a GPCR has, not
 * a measurement of anything in this archive, and nothing on screen reads a
 * number off these shapes.
 *
 * THIS FILE IS ALSO THE CELL SCALE'S SOURCE FOR THE TWO PROTEINS BOTH SCREENS
 * DRAW. `cell/cellForms.js` used to carry its own copy of the kinase and the
 * heterotrimer, one scale factor off, and its own comment said they should be
 * the same protein — *"the same shape the signalling scale draws it as one level
 * down, because it is the same protein and this app should not have two"*. It
 * now imports `kinaseForm` and `trimerForm` from here rather than restating
 * them, so AMPK cannot drift into two proteins the next time either file is
 * touched.
 */

import * as THREE from "three";

/**
 * Roughly the radius a form should occupy, so twelve of them sit on one grid.
 *
 * IT WAS 0.072 AND THAT IS WHY THE SCREEN READ AS A SCATTER. Graded from a
 * render on 2026-09-01 against the fibre scale, which is the one the owner calls
 * good: ink density 0.17 of the frame here against the fibre's 0.52, and every
 * form about 120 px inside a 2560 px shot. Worked back through this scene's own
 * camera — z 4.4, fov 38 vertical, a 758 px stage, the dome putting the twelve
 * near z 0.6 — one world unit is about 290 px, so the tallest form on screen
 * (the two inputs, 2.5 radii tall) was 52 px. Fifty pixels is an outline. It is
 * not enough object for a surface to shade across, whatever the material does,
 * which is why the same screenshot reports a silhouette and no surface.
 *
 * 0.126 IS 1.75x, AND THE CEILING IS THE ARROW AND NOT THE ROW. Rows are
 * `ROW_GAP` 0.42 apart and the widest neighbouring pair on a row is 0.69, so
 * sideways there is room for several times this. What runs out first is the
 * stroke between two rows: `heroGeometry.HERO_R` stops each arrow short of both
 * ends, so a vertical link is `gap - 2 * HERO_R * 1.15 - head` long. Measured
 * over all twelve links at this radius, the shortest is `AMPK -> PGC_1a` at
 * 0.115 — about 33 px of shaft under a 16 px head — and the rest run to 1.62. At
 * 2x the shortest is 0.06 and the model's own arrows stop being visible, and
 * those arrows are the one thing on this screen that is not ours.
 *
 * WHAT THIS DOES NOT DO, SO THE NEXT PASS DOES NOT LOOK FOR IT HERE: it does not
 * make neighbours overlap. The tightest pair in the drawing is AMPK over PGC_1a
 * at 0.420, and the two forms together still leave 0.161 of daylight. Overlap the
 * way the fibre scale has it — many translucent bodies through each other — is
 * not reachable from this layout while an arrow has to survive between every
 * pair, and the layout is not this file's.
 *
 * `heroGeometry.HERO_R` IS DERIVED FROM THIS NOW rather than typed beside it, so
 * turning this dial cannot leave the arrows terminating inside the forms.
 */
/* 0.126 UNTIL THE PLATE ENVELOPE WAS THE REAL CEILING. The forms could not grow
   past 0.129 without a name plate leaving the canvas, and every lever tried
   against that — tighter rows, a shorter plate lift, five camera positions —
   moved the failure and not the cause: it was always "Resistance Exercise", the
   top row, hung above a node with nothing above it. With that plate underneath
   its own node the drawing has room, and this is the largest radius that keeps
   every form clear of its neighbour's centre. 1.47x, and the point is not size:
   at this radius forms OVERLAP, which the audit put at the top of what the fibre
   scale has and this one did not. */
/* 0.255 UNTIL THE FLOOR'S SUBJECT CHANGED, 2026-09-05. The brief for SIGNALS is
   *"nodes are relatively quiet, connections and travelling signals are the
   protagonists"*, and it names the failure directly: *"large sculptural
   molecules dominating the network"*. At 0.255 a node is 0.51 across against a
   link 0.097 across, so the drawing is thirteen sculptures with hairlines
   between them — which is the right hierarchy for a floor about OBJECTS and the
   wrong one for a floor about ROUTES.
   0.195 IS NOT A RETURN TO 0.126, AND THAT DISTINCTION IS THE WHOLE CHOICE.
   The note above measured 0.126 at about 52 px on this camera and graded it
   "an outline … not enough object for a surface to shade across". Scaling that
   measurement, 0.195 lands near 80 px: still a shaded surface, still a form a
   viewer reads as a receptor or a mitochondrion rather than as a dot. What it
   gives up is dominance, which is what the brief asked for.
   THE HIERARCHY IS INVERTED BY THREE THINGS AND ONLY ONE OF THEM IS SIZE. The
   links thickened (`heroGeometry.LINK_R`, now its own dial), the pulses on them
   move and carry the warm/cool identity, and the forms themselves went quiet in
   colour — they hold `QUIET_TINT` and never take an arm's tint any more. A
   still, neutral object beside a moving coloured one loses the eye regardless of
   which is bigger. */
/* 0.195 -> 0.135, 2026-09-06 — the owner's §1, verbatim: *"Hero node를 25~35%
   축소 … SIGNALS의 주인공은 node 자체가 아니라 signal travelling through a
   system"*. 0.135 is a 31 % cut. `heroForms.test.js` holds both ends: at most
   0.146 (the 25 % line) and at least 0.12, under which the note above says a
   form is an outline. Links and pulses no longer follow this dial — see
   `heroGeometry.LINK_R` — so cutting it shrinks the sculptures and nothing else. */
export const FORM_R = 0.135;

/* ---- craft ---------------------------------------------------------------- */

/**
 * WHY A FILE ABOUT SILHOUETTES HAS A GEOMETRY LAYER IN IT.
 *
 * The first version of this file drew every protein as scaled `SphereGeometry`
 * primitives sitting inside each other, and it was graded from a screenshot as
 * reading like CAD — low segment counts, hard intersections where lobes meet, no
 * secondary detail. The reason is written down one scale up, in
 * `fiber/fiberGeometry.js`'s `rod()`, and it is the finding of a render study
 * that failed three times before it landed:
 *
 *   *"a perfect cylinder is still a perfect cylinder under any shading, and a
 *   scene made of them reads as a diagram. Nothing below is a material."*
 *
 * The fibre fixed that by moving vertices on the CPU rather than by reaching for
 * a shader, and the fibre is the scale the owner calls *"꽤 3d같아"*. The three
 * helpers below are the same move at this size, and nothing here is a material
 * either:
 *
 *   · `blob()` — a cluster of lobes drawn as ONE surface, so where two lobes of
 *     a protein meet there is a neck instead of the hard intersection crease two
 *     overlapping spheres leave. That crease is what made the kinase read as two
 *     balls and AMPK as three.
 *   · `dent()` — a deterministic bump field on that surface, so a folded protein
 *     is lumpy rather than turned. NOT random: `heroForms.test.js` measures
 *     bounding boxes, and a random surface would make two runs of the same gate
 *     disagree about a thing that carries no meaning either way — the same
 *     argument `heroGeometry.js` makes for hashing the background dust.
 *   · `bentRod()` — a capsule with a bow, for anything long and thin. Flat disc
 *     ends are the other CAD tell, and seven exactly-parallel helices are
 *     machine-made in a way no receptor is.
 *
 * THIS IS BUILD-TIME WORK, NOT PER-FRAME WORK, which is the whole reason it is
 * affordable on a slow machine. The twelve forms are built once when the scene
 * mounts and never touched again; per frame the scene sets a colour on two
 * materials per node and nothing in this section runs. It also gives draw calls
 * back — a fused AMPK is one mesh where three spheres were three, and the DNA
 * strands below are nine meshes where they were thirty-two.
 */

/**
 * How far a lobe's influence reaches, as a multiple of its own stated size — and
 * this number is the one dial on this whole file that changes what the forms
 * look like, so it is worth knowing what it does before turning it.
 *
 * Each lobe contributes Wyvill's `(1 - q²)³` kernel with `q` the distance to the
 * lobe centre in units of `SUPPORT` semi-axes. `ISO` is then that kernel's value
 * at exactly one semi-axis, which means A LOBE ON ITS OWN COMES OUT THE SIZE IT
 * WAS ASKED FOR whatever `SUPPORT` is: every radius written in the forms below
 * still means what it says, and the bounding-box gate stays readable against
 * them. What `SUPPORT` changes is only how neighbours blend.
 *
 * IT WAS 2.0 AND THAT WAS TOO WIDE. At 2.0 a lobe still contributes meaningfully
 * a full diameter away, so AMPK's three subunits summed into one smooth mass —
 * measured off the built geometry, the silhouette had no waist at all and the
 * heterotrimer that is supposed to be the one recognisable protein on this
 * screen read as a potato. That is the opposite of the failure this machinery
 * was added to fix. 1.55 leaves a neck you can see in the outline while still
 * welding the crease shut.
 */
const SUPPORT = 1.55;
const ISO = (1 - 1 / SUPPORT ** 2) ** 3;

/**
 * A dent field on the unit sphere, in roughly [-1, 1].
 *
 * A product of sines rather than a hash: it is continuous, so the poles and the
 * u=0/u=1 seam of `SphereGeometry` — where vertices are duplicated at identical
 * positions — get identical answers and no crack opens along the seam. Two
 * octaves; one alone gives a shape that reads as a deflating balloon, and the
 * third octave is below the size anyone can see at 60–90 px.
 */
function dent(x, y, z, seed) {
  return (
    0.64 * Math.sin(x * 4.7 + seed) * Math.sin(y * 5.3 - seed * 1.7) * Math.sin(z * 4.1 + seed * 2.3) +
    0.36 * Math.sin(x * 9.1 - seed * 3.1) * Math.sin(y * 8.3 + seed * 0.7) * Math.sin(z * 10.7 - seed)
  );
}

/**
 * One or more lobes, drawn as one closed surface.
 *
 * `lobes` is `[[centre, semiAxes], ...]`. The surface is found by walking each
 * vertex's own direction out from the group origin and taking the OUTERMOST
 * crossing of the iso-surface — a metaball restricted to shapes that are
 * star-shaped about their own centre. That restriction is why this is thirty
 * lines rather than a marching-cubes implementation, and every cluster below
 * satisfies it: a protein drawn as two or three fused lobes contains its origin.
 *
 * WHAT IT WILL NOT DO, written down so the next person does not lose an
 * afternoon to it: a genuinely concave form — a horseshoe, a clamp closed past
 * half a turn — comes out shrink-wrapped, because the outermost crossing skips
 * the cavity. The transcription factor's clamp below is drawn as two separate
 * arms for that reason and not because a clamp has two pieces.
 */
/* `radial`/`rings` WENT UP WITH `FORM_R` AND FOR NO OTHER REASON. 30x22 was
   chosen against a form 52 px tall; the same form is 91 px now, so one quad
   along the silhouette went from under 2 px to over 3 and the outline started
   showing its polygons — the "reads like CAD" failure this whole craft section
   exists to keep out, walked back in through the size dial. 38x28 puts a quad
   back under 2.5 px at the new size. It is build-time work: twelve forms, once,
   at mount. */
export function blob(material, lobes, { seed = 1, dents = 0.055, radial = 38, rings = 28 } = {}) {
  const geo = new THREE.SphereGeometry(1, radial, rings);
  const pos = geo.attributes.position;

  let reach = 0;
  for (const [c, r] of lobes) {
    reach = Math.max(reach, Math.hypot(c[0], c[1], c[2]) + SUPPORT * Math.max(r[0], r[1], r[2]));
  }

  const field = (t, dx, dy, dz) => {
    let f = 0;
    for (const [c, r] of lobes) {
      const qx = (t * dx - c[0]) / (SUPPORT * r[0]);
      const qy = (t * dy - c[1]) / (SUPPORT * r[1]);
      const qz = (t * dz - c[2]) / (SUPPORT * r[2]);
      const q2 = qx * qx + qy * qy + qz * qz;
      if (q2 < 1) {
        const u = 1 - q2;
        f += u * u * u;
      }
    }
    return f;
  };

  /* Scanned INWARD from the kernel's reach, then bisected inside the bracket the
     scan found. The first version scanned outward and took the first crossing,
     which for two lobes in a row is the near lobe's far wall — the surface came
     out with a bite taken out of it wherever the ray had already left one lobe
     and not yet entered the next. Outermost-first has no such case. */
  const SCAN = 26;
  const BISECT = 11;
  for (let i = 0; i < pos.count; i += 1) {
    const dx = pos.getX(i);
    const dy = pos.getY(i);
    const dz = pos.getZ(i);
    let lo = 0;
    let hi = reach;
    for (let s = SCAN; s >= 1; s -= 1) {
      const t = (s / SCAN) * reach;
      if (field(t, dx, dy, dz) >= ISO) {
        lo = t;
        hi = ((s + 1) / SCAN) * reach;
        break;
      }
    }
    for (let b = 0; b < BISECT; b += 1) {
      const mid = (lo + hi) / 2;
      if (field(mid, dx, dy, dz) >= ISO) lo = mid;
      else hi = mid;
    }
    const t = ((lo + hi) / 2) * (1 + dents * dent(dx * 3, dy * 3, dz * 3, seed));
    pos.setXYZ(i, dx * t, dy * t, dz * t);
  }

  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * A capsule with a bow in it: `fiber/fiberGeometry.js`'s `rod()` at this scale.
 *
 * Capsule rather than cylinder because a flat disc end is the loudest CAD tell
 * on this screen and a rounded one costs four rings of vertices. The bow and the
 * waist swell are both half-sines — nothing at the ends, most in the middle — so
 * a bundle of these leans the way a bundle of helices leans instead of standing
 * like railings, and no two rods in a bundle are the same rod.
 */
function bentRod(material, r, h, { bow = [0, 0], radial = 12, seed = 0 } = {}) {
  const geo = new THREE.CapsuleGeometry(r, h, 4, radial);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const u = Math.min(1, Math.max(0, pos.getY(i) / h + 0.5));
    const k = Math.sin(u * Math.PI);
    const swell = 1 + 0.1 * k * Math.sin(seed * 2.3 + u * 3.1);
    pos.setX(i, pos.getX(i) * swell + bow[0] * k);
    pos.setZ(i, pos.getZ(i) * swell + bow[1] * k);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** A swept tube along a curve, for strands and strokes that have to bend. */
function strand(material, points, r, { segments = 30, radial = 7 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, r, radial, false), material);
}

/**
 * A surface of revolution about the long axis, open along a wedge facing +z.
 *
 * `profile` is `[[radius, alongAxis], ...]`. The wedge exists so a hollow
 * organelle can be seen INTO — see `mitochondrionForm`, where the cristae spent
 * their whole first life invisible inside an opaque capsule.
 *
 * `LatheGeometry` puts phi=0 at +z and revolves about +y, so the drawn surface
 * is started half a gap past +z and the gap lands centred on the camera side.
 * The finished mesh is turned onto +x, which maps local +y to +x and leaves z
 * alone — so the opening still faces the viewer after the turn.
 */
function shell(material, profile, { openFraction = 0.3, segments = 30 } = {}) {
  const gap = Math.PI * 2 * openFraction;
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-5, r), y)),
    segments,
    gap / 2,
    Math.PI * 2 - gap,
  );
  geo.rotateZ(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  /* AN OPEN SHELL HAS A FAR WALL AND THE FAR WALL HAS TO SHADE. The material is
     this node's own — `heroGeometry.js` builds a fresh `body`/`detail` pair
     inside its per-node loop — so turning it double-sided here changes this one
     organelle and nothing else on the screen. `cell/cellForms.js` does the same
     thing to the store's wall for the same reason. */
  material.side = THREE.DoubleSide;
  return mesh;
}

/* ---- the forms ------------------------------------------------------------ */

/**
 * THE EXERCISE ARRIVING. Not a molecule — the archive types these two `input`,
 * and its own provenance says the input surface is "two dimensionless scalars in
 * [0,1] and a duration", with nothing mapping 1.0 onto a real load. So this is
 * deliberately not a barbell and not a runner: it is a force reaching the cell,
 * drawn as chevrons pointing the way the signal goes. Drawing a dumbbell here
 * would put a claim about %1RM into a picture the model cannot support.
 *
 * ONE SWEPT STROKE PER CHEVRON, NOT TWO CROSSED RODS. The two-rod version left a
 * notch at the point of the V where the cylinders cut each other, which at this
 * size reads as a broken mark rather than as an arrow. A tube through five
 * points rounds the corner the way a drawn stroke does, and it halves the mesh
 * count while doing it.
 *
 * EXPORTED, BECAUSE THE CELL SCALE DRAWS THIS EXACT MARK. `ATP_hydrolysis_total`
 * is the same bout arriving one scale up, and `cell/cellForms.js` said so in
 * words while keeping a second copy of the drawing. `R` is that scale's own grid
 * radius — and it has to be, because the first version scaled the ARM by `R` and
 * left the three chevrons' spacing as bare world numbers, so the cell drew the
 * same mark wider and no taller than the signalling scale did.
 *
 * THE THREE SIT AT THREE DEPTHS, WHICH IS THE ONLY REASON THIS MARK IS IN 3D AT
 * ALL. Measured on the built geometry, the flat version was 0.018 deep against
 * 0.13 wide — a cardboard cut-out, and this is the most prominent mark on either
 * screen. Staggered in z the three swing against each other the moment the
 * camera moves, and the stagger says the right thing as well: they are a bout
 * arriving, so the nearest is the largest and the far one is smallest and
 * behind. Nothing reads that as a number; it is the same shrink the flat version
 * already had, given somewhere to go.
 */
export function chevronForm(material, R = FORM_R) {
  const group = new THREE.Group();
  const arm = R * 0.82;
  for (let i = 0; i < 3; i += 1) {
    const s = 1 - i * 0.17;
    /* 0.78 UNTIL THE FORMS GREW AND THIS ONE FORM WAS THE ONLY THING OVER THE
       LINE. At `FORM_R` 0.285 the chevron stack reached 0.357 from its centre on
       y against the 0.320 to its nearest neighbour — the one node in thirteen
       that swallowed a neighbour's centre whole, and the same node the note at
       `FORM_R` records as having been the ceiling every previous time. Squashing
       the STACK rather than shrinking all thirteen keeps the ink the growth was
       for: three chevrons closer together still read as a door, and the drawing
       loses nothing a viewer was using. 0.42 puts the half extent at 0.264. */
    const y = (1 - i) * R * 0.42;
    const z = (1 - i) * R * 0.42;
    const stroke = strand(
      material,
      [
        [-arm * s, y - arm * 0.62, z],
        [-arm * 0.5 * s, y - arm * 0.16, z],
        [0, y + arm * 0.34 * s, z],
        [arm * 0.5 * s, y - arm * 0.16, z],
        [arm * s, y - arm * 0.62, z],
      ],
      R * 0.115 * s,
      { segments: 22, radial: 8 },
    );
    group.add(stroke);
  }
  return group;
}

/**
 * A RECEPTOR, THROUGH THE MEMBRANE. `helices` is what that receptor has: seven
 * for a GPCR, two legs for an integrin heterodimer. Arranged in a ring and
 * leaning, which is how every textbook draws a bundle, with a short lobe on the
 * inside face so the thing has a direction.
 *
 * EACH HELIX LEANS AND BOWS BY ITS OWN INDEX rather than all by the same angle.
 * A bundle of identical parallel cylinders is the most machine-made object this
 * file could produce, and it is also wrong about the one thing a bundle drawing
 * is for: the helices of a GPCR are a splayed barrel, not a fence. The lean is
 * deterministic in `i`, so the picture is the same on every load.
 */
function receptorForm(material, helices) {
  const group = new THREE.Group();
  /* THE BUNDLE IS SHORTER THAN IT WAS, TO PAY FOR THE DEEPER TAIL. Setting the
     tail low enough to cure the tangent crease took the whole receptor to 0.170
     tall against the 0.151 it shipped at; the shorter bundle brings it back to
     0.149, so this form is not asking for more room than it had.

     WHAT IT DOES NOT FIX, SO NOBODY LOOKS FOR IT HERE: `heroGeometry.js` stops
     each arrow `HERO_R * 1.15` = 0.0713 short of a node's centre so a stroke
     does not vanish under what it points at, and a receptor reaches 0.0851 below
     its own centre — the arrow down to `RhoA` starts inside the tail. That was
     true of the shipped version at the same 0.085 and it is true of five other
     nodes here, the two inputs worst at 0.096. It is a mismatch between one
     radius in the scene file and the forms' real extents, and it belongs in
     whatever pass owns the layout, not in a form that just got smaller. */
  const h = FORM_R * 1.34;
  const ring = FORM_R * (helices > 3 ? 0.46 : 0.3);

  /**
   * THE LEAN WAS 0.16 RADIANS AND IT WAS NOT A LEAN.
   *
   * Graded off a render, 2026-09-01: *"five identical dark rods standing in a
   * bundle, like pencils in a pot, with no twist"*. The reading is right and the
   * cause is in the two lines this replaces. `rotation.x = sin(a) * 0.16` and
   * `rotation.z = -cos(a) * 0.16` tilt every rod by the SAME 0.16 rad — nine
   * degrees — and nine degrees over a rod 1.34 radii long moves its tip a fifth
   * of a radius. Through this camera that is a couple of pixels. Seven rods of
   * one length, one thickness and one angle, seen from the front, are a fence
   * whatever number is in the rotation.
   *
   * A GPCR's seven are a SPLAYED, TWISTED barrel — wider on the outside face
   * than the inside, no two the same length, and the lean carries a tangential
   * component so the bundle winds rather than flares. Three things here, each
   * varying by index so the picture is identical on every load:
   *
   *   · SPLAY. The rod's axis is built as a direction rather than as two Euler
   *     angles: `up` tipped toward a mix of the outward radial and the tangent.
   *     `TWIST` is how much of that mix is tangential, and it is what separates a
   *     barrel from a cone — at 0 this is a lampshade.
   *   · LENGTH. 0.78 to 1.16 of `h` by index. This is the change that actually
   *     kills the "identical" reading: unequal tops break the flat line across
   *     the top of the bundle, which is the single loudest machine-made cue the
   *     old version had.
   *   · AN ELLIPTICAL RING. A helix bundle's cross-section is an irregular oval,
   *     so the ring radius is modulated on `cos 2a`. It also means the front and
   *     back rows do not project onto each other.
   *
   * NONE OF IT IS A NUMBER ABOUT ANYTHING. Seven is what a GPCR has; every angle
   * and length here is drawing, at the level a textbook cartoon works at, and the
   * scale says that once rather than beside each form.
   */
  const TWIST = 0.62;
  const up = new THREE.Vector3(0, 1, 0);
  const axis = new THREE.Vector3();
  const tops = [];
  for (let i = 0; i < helices; i += 1) {
    const a = (i / helices) * Math.PI * 2;
    /* Deterministic in `i`, and spread over the whole bundle rather than
       alternating: `sin(i * 1.31)` does not repeat over any of the counts this
       function is called with (2, 4 and 7). */
    const vary = Math.sin(i * 1.31);
    const len = h * (0.97 + 0.19 * vary);
    const rad = ring * (1 + 0.24 * Math.cos(2 * a));
    /* Splay grows with the bundle: two legs of an integrin stand nearly upright
       and are read as legs, seven helices need to open or they are a fence. */
    const tilt = (helices > 3 ? 0.30 : 0.13) * (1 + 0.34 * Math.cos(i * 2.11));

    const helix = bentRod(material, FORM_R * 0.155, len, {
      bow: [Math.cos(a) * FORM_R * 0.15, Math.sin(a) * FORM_R * 0.15],
      seed: i * 1.7,
    });
    /* Outward radial and tangent in the xz plane; `TWIST` mixes them, and the
       result is the direction the rod's own +y is turned onto. */
    axis
      .set(Math.cos(a), 0, Math.sin(a))
      .multiplyScalar(Math.cos(TWIST))
      .addScaledVector(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), Math.sin(TWIST))
      .multiplyScalar(Math.sin(tilt))
      .addScaledVector(up, Math.cos(tilt))
      .normalize();
    helix.quaternion.setFromUnitVectors(up, axis);
    /* Staggered along the bundle axis too, so the feet do not line up either —
       a receptor's helices end at different depths in the leaflet. */
    const lift = Math.sin(i * 2.4) * FORM_R * 0.11;
    helix.position.set(Math.cos(a) * rad, lift, Math.sin(a) * rad);
    group.add(helix);
    /* Where this helix's outside end finished, for the loops below. */
    tops.push(
      new THREE.Vector3(Math.cos(a) * rad, lift, Math.sin(a) * rad).addScaledVector(
        axis,
        len * 0.5 + FORM_R * 0.155,
      ),
    );
  }

  /* THE EXTRACELLULAR LOOPS, AND ONLY WHERE THERE ARE ENOUGH HELICES TO HAVE
     ANY. They are the mark that says "this thing crosses the membrane more than
     once" — the strand has to come back to go through again — and they are what a
     first-year is actually shown. They also do the job the value complaint asked
     for on the cheapest terms available: a loop arcs across the gaps between the
     rods, so the bundle stops being separated bars with paper between them and
     becomes one connected object with its own interior shading.
     A two-legged integrin gets none: its two legs are separate chains and
     drawing a loop between them would be drawing a molecule the archive does not
     describe. */
  if (helices > 3) {
    for (let i = 0; i + 1 < helices; i += 2) {
      const a = tops[i];
      const b = tops[i + 1];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      /* Up and OUT: a loop that only rose would sit inside the barrel's mouth. */
      mid.y += FORM_R * 0.3;
      mid.x *= 1.5;
      mid.z *= 1.5;
      group.add(
        strand(material, [a.toArray(), mid.toArray(), b.toArray()], FORM_R * 0.075, {
          segments: 16,
          radial: 6,
        }),
      );
    }
  }
  /* THE CYTOPLASMIC TAIL: WHICH END IS INSIDE — and the helices have to plunge
     INTO it, not rest on top of it. At the first sizing the helix feet ended
     0.0175 below the top of a tail only 0.035 tall, so each of the seven met the
     dome in a shallow tangent and left a ring-shaped crease: the same hard
     intersection this file spent its craft section removing, reintroduced at the
     one junction that is not two lobes of a blob. Bigger and set lower, the
     helices enter it the way a bundle enters a domain. */
  const tail = blob(material, [[[0, 0, 0], [FORM_R * 0.4, FORM_R * 0.32, FORM_R * 0.38]]], {
    seed: 4.1,
    dents: 0.07,
    radial: 24,
    rings: 18,
  });
  tail.position.y = -h * 0.64;
  group.add(tail);
  return group;
}

/**
 * REACTIVE OXYGEN SPECIES. Small, many, and not one object — which is the whole
 * of what "species" means in that name. Fixed offsets rather than random, so the
 * same picture draws every time.
 *
 * SPREAD IN Z AS WELL AS IN THE PICTURE PLANE. Everything else on this screen
 * sits at z ≈ 0, and a cloud of dots at one depth is a texture; the same dots at
 * six depths swing against each other the moment the camera moves, which is the
 * one thing on this node that can only be got by actually being 3D.
 */
function radicalForm(material) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(FORM_R * 0.2, 14, 10);
  /* THE OFFSETS ARE IN RADII, AND THEY USED TO BE BARE WORLD NUMBERS — the exact
     mistake `chevronForm`'s own note above records making and fixing: the DROPS
     were scaled by `FORM_R` and the SPACING between them was not, so growing the
     grid grew six balls inside a cloud that stayed the size it was. Divided
     through by the 0.072 this file shipped at, so the picture is the one that was
     drawn before and the cloud now travels with the dial. */
  for (const [x, y, z, s] of [
    [0, 0.28, 0.42, 1.3],
    [-0.63, -0.42, -0.39, 0.85],
    [0.67, -0.25, 0.5, 0.95],
    [0.17, 0.76, -0.56, 0.7],
    [-0.42, 0.58, 0.33, 0.6],
    [0.42, -0.76, -0.22, 0.68],
  ]) {
    const drop = new THREE.Mesh(geo, material);
    drop.position.set(x * FORM_R, y * FORM_R, z * FORM_R);
    /* Not spheres: a radical drawn as a perfect ball is the CAD tell in
       miniature, and squashing each one on a different axis costs nothing. */
    drop.scale.set(s, s * (1 + 0.22 * Math.sin(s * 7.3)), s * (1 - 0.18 * Math.cos(s * 5.1)));
    drop.rotation.set(s * 2.1, s * 3.4, s * 1.3);
    group.add(drop);
  }
  return group;
}

/**
 * A PROTEIN KINASE: two lobes with a cleft. The small N-lobe on top, the larger
 * C-lobe under it, and daylight between them — the first picture anybody is
 * shown of a kinase, and the reason it looks like nothing else here.
 *
 * ONE FUSED SURFACE, NOT TWO SPHERES. Two overlapping ellipsoids leave a hard
 * intersection crease that reads as two balls in a bag; a metaball waist reads as
 * one protein with a cleft in it, which is what a kinase is. The lobes are also
 * pushed a little further apart than the sphere version had them, because fusing
 * fills a gap in and the cleft is the whole recognisable feature.
 *
 * `R` is a parameter because the cell scale draws the same protein at its own
 * grid size — see this file's header.
 */
export function kinaseForm(material, R = FORM_R) {
  const group = new THREE.Group();
  /* THE CLEFT WAS NOT THERE, AND THE ARITHMETIC SAYS WHY. The two lobes sat 0.86
     radii apart with y semi-axes of 0.44 and 0.56 — sum 1.00, which is MORE than
     the gap, so the ellipsoids interpenetrated before `blob` ever blended them.
     Two solids that already overlap have no waist to weld; the metaball then
     filled what little was left and the result is what the 2026-09-01 render
     reports, a lump with no information in its outline.
     Pushed to 1.16 apart with semi-axes summing to 0.94, the lobes no longer
     touch and the surface has to NECK between them. It still welds: `SUPPORT`
     1.55 gives them reaches of 0.62 and 0.87, and 1.49 covers the 1.16 gap. So
     one protein, two lobes, daylight narrowing between them — which is the first
     picture anybody is shown of a kinase and the whole reason this silhouette
     is worth drawing rather than a ball.
     THE CLEFT OPENS TOWARD THE CAMERA, not sideways. The N-lobe is forward of
     the C-lobe in z, so the groove faces +z where this scene's camera is; laid
     flat the two lobes would occlude each other and the waist would be the only
     evidence left. */
  group.add(
    blob(
      material,
      [
        [[0, R * 0.66, R * 0.14], [R * 0.5, R * 0.4, R * 0.44]],
        [[0, -R * 0.5, -R * 0.06], [R * 0.72, R * 0.54, R * 0.62]],
      ],
      { seed: 2.7, dents: 0.075 },
    ),
  );
  return group;
}

/**
 * A SMALL GTPase, carrying the nucleotide that is the whole of what it does.
 *
 * The body is one lobe with a second small one pushed into its shoulder, so the
 * pocket is a dimple in the surface rather than a bump stuck on it; the
 * nucleotide then sits IN the dimple. The sphere version had a bead balanced on
 * the outside of a ball, which reads as a decoration.
 */
function gtpaseForm(material, detail) {
  const group = new THREE.Group();
  group.add(
    blob(
      material,
      [
        [[0, 0, 0], [FORM_R * 0.82, FORM_R * 0.74, FORM_R * 0.74]],
        [[FORM_R * 0.46, FORM_R * 0.42, FORM_R * 0.24], [FORM_R * 0.32, FORM_R * 0.3, FORM_R * 0.3]],
      ],
      { seed: 5.3, dents: 0.075 },
    ),
  );
  const pocket = blob(
    detail,
    [[[0, 0, 0], [FORM_R * 0.24, FORM_R * 0.19, FORM_R * 0.2]]],
    { seed: 8.9, dents: 0.09, radial: 20, rings: 14 },
  );
  pocket.position.set(FORM_R * 0.58, FORM_R * 0.54, FORM_R * 0.32);
  group.add(pocket);
  return group;
}

/**
 * A HETEROTRIMER — three subunits, fused. AMPK is alpha, beta and gamma.
 *
 * The three lobes are one surface for the same reason the kinase's two are, and
 * it matters more here: three intersecting spheres leave three creases meeting
 * at a point, which is the single most CAD-looking thing this file used to draw.
 * Fused, the subunits keep their own bulges and the necks between them read as a
 * complex that came together rather than as three balls pressed into each other.
 *
 * `R` is a parameter because the cell scale draws AMPK too, and it has to be
 * the same protein there — see this file's header.
 */
export function trimerForm(material, R = FORM_R) {
  const group = new THREE.Group();
  /* THREE SUBUNITS THAT MEET AT ONE FACE, AND THREE THAT ARE NOT THE SAME SIZE.
     The version this replaces put three near-equal lobes at three unequal
     spacings — 1.11, 1.14 and 1.28 radii apart — which is a clump, and it read
     off the 2026-09-01 render as *"three dark lumpy metaballs"*. Two things are
     wrong in that and only one of them is the material.
     THE SPACINGS ARE NOW EQUAL, 1.19 / 1.20 / 1.24, so the three necks all meet
     at one junction in the middle of the form rather than in a line. That
     junction is what "trimer" means and it is the thing to be able to see.
     THE SUBUNITS ARE NOW DIFFERENT SIZES, 0.60 / 0.38 / 0.50, which is both true
     of AMPK — α is the big catalytic subunit, β the small scaffold, γ the
     nucleotide-binding one — and the cheapest way to stop three lobes reading as
     one lumpy potato: a viewer counts three when they are unequal and sees a
     blob when they are not.
     Every pair still welds and none interpenetrates: reaches 0.87 / 0.59 / 0.78
     against gaps of 1.19–1.24, and semi-axis sums of 0.92 / 1.02 / 0.82 under
     them. Three necks, one shared face, no crease. */
  group.add(blob(material, trimerLobes(R), { seed: 1.9, dents: 0.08 }));
  return group;
}

/**
 * The trimer's three lobes as data, so two floors can draw the same molecule.
 *
 * WHY THIS IS AN EXPORT AND WHY THE ORCHESTRATOR WROTE IT — 2026-09-06. AMPK is
 * the seam between ENERGY and SIGNALS: the camera pulls BACK there instead of
 * zooming in, and the only reason that reads as "the same object, seen as one of
 * many" rather than as a cut is that the visitor recognises the FORM. ENERGY had
 * the spec copied into `cellChainGeometry.js`, welded closer — same species
 * today, two places that can drift tomorrow, and the day they drift the seam
 * stops being a seam and nothing fails.
 *
 * It was written here rather than by either lane because `heroForms.js` is the
 * SIGNALS lane's file and the ENERGY lane needed the export: two lanes editing
 * one file is the collision the orchestrator exists to prevent, and the SIGNALS
 * lane's own next item is `growthForm`, eighty lines down.
 *
 * `weld` pulls the lobes toward their shared junction — ENERGY draws its AMPK
 * tighter than the network scale does, because at that distance three separated
 * lobes read as three molecules. `open` turns the large catalytic lobe about the
 * junction, which is the conformational change: at 0 this returns exactly what
 * `trimerForm` typed inline before this existed, so SIGNALS is byte-identical.
 *
 * @param R     the form's radius
 * @param weld  1 = as SIGNALS draws it; below 1 pulls the lobes together
 * @param open  radians the α lobe turns about the junction; 0 is closed
 */
export function trimerLobes(R, { weld = 1, open = 0 } = {}) {
  const lobes = [
    [[-R * 0.5, R * 0.42, R * 0.1], [R * 0.6, R * 0.56, R * 0.54]],
    [[R * 0.62, R * 0.3, -R * 0.28], [R * 0.38, R * 0.36, R * 0.36]],
    [[R * 0.02, -R * 0.66, R * 0.22], [R * 0.5, R * 0.46, R * 0.46]],
  ];
  if (weld === 1 && open === 0) return lobes;
  return lobes.map(([centre, semi], i) => {
    const [x, y, z] = centre.map((v) => v * weld);
    /* Only the first lobe turns — α is the catalytic subunit and the one whose
       cleft opens; turning all three would be the molecule spinning, which says
       nothing. Rotation is about the junction, which the welded centres already
       orbit, so this is a swing rather than a slide. */
    if (i !== 0 || open === 0) return [[x, y, z], semi];
    const c = Math.cos(open);
    const sn = Math.sin(open);
    return [[x * c - y * sn, x * sn + y * c, z], semi];
  });
}

/**
 * A SHORT RUN OF DNA: two backbones twisting past each other, with the base
 * pairs between them.
 *
 * THIRTY-TWO BEADS BECAME TWO STRANDS AND ITS RUNGS. The bead version drew each
 * strand as sixteen little spheres, and at the size this screen is read at the
 * spheres merge into a dotted curve with no direction — two dotted curves side
 * by side are not recognisably a double helix. The rungs are what make it one:
 * they are the mark a first-year is shown, they say which bead pairs with which,
 * and they cost seven meshes where the beads cost thirty-two.
 */
function helixStrands(material, detail, turns = 1.6, rungs = 7, r = FORM_R * 0.44, h = FORM_R * 1.62) {
  const group = new THREE.Group();
  const at = (phase, t) => {
    const a = phase + t * Math.PI * 2 * turns;
    return [Math.cos(a) * r, (t - 0.5) * h, Math.sin(a) * r];
  };
  for (const [i, phase] of [0, Math.PI].entries()) {
    const points = [];
    for (let s = 0; s <= 24; s += 1) points.push(at(phase, s / 24));
    group.add(strand(i ? detail : material, points, r * 0.3, { segments: 48, radial: 6 }));
  }
  /* The base pairs. Thin, and in the darker material, so they read as the rungs
     between the backbones rather than as a third strand. */
  for (let i = 0; i < rungs; i += 1) {
    const t = (i + 0.5) / rungs;
    const a = new THREE.Vector3(...at(0, t));
    const b = new THREE.Vector3(...at(Math.PI, t));
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.13, r * 0.13, a.distanceTo(b), 6),
      detail,
    );
    rung.position.copy(a).add(b).multiplyScalar(0.5);
    rung.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    group.add(rung);
  }
  return group;
}

/**
 * A TRANSCRIPTION FACTOR: a clamp on DNA. Two arms around a short helix, which
 * is what "binds DNA and turns a gene on" looks like drawn — and the reason a
 * transcription factor is drawn differently from the gene it reads.
 *
 * The arms are separate blobs rather than one fused clamp on purpose: a clamp
 * closed around a strand is concave, and `blob()`'s note says what it does with
 * concave — it shrink-wraps the cavity shut and the DNA disappears inside a bean.
 * Each arm is fused in itself, which is where the crease actually showed.
 */
function factorForm(material, detail) {
  const group = new THREE.Group();
  const dna = helixStrands(detail, detail, 1.1, 5, FORM_R * 0.22, FORM_R * 1.3);
  dna.rotation.z = Math.PI / 2;
  group.add(dna);
  /* THE TWO ARMS ARE OFFSET IN Z AS WELL AS IN Y, so the clamp grips the strand
     from opposite sides rather than sandwiching it between two slabs on the same
     plane. The flat version measured 0.046 deep against 0.100 wide and read as a
     sticker; a clamp that actually goes round something is the whole reason a
     transcription factor is drawn differently from the gene it reads. */
  for (const s of [-1, 1]) {
    const arm = blob(
      material,
      [
        [[-FORM_R * 0.26, 0, -FORM_R * 0.06], [FORM_R * 0.3, FORM_R * 0.34, FORM_R * 0.34]],
        [[FORM_R * 0.28, 0, FORM_R * 0.04], [FORM_R * 0.28, FORM_R * 0.3, FORM_R * 0.32]],
      ],
      { seed: 3.3 + s, dents: 0.07, radial: 24, rings: 18 },
    );
    arm.position.set(0, s * FORM_R * 0.52, s * FORM_R * 0.2);
    arm.rotation.x = s * 0.34;
    group.add(arm);
  }
  return group;
}

/** A GENE: DNA, standing up, no clamp on it. */
function geneForm(material, detail) {
  return helixStrands(material, detail);
}

/**
 * A RIBOSOME MAKING A CHAIN. Large subunit, small subunit, and the polypeptide
 * coming out of it — the one drawing of protein synthesis everybody has seen,
 * and the reason this outcome does not need a word to be understood.
 *
 * The two subunits are fused with a shallow overlap so the groove between them
 * survives: the groove is where the mRNA runs and it is the feature that stops a
 * ribosome reading as a potato. The chain was five loose beads and is now one
 * swept strand — a nascent polypeptide is a chain, and five dots at this size
 * read as five more radicals.
 */
function ribosomeForm(material, detail) {
  const group = new THREE.Group();
  group.add(
    blob(
      material,
      [
        [[0, FORM_R * 0.22, 0], [FORM_R * 0.7, FORM_R * 0.56, FORM_R * 0.62]],
        [[0, -FORM_R * 0.46, FORM_R * 0.04], [FORM_R * 0.54, FORM_R * 0.36, FORM_R * 0.48]],
      ],
      { seed: 6.6, dents: 0.085 },
    ),
  );
  /* THE STRAND IS EXTRUDED, NOT WORN — owner §8, 2026-09-06: *"Ribosome이
     strand를 실제로 뽑아내게 합니다"*. Built with its origin at the exit site so
     a scale on the mesh grows it OUT of the ribosome rather than about its own
     middle; `drive(p)` below sets that scale from the outcome's own progress
     through the run. Short at rest rather than absent, so the form still reads
     as a ribosome before anything has happened. */
  const exit = [FORM_R * 0.42, -FORM_R * 0.5, 0];
  const chain = strand(
    detail,
    [
      [0, 0, 0],
      [FORM_R * 0.36, FORM_R * 0.18, FORM_R * 0.1],
      [FORM_R * 0.62, -FORM_R * 0.1, -FORM_R * 0.06],
      [FORM_R * 0.92, FORM_R * 0.14, FORM_R * 0.08],
      [FORM_R * 1.22, -FORM_R * 0.08, -FORM_R * 0.04],
      [FORM_R * 1.5, FORM_R * 0.12, FORM_R * 0.06],
    ],
    FORM_R * 0.11,
    { segments: 34, radial: 6 },
  );
  chain.position.set(...exit);
  chain.userData.part = "strand";
  group.add(chain);
  /* PASS 3 §7 *"inconsistent in scale"*: the ribosome photographed half again
     as wide as the other two outcomes. Down to 0.85 so the row reads as three
     objects of one weight. */
  /* 0.85 -> 1.0, PASS 4 §7: the three outcomes were still *"너무 작고"*; one
     weight across the row is held by `heroForms.test.js`. */
  group.scale.setScalar(1.0);
  group.userData.drive = (p) => {
    const s = 0.3 + 0.7 * Math.min(1, Math.max(0, p));
    chain.scale.set(s, Math.sqrt(s), Math.sqrt(s));
  };
  group.userData.drive(0);
  return group;
}

/**
 * CELL GROWTH: a bundle of fibres, one of them thicker than the rest. Growth is
 * a change, and a change needs two states in one picture — so the difference is
 * drawn as the difference, rather than as a bigger version of nothing.
 *
 * The fibres bow apart and none of them is quite vertical. Four parallel
 * cylinders read as a barcode; four bowed rods read as a bundle, and it is the
 * same fix the receptor's helices get for the same reason.
 */
function growthForm(material, detail) {
  const group = new THREE.Group();
  /* A FIBRE CUT ACROSS, AND IT THICKENS — owner §8, 2026-09-06: *"muscle fiber
     cross section / contractile bundle이 살짝 확대되는 쪽이 더 직관적"*.
     PASS 2: the first cut was seven capsules tilted 60° and, photographed from
     the floor's 14°/9° camera, it read as a bundle of standing rods — the
     thing the brief said was less intuitive. A cross-section is the histology
     picture: a sheath with fibres packed inside, seen end-on. So the fibres are
     short flat-capped cylinders, a torus stands round them as the sheath, and
     the disc faces the viewer with a slight tilt so it still has a thickness.
     `drive(p)` swells the disc radially by up to 28 % — slightly, the brief's
     word — and the sheath with it, which is what hypertrophy IS in section:
     the same fibre, bigger. `heroForms.test.js` holds it wider than deep, with
     a sheath, and every fibre under half a radius long. */
  const bundle = new THREE.Group();
  bundle.userData.part = "bundle";
  const R = FORM_R;
  const cut = R * 0.36;
  /* 0.37 -> 0.43, PASS 3 §7: the disc photographed a third smaller than its
     neighbours in the outcome row. */
  const pitch = R * 0.53;
  const seats = [[0, 0]];
  for (let k = 0; k < 6; k += 1) {
    const a = (k / 6) * Math.PI * 2 + 0.26;
    seats.push([Math.cos(a) * pitch, Math.sin(a) * pitch]);
  }
  seats.forEach(([x, z], i) => {
    /* Not all cut at one height — three heights, so the far fibres show a
       little side and the disc is a thing with thickness rather than a stamp. */
    const fibre = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.19, R * 0.19, cut * (1 - 0.06 * (i % 3)), 14), material);
    fibre.position.set(x, 0, z);
    fibre.userData.part = "fibre";
    bundle.add(fibre);
  });
  /* THE SHEATH: a ring in the cut plane, a shade darker than the fibres so the
     outline reads at this size. */
  const sheath = new THREE.Mesh(new THREE.TorusGeometry(pitch + R * 0.23, R * 0.045, 8, 40), detail);
  sheath.rotation.x = Math.PI / 2;
  /* ON THE NEAR CUT FACE, not at the middle: reviewed with a raycast, a ring at
     mid-height sat behind the caps' plane and a quarter of it was hidden by
     the fibres' own sides. Just under the cap plane it rims the face. */
  sheath.position.y = cut * 0.45;
  sheath.userData.part = "sheath";
  bundle.add(sheath);
  /* Facing the viewer: the cut plane is local xz and the camera stands at +z,
     so the axis (+y, the face the sheath rims) is turned toward +z by
     `rotation.x = +π/2 − 0.34` — a rotation about x by θ carries +y to
     (0, cos θ, sin θ), so the sign matters and the first cut had it wrong,
     showing the viewer the BACK caps at 40°. 0.34 rad short of square-on
     keeps an edge, so the far fibres show a little side and the disc is a thing
     rather than a stamp. `heroForms.test.js` reads the fibre axis's SIGNED z. */
  bundle.rotation.x = Math.PI / 2 - 0.34;
  bundle.rotation.z = 0.12;
  group.add(bundle);
  group.userData.drive = (p) => {
    const k = Math.min(1, Math.max(0, p));
    /* 0.28 -> 0.45, PASS 4 §7 *"small bundle → larger bundle을 더 명확히"*. */
    bundle.scale.set(1 + 0.45 * k, 1 + 0.08 * k, 1 + 0.45 * k);
  };
  group.userData.drive(0);
  return group;
}

/**
 * A MITOCHONDRION, CUT AWAY. The folds are the point — an unfolded capsule is a
 * pill, and the folds are what a first-year recognises.
 *
 * THE FOLDS WERE INVISIBLE AND THAT WAS THE BUG. The first version drew an
 * opaque capsule and then put five half-tori INSIDE it, at 0.34 of a radius the
 * body carried at 0.52. Nothing rendered but a brown pill; the cristae were
 * behind their own outer membrane for their entire life on screen, and the node
 * that is supposed to be the most recognisable object on this scale was the least.
 *
 * So the outer membrane is now a cut-away shell — a lathe with a wedge of it
 * missing, facing the camera — which is how a textbook draws a mitochondrion for
 * exactly this reason.
 *
 * THE CRISTAE ARE A COMB, NOT A STACK OF RINGS. The half-tori went back in first
 * and were measured off the built geometry before they were believed: six arcs
 * of ring-radius 0.024 spaced 0.020 apart overlap each other two and a half
 * times over, which at 60–90 px is not a fold, it is a smear. A crista drawn the
 * way a textbook draws it — a shelf hanging off one wall and reaching most of
 * the way across, alternating top and bottom — is a comb, and a comb survives
 * being small. They are `bentRod`s so they hook at the tip rather than ending
 * flat, which is the same helper the receptor's helices use.
 *
 * The profile is a super-ellipse rather than an ellipse, so the sides are
 * straight and the ends are round — an ellipse is pointed at both ends and reads
 * as a seed. It is swelled off-centre too, because a symmetric pill is a pill.
 */
function oneMitochondrion(material, detail) {
  const group = new THREE.Group();
  const R = FORM_R;
  const half = R * 0.95;
  /* A super-ellipse of exponent 2.8: straight-ish sides, round ends. At 4 the
     silhouette held full width to within a twentieth of each end and then turned
     a corner — a rounded rectangle, not an organelle. Swelled off-centre so the
     thing has a fat end and a narrow one. */
  const wallAt = (t) => R * 0.56 * (1 - Math.abs(2 * t - 1) ** 2.8) ** (1 / 2.8) * (1 + 0.16 * Math.sin(t * 2.2 + 0.4));
  const profile = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    profile.push([wallAt(t), (t - 0.5) * 2 * half]);
  }
  group.add(shell(material, profile, { openFraction: 0.32, segments: 34 }));

  /* Five, not six: at six the shelves are closer together than they are thick. */
  for (let i = 0; i < 5; i += 1) {
    const t = 0.16 + (i / 4) * 0.68;
    const up = i % 2 === 0;
    const wall = wallAt(t);
    const reach = wall * 1.34;
    /* `bentRod` builds along local +y, and the organelle's long axis is +x, so a
       shelf hangs across the tube with NO quarter-turn — the first attempt put
       one in and laid every crista flat along the axis, which draws a stack of
       rods parallel to the membrane instead of folds of it. Only a small lean. */
    const crista = bentRod(detail, R * 0.052, reach, {
      bow: [(up ? 1 : -1) * R * 0.05, 0],
      radial: 8,
      seed: i * 3.7,
    });
    /* AND THEY ARE NOT ALL ON ONE PLANE. Measured, the first comb put all five
       at z ±0.0037 inside a shell 0.072 deep: a flat card standing in a round
       tube, which holds up exactly until the camera moves off axis. Each fold
       now sits at its own depth and turns a little out of the picture plane, so
       the comb has a thickness to it from any angle the viewer can reach. */
    const from = up ? wall * 0.95 : -wall * 0.95;
    crista.position.set((t - 0.5) * 2 * half, from - (up ? 1 : -1) * reach * 0.5, Math.cos(i * 2.1) * wall * 0.34);
    crista.rotation.z = (up ? 1 : -1) * 0.3;
    crista.rotation.y = Math.sin(i * 1.9) * 0.5;
    group.add(crista);
  }
  return group;
}

/*
 * ONE, THEN A GHOST, THEN TWO — owner §8 asked for 1 → 2 → 3; pass 4 §7 revised
 * it: *"activation에서 1 → 2 ghost → 2 solid 정도의 reproduction visual."* Two
 * copies of the organelle above: the second grows in translucent as the
 * outcome's own progress passes 0.15–0.5 and sets solid over 0.55–0.95
 * (`drive(p)`). The archive moves mitochondrial biogenesis 0.357 → 0.387 over the
 * run — a number no shape can show raw — so what drives this is the series'
 * rise over its own run, 0 at the first sample and 1 at the last
 * (`signallingBinding.heroProgress`), and the count says "being built" and
 * never "how many".
 */
function mitochondrionForm(material, detail) {
  /* ONE, THEN A GHOST, THEN TWO — PASS 4 §7: *"activation에서 1 → 2 ghost → 2
     solid 정도의 reproduction visual."* The second copy has its own pair of
     materials (transparent) so it can arrive as a ghost and set; `drive` copies
     the body's live colour into them each frame, so the ghost is the same
     workout's colour as the one it is budding from. */
  const group = new THREE.Group();
  const R = FORM_R;
  const BASE = 0.78;
  const ghostBody = material.clone();
  const ghostDetail = detail.clone();
  for (const m of [ghostBody, ghostDetail]) {
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
  }
  const first = oneMitochondrion(material, detail);
  first.position.set(-R * 0.3, -R * 0.04, 0);
  first.rotation.set(0, 0, 0.16);
  first.scale.setScalar(BASE);
  first.userData.part = "mitochondrion";
  const ghost = oneMitochondrion(ghostBody, ghostDetail);
  ghost.position.set(R * 0.5, R * 0.3, -R * 0.14);
  ghost.rotation.set(0.15, 0.25, -0.45);
  ghost.userData.part = "mitochondrion";
  group.add(first, ghost);
  const step = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
  group.userData.drive = (p) => {
    const k = Math.min(1, Math.max(0, p));
    const grown = step(k, 0.15, 0.5);
    const set = step(k, 0.55, 0.95);
    const s = BASE * grown;
    ghost.scale.setScalar(Math.max(1e-4, s));
    ghost.visible = s > 0.02;
    const opacity = grown * 0.45 + set * 0.55;
    ghostBody.color.copy(material.color);
    ghostDetail.color.copy(detail.color);
    if (material.emissive && ghostBody.emissive) ghostBody.emissive.copy(material.emissive);
    ghostBody.opacity = opacity;
    ghostDetail.opacity = opacity;
    ghostBody.depthWrite = set >= 1;
    ghostDetail.depthWrite = set >= 1;
  };
  group.userData.drive(0);
  return group;
}

/**
 * How many transmembrane helices a drawn receptor gets.
 *
 * TWO ENTRIES, BOTH TEXTBOOK, AND ANY OTHER RECEPTOR FALLS TO A PLAIN BUNDLE
 * rather than being guessed at. `B_AR` is a G-protein-coupled receptor and every
 * GPCR is seven-pass; `integrin` is an alpha-beta heterodimer and crosses as two
 * legs. Both are the first thing said about either molecule. A receptor this
 * table does not know is drawn with four — enough to read as a bundle in a
 * membrane, and not a number about anything.
 */
const HELICES = Object.freeze({ B_AR: 7, integrin: 2 });

/**
 * Build one of the twelve.
 *
 * @param node   `{ id }` from `HERO_NODES`
 * @param type   the archive's own `type` for that id
 * @param mats   `{ body, detail }` — one material each, so the scene can tint a
 *               whole form by setting one colour
 */
export function buildForm(node, type, mats) {
  const { body, detail } = mats;
  switch (node.id) {
    case "AMPK":
      return trimerForm(body);

    case "RhoA":
      return gtpaseForm(body, detail);
    case "Protein_Synthesis":
      return ribosomeForm(body, detail);
    case "Cell_Growth":
      return growthForm(body, detail);
    case "Mitochondrial_Biogenesis":
      return mitochondrionForm(body, detail);
    default:
      break;
  }
  switch (type) {
    case "input":
      return chevronForm(body);
    case "receptor":
      return receptorForm(body, HELICES[node.id] ?? 4);
    case "second messenger":
      return radicalForm(body);
    case "transcription factor":
      return factorForm(body, detail);
    case "gene":
      return geneForm(body, detail);
    case "protein":
      return kinaseForm(body);
    /* A PHENOTYPE THIS FILE HAS NO OBJECT FOR still gets a form rather than a
       ball: an outcome is a change in the cell, and the fibre bundle is the
       least specific true thing to say about one. Only reachable if the twelve
       change without this file following. */
    case "phenotype":
      return growthForm(body, detail);
    default:
      return kinaseForm(body);
  }
}
