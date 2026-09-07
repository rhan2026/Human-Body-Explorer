/**
 * The muscle fiber, built as geometry rather than loaded as an asset.
 *
 * Three nested levels — fascicle, fiber, sarcomere — each a plain THREE.Group
 * with an `update(state, time)` that takes the object out of fiberSimulation.js
 * and moves the geometry. Nothing in here reads React state or a clock.
 *
 * Built procedurally, not from models/muscle-fiber.glb, for one reason: that
 * asset carries a baked 60-frame animation, so it can show a contraction but it
 * cannot show *this* contraction at the calcium level the simulation computes.
 * The `role` tags below deliberately match the extras already in that GLB
 * (calcium-ion, myofibril, z-disc, muscle-fiber, fascicle-boundary) so a later
 * merge does not have to reconcile two vocabularies.
 *
 * SCALE. The three levels are drawn at comparable on-screen sizes and are NOT a
 * single continuous zoom — a fascicle is roughly 100x a sarcomere, and drawing
 * them in one space would put the sarcomere below a pixel. Each level reports
 * its real extent in micrometres so the jump is stated rather than implied.
 */

import * as THREE from "three";
import {
  PALETTE,
  OPACITY,
  SURFACE,
  anatomyMaterial,
  sheathMaterial,
  calciumMaterial,
  activationEmissive,
} from "../anatomyStyle.js";
import { bands, FILAMENT } from "./fiberSimulation.js";

/* ---- shared helpers ------------------------------------------------------ */

/**
 * A hexagonal ring of positions in the YZ plane, plus the centre. The filament
 * lattice, the myofibril packing and the fiber packing are all this same
 * arrangement at different radii, because in the tissue they genuinely are.
 */
function hexPack(radius, rings = 1) {
  const out = [[0, 0]];
  for (let r = 1; r <= rings; r++) {
    for (let i = 0; i < 6 * r; i++) {
      const a = (i / (6 * r)) * Math.PI * 2;
      out.push([Math.cos(a) * radius * r, Math.sin(a) * radius * r]);
    }
  }
  return out;
}

/**
 * Where thin filaments sit: the centroids of the triangles between thick
 * filaments, so every thin filament has three thick neighbours and the central
 * thick filament has six thin ones. That ratio is the lattice.
 */
function trigonalSites(ringPoints) {
  const sites = [];
  for (let i = 0; i < ringPoints.length; i++) {
    const a = ringPoints[i];
    const b = ringPoints[(i + 1) % ringPoints.length];
    // Inner triangle: centre, a, b.
    sites.push([(a[0] + b[0]) / 3, (a[1] + b[1]) / 3]);
    // Outer triangle: a, b, and the lattice point beyond them.
    sites.push([(a[0] + b[0]) * 0.667, (a[1] + b[1]) * 0.667]);
  }
  return sites;
}

/** Long axis is +X throughout: a fiber reads better lying down than standing up. */
function cylinder(radiusTop, radiusBottom, length, radial = 16) {
  const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radial, 1, false);
  g.rotateZ(Math.PI / 2);
  return g;
}

/**
 * A rod that is not a perfect extruded cylinder.
 *
 * `radiusAt(u, phi)` is the surface radius at u — 0 at the -X end, 1 at the +X
 * end — and azimuth phi. `bowAt(u)` is how far the axis has drifted off
 * straight there, as [y, z]. Give it neither and it is `cylinder()` with more
 * segments than it needs.
 *
 * This is the whole finding of the render study in one function. Three takes
 * attacked materials, depth and motion, and all three failed against the same
 * wall: a perfect cylinder is still a perfect cylinder under any shading, and a
 * scene made of them reads as a diagram. Nothing below is a material.
 *
 * Vertices are moved on the CPU rather than in a vertex shader, deliberately.
 * The silhouette is the point, and the silhouette is what the tests measure —
 * a shader would give the same picture and nothing to measure it with.
 *
 * THAT ALSO MAKES EVERY FORM MEASUREMENT IN THIS FILE RENDERER-INDEPENDENT, and
 * it is written down because it was free and free properties are the ones the
 * next person deletes. The fascicle's hexatic order, its ring count, the
 * per-slice radius spread, the cell scale's four-fold order: all of them are
 * read off vertex positions and instance matrices in Node, with no context and
 * no rasteriser. The browser gates cannot say that — `playwright.config.js`
 * forces SwiftShader onto a machine that has a Metal GPU, so the moment those
 * flags change, every absolute pixel number in this project is re-baselined.
 * Two of this file's own quoted figures are on the wrong side of that line: the
 * SHAPE study's 14/9 striation counts and MEDIUM's 25.2% contrast cut are
 * inherited pixel measurements taken under SwiftShader.
 *
 * The rule that sorts them, and it is worth applying before adding a test: a
 * quantity that is a DIFFERENCE between two frames of one scene crosses a
 * rasteriser change; an absolute level does not. Measured both ways — the cell
 * scale's held frames read a 0.0000 luminance step on SwiftShader at 8.8 fps and
 * on Metal at 59.5.
 *
 * ORIENTATION. CylinderGeometry is built along local +Y, so u is read off local
 * y, and the whole thing is turned onto +X at the end with rotateZ(-PI/2),
 * which maps local (x, y, z) to world (y, -x, z). Two consequences used below:
 * u maps to world x monotonically (world x = (u - 0.5) * length), and a bow in
 * world +y has to be written into local -x.
 */
export function rod(length, radiusAt, bowAt = null, radial = 16, segments = 32) {
  const g = new THREE.CylinderGeometry(1, 1, length, radial, segments, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = Math.min(1, Math.max(0, pos.getY(i) / length + 0.5));
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = radiusAt(u, Math.atan2(z, x));
    const [dy, dz] = bowAt ? bowAt(u) : ZERO_BOW;
    pos.setX(i, x * r - dy);
    pos.setZ(i, z * r + dz);
  }
  g.computeVertexNormals();
  g.rotateZ(-Math.PI / 2);
  return g;
}

const ZERO_BOW = [0, 0];

/** Where a bowed axis is pointing at u, as a unit tangent. Bands sit square to it. */
function tangentAt(bowAt, u, length, out) {
  const h = 1 / 256;
  const a = bowAt(Math.max(0, u - h));
  const b = bowAt(Math.min(1, u + h));
  const dx = (Math.min(1, u + h) - Math.max(0, u - h)) * length;
  return out.set(1, (b[0] - a[0]) / dx, (b[1] - a[1]) / dx).normalize();
}

/** Deterministic jitter. Math.random would make every reload a different fiber. */
export function noise(i, salt = 0) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Push any two marks that landed on top of each other apart, and no others.
 *
 * Lives here rather than beside either caller because both scales below the body
 * need it for the same reason and it arrived as a copy in each: scattering marks
 * off a lattice is what stops a scene reading as a diagram, and the scatter is
 * also what buries a countable quantity when two marks merge. Only pairs closer
 * than `minGap` move, so the variety in the spacing — the whole point — survives
 * everywhere it was not an overlap.
 *
 * A floor AT the touching distance is a floor every pair ends up sitting on:
 * measured on the cell scale, 0.115 against a bead diameter of 0.100 collapsed
 * the spacing spread from 0.338 back to 0.115, which is a crystal again with the
 * corners rounded off. Set it below what touching costs, not at it.
 */
export function relax(points, minGap, clamp, passes) {
  const p = points.map(([x, y]) => [x, y]);
  for (let n = 0; n < passes; n++) {
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const dx = p[j][0] - p[i][0];
        const dy = p[j][1] - p[i][1];
        const r = Math.hypot(dx, dy) || 1e-9;
        if (r >= minGap) continue;
        const push = ((minGap - r) / 2 / r) * 0.5;
        p[i][0] -= dx * push;
        p[i][1] -= dy * push;
        p[j][0] += dx * push;
        p[j][1] += dy * push;
      }
    }
    p.forEach(clamp);
  }
  return p.map((q) => Object.freeze(q));
}

function tag(object, role, label) {
  object.userData.role = role;
  if (label) object.userData.fiberLabel = label;
  return object;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
/* The two ends of the store, as colours. An empty cisterna is the membrane it
   has always been; a full one is the calcium it is holding. */
const SR_EMPTY = new THREE.Color(PALETTE.reticulum);
const SR_FULL = new THREE.Color(PALETTE.calcium);
const _up = new THREE.Vector3(0, 1, 0);
const _axisX = new THREE.Vector3(1, 0, 0);
const _radial = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _tilt = new THREE.Quaternion();
const _colour = new THREE.Color();
const PEAK = new THREE.Color(PALETTE.tissuePeak);
/* The quiet end of the T-tubule's ramp, and it is the membrane's own colour
   rather than tissueRest: between bursts this is a piece of sarcolemma, not an
   indicator lamp sitting at zero. */
const SARCOLEMMA = new THREE.Color(PALETTE.sarcolemma);
const CALCIUM = new THREE.Color(PALETTE.calcium);

/**
 * How much tissue each level actually shows. Declared here rather than inside
 * the builders because the readout panel lives outside the Canvas and needs it
 * without building the geometry to ask.
 */
/**
 * How many sarcomeres the sarcomere level draws, end to end.
 *
 * TWO, NOT THREE, AS OF 2026-08-31 — canon D1, and the reason is measured
 * rather than aesthetic. Three sarcomeres make the subject 6.9 by 1.5 world
 * units, 4.6:1. A 1280x900 window is 1.42:1, so `fitCamera` is bound by the
 * WIDTH and the object lands 190 px tall in a 900 px viewport: screenshotted,
 * a thin strip with two thirds of the frame empty above and below it, which is
 * a large part of what "3D가 시각적으로 clear하지 않다" is looking at. Two
 * sarcomeres are 3.1:1 and every part in the picture is half again as big.
 *
 * IT IS A DRAWING CHOICE AND IT IS SAID TO BE ONE. `EXTENT.sarcomere` below is
 * computed from this constant, so the µm figure follows the count instead of
 * being typed beside it; the hexagonal lattice is NOT touched — 7 thick and 12
 * thin filaments is the real packing, and thinning it to fit a window would be
 * drawing a muscle that does not exist. What repeats is the repeating unit, so
 * cutting one repeat costs a viewer nothing: two sarcomeres still show a Z-disc
 * shared between them, which is the whole of what the third one was saying.
 */
const SARC_COUNT = 2;

export const EXTENT = {
  fascicle: "≈600 µm of a fascicle 250 µm across",
  fiber: "≈250 µm of a fiber 60 µm across — 7 of its several hundred myofibrils",
  /* COUNTED, NOT SPELLED. Q14 R10, 2026-08-27: this read "three sarcomeres"
     while `SARC_COUNT` — three lines up now, and two hundred lines down before —
     is what the builder actually draws. CLAUDE.md §9 again: a count a viewer can
     see drawn is never also typed. The two agreed; nothing kept them agreeing.
     The µm figure follows from the same constant times the resting sarcomere,
     which is why it is written as the product rather than as 6.6. That length
     is `FILAMENT.restLength`, NOT a second 2.2 written here — the first version
     of this fix declared its own constant and would have put one fact in two
     files, which is the defect nine rounds of this hundred have been removing.
     `fiber`'s "7 of its several hundred myofibrils" is the same shape and is NOT
     fixed here: that count lives inside the builder as `sites.length`, not as a
     module constant, so making it honest is a refactor rather than a template.
     Named so the next person does not read this line as a decision. */
  sarcomere: `${(SARC_COUNT * FILAMENT.restLength).toFixed(1)} µm — ${SARC_COUNT} sarcomeres of one myofibril`,
  /* THE COUNT ITSELF, for the one other file that spells it in a sentence.
     `FiberMetrics.jsx` had `"three sarcomeres"` typed into a `why` string and
     it went stale the moment this constant moved — the exact defect the note
     above records being fixed here once already, reappearing one file over.
     Exported rather than re-derived so there is one place to change. */
  sarcomereCount: SARC_COUNT,
};

function setInstance(mesh, i, x, y, z, sx = 1, sy = sx, sz = sx, quat = null) {
  _p.set(x, y, z);
  _s.set(sx, sy, sz);
  _m.compose(_p, quat ?? _q.identity(), _s);
  mesh.setMatrixAt(i, _m);
}

/* ---- level 1: sarcomere -------------------------------------------------- */

/**
 * Three sarcomeres of one myofibril, with the filament lattice exposed.
 *
 * Filament DIAMETERS are exaggerated about sevenfold. A thick filament is ~15 nm
 * across in a 2200 nm sarcomere; drawn true to scale it is a seventh of a pixel.
 * Filament LENGTHS and the spacing between them are true, because those are what
 * the sliding-filament claim rests on: the A-band never changes length, and the
 * I-band and H-zone close as the Z-discs come together.
 */
const THICK_R = 0.05;
const THIN_R = 0.032;
/**
 * How far each terminal cisterna sits from the T-tubule it flanks.
 *
 * IT WAS 0.058, AND THE THREE MEMBRANES WERE INSIDE EACH OTHER. The cisterna's
 * tube radius is 0.05 and the tubule's is 0.028, so they touch at 0.078 and
 * the offset was 0.058 — twenty nanometres of interpenetration, which is 5.7
 * screen pixels at the closest beat. The object the pass points at when it
 * says "the command arrives down here" was therefore not drawn as a tube at
 * all: it rendered as a stripe painted on the cisterna beside it.
 *
 * 0.09 leaves about 3.4 px of paper between the membranes at that distance,
 * which is the least that reads as three rings rather than one. This is not a
 * figure imported from a paper and it is not claimed as one — it is the
 * smallest number at which the drawing stops contradicting itself. That it
 * lands near the real junctional gap is luck, not evidence.
 */
export const TRIAD_GAP = 0.09;

const LATTICE = 0.24;
const BRIDGES_PER_FILAMENT = 8;
/* Tropomyosin spans seven actin monomers and carries one troponin complex, so
   seven nodes per thin filament is the real ratio rather than a chosen number.
   A 1 um filament actually holds ~26 of them; seven is what stays legible. */
const TROPONIN_PER_FILAMENT = 7;
/* How far tropomyosin rolls around the thin filament when calcium binds. The
   azimuthal shift from the blocked to the open state is about 30 degrees. */
const TROPOMYOSIN_SHIFT = 0.55;
const CA_COUNT = 72;

/**
 * The bare zone. At the centre of a thick filament the myosin tails from its
 * two halves pack tail-to-tail, no heads emerge, and it is the fattest part of
 * the filament — about 0.15-0.2 µm of the 1.6 µm. Drawing that swelling is free
 * and it lands exactly on the M-line, so the middle of the A-band stops being a
 * featureless length of pipe and starts saying where the filament's centre is.
 *
 * LENGTH IS UNTOUCHED. The A-band claim is a claim about length, and radius is
 * a different axis. The swelling is also kept off the tips on purpose: the tips
 * are the overlap zone, where the eye has to tell a thick filament from the
 * thin one sliding past it, and that is the one place this scene cannot afford
 * to blur.
 */
const BARE_ZONE_SWELL = 0.34;
const BARE_ZONE_HALF = 0.06;
const bareZone = (u) => 1 + BARE_ZONE_SWELL * Math.exp(-(((u - 0.5) / BARE_ZONE_HALF) ** 2));

/**
 * The myofibril's axis, which is not the X axis.
 *
 * A myofibril in a micrograph wanders. Every filament, disc, cisterna and ion
 * in the level below rides this curve instead of a ruled line, and the shape of
 * it is nothing clever — two slow sines with different periods, so the run
 * never repeats over the 6.6 µm on screen.
 *
 * The filaments themselves stay STRAIGHT. A thick filament is a rigid rod; what
 * bends is the register between one sarcomere and the next, at the Z-disc,
 * which is where it bends in tissue. So each piece is translated onto the curve
 * and turned to the local tangent, and every rigid length in the scene — the
 * A-band above all — is exactly what it was.
 */
const AXIS = {
  y: (x) => 0.055 * Math.sin(x * 0.62 + 0.7),
  z: (x) => 0.024 * Math.sin(x * 0.44 - 1.3),
  dy: (x) => 0.055 * 0.62 * Math.cos(x * 0.62 + 0.7),
  dz: (x) => 0.024 * 0.44 * Math.cos(x * 0.44 - 1.3),
};

const _bow = new THREE.Quaternion();
const _spin = new THREE.Quaternion();
const _off = new THREE.Vector3();

/**
 * setInstance, but onto the bowed axis: (x, y, z) is read as "x along the
 * myofibril, (y, z) across it", and the cross-section is carried square to the
 * axis so the filament lattice tilts as a unit instead of shearing.
 *
 * `along` is what an anchored piece needs, and it is not a convenience. A rigid
 * rod placed by its MIDPOINT on a curve has both its ends off the curve, and
 * for a thin filament one of those ends is the weld to its Z-disc — the weld
 * that makes "the Z-disc moving IS the sliding" true. So anything welded is
 * framed at its anchor and extended `along` the tangent from there, and its
 * anchored end lands exactly in the disc it belongs to. `GUARD thin filaments
 * stay welded to their Z-disc` failed at 2.8e-3 before this argument existed.
 */
function onAxis(mesh, i, x, y, z, sx = 1, sy = sx, sz = sx, quat = null, along = 0) {
  _tangent.set(1, AXIS.dy(x), AXIS.dz(x)).normalize();
  _bow.setFromUnitVectors(_axisX, _tangent);
  _off.set(along, y, z).applyQuaternion(_bow);
  setInstance(
    mesh,
    i,
    x + _off.x,
    AXIS.y(x) + _off.y,
    AXIS.z(x) + _off.z,
    sx,
    sy,
    sz,
    quat ? _spin.copy(_bow).multiply(quat) : _bow,
  );
}


/**
 * THE SUBJECT KEEPS ITS COLOUR, EVERYTHING ELSE GOES TO PAPER — 2026-09-07, owner,
 * FIBER pass 10: *"actin이라고 하는데 아직도 어디가 actin인지 모르겠어 … actin 및 각
 * 파트만 컬러를 주고 나머지는 다 그냥 죽이라고 … 모든거 다 그래"*.
 * `baseColor` is captured at build, before any `update` has painted a frame, so
 * a mesh whose colour `update` drives (the SR under calcium) is never frozen at a
 * transient. Applied AFTER `update` each frame while a subject is named — see
 * `FiberScene` — and restored once when it goes.
 */
const PAPER = new THREE.Color("#f4efe8");
const SPOT_DIM = 0.85;
function rememberBaseColours(group) {
  group.traverse((o) => {
    if (o.material?.color && o.userData?.role && !o.userData.baseColor) o.userData.baseColor = o.material.color.clone();
    if (o.material && o.userData?.role && o.userData.baseOpacity === undefined) o.userData.baseOpacity = o.material.opacity;
  });
}
function spotlightOn(group) {
  return function spotlight(roles) {
    group.traverse((o) => {
      const base = o.userData?.baseColor;
      if (!base) return;
      const lit = !!roles && roles.has(o.userData.role);
      /* `litOpacity` (the sarcolemma): brighter while it is the subject, its own opacity otherwise. */
      if (o.userData.litOpacity !== undefined) o.material.opacity = lit ? o.userData.litOpacity : o.userData.baseOpacity;
      if (!roles) { o.material.color.copy(base); return; }
      if (lit) return;
      o.material.color.copy(base).lerp(PAPER, SPOT_DIM);
    });
  };
}

export function buildSarcomereLevel() {
  const group = new THREE.Group();
  group.name = "SarcomereLevel";

  const thickSites = hexPack(LATTICE, 1); // 7 thick filaments
  const thinSites = trigonalSites(thickSites.slice(1)); // 12 thin filaments
  const myofibrilR = LATTICE * 1.85;

  /* Z-discs: the anchors. One more than there are sarcomeres. */
  const zDiscMat = anatomyMaterial({ colour: PALETTE.zDisc, roughness: SURFACE.roughnessStatic });
  const zDiscs = new THREE.InstancedMesh(
    cylinder(myofibrilR, myofibrilR, FILAMENT.zDisc, 24),
    zDiscMat,
    SARC_COUNT + 1,
  );
  tag(zDiscs, "z-disc", "Z-disc");
  group.add(zDiscs);

  /* M-lines: the cross-links holding the thick filaments in register at the
     centre. Drawn only as wide as the thick bundle and kept translucent — at
     full opacity a disc this size becomes a wall across the sarcomere and hides
     the H-zone, which is the thing either side of it worth looking at. */
  const mLines = new THREE.InstancedMesh(
    cylinder(LATTICE * 1.08, LATTICE * 1.08, 0.022, 20),
    anatomyMaterial({ colour: PALETTE.mLine, opacity: 0.4, roughness: SURFACE.roughnessStatic }),
    SARC_COUNT,
  );
  tag(mLines, "m-line", "M-line");
  group.add(mLines);

  /* Thick filaments (myosin). Fixed length — this is the A-band. */
  const thickCount = SARC_COUNT * thickSites.length;
  const thick = new THREE.InstancedMesh(
    rod(FILAMENT.thick, (u) => THICK_R * bareZone(u), null, 12, 40),
    anatomyMaterial({ colour: PALETTE.myosin }),
    thickCount,
  );
  tag(thick, "myosin", "Myosin · thick filament");
  group.add(thick);

  /* Thin filaments (actin). Anchored at a Z-disc, sliding past the thick. */
  const thin = new THREE.InstancedMesh(
    cylinder(THIN_R, THIN_R, FILAMENT.thin, 8),
    anatomyMaterial({ colour: PALETTE.actin }),
    SARC_COUNT * thinSites.length * 2,
  );
  tag(thin, "actin", "Actin · thin filament");
  group.add(thin);

  /* Which way each thin filament has to be blocked.
     
     Tropomyosin lies in the actin groove over the myosin binding sites, so
     "blocked" means facing the thick filament it would otherwise bind. Each thin
     filament sits between three thick ones; the nearest is the one that matters,
     and taking the azimuth from the geometry rather than picking one keeps the
     shift pointing somewhere real. */
  const thinAzimuth = thinSites.map(([y, z]) => {
    let best = null;
    let bestD = Infinity;
    for (const [ty, tz] of thickSites) {
      const d = (ty - y) ** 2 + (tz - z) ** 2;
      if (d < bestD) { bestD = d; best = [ty - y, tz - z]; }
    }
    return Math.atan2(best[1], best[0]);
  });

  /* THE MIRROR OF THE ABOVE, AND THE CROSS-BRIDGES NEEDED IT ALL ALONG. Their
     comment says "point the head radially outward toward its nearest thin
     filament" and the code said `Math.atan2(z, y)` — the direction from the
     myofibril's AXIS to the thick site, which is outward from the centre and not
     toward anything. Worst at the middle: `thickSites[0]` is [0, 0], so
     `atan2(0, 0)` is 0 and all eight of that filament's heads pointed the same
     way, jittered plus or minus twenty-six degrees, into empty lattice.
     Each thick filament is surrounded by six thin ones in this packing, so a
     single nearest azimuth would still aim every head one way. This keeps the
     neighbours in order of distance and hands each head the next one, which is
     the arrangement the lattice actually has — and it is taken from the geometry
     for the same reason the paragraph above takes its own: a picked direction
     points somewhere that is not there. */
  const NEIGHBOURS = 6;
  const thickAzimuth = thickSites.map(([ty, tz]) => {
    const near = thinSites
      .map(([y, z]) => ({ a: Math.atan2(z - tz, y - ty), d: (y - ty) ** 2 + (z - tz) ** 2 }))
      .sort((p, q) => p.d - q.d)
      .slice(0, NEIGHBOURS)
      .map((n) => n.a);
    return near.length ? near : [0];
  });

  /* Tropomyosin: the switch.
     
     This is the piece that makes calcium mean anything. Without it the scene
     shows calcium arriving and cross-bridges attaching with nothing in between,
     and the mechanism is left to the caption. Here the strand sits over the
     binding sites at rest and rolls off them as calcium binds troponin, and the
     cross-bridges attach in the same proportion — so the chain is visible:
     calcium -> troponin -> tropomyosin -> cross-bridge. */
  const THIN_COUNT = SARC_COUNT * thinSites.length * 2;
  const tropomyosin = new THREE.InstancedMesh(
    cylinder(0.015, 0.015, FILAMENT.thin, 6),
    anatomyMaterial({ colour: PALETTE.tropomyosin }),
    THIN_COUNT,
  );
  tag(tropomyosin, "tropomyosin", "Tropomyosin");
  group.add(tropomyosin);

  /* Troponin, riding the tropomyosin strand. Its colour is the readout: it
     lerps toward the calcium blue as calcium binds troponin C. */
  const troponinMat = anatomyMaterial({ colour: PALETTE.troponin });
  const troponin = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.019, 8, 6),
    troponinMat,
    THIN_COUNT * TROPONIN_PER_FILAMENT,
  );
  tag(troponin, "troponin", "Troponin");
  group.add(troponin);

  /* Titin, the third filament. Z-disc to the tip of the thick filament, one per
     thick filament per half-sarcomere. Its I-band segment is elastic and is what
     carries passive tension, so it is the one element here whose LENGTH changes
     with the sarcomere rather than its position. */
  const titin = new THREE.InstancedMesh(
    cylinder(0.011, 0.011, 1, 6),
    anatomyMaterial({ colour: PALETTE.titin }),
    SARC_COUNT * thickSites.length * 2,
  );
  tag(titin, "titin", "Titin");
  group.add(titin);

  /* Cross-bridges: myosin heads, only where a thin filament lies alongside. */
  const bridgeGeo = new THREE.CylinderGeometry(0.009, 0.014, 0.055, 6);
  bridgeGeo.translate(0, 0.0275, 0); // pivot at the base, so it hinges off the filament
  const bridges = new THREE.InstancedMesh(
    bridgeGeo,
    anatomyMaterial({ colour: PALETTE.crossBridge }),
    thickCount * BRIDGES_PER_FILAMENT,
  );
  tag(bridges, "cross-bridge", "Cross-bridge");
  group.add(bridges);

  /* The triad: two terminal cisternae of sarcoplasmic reticulum flanking a
     T-tubule.

     POSITION IS THE POINT. In MAMMALIAN skeletal muscle there are TWO triads per
     sarcomere and they sit at the A-I junctions — the edges of the A-band — not
     at the Z-disc. One triad per sarcomere at the Z-line is the AMPHIBIAN
     arrangement. This model is human, so it is A-I junctions, and because the
     junction is a fixed distance from the M-line the triads migrate toward the
     Z-disc as the sarcomere shortens and the I-band closes. That falls out of
     the geometry rather than being animated.

     It also matters mechanically: the T-tubule is an invagination of the
     sarcolemma carrying the action potential inward, and the cisternae either
     side of it are what release the calcium. Putting them in the wrong place
     puts the whole excitation-contraction story in the wrong place. */
  const TRIADS = SARC_COUNT * 2;

  /* (16, 48) RATHER THAN (8, 26), AND THE CAMERA IS WHY. The guided pass spends
     five of its eight beats inside 3.3 world units of these two rings, and at
     that distance 26 tubular segments is a 26-gon with 36 px edges and 8 radial
     segments is a hard shading step every 11 px across a 29 px tube. Measured
     from the closest beat: 287 px per micron.
     +20,160 triangles across the twelve cisternae and six tubules, which is
     +22.8% of this level — and no new draw call, because they stay one
     InstancedMesh each. Paid for twice over by the troponin beads below, which
     spend 45.7% of this scene's triangles on shapes that are never wider than
     eleven pixels. */
  const srGeo = new THREE.TorusGeometry(myofibrilR * 1.16, 0.036, 16, 48);
  srGeo.rotateY(Math.PI / 2);
  /* THE CISTERNA CARRIES THE STORE, in the two channels the calcium beads below
     already use for concentration — the accent colour, and how hard it glows.

     The channels are shared ON PURPOSE and not for tidiness. What leaves this
     torus is what those beads carry inward, so it is one substance drawn twice
     in one frame, and a viewer who has learnt that cool-and-bright means calcium
     in the cytosol reads it the same way inside the store without being told.
     The membrane keeps its own colour at the empty end, because the cisterna is
     still there when the calcium is not.

     NOT OPACITY, WHICH IS CONSTANT WHATEVER THE STORE IS DOING. Opacity is how
     this project draws uncertainty, and 167.9 µM is not an uncertain number.
     That rule is about opacity VARYING, and this constant is the membrane's own
     material — so raising it says nothing about certainty and everything about
     whether the signal already on it can be seen.

     0.32 -> 0.85, AND THE MEASUREMENT IS THE ARGUMENT. A design review muted the
     guided pass's sentences and read the frames cold. What it found was a
     channel-strength inversion: the thing that must NOT change in this story —
     the T-tubule, the command — is an opaque ring that goes from nothing to
     12,340 saturated orange pixels when it fires, while the thing that MUST
     change, this cisterna, was a colour tint behind 32% glass. One release is a
     37% swing of `storeFraction` and it arrived on screen as about 11 RGB; the
     ten-repetition decline this scale exists to show arrived as 1.5 to 3, which
     is browser dithering. The unchanging half of the argument was drawn roughly
     seventy times louder than the changing half, so muted, the picture says
     "it fires ten times, just as hard" and stops.
     Nothing is added here — not a number, not a label, not a channel. The store
     is already bound to colour and emissive. It was being attenuated to a third
     of itself on the way to the eye. */
  const srMat = anatomyMaterial({
    colour: PALETTE.reticulum,
    opacity: 0.72,
    roughness: SURFACE.roughnessMembrane,
    side: THREE.DoubleSide,
  });
  const sr = new THREE.InstancedMesh(srGeo, srMat, TRIADS * 2);

  /* ── WHAT IS IN THE STORE, AS A SIZE ──────────────────────────────────────
     `fiber.md` §3: *"실제 reservoir 느낌. 단순히 색만 바꾸지 말고: 내부 blue
     density / fill band / particles / local glow 중 하나를 같이 써. 그러면
     사용자가 '저게 calcium store구나'를 설명 없이도 알아."*

     The cisterna has had exactly one channel and this file measured what it is
     worth: `storeFraction` drives albedo alone, over a 97-unit span from
     `reticulum` to `calcium`, and a 12.9% swing arrives as dE 6.2 at the
     default framing — about half of it eaten by the lighting. The note there
     ends by saying widening it "means changing what `reticulum` and `calcium`
     MEAN, which is a bigger decision than this comment". This is the other way
     out: leave both meanings alone and add a second channel.

     A CORE INSIDE THE RING, not a fill band — the cisterna is a torus and a
     torus has no inside to fill. A second torus on the same circle, drawn in
     `PALETTE.calcium` and given a TUBE RADIUS that scales with how full the
     store is, is the same idea in the shape this object actually has: full and
     the ring is fat with blue, empty and there is nothing in it but membrane.
     It is a size, so the lighting cannot eat it the way it eats a hue. */
  const srCoreGeo = new THREE.TorusGeometry(myofibrilR * 1.16, 0.030, 12, 40);
  const srCoreMat = anatomyMaterial({
    colour: PALETTE.calcium,
    opacity: 0.85,
    roughness: 0.4,
  });
  const srCore = new THREE.InstancedMesh(srCoreGeo, srCoreMat, TRIADS * 2);
  /* No `tag`: it is the store's own contents, not a second part beside it. */
  srCore.raycast = () => {};
  group.add(srCore);
  tag(sr, "sarcoplasmic-reticulum", "Terminal cisterna");
  group.add(sr);

  /* T-tubule. Sarcolemma-coloured because that is what it is — the surface
     membrane folded inward, not a separate organelle.

     AND IT IS WHERE THE STIMULUS ARRIVES, which is the one event on this scale
     that was drawn nowhere. Everything else here is an EFFECT: the cisternae
     emptying, the beads leaving the triads, the force falling. The cause is a
     0.1625 s burst every 0.65 s, ten times, and it shipped inside `protocol`
     with nothing reading it — so the screen showed a fibre that fatigued for no
     visible reason.

     IN THE BODY SCALE'S OWN ACTIVATION RAMP, tissueRest -> tissuePeak, via
     `activationColour` and `activationEmissive`. One scale up that ramp already
     means "this tissue is being driven right now"; the membrane that carries
     the drive inward is the same sentence one scale down, so there is no new
     colour for a reader to learn. It is lerped from the tubule's own sarcolemma
     rather than from tissueRest, because between bursts this is a membrane and
     not an indicator sitting at the bottom of a scale.

     NOT OPACITY — the note on the cisternae above applies here for the same
     reason: opacity is how this project draws uncertainty, and a stimulus that
     either arrived or did not is not an uncertain quantity. */
  const ttGeo = new THREE.TorusGeometry(myofibrilR * 1.16, 0.028, 16, 48);
  ttGeo.rotateY(Math.PI / 2);
  const ttMat = anatomyMaterial({
    colour: PALETTE.sarcolemma,
    opacity: 0.5,
    roughness: SURFACE.roughnessMembrane,
    /* FrontSide, not DoubleSide: at 0.5 this does not write depth, and a
       double-sided skin that does not write depth composites against its own
       far wall in triangle order — the tube came out tiled. There is nothing
       inside a T-tubule we are drawing, so the far wall was never carrying
       anything. Culling it costs half the fragments and returns a tube. */
    side: THREE.FrontSide,
    emissive: PALETTE.tissuePeak,
    emissiveIntensity: 0,
  });
  const tTubules = new THREE.InstancedMesh(ttGeo, ttMat, TRIADS);
  tag(tTubules, "t-tubule", "T-tubule");
  group.add(tTubules);

  /* Where the triads actually landed this frame — calcium is released here. */
  const triadX = new Float32Array(TRIADS);

  /* Calcium, released at the cisternae and travelling in to the thin filaments. */
  const caMat = calciumMaterial(0.55);
  const calcium = new THREE.InstancedMesh(new THREE.SphereGeometry(0.026, 10, 8), caMat, CA_COUNT);
  tag(calcium, "calcium-ion", "Calcium");
  group.add(calcium);

  /* PHOSPHATE — WHAT EVERY PULL LEAVES BEHIND, AND THE ONLY THING HERE THAT IS
     A QUANTITY RATHER THAN A PART.

     This is the mechanism under the floor's ending. Measured on `soce_on`:
     across the ten repetitions peak force falls 0.871 -> 0.324 (37% of the
     first) while peak myoplasmic calcium moves 27.145 -> 26.743 (98.5% of the
     first) and `Pi_myo_total` goes 1505 -> 6120, 4.07x. The command keeps
     arriving, the calcium keeps coming out, and the force still halves twice
     over. The authors attribute that to this, and until now the app said so in
     one sentence of narration over a series it was shipping and not drawing.

     WHY PARTICLES AND NOT A PART. Everything else at this scale is a structure
     with a handle you can press to be told what it is. Phosphate has no resting
     state to be told about — at t=0 there is barely any and by the end there is
     four times as much, and THAT is the whole content. A persistent ring around
     it would say "this is a component of a sarcomere", which is the wrong idea.
     So: no anchor, no handle, no plate. It arrives by accumulating.

     HOW IT ACCUMULATES. Each grain carries its own threshold from `noise`, and
     appears when the run's phosphate fraction passes it. So the count on screen
     rises with the series rather than every grain fading up together — waste
     collecting, which is what the data does, instead of a global opacity ramp,
     which is what a shader would have done. Thresholds are spread over 0.18..1
     because the run's own floor is already 20% of its ceiling at t=0: starting
     them at zero would draw a fifth of the field before the first repetition
     and lose the beginning of the story.

     SMALLER THAN CALCIUM AND IT DOES NOT GLOW. 0.017 against calcium's 0.026,
     no emissive, and `PALETTE.phosphate` is the dullest thing in the scene.
     Two small moving things in one space have to be told apart at a glance and
     only one of them is a signal. */
  /* ── ATP, ON ONE HEAD, AND THE BRIDGE TO THE NEXT FLOOR ──────────────────
     `fiber.md` §13, at the owner's word 2026-09-05. The floor closes on "Every
     one of those pulls spent ATP. Follow that energy", and until now the
     molecule that sentence is about was the one thing on this scale that was
     never drawn — the phosphate it leaves behind piles up 79 grains deep with
     no visible cause, and the floor below is entirely a question about a
     molecule the floor above only ever named.

     IT RIDES THE STROKE THAT IS ALREADY DRAWN. Every attached cross-bridge
     swings on `0.55 + 0.5·sin(time·9 + bi·1.7)`, and this molecule's whole
     cycle is that same term for one chosen head. No second clock, no rate, no
     count: a rate would be a number the archive does not publish, and this
     floor already refused to send an ATP figure across the seam for exactly
     that reason. What is claimed is a mechanism — one pull spends one — and
     that is a true sentence about muscle rather than a reading off this run.

     ONE HEAD, NOT A HUNDRED AND TWELVE. Drawing it on every attached bridge
     would be the physiology and would be noise: 112 molecules cycling at once
     is a texture, not a thing you can follow. One is an illustration and reads
     as one, which is why the beat that shows it is a close-up.

     THE THIRD BEAD IS THE PHOSPHATE FIELD'S OWN. Same colour, same radius as
     the 96 grains above, released outward into the band they occupy — so the
     first time a visitor sees where any of them came from is here. */
  const ATP_BEAD_R = 0.017;
  const atpMat = anatomyMaterial({ colour: PALETTE.atp, roughness: 0.42 });
  const atpBody = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), atpMat);
  atpBody.scale.set(1.35, 1, 0.8);
  const atpBeads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(ATP_BEAD_R, 8, 6),
    atpMat,
    2,
  );
  /* The one that leaves. Its own mesh and its own material, because the moment
     it is no longer part of the molecule it is no longer that colour. */
  const atpFreed = new THREE.Mesh(
    new THREE.SphereGeometry(ATP_BEAD_R, 8, 6),
    anatomyMaterial({ colour: PALETTE.phosphate, roughness: 0.58 }),
  );
  const atpGroup = new THREE.Group();
  atpGroup.add(atpBody, atpBeads, atpFreed);
  /* NO `tag`, for the reason the phosphate field has none: this is a quantity
     in motion, not a part with a resting state to be told about. */
  atpGroup.raycast = () => {};
  atpGroup.visible = false;
  group.add(atpGroup);

  /* WHICH HEAD, AND THE FIRST CHOICE PUT IT OFF SCREEN.
     The `myosin` anchor is at x = -1.1 on the filament at `thickSites[1]`, which
     is the LEFT sarcomere's centre — the geometry's own note says so, "myosin
     moves to the LEFT thick filament, because on the shorter row the right one
     is where the t-tubule now is". The first version of this put the molecule on
     the right sarcomere's outermost head at x = +1.9, three units from the point
     the beat's close-up aims at, against a visible half-width of about 1.35.
     Screenshotted: the shot was right and the molecule was not in it.

     So: the same filament the anchor names, in the same sarcomere, and the head
     of that filament nearest the anchor. `k = 6` is 0.41 from it — and its
     `noise(i, 3)` is 0.000, so it is attached at any cross-bridge fraction above
     zero rather than only above 0.35. A head that is sometimes not bound is a
     head that sometimes teaches nothing.
     Derived from the loop's own index arithmetic (`((s * sites) + fi) * per + k`)
     rather than typed, so it follows if any of the three counts move. */
  const ATP_BRIDGE = (0 * thickSites.length + 1) * BRIDGES_PER_FILAMENT + 6;
  const atpSite = { ready: false, x: 0, along: 0, ang: 0, y: 0, z: 0, stroke: 0 };

  const PI_COUNT = 96;
  const PI_FLOOR = 0.18;
  const piMat = anatomyMaterial({ colour: PALETTE.phosphate, roughness: 0.58 });
  const phosphate = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.017, 6, 5),
    piMat,
    PI_COUNT,
  );
  /* NO `tag`. Tagging is what puts a name on a thing the pointer can find, and
     this one deliberately has neither a label nor a handle. */
  phosphate.raycast = () => {};
  group.add(phosphate);

  /* --- per-frame ------------------------------------------------------- */

  function update(state, time) {
    const L = state.length;
    const x0 = (-L * SARC_COUNT) / 2;
    const halfA = FILAMENT.thick / 2;

    for (let s = 0; s <= SARC_COUNT; s++) onAxis(zDiscs, s, x0 + s * L, 0, 0);
    zDiscs.instanceMatrix.needsUpdate = true;

    /* HOW FULL, AS A SCALE. Read before the loop that places both rings so the
       membrane and its contents cannot disagree about which store this is.
       0.24 floor: an empty cisterna is still a cisterna, and a core that
       vanishes entirely would say the store had gone rather than emptied.
       `?? 0` is the unbound case, where there is no store to be full of. */
    const srFill = 0.24 + 0.76 * Math.min(1, Math.max(0, state.storeFraction ?? 0));

    // Triads, at the two A-I junctions of each sarcomere. The junction is the
    // A-band edge, so it sits a fixed 0.8 µm from the M-line and drifts toward
    // the Z-disc as the sarcomere shortens.
    let srI = 0;
    let ttI = 0;
    for (let s = 0; s < SARC_COUNT; s++) {
      const centre = x0 + s * L + L / 2;
      for (const side of [-1, 1]) {
        const junction = centre + side * halfA;
        triadX[ttI] = junction;
        onAxis(tTubules, ttI++, junction, 0, 0);
        onAxis(sr, srI, junction - TRIAD_GAP, 0, 0);
        onAxis(sr, srI + 1, junction + TRIAD_GAP, 0, 0);
        /* THE CORE RIDES ITS OWN RING, squashed along the axis and not scaled.
           A uniform scale was measured first and is wrong: it shrinks the
           torus's MAJOR radius too, so at a half-full store the core became a
           smaller ring crossing the membrane rather than something inside it —
           screenshotted, two blue arcs cutting the cisterna instead of filling
           it. `sx` alone squeezes the tube along the fibre's own axis and leaves
           the circle where it is, which is the fill band `fiber.md` §3 asks for
           in the shape a torus can actually have: a fat round band when the
           store is full, a thin disc when it is spent. */
        onAxis(srCore, srI, junction - TRIAD_GAP, 0, 0, srFill, 1, 1);
        onAxis(srCore, srI + 1, junction + TRIAD_GAP, 0, 0, srFill, 1, 1);
        srI += 2;
      }
    }
    sr.instanceMatrix.needsUpdate = true;
    srCore.instanceMatrix.needsUpdate = true;
    tTubules.instanceMatrix.needsUpdate = true;

    // How much calcium is still in there, as a fraction of what this run started
    // with. `advance` works it out because the panel draws the same ratio; a
    // second opinion computed here is how the picture and the number beside it
    // end up disagreeing.
    //
    // `?? 0` IS THE UNBOUND CASE AND IT LANDS ON THE OLD DRAWING. With no
    // scenario there is no store to be full or empty, and 0 puts these back at
    // bare reticulum with no glow — exactly how they were drawn before anything
    // read the store at all.
    // THE ARRIVAL, AND IT IS THE FIRST THING IN THE ORDER. The tubule lights,
    // the cisternae either side of it release, the beads leave. Ten times, and
    // then the recovery half where nothing arrives and nothing leaves — which
    // is where a viewer learns the rhythm was the stimulus and not an idle
    // animation. `?? 0` is the unbound case: no protocol, so nothing fires.
    /* THE COMMAND IS A FLASH, NOT A HOLD — `fiber.md` §3.
       It was `lerpColors(SARCOLEMMA, PEAK, fired)` with `activationEmissive`
       on the same square wave: full #ff4a2b at emissive 0.9 for every one of
       the burst's 0.1625 s, ten times. The spec's complaint is exact — *"역설
       적으로 변하지 않는 signal이 화면에서 가장 큰 변화가 돼버려"* — the one
       quantity on this floor whose whole point is that it does NOT change was
       the loudest thing on the stage, while the store, which does change, moved
       by a measured dE of 6.2.

       So the window is the model's and the shape inside it is a fast attack and
       a decay: up in the first fifth of the burst, down over the rest. It
       arrives, it passes. `stimulusPhase` carries the note about which half of
       that is ours.

       AND IT IS SMALLER. 0.62 of the way to peak instead of all of it, emissive
       0.34 instead of 0.9 — so a tubule flashing still reads as a tubule
       flashing rather than as a new object appearing. Every burst is identical,
       which is the claim; it just no longer shouts it. */
    const fired = state.stim ?? 0;
    const into = state.stimPhase;
    /* FIRED WITH NO PHASE IS STILL FIRED. The envelope is a refinement of how a
       burst is drawn; the fact that one is arriving is the model's, and a
       caller that hands `stim` without `stimPhase` — a test, a hand-built
       state, an older scenario path — must get a lit tubule rather than a dark
       one. Two gates said so within a minute of the envelope landing: "the
       T-tubule is as dark mid-burst as it is between bursts: 0 vs 0".
       `Number.isFinite` AND NOT `=== null`, which was the second version and
       the third gate: `glowNeverFightsColour` drives a hand-built state where
       the field is simply absent, so `undefined < 0.2` fell through to
       `Math.pow(NaN, 1.5)` and the tubule's readings came back NaN. */
    const flash = !fired
      ? 0
      : !Number.isFinite(into)
        ? 1
        : into < 0.2
          ? into / 0.2
          : Math.pow(1 - (into - 0.2) / 0.8, 1.5);
    ttMat.color.lerpColors(SARCOLEMMA, PEAK, flash * 0.62);
    ttMat.emissiveIntensity = activationEmissive(flash) * 0.38;

    const stored = state.storeFraction ?? 0;
    /* ONE CHANNEL, BECAUSE THE SECOND ONE WAS SUBTRACTING FROM THE FIRST.
       This used to glow as well: `emissiveIntensity = 0.75 * stored`, so a full
       cisterna read cool-and-bright to match the calcium beads below — one
       substance, one exposure. The intent was right and the arithmetic was
       against it. `PALETTE.calcium` is a desaturated blue-grey whose red is 91,
       so the glow ADDS red as the store fills at nearly the rate the albedo
       lerp REMOVES it, and what is left of a 94-count red swing reaches the
       screen as about 26. An emissive term is also unlit light laid on top, so
       it walks the ring up into the tone curve's shoulder where whatever
       difference survived compresses again.
       Measured 2026-08-27 on the guided pass's own conclusion, the two beats
       this scale exists to put side by side — 547.3 µM against 448.3, a 10.5%
       fall. Sweeping the coefficient and reading the 57,000 ring pixels off the
       render, nothing else in the frame moving:
         0.75x (as shipped)  ΔE 4.55
         0.30x               ΔE 6.00
         0.00x               ΔE 7.55
       At 0.75 the two rings are the same blue-grey in a photograph. At 0 the
       emptier one goes visibly mauve.
       AND THE FIX'S REACH IS THE CAMERA'S, WHICH IS WORTH KNOWING BEFORE
       READING THE LINE ABOVE AS "the store is legible now". Sampled at 0.25x
       once the pass has handed the scene back — the default framing, a 12.9%
       swing, 22 stable frames of 22 — the same removal is worth 5.82 -> 6.16,
       six percent. It is worth sixty at the conclusion because the camera is
       three units closer there and the rings are deep enough into the shoulder
       for the added light to matter. Opacity is not what is left: at 1.0 the
       same swing reads 6.22 against 0.85's 6.16, so the 15% of warm tissue
       showing through is not the dilution it looks like. What remains is the
       render — 12.9% of a 97-unit palette span is 12.5 material units and
       arrives as 6.2, so half the channel goes to the lighting whatever we do
       here. Widening it means changing what `reticulum` and `calcium` mean,
       which is a bigger decision than this comment.
       THE CELL SCALE ALREADY PAID FOR THIS. In `cellGeometry.js`,
       `emissiveIntensity = demand / 2.0` left the flash beads 32% FAINTER at
       the moment the bout cost the most, and that scale's channels became size
       and darkness for the reason this one's becomes colour alone. The fix
       never came down to the fibre.
       The beads keep both channels and should: they are eleven pixels on a dark
       cytosol and the glow is what makes them findable. This torus is 57,000
       pixels and does not need finding. `gate-legibility.spec.js` holds the
       floor so the glow cannot come back quietly. */
    srMat.color.lerpColors(SR_EMPTY, SR_FULL, stored);

    // Thick filaments stay centred in their sarcomere and never change length.
    let ti = 0;
    for (let s = 0; s < SARC_COUNT; s++) {
      const centre = x0 + s * L + L / 2;
      onAxis(mLines, s, centre, 0, 0);
      for (const [y, z] of thickSites) onAxis(thick, ti++, centre, y, z);
    }
    mLines.instanceMatrix.needsUpdate = true;
    thick.instanceMatrix.needsUpdate = true;

    // Thin filaments are welded to their Z-disc, so the Z-disc moving IS the
    // sliding. Nothing here scales — they keep their length and change position.
    //
    // Tropomyosin and troponin ride along with each one, offset to whichever
    // side is blocking and rotated off it by however much calcium has bound.
    const open = state.activation;
    const strandR = THIN_R + 0.013;
    let ni = 0;
    let tmI = 0;
    let tnI = 0;
    for (let s = 0; s < SARC_COUNT; s++) {
      const left = x0 + s * L;
      const right = left + L;
      for (let f = 0; f < thinSites.length; f++) {
        const [y, z] = thinSites[f];
        // Rolled off the binding sites in proportion to bound calcium.
        const phi = thinAzimuth[f] + TROPOMYOSIN_SHIFT * open;
        const oy = Math.cos(phi) * strandR;
        const oz = Math.sin(phi) * strandR;

        // Framed at the Z-disc and extended from it, not placed at its own
        // midpoint: the weld is the mechanism.
        for (const [origin, dir] of [[left, 1], [right, -1]]) {
          onAxis(thin, ni++, origin, y, z, 1, 1, 1, null, dir * (FILAMENT.thin / 2));
          onAxis(tropomyosin, tmI++, origin, y + oy, z + oz, 1, 1, 1, null, dir * (FILAMENT.thin / 2));

          for (let k = 0; k < TROPONIN_PER_FILAMENT; k++) {
            const u = (k + 0.5) / TROPONIN_PER_FILAMENT;
            onAxis(troponin, tnI++, origin, y + oy, z + oz, 1, 1, 1, null, dir * u * FILAMENT.thin);
          }
        }
      }
    }
    thin.instanceMatrix.needsUpdate = true;
    tropomyosin.instanceMatrix.needsUpdate = true;
    troponin.instanceMatrix.needsUpdate = true;

    // Troponin holds the calcium it binds, so it carries the cool accent rather
    // than staying a structural colour. Stopped at 0.65 of the way: taken the
    // whole way it becomes the same blue as a free calcium ion, and bound
    // calcium stops being distinguishable from calcium in transit.
    troponinMat.color.copy(_colour.set(PALETTE.troponin).lerp(CALCIUM, open * 0.65));

    // Titin spans Z-disc to thick-filament tip, so its length IS the I-band
    // half-width and it shortens as the sarcomere closes.
    const titinLen = Math.max(state.iBandHalf, 0.001);
    let tiI = 0;
    for (let s = 0; s < SARC_COUNT; s++) {
      const left = x0 + s * L;
      const right = left + L;
      for (const [y, z] of thickSites) {
        onAxis(titin, tiI++, left, y, z, titinLen, 1, 1, null, titinLen / 2);
        onAxis(titin, tiI++, right, y, z, titinLen, 1, 1, null, -titinLen / 2);
      }
    }
    titin.instanceMatrix.needsUpdate = true;

    // Cross-bridges sit on the thick filament in the overlap zone only, and
    // swing through the power stroke while calcium has the binding sites open.
    const overlap = Math.max(state.overlap, 0);
    const bound = state.crossBridges;
    let bi = 0;
    for (let s = 0; s < SARC_COUNT; s++) {
      const centre = x0 + s * L + L / 2;
      for (let fi = 0; fi < thickSites.length; fi++) {
        const [y, z] = thickSites[fi];
        for (let k = 0; k < BRIDGES_PER_FILAMENT; k++) {
          const perSide = BRIDGES_PER_FILAMENT / 2;
          const side = k < perSide ? -1 : 1;
          const u = (k % perSide) / (perSide - 1 || 1);

          // Laid from the outer end of the thick filament inward, so bridges
          // disappear from the M-line side as the overlap shrinks. Measured
          // ALONG the filament it sits on, framed at that filament's own centre,
          // so a head stays on its filament where the myofibril bends.
          const along = side * (halfA - u * overlap * 0.92);
          const attached = overlap > 0.02 && noise(bi, 3) < bound;

          // Point the head radially outward toward its nearest thin filament,
          // then tilt it along the filament through the stroke.
          /* One of this filament's own neighbours, by head index, plus a small
             wobble so a row of heads is not a comb. `(noise - 0.5) * 0.35` is
             narrower than the old ±0.45 because the direction is now real and
             the jitter only has to break the regularity, not stand in for it. */
          const fan = thickAzimuth[fi] ?? [0];
          const ang = fan[k % fan.length] + (noise(bi, 7) - 0.5) * 0.35;
          _radial.set(0, Math.cos(ang), Math.sin(ang));
          _tangent.set(0, -Math.sin(ang), Math.cos(ang));
          _q.setFromUnitVectors(_up, _radial);
          const stroke = attached ? 0.55 + 0.5 * Math.sin(time * 9 + bi * 1.7) : 0.12;
          _tilt.setFromAxisAngle(_tangent, side * stroke);
          _q.premultiply(_tilt);

          const scale = attached ? 1 : 0.45;
          /* THE HEAD THE MOLECULE RIDES, captured as the loop draws it rather
             than re-derived after it. Re-deriving is how the storyboard's
             coordinates went two sarcomeres stale; the numbers a thing is drawn
             from are the only numbers that cannot disagree with it. */
          if (bi === ATP_BRIDGE) {
            atpSite.ready = attached;
            atpSite.x = centre;
            atpSite.along = along;
            atpSite.ang = ang;
            atpSite.y = y;
            atpSite.z = z;
            atpSite.stroke = stroke;
          }
          onAxis(
            bridges,
            bi++,
            centre,
            y + Math.cos(ang) * THICK_R,
            z + Math.sin(ang) * THICK_R,
            scale,
            scale,
            scale,
            _q,
            along,
          );
        }
      }
    }
    bridges.instanceMatrix.needsUpdate = true;

    // Calcium: released at the cisternae, drifting in toward the filaments while
    // free calcium is high, cleared as SERCA pumps it back.
    const ca = state.calcium;
    for (let i = 0; i < CA_COUNT; i++) {
      // Released at a triad, then spreading in toward the filaments.
      const origin = triadX[Math.floor(noise(i, 1) * TRIADS)];
      const ang = noise(i, 2) * Math.PI * 2;
      const radius = myofibrilR * (1.16 - 0.8 * ca) + noise(i, 5) * 0.06;
      const drift = (noise(i, 6) - 0.5) * L * 0.55 * ca;
      const wander = 0.12 * ca * Math.sin(time * 2.2 + i);
      const scale = ca > 0.02 ? 0.55 + 0.85 * ca : 0;

      onAxis(
        calcium,
        i,
        origin + drift + wander,
        Math.cos(ang) * radius,
        Math.sin(ang) * radius,
        scale,
      );
    }
    calcium.instanceMatrix.needsUpdate = true;
    caMat.emissiveIntensity = 0.25 + 0.5 * ca;

    /* Phosphate: collecting in the spaces between the filaments, one grain at a
       time as the run's own `Pi_myo_total` climbs.

       `?? 0` IS THE UNBOUND CASE and it draws nothing at all, which is right:
       the illustrative drive has no phosphate series, and grains piling up
       under a curve that is not spending anything would be the invention this
       whole binding exists to avoid.

       PLACED ACROSS THE WHOLE ROW rather than at a source. Calcium has an
       origin — it comes out of a cisterna and travels — and its placement says
       so. Phosphate has no origin to point at: every cross-bridge that lets go
       leaves some, so it appears where the machinery is. Radius runs from just
       outside the thick-filament lattice to just inside the myofibril's own
       radius, i.e. the interstitial space, never inside a rod.

       IT RIDES THE SARCOMERE. `x` is drawn as a fraction of the CURRENT row
       length, so when the sarcomere shortens the grains close up with the
       filaments they sit among instead of standing still while the model moves
       under them. */
    /* SHOWN WHERE THE SPEC ASKS AND NOWHERE ELSE — `fiber.md` §7: *"대신 FULL
       SET / COMPARE에서만 나타나게 해."* Phosphate is what a SET leaves; a field
       of it standing over ONE PULL says a single contraction did that, which is
       the opposite of the point. `state.showPhosphate` is the scene's answer to
       "is the visitor looking at a set", set the same way `showAtp` is. `?? true`
       so a caller that has not heard of the flag draws what it always drew. */
    const pi = (state.showPhosphate ?? true) ? (state.phosphateFraction ?? 0) : 0;
    for (let i = 0; i < PI_COUNT; i++) {
      /* This grain's own threshold. Spread over PI_FLOOR..1 so the field is
         empty at the run's own starting level and full at its ceiling. */
      const appearsAt = PI_FLOOR + (1 - PI_FLOOR) * noise(i, 11);
      if (pi < appearsAt) {
        onAxis(phosphate, i, 0, 0, 0, 0);
        continue;
      }
      /* How long this grain has been present, 0 at the instant it appears and 1
         once the run is at its ceiling — so a new grain fades in rather than
         popping, and the oldest are at full size. */
      const age = Math.min(1, Math.max(0, (pi - appearsAt) / Math.max(1 - appearsAt, 0.001)));

      const u = noise(i, 12);
      const x = x0 + u * L * SARC_COUNT;
      const ang = noise(i, 13) * Math.PI * 2;
      const radius = LATTICE * 1.25 + noise(i, 14) * (myofibrilR - LATTICE * 1.25);
      /* A slow, small wander. Waste is not swimming anywhere. */
      const wander = 0.02 * Math.sin(time * 0.6 + i * 1.7);

      onAxis(
        phosphate,
        i,
        x,
        Math.cos(ang) * radius + wander,
        Math.sin(ang) * radius,
        0.45 + 0.55 * age,
      );
    }
    phosphate.instanceMatrix.needsUpdate = true;

    /* ── ONE PULL SPENDING ONE MOLECULE ──────────────────────────────────────
       Drawn only when the storyboard asks (`state.showAtp`), because one
       molecule among 112 heads is a teaching device and not a census — see the
       note where the form is built. Off, the group is hidden and costs a
       boolean.

       THE PHASE IS THE HEAD'S OWN. `stroke` is `0.55 + 0.5·sin(...)` for the
       chosen bridge, captured above as it was drawn, so `cycle` runs 0 to 1
       across exactly the swing a viewer is watching:

         0.00–0.40   the molecule comes in from the sarcoplasm, three beads
         0.40–0.55   it is docked and the head strokes: the pull
         0.55–1.00   two beads stay, the third leaves outward

       No number is claimed by any of that. What is drawn is the ORDER — arrive,
       pull, split — which is the mechanism, and the mechanism is what the
       closing sentence is about. */
    atpGroup.visible = !!state.showAtp && atpSite.ready;
    if (atpGroup.visible) {
      const cycle = Math.min(1, Math.max(0, (atpSite.stroke - 0.05) / 1.0));
      /* OUTWARD FROM THE MYOFIBRIL'S AXIS, NOT ALONG THE HEAD'S OWN AZIMUTH.
         The first version used the head's `ang`, which points at whichever THIN
         filament that head reaches for — so the molecule was placed 0.135 from
         its filament in a direction that is usually inward, and it came to rest
         at radius 0.125 inside a lattice whose thick filaments sit at 0.24.
         Buried. Probed in node after it failed to appear on screen twice.
         The sarcoplasm is OUTSIDE the lattice, which is also where the
         phosphate field lives (0.30 to 0.444), so going out from the axis puts
         the molecule in the space it would actually arrive from and drops its
         third bead into the very band the other grains occupy. */
      const site = Math.hypot(atpSite.y, atpSite.z) || 1;
      const cos = atpSite.y / site;
      const sin = atpSite.z / site;
      /* CLOSE ENOUGH TO READ AS BOUND. The lattice's thick filaments sit at
         0.24 and a head reaches 0.055 beyond that, so 0.095 puts the molecule
         just past the head's tip — attached rather than floating. 0.14 was
         measured first and read as a molecule hovering near the tissue with no
         visible business there. */
      const dock = site + 0.095;
      const approach = 0.20 * Math.max(0, 1 - cycle / 0.4);
      const r = dock + approach;
      const px = atpSite.x + atpSite.along;
      atpGroup.position.set(px, cos * r, sin * r);
      /* Beads laid along the filament, so the tail reads as a chain rather than
         as three dots stacked toward the camera. */
      const step = ATP_BEAD_R * 2.15;
      for (let i = 0; i < 2; i++) {
        setInstance(atpBeads, i, (i + 1) * step, 0, 0, 1);
      }
      atpBeads.instanceMatrix.needsUpdate = true;
      /* THE THIRD BEAD, AND WHERE THE FIELD COMES FROM. Before the split it is
         the molecule's own third phosphate, in line with the other two; after
         it, it drifts out along the radial into the band the 96 grains occupy
         and is drawn in their colour. */
      const split = 0.55;
      if (cycle < split) {
        atpFreed.position.set(3 * step, 0, 0);
        atpFreed.scale.setScalar(1);
      } else {
        const gone = (cycle - split) / (1 - split);
        atpFreed.position.set(
          3 * step + gone * 0.05,
          cos * gone * 0.26,
          sin * gone * 0.26,
        );
        /* Shrinking to nothing at the end of the swing: it has joined the
           field, and two drawings of the same grain would be one too many. */
        atpFreed.scale.setScalar(Math.max(0, 1 - gone * gone));
      }
    }
  }

  // Callouts are laid out against the RESTING length so they hold still while
  // the sarcomere works — a label that slides with the geometry it names is
  // unreadable in motion.
  //
  // THE HEIGHTS WERE THE OLD FLAT-PLATE PLACEMENT AND THEY ARE GONE.
  // `FiberLabels` drew a text box per anchor with nothing to point WITH, so the
  // rule was "clear of the silhouette" — good for a text box, fatal for a leader
  // line, which then runs from the plate to a point in empty space. The comment
  // that stood here deferred the fix twice over: "moving six anchors is a change
  // only a browser can judge". Half of that was false and
  // `scripts/anchors-vs-tissue.mjs` was the proof sitting next to it — whether an
  // anchor is INSIDE the model needs no browser, and it said 13 of 22 were not,
  // the sarcomere's six at 4.4% to 11.9% of the model away. At 1200x760 the
  // sarcomere draws 137 px tall and those six leaders ended 33 to 91 px clear of
  // it, in white. What did need a browser was whether the solver can still place
  // eight plates once the anchors cluster, which is a different question and is
  // answered below rather than used to defer this one.
  //
  // OFF THE LATTICE, NOT TYPED. Each one now sits on the surface of the thing it
  // names, computed from the same arrays `update` places the meshes with, so a
  // change to `LATTICE` or a filament radius moves the callout with the tissue
  // instead of leaving it behind. `anchorsLand.test.js` holds it.
  const highest = (sites) => sites.reduce((a, b) => (b[0] > a[0] ? b : a));
  const lowest = (sites) => sites.reduce((a, b) => (b[0] < a[0] ? b : a));
  const topThin = highest(thinSites);
  const lowThin = lowest(thinSites);

  /* FIVE PLATES, AND EVERY ONE OF THEM HAS A BEAT THAT EXPLAINS IT.
     TODO.md's canon of 2026-08-30, F1: *"element가 너무 많다. 진짜 쓰이는 것만
     남긴다. element는 pill 위에 두고, 그게 뭘 하는지는 guided tour가 설명한다."*
     Eight anchors shipped here and the pass focuses five. The other three —
     A-band, Z-disc, titin — were kept on an argument this scale's own
     storyboard writes down: they "carry their one-line roles in free
     exploration instead" (`fiberTour.js`, the note over the myosin beat). That
     IS the standing text the canon replaces with the pass, and the pass has no
     room to adopt them — it measures 42.1 s against `tourPace`'s 45 s ceiling,
     so a plate with no beat is a plate nothing explains.
     So it is a rule rather than a taste: **a sarcomere plate draws only if a
     beat names it.** `fiberTour.test.js` holds it off the two lists rather than
     off a copy, so writing a beat is what lets a plate back and neither list
     can drift from the other.
     NOTHING LEFT THE PICTURE (CLAUDE.md §6). The Z-discs, the A-band stripes
     and the titin strands are still built, still lit, still carrying
     `anatomyStyle`'s structural colours. Three labels went; no geometry did.

     AND THE CLAUSE IS THE ROLE, SO TWO CLAUSES WENT FOR THE SAME REASON.
     `· carries the signal` and `· calcium lands on troponin` say what the
     element DOES — twice, once on the plate and once in the beat that frames it
     ("One command opens it", "Troponin catches it"). The canon gives that job
     to the pass. What survives is the SECOND NAME, which no beat supplies:
     `· thick` and `· thin` are what a textbook calls these two filaments, and
     `· calcium store` is the word the pass itself uses for the cisterna —
     drop it and "the store drops and comes back" is a sentence pointing at a
     plate reading `Terminal cisterna`, with nothing joining them. That last one
     is Q11's own example, and it is the one clause here that is not a role.
     IT GAINED THE WORD `calcium` ON 2026-09-06, and that is the owner's Q8:
     *"파란색이 calcium인건 독자들이 모르잖아"*. `PALETTE.calcium` drives four
     separate channels on this floor — the free ions, the store's core torus, the
     cisterna's albedo, troponin's lerp — and not one of them had a ring, a
     plate, a hover or a beat tying the blue to the word. This is the one plate
     that stands on the blue thing the ions come OUT of, so it is the cheapest
     place in the app to join them, and it costs one word inside a clause the
     canon already allows (a second name, two words, not a role). `the` came off
     when the plate reached x 1432 of a 1440 stage and clipped: this anchor is the
     rightmost on the sarcomere, and the framing got WIDER on the same day the
     camera stopped rolling.
     A MEASUREMENT CAME OFF WITH IT: `Tropomyosin + troponin · calcium lands on
     troponin` was the single label that would not fit a 320 px plate, and
     `FiberScene` carried a hand-picked fold for it. The fold is gone because
     the overflow is.

     Callouts are laid out against the RESTING length so they hold still while
     the sarcomere works — a label that slides with the geometry it names is
     unreadable in motion — and each `at` sits on the surface of the thing it
     names, computed from the same arrays `update` places the meshes with.
     `anchorsLand.test.js` holds that. */
  /* WHERE A TRIAD SITS, as the per-frame `update` computes it — the A-band edge
     of sarcomere `s`, on the `-1` or `+1` side of its centre. Written once here
     so an anchor cannot disagree with the geometry it hangs on; at rest `L` is
     `FILAMENT.restLength`, which is the length these labels are placed against.
     Shortening moves the junctions inward and the labels ride the model, which
     is `update`'s business and not this list's. */
  const junctionX = (s, side) =>
    (-FILAMENT.restLength * SARC_COUNT) / 2 +
    s * FILAMENT.restLength +
    FILAMENT.restLength / 2 +
    (side * FILAMENT.thick) / 2;
  const anchors = [
    // A thick filament off the sarcomere's centre, so the leader lands on one
    // rod rather than into the middle of the bundle.
    //
    // +0.35 AND NOT -0.3, AND THE REASON IS THE RING RATHER THAN THE LABEL.
    // Canon D2ⓐ put a pressable ring on every anchor (`Handle.jsx`), and an
    // anchor is where a LABEL hangs — a point chosen for legibility, not a
    // claim about where the part is; the part is a rod 1.6 long and every x in
    // -0.8..0.8 is equally on it. At -0.3 this ring and tropomyosin's at -0.2
    // measured **19 px apart in a browser at 1280x900** while their hit targets
    // are 44 px square, so the two were one target and neither could be
    // reliably pressed. Mirroring to the other half of the same filament costs
    // nothing and spreads the five rings evenly across the row: -1.70, -0.20,
    // +0.35, 1.40, 3.09. `anchorsLand.test.js` still holds it on the surface.
    // AND FOUR OF THE FIVE ARE COMPUTED NOW, NOT TYPED. When `SARC_COUNT` went
    // from three to two (canon D1) the row shrank from -3.3..3.3 to -2.2..2.2
    // and two of these numbers were the OLD row's: `anchorsLand` caught the
    // cisterna 17.9 % of the model away from the thing it names, pointing at
    // empty air past the end. The t-tubule's 1.4 was the same kind of number and
    // would have landed inside a sarcomere rather than on a junction.
    // `junctionX` is the builder's own expression for where a triad goes, so
    // these follow the count instead of agreeing with it by hand. The spread the
    // note above bought is kept — myosin moves to the LEFT thick filament,
    // because on the shorter row the right one is where the t-tubule now is:
    // -1.7, -1.1, -0.2, +0.3, +1.99, closest pair 0.5 µm apart against the
    // 0.1 that made two rings one target.
    { id: "myosin", label: "Myosin · thick", at: [-1.1, thickSites[1][0] + THICK_R, thickSites[1][1]] },
    { id: "t-tubule", label: "T-tubule", at: [junctionX(SARC_COUNT - 1, -1), 0.543, 0] },
    // The gap is READ, not spelled: this was `3.058` once — 3 plus the OLD gap —
    // and Q2 R1 moved the gap to 0.09 without it, 0.032 µm of drift that put the
    // leader on the tubule's edge of the cisterna rather than on its crown.
    { id: "sr", label: "Terminal cisterna · calcium store", at: [junctionX(SARC_COUNT - 1, 1) + TRIAD_GAP, 0.565, 0] },
    { id: "actin", label: "Actin · thin", at: [-1.7, lowThin[0] - THIN_R, lowThin[1]] },
    // The strand rides at THIN_R + 0.013 and the troponin beads on it, so the
    // callout lands on the strand rather than on the filament under it.
    { id: "tropomyosin", label: "Tropomyosin + troponin", at: [-0.2, topThin[0] + THIN_R + 0.013, topThin[1]] },
  ];

  /* WHERE A SHOT MAY STAND, WHICH IS NOT WHERE A LABEL STANDS.
     `anchors` is a solved layout: the callout plates have to not collide, so the
     t-tubule's label went on the junction at one end of the sarcomere and the
     store's on the junction at the other. Measured 2026-09-05 those two are
     **1.69 apart** — a whole sarcomere — and the guided pass says *"that calcium
     waits in the store BESIDE this tube"* over them. The word was false on
     screen, and no gate could see it because both anchors are individually on
     real tissue and `anchorsLand.test.js` asks only that.
     A triad is a tubule with a cisterna 0.09 either side of it, which is
     `TRIAD_GAP` and is drawn that way at every junction. So the pass gets the
     triad the labelled STORE belongs to: its own tubule is at the same junction,
     0.09 away, and framing there makes "beside" a thing a viewer can see. The
     store's beacon still lands on the `sr` anchor, so the ring a visitor presses
     later and the ring the pass lights are the same ring.
     Derived from `junctionX` — the builder's own expression for where a triad
     goes — for the same reason the anchors are. Nothing here is typed. */
  const storeJunction = junctionX(SARC_COUNT - 1, 1);
  /* WHERE THE ONE SPENDING HEAD IS, at rest, so a beat can frame it.
     The molecule is drawn on `ATP_BRIDGE` and that head is 0.055 of a unit long
     among a hundred and twelve; a shot aimed at the `myosin` ANCHOR sits 2.44
     back and puts it against paper at the top of the frame — screenshotted, the
     molecule was on screen and read as floating near the tissue rather than as
     bound to anything. A close-up needs the head's own address.
     Rest values on purpose: the head travels about 0.4 over the run and a
     camera that chased it would be the picture moving under the sentence. */
  const atpRest = (() => {
    const perSide = BRIDGES_PER_FILAMENT / 2;
    const k = 6;
    const side = k < perSide ? -1 : 1;
    const u = (k % perSide) / (perSide - 1 || 1);
    const rest = bands(FILAMENT.restLength);
    const along = side * (FILAMENT.thick / 2 - u * Math.max(rest.overlap, 0) * 0.92);
    const [sy, sz] = thickSites[1];
    const r = Math.hypot(sy, sz) || 1;
    return [
      (-FILAMENT.restLength * SARC_COUNT) / 2 + FILAMENT.restLength / 2 + along,
      (sy / r) * (r + 0.095),
      (sz / r) * (r + 0.095),
    ];
  })();
  const sites = [
    /* The head the ATP beat is about. No plate — it is a shot, not a part. */
    { id: "atp-head", at: atpRest },
    /* The tubule at the store's own junction — a different drawn instance from
       the labelled one, and the one the store is actually beside. */
    { id: "triad-tubule", at: [storeJunction, 0.543, 0] },
    /* The middle of that triad: tubule and both its cisternae in one frame. */
    { id: "triad", at: [storeJunction, 0.554, 0] },
  ];

  rememberBaseColours(group);
  return {
    spotlight: spotlightOn(group),
    group,
    update,
    anchors,
    sites,
    extent: EXTENT.sarcomere,
    dispose: () => disposeTree(group),
  };
}

/* ---- level 2: fiber ------------------------------------------------------ */

/**
 * One muscle fiber, cut away: sarcolemma, peripheral nuclei, the myofibrils
 * packed inside it, and the mitochondria in the spaces between them.
 *
 * Roughly 250 µm of a fiber 60 µm across. A real fiber runs centimetres and
 * holds hundreds of myofibrils rather than seven — the count here is
 * representative, chosen so the packing stays readable.
 */
const FIBER_LEN = 5.0;
const FIBER_R = 0.62;
const STRIATIONS = 48;
const NUCLEI = 6;
const MITO = 26;

/**
 * Myofibril packing. Sites sit 0.3 apart, so two neighbours have 0.3 to share
 * between two radii, two bows and two SR nets. Every amplitude below is bounded
 * by that number, and `GUARD myofibrils bend without passing through their
 * neighbours` in shape.test.js is what holds them to it.
 *
 * The base radius came down from 0.115 to 0.110 to make room for the SR net,
 * which now carries part of the outer silhouette.
 */
const SITE_SPACING = 0.3;
const MYOFIBRIL_R = 0.11;
/** How far the whole bundle bends. Shared, because what bends is the fiber. */
const BUNDLE_BOW = 0.07;
/** How far one myofibril departs from its neighbours. Bounded by the clearance. */
const FIBRIL_BOW = 0.012;
/**
 * How far the net's valleys sit INSIDE the myofibril, and how far its tubules
 * stand off it.
 *
 * SR_SINK is the whole reason the striations survived this change. The net was
 * first drawn as a continuous translucent sleeve at a constant standoff, and
 * the first macro pair showed exactly what Take A shipped and had to revert:
 * the bands were still there, and they were greyer and harder to count than
 * BEFORE. A frame that is prettier and carries less information is a
 * regression.
 *
 * Sinking the valleys below the myofibril surface turns the sleeve into what
 * the SR actually is — a NET of tubules with the myofibril visible between them
 * — rather than a bag over it. The valleys are swallowed by the surface they
 * sit under, and only the seven tubules emerge. So the bands read at full
 * contrast between the tubules and are only dimmed where a tubule crosses them,
 * which is the same thing that happens in a micrograph.
 */
const SR_SINK = 0.014;
const SR_RELIEF = 0.017;
/** Longitudinal SR tubules around one myofibril, and how far they wind over its run. */
const SR_TUBULES = 7;
const SR_TWIST = 0.55;

/**
 * One myofibril's own shape, derived from its index so the fiber is the same
 * fiber on every reload — Math.random here would mean no two screenshots could
 * be compared.
 *
 * FOUR WAYS THIS FILE USED TO LIE, in the order they cost the most:
 *
 *   1. every myofibril banded in lockstep with its neighbours. Real tissue
 *      registers loosely: a myofibril is mechanically coupled to the next one
 *      at the Z-disc through desmin, and coupled is not welded. `bandPhase`.
 *   2. every myofibril was the same diameter and the same length. `r0`,
 *      `length`.
 *   3. every myofibril was a perfect extruded cylinder, the same width at both
 *      ends. A real one narrows along its run and its diameter drifts.
 *      `taper`, `drift`.
 *   4. every axis was dead straight. `bowAt`.
 *
 * All four are SLIGHT. The bundle has to stay a bundle; the failure mode on the
 * other side of this is tissue that looks chewed.
 */
export function myofibrilShape(i) {
  const r0 = MYOFIBRIL_R * (0.9 + noise(i, 41) * 0.16);
  const length = FIBER_LEN * 0.98 * (0.965 + noise(i, 42) * 0.05);
  const taper = 0.06 + noise(i, 43) * 0.1;
  const drift = 0.03 + noise(i, 44) * 0.03;
  const driftPhase = noise(i, 45) * Math.PI * 2;
  const wobble = noise(i, 46) * Math.PI * 2;

  return {
    length,
    /** 0..1 of one band spacing. The whole point of the item. */
    bandPhase: noise(i, 47),
    radiusAt: (u) => r0 * (1 - taper * u + drift * Math.sin(u * Math.PI * 2.7 + driftPhase)),
    bowAt: (u) => [
      BUNDLE_BOW * Math.sin(u * Math.PI * 1.35 - 0.5) + FIBRIL_BOW * Math.sin(u * Math.PI * 2.2 + wobble),
      BUNDLE_BOW * 0.4 * Math.sin(u * Math.PI * 0.9 + 1.1) + FIBRIL_BOW * Math.sin(u * Math.PI * 1.7 + wobble * 1.6),
    ],
  };
}

export function buildFiberLevel() {
  const group = new THREE.Group();
  group.name = "FiberLevel";

  /* Sarcolemma. Same opacity the body shell uses one scale up. */
  const membrane = new THREE.Mesh(
    cylinder(FIBER_R, FIBER_R, FIBER_LEN, 40),
    sheathMaterial({ colour: PALETTE.sarcolemma, opacity: OPACITY.membrane }),
  );
  tag(membrane, "sarcolemma", "Sarcolemma");
  /* A translucent skin barely reads as "lit" by colour alone — owner (pace 3-1, P2):
     *"skin 자체가 더 하이라이트"*. The spotlight raises its opacity while it is the subject. */
  membrane.userData.litOpacity = 0.62;
  group.add(membrane);

  const sites = hexPack(SITE_SPACING, 1);
  const shapes = sites.map((_, i) => myofibrilShape(i));

  /* Myofibrils.

     One mesh each rather than one InstancedMesh with seven copies. An instance
     can only be moved and scaled, and every item of the brief — taper, bend,
     per-fibril diameter — is a change of SHAPE, which lives in the geometry. At
     seven meshes sharing one material the draw calls are not the constraint;
     what would be a constraint is a hundred, and a hundred myofibrils in a
     fiber 60 µm across is not something this camera can resolve anyway. */
  const myofibrilMat = anatomyMaterial({
    colour: PALETTE.myofibril,
    emissive: PALETTE.tissuePeak,
    emissiveIntensity: 0,
  });

  /* The SR net: the skin.

     A myofibril in a photograph is not a bare rod — it is sleeved in
     sarcoplasmic reticulum, longitudinal tubules running its length and joining
     over each A-I junction. That net is the anatomically correct source of
     surface relief, and it is a structure this app is supposed to be showing
     anyway, so the relief is not decoration bought on the side.

     Drawn as one fluted sleeve rather than as seven separate tubes: it is one
     mesh instead of seven per fibril, and with its valleys sunk below the
     myofibril surface (SR_SINK) what you see of it IS seven tubules. Translucent
     and never writing depth, so a band crossed by a tubule is dimmed rather than
     erased — losing the striations to a membrane is the failure Take A shipped. */
  const srMat = sheathMaterial({ colour: PALETTE.reticulum, opacity: 0.26 });

  shapes.forEach((shape, i) => {
    const [y, z] = sites[i];

    const fibril = new THREE.Mesh(rod(shape.length, shape.radiusAt, shape.bowAt, 16, 40), myofibrilMat);
    fibril.position.set(0, y, z);
    tag(fibril, "myofibril", "Myofibril");
    group.add(fibril);

    const sleeve = new THREE.Mesh(
      rod(
        shape.length * 0.995,
        (u, phi) =>
          shape.radiusAt(u) -
          SR_SINK +
          (SR_SINK + SR_RELIEF) * Math.max(0, Math.cos(SR_TUBULES * phi - SR_TWIST * u * Math.PI * 2)) ** 0.7,
        shape.bowAt,
        30,
        40,
      ),
      srMat,
    );
    sleeve.position.set(0, y, z);
    tag(sleeve, "sarcoplasmic-reticulum", "Sarcoplasmic reticulum");
    group.add(sleeve);
  });

  /* Striations.
     
     These are A-bands, not Z-discs. What makes a myofibril look striped is the
     dark A-band alternating with the light I-band either side of it — the Z-disc
     itself is a line inside the I-band and far too fine to see here. Drawn as
     rings at a larger radius instead, they clamp around the myofibril like hoops
     on a barrel and the fiber reads as something machined. So: a segment of the
     A-band's own length, at the myofibril's own radius, in the thick-filament
     colour, with the lighter myofibril showing through between them as the
     I-band. There are really about 113 sarcomeres in this much fiber; 48 is as
     many as survives without aliasing into a moiré at this camera distance. */
  const striations = new THREE.InstancedMesh(
    cylinder(1, 1, 1, 14), // unit rod: each band is scaled to its own myofibril
    anatomyMaterial({ colour: PALETTE.myosin, roughness: SURFACE.roughnessStatic }),
    sites.length * STRIATIONS,
  );
  tag(striations, "a-band", "A-band striation");
  group.add(striations);

  /* Nuclei: peripheral, pressed against the membrane. A fiber is a syncytium —
     many nuclei, all at the edge, which is the diagnostic look. */
  const nucleusGeo = new THREE.SphereGeometry(0.1, 14, 10);
  nucleusGeo.scale(1.9, 0.62, 1);
  const nuclei = new THREE.InstancedMesh(
    nucleusGeo,
    anatomyMaterial({ colour: PALETTE.nucleus, roughness: 0.5 }),
    NUCLEI,
  );
  tag(nuclei, "myonucleus", "Myonucleus");
  group.add(nuclei);
  for (let i = 0; i < NUCLEI; i++) {
    const ang = noise(i, 11) * Math.PI * 2;
    _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang);
    setInstance(
      nuclei,
      i,
      (noise(i, 12) - 0.5) * FIBER_LEN * 0.82,
      Math.cos(ang) * FIBER_R * 0.84,
      Math.sin(ang) * FIBER_R * 0.84,
      1,
      1,
      1,
      _q,
    );
  }
  nuclei.instanceMatrix.needsUpdate = true;

  /* Mitochondria, in the interstices between myofibrils. */
  const mitoGeo = new THREE.CapsuleGeometry(0.045, 0.11, 4, 8);
  mitoGeo.rotateZ(Math.PI / 2);
  const mitoMat = anatomyMaterial({
    colour: PALETTE.mitochondrion,
    roughness: 0.5,
    emissive: PALETTE.mitochondrion,
    emissiveIntensity: 0,
  });
  const mitochondria = new THREE.InstancedMesh(mitoGeo, mitoMat, MITO);
  tag(mitochondria, "mitochondrion", "Mitochondrion");
  group.add(mitochondria);
  for (let i = 0; i < MITO; i++) {
    const ang = noise(i, 21) * Math.PI * 2;
    const r = 0.16 + noise(i, 22) * 0.34;
    setInstance(
      mitochondria,
      i,
      (noise(i, 23) - 0.5) * FIBER_LEN * 0.88,
      Math.cos(ang) * r,
      Math.sin(ang) * r,
    );
  }
  mitochondria.instanceMatrix.needsUpdate = true;

  /* WHERE ONE OF EACH ACTUALLY SITS — 2026-09-07, owner (pace 2, F2): *"Myonucleus는
     겁나 위에 있고 Mitochondria는 겁나 옆에"*. The anchors' `at` are plate points; a
     press zoomed on the plate and the part was elsewhere. The front-most instance
     (largest z) of each, recomputed from the same noise, is what the close-up
     looks at (`partAt`). */
  const frontOf = (count, xSeed, angSeed, len, rOf) => {
    let best = null;
    for (let i = 0; i < count; i++) {
      const ang = noise(i, angSeed) * Math.PI * 2;
      const r = rOf(i);
      const at = [(noise(i, xSeed) - 0.5) * len, Math.cos(ang) * r, Math.sin(ang) * r];
      if (!best || at[2] > best[2]) best = at;
    }
    return best;
  };
  const nucleusFront = frontOf(NUCLEI, 12, 11, FIBER_LEN * 0.82, () => FIBER_R * 0.84);
  const mitoFront = frontOf(MITO, 23, 21, FIBER_LEN * 0.88, (i) => 0.16 + noise(i, 22) * 0.34);

  /* --- per-frame ------------------------------------------------------- */

  function update(state) {
    // The fiber shortens and thickens together, on the same volume-preserving
    // rule the body rig uses one scale up (rig.js updateGirth).
    const along = state.length / FILAMENT.restLength;
    group.scale.set(along, state.girth, state.girth);

    // ...and that scale was shrinking the A-bands with it. Measured off the
    // render before this was countered: a striation went 0.11750 -> 0.10255
    // between rest and peak, a factor of 0.8727, which is just `along`. So this
    // level drew the thick filament getting shorter while the level below it
    // printed "A-band 1.60 µm" under a caption saying it never changes length.
    //
    // Shortening closes the GAPS, not the bands: the sarcomere count is fixed,
    // so A-bands ride closer together while each keeps its own length. The
    // instance positions therefore keep riding the group scale untouched, and
    // only each band's own X is countered here. `bandLength` differs per
    // myofibril since SHAPE gave each its own arc length, so the base is
    // replayed rather than recomputed, and the rotation goes back with it —
    // dropping the quaternion would straighten every band off its bowed axis.
    if (striationScale !== 1 / along) {
      striationScale = 1 / along;
      for (let i = 0; i < striationBase.length; i++) {
        const b = striationBase[i];
        setInstance(striations, i, b.x, b.y, b.z, b.bandLength * striationScale, b.r, b.r, b.q);
      }
      striations.instanceMatrix.needsUpdate = true;
    }

    // Warms toward the activation colour but never reaches it. At the body
    // scale a peak-effort muscle can go the whole way because it is one red
    // shape among translucent context; here the working tissue fills the frame,
    // and taken the whole way the entire screen turns orange.
    const load = state.crossBridges;
    myofibrilMat.color.copy(_colour.set(PALETTE.myofibril).lerp(PEAK, load * 0.3));
    myofibrilMat.emissiveIntensity = load * load * 0.15;
    mitoMat.emissiveIntensity = load * 0.18;
  }

  // Striation spacing does not depend on the frame — the group scale carries the
  // shortening, which is correct for where a band SITS — so the positions are
  // laid out once and kept. A band's own length is not the group's business and
  // is countered in `update` off the base recorded here.
  //
  // PHASE JITTER LIVES HERE, and it is the one change in this file that costs
  // nothing and pays the most. Every myofibril used to start its band pattern at
  // exactly the same x, so seven of them made a perfect grid and the fiber read
  // as corrugated sheet. Each one now starts its run at its own offset within a
  // band, and carries its bands on its own bowed, tapering axis at its own local
  // radius, so the pattern is loose across the bundle.
  //
  // What did NOT change: the spacing WITHIN one myofibril is still exactly
  // uniform. Sarcomeres along one myofibril are in series and share a length —
  // jittering them would be inventing a defect rather than removing one, and it
  // would break the only claim the striation is making. `GUARD sarcomeres inside
  // one myofibril stay in register` holds that line.
  const striationBase = [];
  sites.forEach(([y, z], i) => {
    const shape = shapes[i];
    const spacing = shape.length / (STRIATIONS + 1);
    const bandLength = spacing * (FILAMENT.thick / FILAMENT.restLength);
    for (let k = 0; k < STRIATIONS; k++) {
      const u = (k + 0.5 + shape.bandPhase) / (STRIATIONS + 1);
      const [dy, dz] = shape.bowAt(u);
      const r = shape.radiusAt(u) * 1.015;
      tangentAt(shape.bowAt, u, shape.length, _tangent);
      striationBase.push({
        x: (u - 0.5) * shape.length,
        y: y + dy,
        z: z + dz,
        bandLength,
        r,
        // Cloned, not shared: `_q` is one scratch quaternion reused every
        // iteration, so storing it would leave all 336 bands pointing along
        // whichever tangent happened to be computed last.
        q: new THREE.Quaternion().setFromUnitVectors(_axisX, _tangent),
      });
    }
  });
  let striationScale = 1;
  striationBase.forEach((b, i) =>
    setInstance(striations, i, b.x, b.y, b.z, b.bandLength, b.r, b.r, b.q),
  );
  striations.instanceMatrix.needsUpdate = true;

  /* ON THE THING, not clear of the silhouette — see the sarcomere level's own
     note. These were at y ±1.02 and ±1.06 against a model that reaches 0.62, so
     every leader on this level ran into white. Each now sits where its own mesh
     is placed: the sheath at the fibre's radius, a myofibril on its lattice
     site, and the two organelles on the shell `setInstance` scatters them
     around — `FIBER_R * 0.84` for the nuclei, 0.16 to 0.50 for mitochondria. */
  /* THE CLAUSE THE SARCOMERE LEVEL HAS, ON THE LEVELS THAT DID NOT. The
     first-visitor audit, 2026-08-30: the default level glosses all nine of its
     plates — `A-band · never changes length`, `Titin · the spring` — and a
     viewer who presses `Fiber` or `Fascicle` gets bare Latin. The Scale chips
     are one press apart, so the same screen taught a word and then refused to,
     which reads as the deeper level being the one that matters.
     Q11's rule and its wording, unchanged: the plain words the panel already
     uses, and the textbook fact the geometry above is BUILT on — six nuclei are
     instanced at the shell (`NUCLEI`, "a fiber is a syncytium — many nuclei, all
     at the edge"), so "one of the cell's many" is what is drawn and not a fact
     imported from a book. No number and no evidence word, so §5 is not involved.

     `Mitochondria` IS LEFT BARE ON PURPOSE, and so are `Muscle fibers` and
     `Selected fiber` below. The rule is not "every plate carries a clause" —
     it is that a word a visitor cannot read gets one. Glossing the word every
     first-year already met in school spends the plate's width on nothing and
     puts a fifth thing to read on a level that has four. */
  const anchors = [
    /* NAMES ONLY — 2026-09-07, owner (pace 3-1, P2): *"이 name tag에 설명 필요없어 …
       어차피 누르면 보이는데"*. The press carries the sentence. */
    { id: "sarcolemma", label: "Sarcolemma", at: [1.7, FIBER_R * 0.97, 0], partAt: [1.2, FIBER_R * 0.7, FIBER_R * 0.7] },
    { id: "myofibril", label: "Myofibril", at: [-1.6, SITE_SPACING, 0], partAt: [-1.2, SITE_SPACING * 0.5, 0.35] },
    { id: "myonucleus", label: "Myonucleus", at: [-0.5, -FIBER_R * 0.84, 0], partAt: nucleusFront },
    { id: "mitochondrion", label: "Mitochondria", at: [1.9, -0.33, 0], partAt: mitoFront },
  ];

  rememberBaseColours(group);
  return {
    spotlight: spotlightOn(group),
    group,
    update,
    anchors,
    extent: EXTENT.fiber,
    dispose: () => disposeTree(group),
  };
}

/* ---- level 3: fascicle --------------------------------------------------- */

/**
 * A fascicle: a bundle of fibers inside its perimysium. This is the last level
 * at which the body model could hand off — a whole muscle is a bundle of these.
 */
const FASC_LEN = 5.4;

/**
 * One muscle fibre's own outline, and how far the packing may be disturbed.
 *
 * A real fibre is polygonal in cross-section, varies in calibre along its length
 * and is not straight; `cylinder(r, r, L)` is none of those. These are the same
 * moves `myofibrilShape` makes one level down, at this level's dimensions — the
 * taper is small because a fibre is not a spindle, and the bow is small because
 * eighteen of them are packed inside a sheath 0.8 across.
 *
 * THE DISC IS BOUNDED BY THE SHEATH, and that is the only hard number here. The
 * perimysium is drawn at radius 0.8 and a fibre reaches its own radius past its
 * centre at up to 1.14x, so a centre outside about 0.65 puts a fibre through the
 * sheath — the scale-appropriate form of a muscle leaving the body (§6).
 */
const FIBRE_R = 0.132;
const FIBRE_DISC = 0.63;
const FIBRE_SCATTER = 0.09;
const FIBRE_MIN_GAP = 0.245;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const fibreRadiusAt = (u, phi) =>
  FIBRE_R * (1 - 0.05 * u + 0.035 * Math.sin(u * Math.PI * 2.3) + 0.03 * Math.sin(phi * 3 + u * 2.1));
const fibreBowAt = (u) => [0.035 * Math.sin(u * Math.PI * 1.6), 0.022 * Math.sin(u * Math.PI * 2.2 + 1.1)];

export function buildFascicleLevel() {
  const group = new THREE.Group();
  group.name = "FascicleLevel";

  const sheath = new THREE.Mesh(
    cylinder(0.8, 0.8, FASC_LEN, 44),
    sheathMaterial({ colour: PALETTE.perimysium, opacity: OPACITY.sheath }),
  );
  tag(sheath, "fascicle-boundary", "Perimysium");
  group.add(sheath);

  /* Two rings rather than one. A fascicle holds tens to hundreds of fibers, and
     at seven it reads as a cable of rods with the sheath hanging off it.

     AND THE RINGS ARE NOT DRAWN AS RINGS. `hexPack` returns a hexagonal lattice
     and this level used to place eighteen fibres on it exactly: a
     nearest-neighbour spacing spread of 0.016, against the 0.117 that got the
     cell scale's pool called a crystal and rebuilt.

     JITTERING THE LATTICE WAS TRIED FIRST AND IS NOT ENOUGH. `hexPack(0.3, 2)`
     puts ring 1 at 0.3 and two fibres touch at about 0.27, so there is 0.03 to
     spend and spending all of it reached 0.030 — measurably better than 0.016
     and visibly the same picture. The rings were the constraint, not the jitter,
     and eighteen fibres of mean radius 0.132 occupy only 49% of a sheath 0.8
     across: the room was there, the lattice was simply not using it. So the
     sites are a golden-angle fill of the same disc, displaced per index and then
     pushed apart only where two fibres would interpenetrate — which at this
     scale is the drawing claiming two cells share a wall. */
  const sites = relax(
    Array.from({ length: 18 }, (_, i) => {
      const r = FIBRE_DISC * Math.sqrt((i + 0.5) / 18);
      const a = i * GOLDEN_ANGLE;
      return [
        r * Math.cos(a) + (noise(i, 33) - 0.5) * FIBRE_SCATTER,
        r * Math.sin(a) + (noise(i, 34) - 0.5) * FIBRE_SCATTER,
      ];
    }),
    FIBRE_MIN_GAP,
    (q) => {
      const d = Math.hypot(q[0], q[1]);
      if (d > FIBRE_DISC) {
        q[0] *= FIBRE_DISC / d;
        q[1] *= FIBRE_DISC / d;
      }
    },
    40,
  );
  const fiberMat = anatomyMaterial({ colour: PALETTE.tissueIdle, opacity: OPACITY.secondary });
  /* ONE ROD, EIGHTEEN ATTITUDES — not eighteen cylinders.
     This was `cylinder(0.132, 0.132, ...)`: constant radius end to end, which is
     the extruded cylinder the form study spent three treatments learning it
     could not shade its way out of. `rod` is the machinery that fixed it one
     level down and it was already exported from this file. One geometry keeps
     the single draw call; the per-instance quaternion turns each fibre about its
     own long axis, so one bow points eighteen different ways and the outlines
     stop being copies. Scattering the sites while leaving the attitude alone
     would have bought half of it — the outline is what the eye counts. */
  const fibers = new THREE.InstancedMesh(
    rod(FASC_LEN * 0.97, fibreRadiusAt, fibreBowAt, 14, 24),
    fiberMat,
    sites.length,
  );
  tag(fibers, "muscle-fiber", "Muscle fiber");
  group.add(fibers);
  sites.forEach(([y, z], i) => {
    const j = 0.9 + noise(i, 31) * 0.24;
    _q.setFromAxisAngle(_axisX, noise(i, 35) * Math.PI * 2);
    setInstance(fibers, i, 0, y, z, 0.96 + noise(i, 36) * 0.08, j, j, _q);
  });
  fibers.instanceMatrix.needsUpdate = true;

  /* The one fiber the next level down is about. Solid where the rest are faint —
     the explorer's own selection convention rather than an outline. */
  const focusMat = anatomyMaterial({
    colour: PALETTE.tissueRest,
    emissive: PALETTE.tissuePeak,
    emissiveIntensity: 0,
  });
  const focus = new THREE.Mesh(cylinder(0.142, 0.142, FASC_LEN * 0.97, 20), focusMat);
  tag(focus, "muscle-fiber-focus", "Selected fiber");
  group.add(focus);

  function update(state) {
    group.scale.set(state.length / FILAMENT.restLength, state.girth, state.girth);

    const load = state.crossBridges;
    focusMat.color.copy(_colour.set(PALETTE.tissueRest).lerp(PEAK, load * 0.55));
    focusMat.emissiveIntensity = load * load * 0.45;
    // Surrounding fibers lag — a fascicle does not recruit as one unit.
    fiberMat.color.copy(_colour.set(PALETTE.tissueIdle).lerp(PEAK, load * 0.22));
  }

  /* ON THE THING — same note as the two levels above. These were at y ±1.18 and
     -1.2 against a model that reaches 0.80, so all three leaders ran into white,
     and the one that matters most is "Selected fiber": this level's whole job is
     to say which of eighteen you came down through, and its line ended 6.8% of
     the model clear of every fibre. The sheath's own radius is 0.8, the fibres
     are scattered inside `FIBRE_DISC`, and the selected one is the 0.142 rod on
     the axis. */
  /* One gloss, for the one word here a visitor cannot read — see the fiber
     level's note. `LEVELS.fascicle` already calls this level "a bundle of
     fibres, wrapped together", so the clause is that sentence's own word
     pointed at the thing doing the wrapping. */
  /* ONE PLATE ON THE FASCICLE — owner, FIBER pass 3 (2026-09-07): *"perimysium,
     selected fiber빼도 되고 muscle fibers만 보여주면 되는데"*. The sheath and the
     focused fibre are still drawn and still tagged for a press; they no longer
     carry a standing name. */
  const anchors = [
    { id: "muscle-fiber", label: "Muscle fibers", at: [-1.8, FIBRE_DISC * 0.8, 0] },
  ];

  rememberBaseColours(group);
  return {
    spotlight: spotlightOn(group),
    group,
    update,
    anchors,
    extent: EXTENT.fascicle,
    dispose: () => disposeTree(group),
  };
}

/* ---- teardown ------------------------------------------------------------ */

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) m.dispose();
  });
}

/**
 * Outside in. The camera positions are where each level frames well.
 *
 * WHAT MOVES BETWEEN THEM IS THE TISSUE, NOT THE CAMERA. This said "the scene
 * eases between them rather than cutting, so the descent reads as one move",
 * and it does not: `spec.build()` swaps the whole model when the level changes,
 * so there is nothing for a camera to ease BETWEEN. Measured 2026-08-27, the
 * cameras are 0.100 apart from fascicle to fiber — 1.6% of apparent size, a
 * move nobody can see — and 1.517 from fiber to sarcomere. What carries the
 * ladder is the picture: ink over the stage goes 37.8% to 26.8% to 16.8% as the
 * subject narrows from eighteen fibres to seven myofibrils to three sarcomeres.
 * The camera's job here is to frame each one, and it does.
 *
 * All three are near side-on with a little elevation and a little swing off the
 * axis. That is not a style choice — everything here is a bundle of parallel
 * cylinders along X, and viewed down the axis a bundle of cylinders is a
 * circle. The banding only exists side-on. The swing is what stops it going
 * flat, and it is kept small because past about 30 degrees the near filaments
 * start hiding the far ones.
 *
 * `camera` IS NOW A DIRECTION, AND `frame` IS THE JOB. 2026-08-31: "the camera's
 * job here is to frame each one, and it does" was written above and was not
 * true. A perspective `fov` is VERTICAL, so a typed position frames its subject
 * at exactly one window shape and crops it at every other. Measured in a browser
 * at 1280x900, the sarcomere's `[0, 1.3, 3.0]` covered x = ±1.60 while this
 * level's own terminal cisterna sits at x = 3.09 — a third of the subject
 * outside the picture in the scale's resting state, taking the mitochondria and
 * therefore the entire way down to the cell with it (`way-in` measured at
 * x = 1531 in a 1280-wide window).
 *
 * So each level states WHAT MUST BE VISIBLE and `fitCamera.js` works out how far
 * back that is for the window in front of the viewer. The direction above is
 * kept exactly — it is the part that was chosen for a reason.
 *
 * The numbers are the DRAWN object, read out of a live browser on 2026-08-31
 * through `window.__fiberBox()` and rounded outward for the labels:
 *
 *     fascicle   x ±2.72   y ±0.80
 *     fiber      x ±2.50   y ±0.62
 *     sarcomere  x ±3.34   y ±0.60
 *
 * THE FIRST VERSION OF THESE WAS READ OFF THE ANCHORS AND IT CUT THE PICTURE.
 * A level's anchors are where LABELS hang, not where the object is: the
 * sarcomere's run from -1.70 to 3.09, so a frame built from them sat centred at
 * x = +0.7 while the object is symmetric about zero. Screenshotted at 1280x900,
 * the right end was whole and the left end ran off the edge — the same crop as
 * before, moved. What the anchors were good for was the OTHER direction, and
 * `fitCamera.test.js` keeps that: every anchor must be inside its own level's
 * frame, so a label that wanders outside fails a test rather than a screenshot.
 *
 * These are `InstancedMesh` levels whose matrices are written by `update()` on a
 * live reading, so node cannot measure them — `Box3.setFromObject` at build time
 * answers ±0.80 for the sarcomere. The browser is the only instrument, which is
 * why `FiberScene` carries `__fiberBox` next to `__fiberState`.
 */
export const LEVELS = {
  /* WHAT EACH LEVEL IS, IN ONE CLAUSE. Q11, 2026-08-27: the CONTRACTION
     section under these chips has carried a per-mode note since it shipped —
     "Stimuli arrive faster than calcium clears, so twitches fuse" — and SCALE
     had nothing at all, so a viewer met `Fascicle`, `Fiber` and `Sarcomere` as
     three bare words naming the thing they are looking at. Same slot, same
     shape, one section up. Anatomy rather than a reading, so no number and no
     evidence word is involved; the field-of-view line at the foot of the panel
     already carries the measured extent.
     "Thousands in a row" was written first and taken out before it shipped: it
     is a magnitude, and §5's floor is that we do not put a number on screen we
     have not got. "A long row of them" says the same relation and claims no
     count.

     AND THE CLAUSE AFTER IT IS Q18's, WHICH IS ABOUT WHAT DOES NOT CARRY DOWN.
     This scene never reads the muscle a viewer picked — `DevFiberScene` loads
     one scenario, `fiberGeometry` is procedural, and the same sarcomere is drawn
     for all 467 meshes. That is correct science and it sits under a breadcrumb
     reading `push up · left brachioradialis`, one step after a descent card that
     showed a muscle-SPECIFIC number: `span ÷ sarcomere`, whose denominator
     `descentFacts` calls "a standard value, not one of ours".
     So the note says which half is which. Still no count — the row's length is
     the descent's number and it has a permanent home on the pick card — but a
     viewer is told that the picture in front of them is every muscle's and the
     thing that was theirs is how many. */
  fascicle: {
    label: "Fascicle",
    note: "A bundle of fibres, wrapped together inside the muscle.",
    build: buildFascicleLevel,
    /* THE OUTERMOST ANGLE OF A THREE-STEP DESCENT — see the note on `fiber`. */
    /* [2.9, 1.3, 5.9] -> [5.2, 1.5, 4.2] on 2026-09-07 — owner, FIBER 1: *"fascicle에서 저 앵글이 맞나? 막 번들 얘기하는데"*. A bundle reads at its cut end: fibres packed inside a sheath. 64 -> 39 degrees off the long axis, so the end face shows and the length still runs across the frame. */
    camera: [5.2, 1.5, 4.2],
    frame: { centre: [0, 0.06, 0], half: [2.85, 0.94] },
    extent: EXTENT.fascicle,
  },
  /* THE THREE DIRECTIONS ARE A PATH NOW, AND THEY USED TO BE A PAIR AND A HALF.
     Fascicle and fiber were BOTH `[1.3, 1.7, 6.1]`, and the note that stood here
     defended it: they had been 6.0 and 6.1, "0.100 apart, 1.6% of apparent size,
     a move nobody can see", so the copy was made exact and the argument became
     "what separates these two levels is the picture".

     That argument is right about a level SWITCH and wrong about a descent. Every
     level's `frame` is fitted to fill the stage, so all three draw at the same
     apparent size; with the same direction as well, going from a fascicle to a
     fibre was a model swap behind a motionless camera. `fiber.md` §1 asks for
     the opposite — "camera physically enters" — and a camera that does not move
     cannot enter anything.

     So the three are a path. Measured as swing off the axis and elevation above
     it:

         fascicle   swing 26.2 deg   elevation 11.2 deg
         fiber      swing 16.1 deg   elevation 16.8 deg
         sarcomere  swing  0.0 deg   elevation 23.4 deg

     The camera swings round to the axis and rises as it goes in, which is a
     direction of travel a viewer can feel across two swaps. The sarcomere's own
     direction is untouched: it is the main stage and its framing is the one
     thing on this floor nobody has complained about.

     THE 30-DEGREE CEILING STILL HOLDS. The note above these entries says the
     swing "is kept small because past about 30 degrees the near filaments start
     hiding the far ones", and the widest of the three is 26.2. The fascicle is
     also the level with the least to occlude — eighteen fibres and no lattice —
     so it is the right place to spend the angle. */
  fiber: {
    label: "Fiber",
    note: "One muscle cell. It runs the length of the fascicle.",
    build: buildFiberLevel,
    camera: [1.7, 1.85, 5.9],
    frame: { centre: [0, 0.02, 0], half: [2.62, 0.76] },
    extent: EXTENT.fiber,
  },
  sarcomere: {
    label: "Sarcomere",
    note: "The unit that shortens. A fibre is a long row of them — the row is what differs between muscles.",
    build: buildSarcomereLevel,
    /* ALMOST DEAD ON — 2026-09-06, the owner's *"sacromere앵글을 거의 정중앙에서
       바라보게 해"*. This was [0, 1.3, 3.0]: azimuth 0, elevation 23.4 deg, so the
       sarcomere was always seen from above and its lattice read as a pile rather
       than a row. 0.42/3.0 is 8.0 deg — enough that the filaments still have a
       near and a far side and the rig is not a flat elevation drawing, and not
       enough to look down on. The other two levels keep their own angles: the
       owner asked for this one. */
    camera: [0, 0.42, 3.0],
    /* RE-MEASURED 2026-08-31 after `SARC_COUNT` went to two — `window.__fiberBox()`
       sampled in a browser at 1280x900 over a whole run — 216 readings across 26 s
       — as x -2.283..2.249, y -0.579..0.605, and this is that rounded outward.

       SAMPLED OVER THE RUN, NOT AT AN INSTANT, and the first version of this line
       was the instant. One reading three seconds in said x ±2.03, so the frame
       went to 2.1 and the picture CROPPED: the sarcomere lengthens past its
       resting 2.2 µm during the run, and at full length the terminal cisterna and
       the way in were cut off by the right edge, screenshotted. A frame is what
       must be visible for the whole time it is on screen; measuring it once is
       measuring the wrong thing, and it happens to look right until the animation
       reaches its extreme.

       It cannot be computed here either: these levels are `InstancedMesh` and
       their matrices are written by `update()` on a live reading, so
       `Box3.setFromObject` at build time sees the base geometry at the origin.
       `fitCamera.js` carries the long form. And it has to hold the LABELS, which
       reach past the mesh on one axis — the cisterna's anchor is x = 1.99,
       y = 0.565. */
    frame: { centre: [0, 0.02, 0], half: [2.32, 0.66] },
    extent: EXTENT.sarcomere,
  },
};

export const LEVEL_ORDER = ["fascicle", "fiber", "sarcomere"];
