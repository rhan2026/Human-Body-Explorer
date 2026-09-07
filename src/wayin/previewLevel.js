import * as THREE from "three";
import { LIGHTS } from "../anatomyStyle.js";
import { environmentSource, PALETTE, SCENE } from "../anatomyStyle.js";

/** Air around the destination's own bounding sphere in the coin. 1.0 would put
    the widest point exactly on the edge; 1.06 leaves a hairline so nothing is
    cut by the circular mask. Owner, 2026-09-06: *"mini 3d더 확대되게 해주고
    (inside the frame)"* — bigger, and inside. */
/* 1.06 -> 0.74 ON 2026-09-06, MEASURED RATHER THAN CHOSEN. Fitting the whole
   bounding sphere inside the square render sounds right and is not what the
   viewer sees: the render is square, the mask is a circle, and both destinations
   carry a background field — signalling's constellation of 108 undrawn
   components, the cell's cytosol — that reaches far past the subject. So the
   sphere was mostly background, and the network drew at about 45 % of the coin.
   Under 1 the outermost background falls outside the mask, which is where it
   belongs: it is the thing that says "there is more behind this", not the thing
   the coin is a picture of.
   0.74 -> 0.55 ON 2026-09-06: *"그 각각의 3d preview안에서 다음 스테이지의 핵심이
   더 zoom 되어 있었으면 좋겠어 지금은 too far out"*. The signalling network also
   grew wider in its own pass, which pushed its bounding sphere out again — so the
   number had to come down twice over, once for the owner and once for the floor. */
/* 0.62 -> 0.45 and the gains x1.3 on 2026-09-07 — owner, item 3: *"go inside누를 때
   3d preview가 더 줌인되고 더 밝게"*. Measured in the disc before/after, see the
   pass list. */
const PREVIEW_MARGIN = 0.45;

/** How much room a named part needs around its anchor point, in world units.
    Both destinations draw their largest single form at well under this; it is
    the same order as `FORM_R` on signalling and the AMPK trimer on the cell. */
const PART_REACH = 0.18;

/** How much the coin turns the destination's own lamps up. See `rig`. */
/* x1 ON 2026-09-07 — owner: *"더 밝은게 아니라 그대로 보여줘 … 뭔가 컬러 렌즈를
   너가 해둔거 같았어"*. The gains were 2.8/1.6/1.15/1.25 and then x1.3 on top, so the
   coin's sarcomere sat under three times the floor's ambient and read as a tinted,
   flattened copy of the thing it promised. The coin now uses the floor's own lamp
   values, untouched: what is down there, as it is, closer. */
const PREVIEW_GAIN = Object.freeze({ ambient: 1, ambientFloor: 0, key: 1, fill: 1 });

/**
 * A still of the next scale, rendered by the scale you are standing on.
 *
 * WHY A RENDER TARGET AND NOT A SECOND CANVAS. A second `<Canvas>` is a second
 * WebGL context, and a phone gives you a small number of those before it starts
 * evicting the one you were using. It would also be caught by `styles.css`'s
 * `[data-crossing] canvas`, which matches every canvas on the page and would
 * play the crossing keyframe on a preview the size of a coin. One context, one
 * extra `gl.render()` per frame while an entrance is open, and zero when it is
 * closed.
 *
 * WHY IT IS HONEST BY CONSTRUCTION RATHER THAN BY PROMISE. Three rules, and
 * none of them is a thing anyone has to remember:
 *
 *   1. The group comes from the DESTINATION'S OWN BUILDER, called by the name
 *      the destination calls it by. If the builder changes, this changes. There
 *      is no second asset that can drift away from the first.
 *   2. The camera is the DESTINATION'S OWN EXPORTED CONSTANT, never a
 *      hand-picked angle that flatters the shape.
 *   3. Nothing is added for looks. The lights are the ones the scene uses.
 *
 * MEASURED BEFORE IT WAS SHAPED, on this machine, in the browser rather than in
 * node — node times the geometry and misses the GPU entirely:
 *
 *     build sarcomere  0.8 ms     upload + render + read  3.7 ms
 *     build cell       1.0 ms                             1.6 ms
 *     build signalling 0.7 ms                             1.5 ms
 *
 * Under 5 ms each, against the 150 ms that would have forced the preview to
 * build behind a hover delay. So it builds on mount and hover is instant: no
 * spinner, no skeleton, no "preparing…" state to design. The number decided the
 * component's shape, which is why it was taken first.
 *
 * ponytail: one preview at a time. There is one viewer and one entrance, and a
 * module-level slot is the whole of the cache this needs.
 */

let open = null;
/** Reused so a preview playing at twelve a second does not allocate 590 KB a step. */
let buffer = null;

/** The lights the scenes use. Cloned per preview so disposal is local. */
/**
 * THE DESTINATION'S OWN LAMPS, SINCE 2026-09-03, AND THIS FILE'S OWN ARGUMENT IS
 * WHY. Its header claims honesty by construction — the group comes from the
 * destination's builder, the camera is the destination's exported constant — and
 * then lit the scene with three numbers typed here and belonging to nobody:
 * ambient 1.15, key 2.4, fill 1.0. The signalling scale ships 0.5 / 3.4 / 1.2.
 * So the disc promising "this is the room you are about to be in" was showing
 * that room under different lamps.
 * IT MATTERED ONCE THE DISC BECAME THE DOOR. While it was a reward for hovering
 * three orange rings, a slightly-off still was a small lie in a corner. It is now
 * the control itself, and the only thing it says is what is down there.
 * FALLING BACK TO THE OLD NUMBERS is deliberate: a seam that has not been told
 * its lamps yet draws the way it always did rather than black.
 */
function rig(lights) {
  /* BRIGHTER THAN THE SCENE IT COPIES — owner, 2026-09-06: the disc read as too
     dark. It is a 384px circle seen against paper, not a full stage, so the same
     numbers that light a whole scene leave it muddy at that size. Lifted, not
     recoloured: the destination's own rig, turned up.
     AND THE LIFT WAS ONLY EVER A FALLBACK, WHICH IS WHY IT WAS STILL DARK. This
     read `lights ?? {bright}` — so a seam that DECLARES its lamps got its own
     numbers untouched and the whole brightening skipped it. Exactly one seam
     declares them, and it is signalling at ambient 0.5 (`CellScale.jsx:168`),
     the darkest of the three. So the one disc the owner named twice — *"돋보기에서
     Signals는 ㅈㄴ 회색이얔ㅋㅋ"* — was the one the fix could not reach. The lift
     is a GAIN on whatever arrives now, not a replacement for it, so a seam keeps
     its own lighting character and just gets turned up.
     AMBIENT CARRIES MOST OF IT: at coin size the key light's modelling is what
     survives least — a 90 px sphere has almost no shaded side to read — so the
     flat term is the one that decides whether the disc looks like a picture or a
     silhouette. */
  /* The floor's own lamps (`anatomyStyle.LIGHTS`) when a seam declares none. */
  const own = lights ?? { ambient: LIGHTS.ambient, key: LIGHTS.key.intensity, fill: LIGHTS.fill.intensity };
  const L = {
    ambient: Math.max(own.ambient * PREVIEW_GAIN.ambient, PREVIEW_GAIN.ambientFloor),
    key: own.key * PREVIEW_GAIN.key,
    fill: own.fill * PREVIEW_GAIN.fill,
  };
  const key = new THREE.DirectionalLight(0xffffff, L.key);
  key.position.set(3, 5, 4);
  const fill = new THREE.DirectionalLight(0xffffff, L.fill);
  fill.position.set(-4, 2, -2);
  return [new THREE.AmbientLight(0xffffff, L.ambient), key, fill];
}

/**
 * Build the destination and render one frame of it.
 *
 * `seam.build()` is synchronous — every level builder is — so this returns the
 * target's texture immediately and the caller can hand it to a material on the
 * same frame.
 */
/**
 * THE OUTPUT PASS THE CANVAS GETS FOR FREE AND A RENDER TARGET DOES NOT —
 * 2026-09-07 (3b-2). Owner, of the coin's sarcomere: *"메인이랑 색깔이 다른데 …
 * 컬러 렌즈를 너가 해둔거 같았어"*. Three applies the renderer's tone mapping
 * (ACES filmic, R3F's default) and the sRGB output transform ONLY when it draws
 * to the screen; into a render target it writes linear, untoned values, and this
 * file read those bytes straight into a 2D canvas as if they were sRGB. Darker,
 * more saturated, every hue pushed — a lens, exactly as it looked. So the coin is
 * drawn linear as before and then blitted through the same two functions the
 * canvas uses (`ACESFilmicToneMapping`, `sRGBTransferOETF`, out of three's own
 * shader chunks), into a second target that is what gets read back.
 */
let blit = null;
function outputPass() {
  if (blit) return blit;
  const material = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, toneMappingExposure: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      /* three prepends the colour-space functions to every fragment shader;
         including that chunk again redefines them. The tone-mapping chunk is
         not prepended for a ShaderMaterial. */
      #include <tonemapping_pars_fragment>
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main(){
        vec4 t = texture2D(tDiffuse, vUv);
        t.rgb = ACESFilmicToneMapping(t.rgb);
        gl_FragColor = sRGBTransferOETF(t);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  blit = { scene, camera, material };
  return blit;
}

export function openPreview(gl, seam, size = 384) {
  closePreview();
  /* EVERY LEVEL BUILDER RETURNS A RECORD, NOT AN OBJECT3D — `{ group, update,
     anchors, dispose }`. The first version added the record itself to a scene,
     which three.js accepts silently and draws as nothing: the disc came back a
     flat colour and looked like a render that had simply missed. Take the group
     and keep the record's own `dispose`, which knows the tree it built. */
  const built = seam.build();
  /* DRESSED BEFORE IT IS PHOTOGRAPHED, 2026-09-03. Both destination builders end
     with `update(null)`, which is their QUIET state — every node at
     `QUIET_TINT`, which on the signalling scale is near-black. So the coin was a
     picture of a room nobody will ever walk into: the disc came back as black
     shapes on white while the scale it promises is salmon and brown on cream.
     It went unnoticed while the disc was a reward for hovering three rings. It
     stopped being ignorable the moment the disc BECAME the door, because then
     the only thing the control says is what is down there.
     THE SEAM SUPPLIES THE DRESSING, not this file, for the same reason it
     supplies the builder and the camera: the reading belongs to the scale that
     owns it, and anything typed here could drift from it. A seam with no `dress`
     draws quiet, which is what it did before. */
  seam.dress?.(built);
  const group = built.group ?? built;
  const scene = new THREE.Scene();
  /* THE ROOM, WHICH THE COIN HAD NEVER BEEN GIVEN — 2026-09-06, and this is the
     real answer to *"돋보기에서 Signals는 ㅈㄴ 회색이얔ㅋㅋ"* and to the disc
     reading dark after the lamps were already turned up twice.
     `AnatomyEnvironment` installs a PMREM-prefiltered room as `scene.environment`
     on the cell and signalling canvases, and every material on those floors is
     lit by it as much as by the three lamps — a rough surface sees a blurred
     room, a smooth one sees a sharp one. This scene had lamps and no room, so
     the same objects came back as near-black silhouettes on white paper while
     the floor itself draws them grey-brown. Turning the lamps up could not fix
     it, because what was missing was not intensity but the thing the surfaces
     reflect.
     Built here rather than shared with the page's: PMREM output belongs to the
     renderer that made it, and this render target is disposed with the preview.
     Under 3 ms on this machine, once per opened preview, not per frame. */
  const pmrem = new THREE.PMREMGenerator(gl);
  const source = environmentSource(THREE);
  const room = pmrem.fromEquirectangular(source);
  scene.environment = room.texture;
  source.dispose();
  pmrem.dispose();
  /* THE PAPER THE DESTINATION IS DRAWN ON. Without it the target clears to
     transparent black and the disc arrives as a grey coin — which is not what
     the viewer would see on arriving, and the whole promise here is that it
     is. */
  scene.background = new THREE.Color(PALETTE.background);
  for (const light of rig(seam.lights)) scene.add(light);
  scene.add(group);

  /* THE DESTINATION'S OWN LENS, AND IT WAS NOT. This read 45 while every scale
     in the app draws at `SCENE.camera.fov` — the third typed number in this file
     that its own header promised came from the destination. A wider lens on a
     coin is the last thing this needed.
     AND PULLED IN, which IS this file deciding something, so it says so. The
     destination's camera frames a whole stage 1280 px wide; the same framing in
     an 88 px circle is a picture of nothing, which is what the owner saw —
     *"각각 너무 줌아웃되서 잘 안보야"*. The direction and the lens stay the
     destination's; only the distance is ours, and it is one number rather than a
     re-aimed camera, so the coin is a DETAIL of the arrival view and cannot be a
     different view of it. */
  /* `seam.fov` — a coin on one corner of a walled room (ENERGY's AMPK + CaMKK2)
     has to stand OUTSIDE the wall; a narrower lens keeps the corner large from
     out there, where the app's own fov would put the camera in the membrane
     (2026-09-07: a milky disc). */
  const fov = seam.fov ?? SCENE.camera.fov;
  const camera = new THREE.PerspectiveCamera(fov, 1, SCENE.camera.near, SCENE.camera.far);
  /* FITTED TO WHAT WAS BUILT, NOT TO A FRACTION — 2026-09-06. `PREVIEW_PULL` was
     one number for three destinations of different sizes, so tightening it far
     enough to fill the coin for one of them cropped another into a picture of a
     corner: measured at 0.44, the signalling disc was one node and half a link.
     The three destinations differ by more than 2x in extent, so no single
     fraction can be right for all of them.
     The direction and the lens are still the destination's — only the DISTANCE
     is ours, as before — and now it is derived from the group's own bounding
     sphere so a builder that grows or shrinks moves the coin with it instead of
     silently overflowing a constant tuned against the old size. `MARGIN` is the
     air left around it. */
  /* FRAMED ON THE PARTS THE DESTINATION NAMES, NOT ON EVERYTHING IT DRAWS —
     2026-09-06. Owner, twice: *"그 각각의 3d preview안에서 다음 스테이지의 핵심이
     더 zoom 되어 있었으면 좋겠어 지금은 too far out"*.
     Tightening the margin was chasing the wrong number. Both destinations carry
     a background field that reaches much further than their subject — the cell's
     cytosol motes and its fibre rods, signalling's constellation of 108 undrawn
     components — so a sphere around the whole group is a sphere around the
     background, and the coin came out 15 % ink whatever the margin was.
     `anchors` IS THE FLOOR'S OWN ANSWER to "what is this room about": every
     level builder returns one, it is the list that gets a name and a plate, and
     the background is deliberately not in it. So the coin frames those points
     and adds the largest single object's reach around them, which keeps the
     named things whole rather than cropping them to their centres.
     Falls back to the whole group where a seam has no anchors, which is the old
     behaviour and not a guess. */
  /* `seam.focus` — 2026-09-07, owner FIBER 11: *"coins zoom the next floor's most
     active spot"*. A list of the destination's anchor ids; the coin frames those
     alone (AMPK + CaMKK2 for ENERGY, the JNK convergence for SIGNALS) and the
     direction is still the destination's own camera, so the coin is that floor's
     own view of its busiest corner. Unknown ids simply do not count; a focus that
     names nothing present frames the room as before. */
  const wanted = Array.isArray(seam.focus) && seam.focus.length ? new Set(seam.focus) : null;
  const pick = (built.anchors ?? []).filter((a) => a?.at && (!wanted || wanted.has(a.id)));
  const named = (wanted && pick.length ? pick : built.anchors ?? [])
    .map((a) => a?.at)
    .filter((a) => Array.isArray(a) && a.length === 3);
  const box = new THREE.Box3();
  if (named.length >= 2 || (wanted && named.length === 1)) {
    for (const a of named) box.expandByPoint(new THREE.Vector3(...a));
  } else {
    box.setFromObject(group);
  }
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  /* The anchors are POINTS. Without this the frame would cut every named object
     in half at the edge of the circle; one object's own reach is the least it
     can be and still show what it framed. */
  if (named.length >= 2 || (wanted && named.length === 1)) sphere.radius += PART_REACH * (seam.reach ?? 1);
  const dir = new THREE.Vector3(...seam.camera).normalize();
  const fit = sphere.radius / Math.sin((fov * Math.PI) / 360);
  /* A seam may ask for its own margin — the body's coin does (owner: *"살짝 만 더 줌"*). */
  /* A seam may also ask the picture to sit off-centre — BODY 3rd round, owner:
     *"이 3d preview안에 보이는 화면을 왼쪽으로"*. `pan` is a share of the subject's
     radius along the camera's right; aiming right of the subject puts the
     subject left in the disc. The dolly on hover breathes along the same line. */
  /* `seam.centre` — the point the coin is centred on when the anchors' own centre is
     not the room's (ENERGY's parts sit off-centre; owner 2026-09-07: *"완전 중앙에 줌인"*). */
  const centre = Array.isArray(seam.centre) ? new THREE.Vector3(...seam.centre) : sphere.center;
  const at = dir.multiplyScalar(fit * (seam.margin ?? PREVIEW_MARGIN)).add(centre);
  const look = centre.clone();
  if (seam.pan) {
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    look.addScaledVector(right, seam.pan * sphere.radius);
    at.addScaledVector(right, seam.pan * sphere.radius);
  }
  /* `tilt`: the same, along up — aiming above the subject puts it lower in the disc. */
  if (seam.tilt) {
    look.y += seam.tilt * sphere.radius;
    at.y += seam.tilt * sphere.radius;
  }
  camera.position.copy(at);
  camera.lookAt(look);

  const target = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  /* What is read back — see `outputPass`. */
  const out = new THREE.WebGLRenderTarget(size, size, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  open = { built, group, scene, camera, target, out, room, home: at.toArray(), centre: look.toArray() };
  render(gl, 0);
  return target.texture;
}

/**
 * Dolly from a little further out to the destination's own home camera.
 *
 * `k` runs 0 → 1. It starts at 1.15 of the home distance so the preview has
 * somewhere to go while a viewer hovers: the shape settles into the framing it
 * will actually arrive at, which is the promise the entrance is making.
 */
export function render(gl, k) {
  if (!open) return;
  /* AROUND THE SUBJECT'S CENTRE, NOT THE ORIGIN — 2026-09-06. This scaled the
     home position about (0,0,0) and aimed at (0,0,0), which was consistent only
     while the home position was `seam.camera * a fraction` and the destination
     happened to be built around the origin. The camera is fitted to the group's
     own bounding sphere now, so the dolly has to breathe along the line from
     THAT centre or the first frame of the hover would swing the aim off the
     subject and the last frame would swing it back. */
  const scale = 1.15 + (1 - 1.15) * Math.min(1, Math.max(0, k));
  const c = open.centre;
  open.camera.position.set(
    c[0] + (open.home[0] - c[0]) * scale,
    c[1] + (open.home[1] - c[1]) * scale,
    c[2] + (open.home[2] - c[2]) * scale,
  );
  open.camera.lookAt(c[0], c[1], c[2]);
  const previous = gl.getRenderTarget();
  gl.setRenderTarget(open.target);
  gl.render(open.scene, open.camera);
  const pass = outputPass();
  pass.material.uniforms.tDiffuse.value = open.target.texture;
  pass.material.uniforms.toneMappingExposure.value = gl.toneMappingExposure ?? 1;
  gl.setRenderTarget(open.out);
  gl.render(pass.scene, pass.camera);
  gl.setRenderTarget(previous);
}

/**
 * The last frame, as a data URL, for `Descent` to hold across the scene swap.
 *
 * This is the whole mechanism: the frame a viewer is looking THROUGH becomes
 * the frame they are looking AT. Everything else — the wash, the easing, the
 * ring — is decoration on top of a cut. The pixels have to be the destination's
 * own or the cut is visible.
 */
/**
 * ADVANCE THE OPEN PREVIEW BY ONE STEP AND REDRAW IT.
 *
 * The coin was a photograph. Owner, 2026-09-03: *"fiber 3d가 mini로 플레이해"* —
 * they asked for it moving, and this file was built for that: its header already
 * says "one extra `gl.render()` per frame while an entrance is open, and zero
 * when it is closed".
 *
 * THE CALLER SUPPLIES THE MOTION, not this file. `dress` gets the destination's
 * own record and moves it however that destination moves — the fibre steps its
 * own simulation, the deep scales read their own archives. Same rule as the
 * builder, the camera and the lights: what belongs to the destination comes from
 * the destination.
 *
 * TWELVE A SECOND, NOT SIXTY, and the number is measured. Every step ends in a
 * `readRenderTargetPixels` and a PNG encode — the encode alone timed 0.97 ms on
 * a 384 px canvas, and the GPU readback that precedes it stalls the pipeline,
 * which is the part that actually costs. At 60 fps that is a stall in every
 * frame of the REAL scene for the sake of a coin. The callers use an interval,
 * not `useFrame`, for exactly that reason.
 */
export function stepPreview(gl, dress) {
  if (!open) return false;
  dress?.(open.built);
  render(gl, 1);
  return true;
}

/**
 * PAINT THE OPEN PREVIEW STRAIGHT ONTO A CANVAS, WITH NO REACT IN BETWEEN.
 *
 * WHY NOT `stillOf` IN A LOOP. `stillOf` returns a data URL, which means the
 * caller sets it as state, which means React re-renders — and this control lives
 * inside a drei `<Html>` portal, so every re-render replaces the DOM under the
 * pointer. Driving that at twelve a second made the view open and shut on its
 * own: the pointer kept entering a button that had just been swapped out.
 * Measured, then reverted, then rebuilt this way.
 *
 * PIXELS THROUGH A REF INSTEAD. The caller holds a `<canvas>` and hands it here;
 * nothing enters React state, nothing re-renders, the DOM under the pointer
 * never moves. It is also CHEAPER than the still it replaces — one readback and
 * a `putImageData`, where `stillOf` did a readback AND a PNG encode.
 *
 * FLIPPED, BECAUSE GL COUNTS ROWS FROM THE BOTTOM. `readRenderTargetPixels`
 * hands back the buffer in GL order and a canvas is top-down, so the rows are
 * reversed on the way in. Without this the coin is upside down, which reads as a
 * different room rather than as a bug.
 */
export function paintPreview(gl, canvas) {
  if (!open || !canvas) return false;
  const w = open.out.width;
  const h = open.out.height;
  if (!buffer || buffer.length !== w * h * 4) buffer = new Uint8Array(w * h * 4);
  gl.readRenderTargetPixels(open.out, 0, 0, w, h, buffer);
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const image = ctx.createImageData(w, h);
  const row = w * 4;
  for (let y = 0; y < h; y += 1) {
    image.data.set(buffer.subarray((h - 1 - y) * row, (h - y) * row), y * row);
  }
  ctx.putImageData(image, 0, 0);
  return true;
}

export function stillOf(gl) {
  if (!open) return null;
  const { width, height } = open.out;
  const pixels = new Uint8Array(width * height * 4);
  gl.readRenderTargetPixels(open.out, 0, 0, width, height, pixels);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(width, height);
  // WebGL reads bottom-up; a canvas is top-down.
  for (let y = 0; y < height; y += 1) {
    const from = (height - 1 - y) * width * 4;
    image.data.set(pixels.subarray(from, from + width * 4), y * width * 4);
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

/** Release the GPU memory. Called on close and on unmount. */
export function closePreview() {
  if (!open) return;
  open.target.dispose();
  open.out?.dispose();
  /* The room too — it is a render target like the coin's, and one per opened
     preview leaks one per hover otherwise. */
  open.room?.dispose();
  /* The builder's own dispose where there is one — it knows what it made. */
  if (typeof open.built?.dispose === "function") open.built.dispose();
  else {
    open.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else if (material) material.dispose();
    });
  }
  open = null;
}
