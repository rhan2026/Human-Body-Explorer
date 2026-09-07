/**
 * The one place the anatomy scenes agree on how they look.
 *
 * These values are not new. They are lifted from the two scenes that already
 * shipped — PushUpScene.jsx and App.jsx — so a new scene can be built without
 * re-picking a background, a light rig or a roughness by eye and drifting a
 * shade off. Anything added at a smaller biological scale (filaments, calcium,
 * organelles) is derived from the same warm-tissue family rather than chosen
 * fresh, because the whole point of BODY → MUSCLE → FIBER → CELL is that it
 * reads as one continuous descent and not four different pieces of software.
 *
 * Where the two existing scenes disagree, both numbers are kept and named. The
 * explorer lights a still, cut-away body a little harder than the push-up
 * lights a moving one; neither is wrong.
 */

import * as THREE from "three";

/* ---- stage --------------------------------------------------------------- */

export const SCENE = {
  /** press.css .press background. The stage is paper, not a void. */
  background: "#faf8f5",
  backgroundDark: "#17161a",

  /** PushUpScene's floor grid. Faint enough to give scale and nothing else. */
  grid: { size: 4, divisions: 20, colour: "#c9c2ba", subColour: "#e2ddd6" },

  /**
   * Perspective, never orthographic — the body scenes both use it, and at the
   * fiber scale it is what stops a bundle of parallel cylinders reading flat.
   * fov 38 is the push-up's; the explorer uses 32 on a standing figure.
   */
  camera: { fov: 38, fovExplorer: 32, near: 0.01, far: 100 },

  gl: { antialias: true, alpha: true },
  dpr: [1, 1.75],
};

/**
 * Three lights, no shadow maps, no environment, no post-processing.
 *
 * The look is a lit medical illustration rather than a photograph: a high
 * ambient floor so nothing goes black, one strong key from front-right-above,
 * and a weak back-left fill so the far side of a cylinder still has form. The
 * absence of shadows is deliberate and worth preserving — cast shadows between
 * overlapping translucent layers read as dirt.
 *
 * AND THE PREMISE HAS A COUNT NOW, taken 2026-08-27 because a design audit
 * asked whether it still held after two rounds had raised opacities elsewhere.
 * It holds harder than the sentence above claims: of the meshes the body scale
 * draws, only the ones with a role in the current exercise are opaque — 70 of
 * 668 for the push-up, 54 of 674 for the bench press, 50 of 671 for the pull-up,
 * 52 of 668 for the lunge. **Between 7.5% and 10.5%.** The other nine tenths are
 * `IDLE_COLOUR` at opacity 0.3 with no depth write, which is what makes the
 * trunk read as a wash and the movers read as movers. A shadow map over that is
 * six hundred faint surfaces casting onto each other.
 * The form does not need them: photographed at the bottom of a push-up, the
 * skull, the ribcage, the deltoid and the forearm all separate on the key/fill
 * gradient alone.
 */
export const LIGHTS = {
  ambient: 1.15,
  ambientExplorer: 1.35,
  key: { position: [3, 5, 4], intensity: 2.5 },
  fill: { position: [-4, 2, -2], intensity: 1.0 },
};

/**
 * The shadow rig, and why it stands beside a comment that says "no shadow maps".
 *
 * ── WHO ACTUALLY USES IT, 2026-09-05, AND IT IS NOT WHAT THIS HEADER SAID ────
 *
 * This opened "the rig the two DEEP scales use". Counted: `src/cell` and
 * `src/signalling` set `castShadow` and `receiveShadow` **zero times between
 * them**. Neither has ever drawn a shadow pixel. The numbers below were fitted
 * for them, the argument below is written about them, and they declined it —
 * so for a day the one file that is supposed to be where the scenes agree was
 * asserting a use that did not exist.
 *
 * IT IS DECLINED WITH REASONS, NOT FORGOTTEN, which is why nothing here is
 * deleted. `SignallingScale.jsx` graded it from screenshots on 2026-09-01 and
 * carries the finding: *"These scenes have no ground: a drawn cell floats in
 * paper, so every shadow fell on the backdrop … each of the eight or twelve
 * objects grew a grey twin down and to its left. Not a contact cue — a
 * duplicate."* The rig needs a floor and those scenes have none.
 *
 * SO THE LIVE USERS ARE FIBER AND, SINCE 2026-09-05, THE BODY — which is the
 * reversal worth recording. The rule below says the body must NOT have shadows
 * and gives a count for it, and that count is still right about the six hundred
 * translucent sheets. The BODY lane got the picture anyway by casting only from
 * what is already opaque (`opaqueEnough`, the same threshold the fibre uses) and
 * catching on a `ShadowMaterial` plane rather than on the grid, which is lines
 * and cannot receive. Fifty to seventy opaque meshes casting is the fibre's
 * situation, not the body's old one.
 *
 * `ContactShadows` WAS TRIED FIRST AND DRAWS NOTHING HERE. Measured on the body:
 * the floor band averaged 237.9 with it against 238.6 without, at opacity 1 and
 * blur 0.1 — and it still cost 58 fps down to 50. A scene that is nine tenths
 * transparent has no depth for it to sample. The real map is both cheaper and
 * visible: 60.1 fps, floor-band min 160 → 64.
 *
 * THE "NO SHADOWS" RULE IS ABOUT THE BODY AND IT IS STILL RIGHT THERE. Its own
 * counted reason is above: 668 meshes of which fifty to seventy are opaque, so a
 * shadow map at the body scale is six hundred faint surfaces casting onto each
 * other. `MuscleFiberVisualization.jsx` already made the argument that the count
 * is what decides it, and turned shadows on for the fibre — eleven meshes, all
 * but three opaque.
 * Counted the same way on 2026-08-31: the cell chain draws 28 opaque meshes and
 * 16 translucent ones, and the signalling network 109 opaque and 46 translucent.
 * The translucent ones are one cell wrapper, one membrane, one background crowd
 * and the link arrows — not six hundred sheets of skin. That is the fibre's
 * situation with a different mesh count, not the body's.
 *
 * WHAT IT BUYS, WHICH IS THE WHOLE REASON THIS EXISTS. Both deep scenes are
 * near-flat sheets of objects seen face-on down a perspective camera that has
 * nothing to do. Every part is lit identically, so nothing occludes and nothing
 * sits in front of anything: read off a screenshot, they could be SVG. A cast
 * shadow is the one cue that survives a dead-on camera — the offset between a
 * form and its own shadow on the wall behind is proportional to how far off that
 * wall the form stands, so a viewer reads depth from a still frame without
 * orbiting and without a caption.
 *
 * `radius` IS WHY THIS IS PCF AND NOT PCF-SOFT. R3F's bare `shadows` selects
 * `PCFSoftShadowMap`, which ignores `radius`; these scenes want a soft, drawn
 * shadow rather than a photographic one, so they blur with the radius instead of
 * chasing a hard edge.
 *
 * THE MAP IS SIZED BY TEXELS PER FORM, NOT BY WHAT LOOKS LIKE ENOUGH, and the
 * first version of this got it wrong by a factor of two in each direction. It
 * was 1024 over a half-frustum of 3.4 — 6.8 world units across 1024 texels, so
 * one texel is 0.0066. The fibre's own rig is 2048 over 6, which is 0.0029, and
 * it is shading CYLINDERS about 0.1 across: 34 texels each. These scenes draw
 * lobes 0.04 to 0.08 across. At 0.0066 that is six to twelve texels per lobe,
 * which is not a shadow, it is a staircase — and every one of those lobes was
 * also set to RECEIVE, so the staircase would have landed on the subject as
 * self-shadow acne rather than on the ground where it is wanted.
 * Two changes, both measured against the fibre rather than tuned by eye. The
 * frustum is 2.6, which is the radius of the bigger of the two scenes' bounding
 * spheres with a little to spare; at 2048 that is 0.0025 per texel, slightly
 * finer than the fibre's. And the receive rule is inverted from the fibre's —
 * see below.
 *
 * `normalBias` DOES THE WORK `bias` USED TO. A constant depth bias big enough to
 * stop acne on a sphere is big enough to detach the shadow from its own object;
 * offsetting along the surface normal instead scales with how glancing the light
 * is, which is exactly where acne comes from. So `bias` drops back to the
 * fibre's order of magnitude and `normalBias` carries a texel and a half.
 *
 * WHAT ONLY RECEIVES IS THE OPPOSITE OF WHAT CASTS, which is not what the fibre
 * does — it sets `receiveShadow` on everything and gates only `castShadow`. That
 * is right for a bundle of big overlapping cylinders, where one fibre's shadow
 * falling on the next is most of the effect. It is wrong here: nothing these two
 * scenes draw is big enough to carry a legible shadow on its own surface, and
 * every one of them stands clear of its neighbours, so a form receiving is all
 * cost and no picture. The forms cast, and the ground, the cell wrapper and the
 * membrane catch it — one opacity threshold read in both directions.
 */
export const SHADOW = {
  mapSize: [2048, 2048],
  radius: 4,
  bias: -0.0004,
  normalBias: 0.02,
  /**
   * Half-width of the projector's orthographic frustum, in world units.
   *
   * SIZED TO THE CASTERS AND TO WHERE THEIR SHADOWS LAND, not to the scene — an
   * earlier line here claimed it was "the bounding-sphere radius of the larger
   * deep scene" and that is simply false: the signalling scene's box reaches
   * 4.02 from the origin once its background crowd is counted. Nothing out there
   * casts (the crowd is at 0.62 opacity, under `opaqueEnough`) and nothing out
   * there catches (a shadow map is unshadowed outside its frustum, and no shadow
   * reaches that far anyway). What must be inside is the twelve forms, at 1.96,
   * and the ground under them. 2.6 covers both with room, and every unit of it
   * is spent on texels: 5.2 across 2048 is 0.0025, against the fibre's 0.0029.
   */
  frustum: 2.6,
  near: 0.1,
  far: 22,
  /** Above this opacity a mesh casts; at or below it, a mesh receives. One
      number, read in both directions, so the two rules cannot drift apart. */
  opaqueEnough: 0.8,

  /**
   * WHERE THE SHADOW IS THROWN FROM, WHICH IS NOT WHERE THE SCENE IS LIT FROM.
   *
   * This started as `castShadow` on the key and the key's own angle is the
   * reason it could not stay there. `LIGHTS.key` is at [3, 5, 4], so per unit of
   * gap between a form and the ground it throws 0.75 across and **1.25 down** —
   * an angle chosen for how it MODELS a surface, on a body scale, where nothing
   * ever catches a shadow. Measured against the cell chain's own dome: the eight
   * forms threw 0.45 to 1.00 down, and one row of that drawing is 0.44. So every
   * form got a displaced twin one to two and a half rows below itself, and a
   * screen whose whole subject is a causal chain read top to bottom would have
   * been drawing eight extra marks in the gaps between its steps.
   *
   * Nearly head-on instead: 0.18 across and 0.30 down per unit of gap, which
   * puts the same eight throws at 0.11 to 0.24 — a quarter to a half of one row.
   * The shadow stays under its own form, and the only thing that varies is how
   * far it has slipped, which is exactly and only the depth cue this is for.
   * It is also what a drawn drop shadow does: illustration puts the shadow light
   * in front of the picture and the modelling light off to one side, because the
   * two are answering different questions.
   *
   * INTENSITY 0, AND IT IS NOT A TRICK THAT MIGHT STOP WORKING. Checked in the
   * installed three (0.185.1) rather than assumed: `WebGLLights.setup` files a
   * light's shadow uniforms under `if (light.castShadow)` with no reference to
   * intensity, `WebGLShadowMap.render` skips only lights with no `shadow` at
   * all, and `ShadowMaterial`'s fragment shader is
   * `opacity * (1 - getShadowMask())` — `getShadowMask` reads the shadow map and
   * never the light's colour or intensity. So this projects and does not light,
   * which is the whole requirement: the two deep scenes were lit by eye against
   * what they draw and a depth pass has no business changing that.
   *
   * WHAT IT COSTS: only a `ShadowMaterial` can show it. A standard material's
   * shadow darkens THAT light's contribution, and this one contributes nothing,
   * so the cell wrapper and the membrane catch nothing however they are flagged.
   * The ground is the receiver that matters and the ground is a `ShadowMaterial`.
   * The receive flag stays on the wrappers anyway — it is one arm of a rule that
   * reads a single threshold in both directions, and it is right the day anyone
   * gives this thing an intensity.
   */
  projector: [1.1, 1.8, 6],
  /**
   * How dark a shadow lands on the catcher plane.
   *
   * A `ShadowMaterial` DRAWS NOTHING BUT THE SHADOW, which is what makes a
   * catcher safe here: the stage is `#faf8f5` paper painted by CSS under a
   * transparent canvas (`.fiber__stage`), and an opaque back wall in that colour
   * would have to be repainted for a theme it cannot see. This one has no colour
   * of its own to get wrong — it darkens whatever the page is showing.
   */
  catcher: 0.17,
};

export const CONTROLS = {
  enableDamping: true,
  dampingFactor: 0.08,
};

/**
 * How far off the back wall a thing drawn inside a cell stands.
 *
 * BOTH DEEP SCALES DRAW A DIAGRAM ON A GRID, and a grid is a plane. `row` and
 * `col` are honest — they are the cascade's own order and its two arms — but z
 * was left at exactly 0 for every node on both screens, which is the reason the
 * owner's verdict on them was *"처참해"* while the fibre one step up was
 * *"꽤 3d같아"*: the fibre is a bundle of volumes that overlap in depth, and
 * these two were flat sheets photographed square-on.
 *
 * THE Z IS NOT DATA AND MUST NOT LOOK LIKE IT. Neither archive ships a
 * coordinate — `heroForms.js` and `cellChain.js` both say so at length, and
 * `signallingBinding.js` argues that a placement we invented is anatomy we made
 * up. So this deliberately carries NO information: it is a function of where a
 * node already sits, it is the same function on both scales, and no readout
 * anywhere reads it. What it states is the one spatial fact both models do
 * support — these things are inside a cell, and a cell is round, so the ones in
 * the middle of the picture are nearer the viewer than the ones out at the rim.
 *
 * WHY A DOME AND NOT A TILT. A tilted plane is still a plane: every node keeps
 * exactly one neighbour in front and one behind, and orbiting it just yaws a
 * flat sheet. A cap curves, so the near-far order changes as the camera moves
 * and the arrows between rows are foreshortened by different amounts. It is also
 * the shape the cell wrapper is already drawn as, which is the argument for it
 * being this and not a wave or a spiral.
 *
 * WHAT IT COSTS A LABEL, AND WHERE — because `Gizmos` places a 2D plate by
 * projecting its anchor, so every millimetre of z moves that plate on screen,
 * outward, along its radius from the centre.
 *
 * THE FIRST VERSION OF THIS PARAGRAPH GUESSED AND GUESSED WRONG. It read "outer
 * nodes barely move, which is the property that made it safe: the plates most at
 * risk of leaving the canvas are the ones furthest out, and those are exactly
 * the ones this returns ~0 for." Half of that is true and the conclusion does
 * not follow. The drift is the PRODUCT of the radius a projection is pushed
 * along and the z pushing it, and this function makes z fall as radius rises —
 * so the product is small at both ends and peaks on a ring in between. Measured
 * on the shipped constellations at 1175x758: the cell's dead-centre node moves
 * 7.0 px and its corner nodes 19–23 px, while the mid-ring — ADP, CaMKK2, RhoA,
 * AMPK — moves 38. The most exposed plate is neither the one with the most depth
 * nor the one furthest out.
 * Which is why the ceiling is a gate and not a paragraph: `gizmoLayout.test.js`
 * fails if any anchor on either scale drifts past 8 % of the stage's height, and
 * both ship at 5.1 %. That gate went red at `rise` 1.2, so there is about 1.6x
 * of headroom in it and no more.
 *
 * @param x,y     where the node already sits
 * @param half    [halfWidth, halfHeight] of the drawing it sits in
 * @param rise    how far the middle of the cap stands off the rim
 */
export function domeZ(x, y, half, rise) {
  const u = x / (half[0] || 1);
  const v = y / (half[1] || 1);
  return rise * (1 - Math.min(1, u * u + v * v));
}

/* ---- surface ------------------------------------------------------------- */

/**
 * Everything is dielectric. Not one surface in the anatomy set is metallic, and
 * a metallic filament would read as machinery.
 */
/**
 * SOMETHING FOR THE SURFACES TO REFLECT.
 *
 * WHY THIS EXISTS. An audit of the three scales on 2026-09-01 found no
 * environment map anywhere in the app — no `Environment`, no PMREM, no
 * `scene.environment`, zero hits. With `SURFACE.metalness` at 0 that makes
 * `RE_IndirectSpecular` exactly zero: every highlight on every scale comes from
 * two directional lobes at F0 0.04, which is why every form reads as matte
 * clay. The signalling scale's own forms are already at roughness 0.34 — a lobe
 * tight enough to show a highlight — and had nothing to put in it.
 *
 * LOW MEAN, HIGH PEAK, AND THAT IS THE WHOLE DESIGN. An earlier attempt at this
 * built a bright room and paid for the added irradiance by dropping
 * `LIGHTS.ambient` from 1.15 to 0.40 across all four scenes — a large shared
 * change to the one scale that already looks right. This one does not need to:
 * the room is DIM on average, so the diffuse irradiance it adds is small enough
 * to ignore, and its two small patches are bright, so a tight lobe catches a
 * real highlight. Exposure is unchanged and the fibre scale is untouched.
 *
 * GENERATED, NOT LOADED. This app ships under a strict CSP and runs offline,
 * so there is no HDR to fetch — 64x32 of half-float written here, run through
 * `PMREMGenerator` by whoever owns a renderer.
 */
export const ENVIRONMENT = {
  /** Sky and ground, in linear radiance. Both dim; this is not the lighting. */
  /* MEASURED, NOT PICKED. A solid-angle-weighted sweep of this generator: these
     values put the room's mean radiance at 0.0358, so the diffuse irradiance it
     adds is 9.8% of `LIGHTS.ambient` — small enough that exposure does not move
     and no scale needs its lamps re-balanced — while the peak is 235x the mean,
     which is what a roughness-0.34 lobe turns into a highlight. The first cut
     was 0.34/0.12 and added 47.7%: that is a second ambient light wearing a
     reflection's clothes, and it would have flattened what it was meant to
     model. */
  sky: 0.02,
  ground: 0.008,
  /** Small and bright, so a narrow lobe has something to find. Elevations are
      load-bearing and azimuths are not: both are above the horizon, so no
      highlight can land under a form however the shader decodes the wrap. */
  patches: [
    { dir: [0.35, 0.86, 0.37], radius: 0.20, gain: 9.5 },
    { dir: [-0.55, 0.62, -0.56], radius: 0.30, gain: 2.6 },
  ],
};

/** The generated room as an equirectangular half-float texture. */
export function environmentSource(THREE) {
  const W = 64;
  const H = 32;
  const data = new Uint16Array(W * H * 4);
  const patches = ENVIRONMENT.patches.map((p) => {
    const [x, y, z] = p.dir;
    const n = Math.hypot(x, y, z) || 1;
    return { ...p, dir: [x / n, y / n, z / n] };
  });
  for (let j = 0; j < H; j += 1) {
    /* v runs top to bottom, so theta 0 is up. */
    const theta = ((j + 0.5) / H) * Math.PI;
    for (let i = 0; i < W; i += 1) {
      const phi = ((i + 0.5) / W) * Math.PI * 2;
      const dy = Math.cos(theta);
      const dx = Math.sin(theta) * Math.cos(phi);
      const dz = Math.sin(theta) * Math.sin(phi);
      /* The horizon is where sky meets the paper's own bounce. */
      let v = dy >= 0
        ? ENVIRONMENT.ground + (ENVIRONMENT.sky - ENVIRONMENT.ground) * dy
        : ENVIRONMENT.ground * (1 + dy * 0.55);
      for (const p of patches) {
        const cos = dx * p.dir[0] + dy * p.dir[1] + dz * p.dir[2];
        const ang = Math.acos(Math.max(-1, Math.min(1, cos)));
        if (ang < p.radius) {
          const t = 1 - ang / p.radius;
          v += p.gain * t * t;
        }
      }
      const o = (j * W + i) * 4;
      data[o] = THREE.DataUtils.toHalfFloat(v);
      data[o + 1] = THREE.DataUtils.toHalfFloat(v);
      data[o + 2] = THREE.DataUtils.toHalfFloat(v * 0.985);
      data[o + 3] = THREE.DataUtils.toHalfFloat(1);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export const SURFACE = {
  metalness: 0,
  /** PushUpScene's animated muscle. */
  roughness: 0.62,
  /** App.jsx's static cut-away layers, very slightly duller. */
  roughnessStatic: 0.72,
  /** Membranes and sheaths, a touch glossier so a thin film reads as wet. */
  roughnessMembrane: 0.45,
  /* A LOBE TIGHT ENOUGH TO CATCH THE ROOM. The signalling forms already chose
     0.34 for themselves; the cell's were drawing at `roughnessStatic` 0.72,
     where a 4% Fresnel reflection is spread over most of the hemisphere and no
     highlight can exist. Named here so both deep scales ask for the same thing
     and neither reaches into the other's file for it. */
  roughnessForm: 0.34,
};

/**
 * Opacity tiers, carried over verbatim.
 *
 * 0.18 is the body shell in App.jsx and 0.12 is the fascicle sheath already
 * baked into muscle-fiber.glb, so a sheath at the micro scale sits at the same
 * weight as skin at the body scale. Both are low for the same reason: a
 * translucent wrapper has to stop reading as fog over the thing inside it.
 */
export const OPACITY = {
  sheath: 0.12,
  membrane: 0.18,
  inactive: 0.3,
  secondary: 0.55,
  solid: 1,
};

/* ---- colour -------------------------------------------------------------- */

/**
 * One warm tissue family, one cool accent, one neutral.
 *
 * THE APP HAS TWO COLOUR LANGUAGES, and picking the right one matters more than
 * any single hue below.
 *
 *   Identity — App.jsx paints each muscle by its group, from the saturated
 *   categorical palette in muscle-map.json (chest #e8776b, core #dcc75a,
 *   forearms #9b7ede...). Hue answers "which muscle is this".
 *
 *   Activation — PushUpScene.jsx ignores group entirely and sweeps every muscle
 *   along one ramp, rest #8c5f5a to peak #ff4a2b, by how hard it is working.
 *   Hue answers "is this loaded right now".
 *
 * The fiber scene is about one muscle's interior over time, so there is nothing
 * to tell apart by identity and everything to tell apart by load: it follows the
 * activation language. Structure is stated in desaturated warm tones read by
 * value rather than hue, and actin and myosin are separated by lightness inside
 * the same red rather than by inventing a second hue. If a later view needs to
 * distinguish fiber TYPES (I vs IIa vs IIx), that is an identity question and
 * should borrow the group palette instead.
 *
 * Calcium is the single exception and the single cool colour in the system. It
 * is a signal rather than a structure, it has to be findable in one glance
 * against warm tissue, and complementary-but-desaturated does that without
 * reaching for the glowing cyan the legacy muscle-fiber.glb uses.
 */
export const PALETTE = {
  /* body scale — PushUpScene.jsx */
  tissueRest: "#8c5f5a",
  tissueIdle: "#9a7a74",
  tissuePeak: "#ff4a2b",
  bone: "#e8e2d8",
  skin: "#e3d6cc",

  /* fiber scale — same family, separated by value */
  perimysium: "#7d4a48",
  sarcolemma: "#8a5350",
  myofibril: "#96605a",
  mitochondrion: "#c98a5c",
  nucleus: "#7f6f86",
  reticulum: "#b98f83",

  /* SARCOMERE SCALE — SEPARATED BY HUE, AND IT USED TO BE BY VALUE ALONE.
     The line here read "lightest to darkest is thin, thick, structural", and
     that is still true INSIDE each family. What changed on 2026-08-30 is that
     the families stopped sharing one hue, because the owner could not read the
     picture — "뭐가 뭔지 잘 안보여" — and the measurement said why.

     Nine parts sat a mean of dE 22.0 apart with the closest pair, `mLine` and
     `zDisc`, at 4.6 — when 2.3 is the just-noticeable step. And value is the one
     channel a lit 3D scene spends: under the scene's three lights one albedo
     moves L* 25-33 between the face turned to the key and the face turned away,
     so a `myosin` rod's lit side (L* 78) came out lighter than an `actin` rod's
     shadow (L* 75). A palette separated by value alone is a palette the
     lighting erases.

     So the structural parts — the Z-disc, the M-line, the titin spring — take a
     cool violet and the filaments keep the warm family. Three strata a viewer
     can name before reading a word: warm rods that pull, cool discs that bound
     and anchor, and one ring whose colour is a reading rather than a name.
     Mean dE 22.0 -> 38.4; closest pair 4.6 -> 6.3, and that pair is
     `tropomyosin`/`troponin`, which lie on the same filament and SHOULD be
     close.

     WHAT IS NOT REPAINTED: `reticulum`. The cisterna's colour is a READING — it
     lerps toward `calcium` as the store fills — so its hue is the store's level
     and cannot also be its identity. A fixed cool hue there would have
     shortened exactly the swing the fatigue story is told with. */
  /* THE FIVE WARM ONES ARE BACK WHERE THEY WERE, 2026-08-30.

     Eight of ten moved in one pass and only three of them were fixing
     anything. `zDisc` and `mLine` measured ΔE 4.6 apart — a sixth of the floor
     this project set itself — so two different parts were effectively one
     colour, and the purples below fix that and stay.

     The other five were pushed lighter and more saturated with no defect to
     answer: measured, reverting them leaves the mean at 28.5 and the closest
     pair at crossBridge/myosin 5.4, which is a rod and its own head and is
     SUPPOSED to be close. What the push cost is the thing the palette was
     written for — lit medical illustration — and the lane that made it said so
     itself in the same report: it read as machine parts. On screen the thick
     filament had gone from tissue to a rubber hose.

     Reverted at the owner's word after being shown both. */
  actin: "#cda58c",
  myosin: "#8f544c",
  /* A HEAD BELONGS TO THE THICK FILAMENT AND WAS COLOURED WITH THE THIN ONE'S
     REGULATORY PROTEINS. Measured: #a4625a was ΔRGB 16 from troponin and 27 from
     tropomyosin — three different mechanisms, one rivet. A head is part of the
     THICK filament, so it sits with myosin and not with the thin filament's
     regulators. The repaint above does not touch that ruling and the same test
     still holds it: 18.4 of value from `myosin` against 35.1 from `troponin`,
     and dRGB 63 and 47 from the two regulators against a floor of 30. */
  crossBridge: "#9d5b4f",
  zDisc: "#4a4258",
  mLine: "#6f6483",
  titin: "#8d80a0",

  /* the regulatory apparatus. Tropomyosin sits between actin and myosin in
     value so it reads as lying on the thin filament rather than being part of
     it. Troponin is given its own entry because it does not keep this colour —
     it is the calcium sensor, and it lerps toward PALETTE.calcium as calcium
     binds, which is the one place the cool accent means a bond rather than an
     ion in transit. */
  tropomyosin: "#9a7057",
  troponin: "#a06a5e",

  /* PHOSPHATE — THE ONE PART OF THIS SCENE THAT IS NOT A PART.
     Added 2026-09-05 for the fibre floor's ending. Everything else in this
     block is a structure that is always there and changes how it looks;
     phosphate is a QUANTITY that accumulates and is not there at the start, so
     it is drawn as particles rather than given a handle. `Pi_myo_total` has
     shipped in every fibre scenario since the first one and nothing had ever
     read it: 1504.5 -> 7492.0 µM on `soce_on`, 4.07x across the ten
     repetitions, the largest swing on the floor and no channel at all.

     DESATURATED ON PURPOSE, and measured. It has to read as waste next to nine
     things that read as machinery, and it must not be mistaken for calcium
     (#5b7f96) which is the other small moving thing in the same space. Nearest
     neighbour by dE76 is `tropomyosin` at 19.5 and `reticulum` at 19.8, against
     this palette's own closest legitimate pair of 6.3 — so it is three times
     clear of the floor while sitting at L* 50.6, dark enough to be seen
     collecting against the paper and dull enough not to compete with anything
     that pulls.

     ADDITIVE ONLY. No other floor reads this key; the cell scale draws its
     phosphates as beads on the nucleotide forms and has its own tints. */
  phosphate: "#7d786e",

  /* ATP — THE MOLECULE THIS FLOOR HANDS THE NEXT ONE.
     Added 2026-09-05 at the owner's word, and it is the same orange the ENERGY
     floor draws its ATP in (`cellChainGeometry.js:375`, `wet("#c07b3f")`). That
     is the whole point of it being here: the fibre's closing beat spends one,
     the next floor's whole question is where it came from, and meeting the same
     molecule in the same colour one scale down is half of what makes that a
     bridge rather than a link. Calcium already works this way — one
     `PALETTE.calcium` read by both floors — and this is the second such pair.
     THERE IS NO `adp` KEY AND THERE SHOULD NOT BE. What separates ATP from ADP
     is the number of phosphates on it, not its colour: `cellForms.js` puts it
     exactly — "the count IS the name, it is the whole of what changes". So the
     molecule keeps this orange and loses a bead. A second hex would say the
     thing the bead already says, and say it differently in two places. */
  atp: "#c07b3f",

  /* the one cool accent */
  calcium: "#5b7f96",
};

/** Selection, matching the explorer's blue UI accent rather than the tissue. */
export const HIGHLIGHT = {
  colour: "#2f6fd0",
  emissiveIntensity: 0.7,
  hoverEmissiveIntensity: 0.28,
};

const _rest = new THREE.Color(PALETTE.tissueRest);
const _peak = new THREE.Color(PALETTE.tissuePeak);

/**
 * Load 0..1 to the colour a working muscle shows, straight out of PushUpScene's
 * frame loop. Kept here so the fiber scene brightens on exactly the same ramp
 * as the body it came from.
 */
export function activationColour(load, target = new THREE.Color()) {
  return target.copy(_rest).lerp(_peak, THREE.MathUtils.clamp(load, 0, 1));
}

/**
 * Squared rather than linear on purpose: it keeps a lightly loaded muscle
 * visibly dim so the glow means "working hard", not merely "involved".
 */
export function activationEmissive(load) {
  const l = THREE.MathUtils.clamp(load, 0, 1);
  return l * l * 0.9;
}

/* ---- materials ----------------------------------------------------------- */

/**
 * The only material constructor the anatomy scenes use.
 *
 * depthWrite follows App.jsx's rule — anything at or below half opacity stops
 * writing depth — which is what separates a translucent sheath you can see
 * through from one that punches a hole in everything behind it.
 */
export function anatomyMaterial({
  colour,
  opacity = OPACITY.solid,
  roughness = SURFACE.roughness,
  emissive = null,
  emissiveIntensity = 0,
  side = THREE.FrontSide,
  /* HOW HARD THIS SURFACE LOOKS AT THE ROOM. Default 1 is the physical answer
     and the right one for bulk tissue. A form that is meant to read as a small
     wet object asks for more: at `metalness` 0 the Fresnel base is 0.04, so a
     highlight is about a tenth of the surface's brightness however bright the
     room is, and the only honest lever that does not touch the lamps or make
     these things metal is to let the small forms weigh the room more heavily
     than the walls do. */
  envMapIntensity = 1,
  depthWrite,
} = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colour),
    roughness,
    envMapIntensity,
    metalness: SURFACE.metalness,
    side,
  });
  material.transparent = opacity < 1;
  material.opacity = opacity;

  /* A double-sided skin that does not write depth blends against its own far
     wall, and it does it in triangle-index order rather than in depth order, so
     the surface tiles wherever the fragment count or the order changes. That is
     a real look — it is what a sheath you are meant to see through is made of —
     but it has to be CHOSEN. Inheriting it from an opacity number is how the
     fibre's T-tubule got it: 0.5 is not `> 0.5`, so the tube quietly stopped
     writing depth and rendered as a stack of stubby tiles while the cisterna
     beside it, same torus, same lights, opacity 0.85, stayed smooth. Ask by
     name and this is a decision; leave it out and it is an accident. */
  if (side === THREE.DoubleSide && depthWrite === undefined && !(opacity > 0.5)) {
    throw new Error(
      `anatomyMaterial: a DoubleSide surface at opacity ${opacity} inherits depthWrite:false and blends ` +
        `against its own far wall. Pass depthWrite explicitly if that is what you want (sheathMaterial ` +
        `does), or draw it FrontSide.`,
    );
  }
  material.depthWrite = depthWrite ?? opacity > 0.5;
  if (emissive) {
    material.emissive = new THREE.Color(emissive);
    material.emissiveIntensity = emissiveIntensity;
  }
  return material;
}

/**
 * A wrapper you are meant to see through: double sided so the far wall of the
 * tube still shades, and never writing depth.
 */
export function sheathMaterial({ colour, opacity = OPACITY.sheath } = {}) {
  return anatomyMaterial({
    colour,
    opacity,
    roughness: SURFACE.roughnessMembrane,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/**
 * Calcium. Emissive because it is a signal and has to be findable, but at a
 * strength chosen against the body scene's activation glow rather than against
 * the legacy asset's 2.5 — at 2.5 it blows out and the scene stops being an
 * anatomy illustration.
 */
export function calciumMaterial(intensity = 0.55) {
  return anatomyMaterial({
    colour: PALETTE.calcium,
    roughness: 0.34,
    emissive: PALETTE.calcium,
    emissiveIntensity: intensity,
  });
}

/* ---- labels -------------------------------------------------------------- */

/**
 * Label typography, matching styles.css `.label` so a callout in the viewport
 * and a heading in the side panel are recognisably the same system.
 */
export const LABEL = {
  eyebrow: {
    fontSize: 10,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  body: { fontSize: 12 },
  note: { fontSize: 11 },
};
