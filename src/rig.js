import * as THREE from "three";
import { useDualQuaternionSkinning } from "./dqs.js";

/**
 * Turns the flat GLB scenes into an articulated body.
 *
 * The mesh set ships 668 static meshes parented directly to their scene root.
 * `mapping/rig.json` says which segment each one belongs to and where each joint
 * actually is (fitted to the bone geometry, not guessed). This module builds the
 * segment tree, moves every mesh into it with `attach()` so nothing shifts, and
 * then a pose is just a set of rotations on ~23 groups.
 */

const DEG = Math.PI / 180;

/**
 * Builds the empty segment tree. Each group sits at its joint centre, so
 * rotating it rotates about the real joint rather than the world origin.
 */
export function buildSegments(rig) {
  const groups = new Map();

  // THREE.Bone rather than Group, because the spanning muscles are skinned to
  // these and a Skeleton will only accept bones.
  for (const name of Object.keys(rig.parent)) {
    const bone = new THREE.Bone();
    bone.name = `seg:${name}`;
    const pivotKey = rig.pivot[name];
    const pivot = pivotKey ? rig.joints[pivotKey] : null;
    if (pivot) bone.position.set(pivot[0], pivot[1], pivot[2]);
    groups.set(name, bone);
  }

  // Parent in a second pass, using attach() so each bone keeps the world
  // position we just gave it and its local offset is computed for us.
  const root = new THREE.Bone();
  root.name = "seg:root";
  for (const [name, bone] of groups) {
    const parentName = rig.parent[name];
    (parentName ? groups.get(parentName) : root).attach(bone);
  }

  // Bind pose is the rest pose, so inverses must be taken before anything moves.
  root.updateMatrixWorld(true);
  const order = [...groups.keys()];
  const skeleton = new THREE.Skeleton(order.map((n) => groups.get(n)));
  const boneIndex = new Map(order.map((n, i) => [n, i]));

  return { root, groups, skeleton, boneIndex };
}

/**
 * glTF node names survive into three.js only after PropertyBinding.sanitizeNodeName,
 * which turns every space into an underscore and drops `[].:/ `. So "left humerus"
 * arrives as "left_humerus" and a raw lookup against rig.json misses everything
 * except the single-word bones. Normalise both sides before matching.
 */
const normalizeName = (name) => (name ?? "").replace(/\s/g, "_").replace(/[[\]./:]/g, "");

/**
 * Moves every mesh out of its GLB scene and into the segment it belongs to.
 * `attach()` preserves the world transform, so the body does not move at all —
 * it just becomes articulated.
 */
export function bindMeshes(scene, rig, groups, fallback, blendLookup) {
  const bySegment = new Map();
  const byBlend = new Map();
  for (const [name, segs] of Object.entries(rig.meshSegments)) {
    bySegment.set(normalizeName(name), segs);
    const blend = blendLookup?.get(name);
    if (blend) byBlend.set(normalizeName(name), blend);
  }

  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });

  let bound = 0;
  let blended = 0;
  let unbound = 0;
  for (const mesh of meshes) {
    // The name may sit on the mesh or on its parent, depending on how the loader
    // split the glTF node.
    const key = bySegment.has(normalizeName(mesh.name))
      ? normalizeName(mesh.name)
      : normalizeName(mesh.parent?.name);
    const segs = bySegment.get(key);
    const blend = byBlend.get(key);

    if (blend) blended++;
    if (segs) bound++;
    else unbound++;

    const target = blend?.group ?? (segs ? groups.get(segs[0]) : groups.get(fallback));
    target?.attach(mesh);
  }
  return { bound, blended, unbound, total: meshes.length };
}

/* ------------------------------------------------------------------ skin */

/**
 * Converts the muscles that cross a joint into skinned meshes.
 *
 * Rotating a whole muscle part-way between two segments — which is what a rigid
 * blend does — is wrong at both ends. The end that should be welded to the hand
 * lags it by however much weight the forearm holds, so at the wrist, which turns
 * about 90 degrees in a push-up, the hand muscles visibly tear away from the
 * bones. The fix has to be per vertex: vertices past the joint follow the distal
 * segment outright, vertices behind it stay put, and only a narrow band across
 * the joint blends.
 *
 * Geometry is baked to rest-pose world space and the mesh is bound with an
 * identity bind matrix, so the returned container must sit at the scene root
 * rather than under the rig — the bones already carry the body transform.
 */
export function skinSpanningMeshes({ scene, rig, groups, boneIndex, skeleton, segments = null, exclude = null }) {
  const container = new THREE.Group();
  container.name = "skinned";
  container.userData.order = [...boneIndex.keys()];

  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });

  const bySegment = new Map();
  for (const [name, segs] of Object.entries(rig.meshSegments)) {
    bySegment.set(normalizeName(name), { name, segs });
  }

  const why = { noRecord: 0, notSpanning: 0, noBone: 0, noPlane: 0, excluded: 0, ok: 0 };
  const identity = new THREE.Matrix4();
  const origin = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const v = new THREE.Vector3();
  let skinned = 0;
  const fibres = [];

  for (const mesh of meshes) {
    const key = bySegment.has(normalizeName(mesh.name))
      ? normalizeName(mesh.name)
      : normalizeName(mesh.parent?.name);
    const record = bySegment.get(key);
    if (!record) { why.noRecord++; continue; }

    // Gate on the chain, not on the old two-bone spanning flag. A mesh can label
    // as one segment and still reach past a joint, and those are exactly the ones
    // that hang loose — extensor carpi ulnaris is wholly "ulna" by nearest bone
    // with a fifth of itself out in the hand.
    const chain = rig.meshChain?.[record.name];
    if (!chain || chain.segments.length < 2) { why.notSpanning++; continue; }
    if (segments && !chain.segments.every((n) => segments.has(n))) continue;
    if (exclude?.has(record.name)) { why.excluded++; continue; }

    // The build measured, from the labelled vertices themselves, every segment
    // this mesh belongs to and where it hands over between them. Meshes with no
    // chain are ones whose halves overlap — splitting those would only shear them.
    const bones = chain.segments.map((n) => boneIndex.get(n));
    if (bones.some((b) => b === undefined)) { why.noBone++; continue; }

    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.clone();

    // De-quantize before baking the world transform in.
    //
    // The mesh set ships KHR_mesh_quantization, so POSITION arrives as Int16 with
    // normalized: true — the GPU divides by 32767 at draw time. applyMatrix4 reads
    // those as floats, transforms them into metres, then writes the result back
    // through the same normalization, which clamps everything past ±1. The mesh
    // comes out smeared across two metres. Convert to plain float first.
    for (const name of ["position", "normal"]) {
      const attr = geometry.getAttribute(name);
      if (!attr || (!attr.normalized && attr.array instanceof Float32Array)) continue;
      const out = new Float32Array(attr.count * attr.itemSize);
      for (let k = 0; k < attr.count; k++) {
        out[k * 3] = attr.getX(k);
        out[k * 3 + 1] = attr.getY(k);
        out[k * 3 + 2] = attr.getZ(k);
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
    }

    geometry.applyMatrix4(mesh.matrixWorld);

    const position = geometry.attributes.position;
    const count = position.count;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);

    for (let k = 0; k < count; k++) {
      v.fromBufferAttribute(position, k);

      // Walk the chain: each plane crossed advances the vertex one segment along
      // it, so summing the crossings gives a position in "segments from the
      // proximal end" and the fractional part is the blend with the next one.
      // Two influences per vertex, but a different pair depending on where the
      // vertex sits — which is what a two-bone bind cannot express, and why the
      // wrist muscles stayed rigid at the hand while blending fine at the elbow.
      let walk = 0;
      for (const plane of chain.planes) {
        origin.fromArray(plane.o);
        axis.fromArray(plane.n);
        const t = THREE.MathUtils.clamp(
          v.clone().sub(origin).dot(axis) / (plane.band ?? 0.06) + 0.5, 0, 1,
        );
        walk += t * t * (3 - 2 * t);
      }

      const lo = Math.min(Math.floor(walk), bones.length - 2);
      const frac = THREE.MathUtils.clamp(walk - lo, 0, 1);
      skinIndex[k * 4] = bones[lo];
      skinIndex[k * 4 + 1] = bones[lo + 1];
      skinWeight[k * 4] = 1 - frac;
      skinWeight[k * 4 + 1] = frac;
    }

    geometry.setAttribute("skinIndex", new THREE.BufferAttribute(skinIndex, 4));
    geometry.setAttribute("skinWeight", new THREE.BufferAttribute(skinWeight, 4));

    // Dual quaternion skinning: these are the meshes that cross a bending joint,
    // and they are the only ones that need it.
    const skin = new THREE.SkinnedMesh(
      geometry,
      useDualQuaternionSkinning(mesh.material.clone(), chain.fibre),
    );
    skin.name = mesh.name;
    skin.userData = { ...mesh.userData };
    if (mesh.parent?.userData) skin.userData = { ...mesh.parent.userData, ...skin.userData };
    // The body leaves the bind pose entirely, so the rest bounds mean nothing.
    skin.frustumCulled = false;
    container.add(skin);
    skin.bind(skeleton, identity);

    // Raycasting has the same rest-bounds problem culling does: Mesh.raycast
    // gates on the geometry's bounding sphere, which was computed from the
    // rest pose — a hanging or prone body sits metres away from it, so clicks
    // in inspect mode passed straight through every skinned muscle and only
    // rigid meshes could be picked. One sphere generously covering the stage
    // keeps the gate honest; the per-triangle test that follows uses the
    // posed vertices, so hits stay exact.
    skin.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 3.2);

    // Two empties riding the end segments, so the current fibre length can be
    // read straight off the posed skeleton each frame.
    if (chain.fibre) {
      const a = new THREE.Object3D();
      const b = new THREE.Object3D();
      const half = chain.fibre.len / 2;
      a.position.set(
        chain.fibre.c[0] - chain.fibre.a[0] * half,
        chain.fibre.c[1] - chain.fibre.a[1] * half,
        chain.fibre.c[2] - chain.fibre.a[2] * half,
      );
      b.position.set(
        chain.fibre.c[0] + chain.fibre.a[0] * half,
        chain.fibre.c[1] + chain.fibre.a[1] * half,
        chain.fibre.c[2] + chain.fibre.a[2] * half,
      );
      groups.get(chain.segments[0])?.attach(a);
      groups.get(chain.segments[chain.segments.length - 1])?.attach(b);
      fibres.push({ a, b, restLen: chain.fibre.len, girth: skin.material.userData.girth });
    }

    mesh.parent?.remove(mesh);
    skinned++;
    why.ok++;
  }

  return { container, skinned, fibres };
}

/* --------------------------------------------------------------------- ik */

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/**
 * Points a segment along `targetDir` (world space).
 *
 * At rest every segment group has identity rotation, so a direction measured in
 * the rest pose is already expressed in the segment's parent frame. Cancelling
 * the parent's current world rotation puts the target in that same frame, and
 * the shortest arc between the two is the segment's local rotation.
 */
export function aimSegment(group, restDir, targetDir) {
  group.parent?.updateMatrixWorld();
  group.parent?.getWorldQuaternion(_q).invert();
  _v.copy(targetDir).normalize().applyQuaternion(_q).normalize();
  group.quaternion.setFromUnitVectors(restDir, _v);
}

/** Right-handed orthonormal basis from a primary axis and a rough secondary. */
function orthoBasis(primary, secondary, out) {
  const x = primary.clone().normalize();
  const z = new THREE.Vector3().crossVectors(x, secondary).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return out.makeBasis(x, y, z);
}

const _restM = new THREE.Matrix4();
const _targetM = new THREE.Matrix4();
const _qWorld = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();

/**
 * Fully orients a segment, not just its long axis.
 *
 * Aiming alone leaves the roll free, which is fine for a limb bone and wrong for
 * a hand: a push-up rests on the palm, so which way the palm faces is the whole
 * point. Give it two axes measured in the rest pose and two desired world axes.
 */
export function orientSegment(group, restPrimary, restSecondary, targetPrimary, targetSecondary) {
  orthoBasis(restPrimary, restSecondary, _restM);
  orthoBasis(targetPrimary, targetSecondary, _targetM);
  _qWorld.setFromRotationMatrix(_targetM.multiply(_restM.invert()));

  group.parent?.updateMatrixWorld();
  group.parent?.getWorldQuaternion(_qParent).invert();
  group.quaternion.copy(_qParent).multiply(_qWorld);
}

/**
 * Two-link IK for an arm whose hand is planted on the floor.
 *
 * Returns world-space directions for the upper arm and forearm that put the
 * wrist exactly on `target`, with the elbow bending in the plane whose normal
 * is `bendAxis`. Reach is clamped, so an unreachable target just straightens
 * the arm instead of producing NaNs.
 */
export function solveArm({ shoulder, target, upperLen, foreLen, bendAxis, bendSign = 1 }) {
  const toTarget = new THREE.Vector3().subVectors(target, shoulder);
  const d = THREE.MathUtils.clamp(
    toTarget.length(),
    Math.abs(upperLen - foreLen) + 1e-4,
    upperLen + foreLen - 1e-4,
  );
  const dir = toTarget.normalize();

  // Angle between the upper arm and the shoulder->target line.
  const cosA = (upperLen * upperLen + d * d - foreLen * foreLen) / (2 * upperLen * d);
  const a = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));

  const axis = new THREE.Vector3().copy(bendAxis).normalize();
  const upperDir = dir.clone().applyAxisAngle(axis, a * bendSign);
  const elbow = new THREE.Vector3().copy(shoulder).addScaledVector(upperDir, upperLen);
  const foreDir = new THREE.Vector3().subVectors(target, elbow).normalize();

  return { upperDir, foreDir, elbow, reach: d };
}

/* ------------------------------------------------------------------- pose */

const _euler = new THREE.Euler();
const _axis = new THREE.Vector3();

/**
 * Applies a pose — a map of segment name to [x, y, z] Euler degrees.
 *
 * A segment listed in `rig.hinges` turns about that measured axis instead, using
 * the first component as the angle. Some joints are simply not square to the
 * body: the line of the toe knuckles runs about 36 degrees off the X axis, so
 * bending the toes about X pulls the outer ones out of their sockets while the
 * big toe barely moves.
 */
export function applyPose(groups, pose, rig) {
  for (const [name, group] of groups) {
    const r = pose[name];
    const hinge = rig?.hinges?.[name];
    if (hinge) {
      _axis.fromArray(hinge);
      group.quaternion.setFromAxisAngle(_axis, (r?.[0] ?? 0) * DEG);
      continue;
    }
    _euler.set(
      (r?.[0] ?? 0) * DEG,
      (r?.[1] ?? 0) * DEG,
      (r?.[2] ?? 0) * DEG,
      "XYZ",
    );
    group.quaternion.setFromEuler(_euler);
  }
}

/** Blends two poses. Rotations are slerped so limbs swing along an arc. */
export function blendPose(a, b, t) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const pa = a[key] ?? [0, 0, 0];
    const pb = b[key] ?? [0, 0, 0];
    out[key] = [
      pa[0] + (pb[0] - pa[0]) * t,
      pa[1] + (pb[1] - pa[1]) * t,
      pa[2] + (pb[2] - pa[2]) * t,
    ];
  }
  return out;
}

/** Samples a keyframe track of `{ t, pose }` at time `time` (seconds). */
export function samplePoseTrack(track, time) {
  const duration = track[track.length - 1].t;
  const t = ((time % duration) + duration) % duration;
  let i = 0;
  while (i < track.length - 2 && track[i + 1].t <= t) i++;
  const a = track[i];
  const b = track[i + 1];
  const span = Math.max(b.t - a.t, 1e-6);
  const u = (t - a.t) / span;
  // Smoothstep: the lift decelerates into lockout and accelerates out of it,
  // which is what makes the rep read as effortful rather than mechanical.
  return blendPose(a.pose, b.pose, u * u * (3 - 2 * u));
}

/**
 * Puts every segment back on its bind rotation and the root back at the origin.
 *
 * Switching exercises has to go through this. `applyPose` rewrites every group
 * each frame, so rotations cannot accumulate *within* one movement — but the
 * root carries the body's whole placement, prone for a push-up and hanging for a
 * pull-up, and nothing else clears it. Leaving the previous exercise's root set
 * is what would start the next one buried in the floor.
 */
export function resetRig(root, groups) {
  for (const [, group] of groups) group.quaternion.identity();
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
}

/**
 * Orients and positions the whole body. The general form of `setRootTransform`,
 * which stays as it is because the push-up's plank bisection calls it directly.
 */
export function placeRoot(root, { quaternion, position, deep = true }) {
  if (quaternion) root.quaternion.copy(quaternion);
  if (position) root.position.copy(position);
  root.scale.set(1, 1, 1);
  if (deep) root.updateMatrixWorld(true);
  else root.updateMatrix();
}

const _anchorAt = new THREE.Vector3();
const _anchorTo = new THREE.Vector3();

/**
 * Translates the root so `marker` lands exactly on `target`.
 *
 * The counterpart of `groundOn` for movements that are not resting on the floor.
 * A segment group's rotation pivots about its own joint centre, but the *pelvis*
 * group's pivot is the world origin — down at the feet — so tilting the pelvis
 * swings the entire body about a point on the floor. Anchoring a marker riding
 * the pelvis to the hip height the movement asks for cancels that, and is also
 * how a squat or a lunge lowers: the pose says how the joints fold, this says
 * where the hips end up.
 */
export function anchorRoot(root, marker, target, deep = true) {
  marker.updateWorldMatrix(true, false);
  marker.getWorldPosition(_anchorAt);
  _anchorTo.subVectors(target, _anchorAt);
  root.position.add(_anchorTo);
  root.updateMatrix();
  if (deep) root.updateMatrixWorld(true);
  return _anchorTo.length();
}

/**
 * An empty riding `group`, placed at a world-space point in the rest pose.
 *
 * `attach` treats an unparented object's position as world space and solves the
 * local offset, so the marker stays welded to that spot on the body however the
 * segment later moves. Contacts are measured this way rather than assumed.
 */
export function attachMarker(group, point) {
  const marker = new THREE.Object3D();
  marker.position.set(point[0], point[1], point[2]);
  group.attach(marker);
  return marker;
}

/**
 * World bounding box of whatever geometry a segment actually holds, in the pose
 * it is in when called.
 *
 * Used to find the sole of the foot. Guessing "the floor is at ankle y minus
 * 60 mm" is the same class of error as guessing a joint centre — measure it, and
 * it survives a rebuild of the mesh set.
 */
export function segmentBounds(group) {
  const box = new THREE.Box3();
  let found = false;
  group.traverse((o) => {
    if (!o.isMesh) return;
    box.expandByObject(o);
    found = true;
  });
  return found && !box.isEmpty() ? box : null;
}

/**
 * Places the whole body for the exercise. The model is authored standing and
 * facing +Z, so a push-up needs it rotated face-down and then pitched about the
 * toes. Everything below is applied to the rig root, not to any joint.
 */
export function setRootTransform(root, { pitchDeg = 0, lift = 0, rig, deep = true }) {
  const toe = rig.joints["toes.L"];
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.updateMatrix();

  // Face-down: +Y (head) swings to +Z, +Z (front) swings to -Y.
  const prone = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  // Plank pitch about the toe contact. Negative, because after the prone
  // rotation the head lies toward +Z and a positive X rotation would drive that
  // end into the floor rather than lifting it.
  const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitchDeg * DEG);
  root.quaternion.copy(pitch).multiply(prone);

  // Rest the body on the toe pads, not the joint inside the foot, and keep that
  // contact fixed as the body pitches.
  const toeWorld = new THREE.Vector3(toe[0], toe[1], toe[2]).applyQuaternion(root.quaternion);
  root.position.set(0, -toeWorld.y + lift, -toeWorld.z);
  if (deep) root.updateMatrixWorld(true);
  else root.updateMatrix();
}

const _probe = new THREE.Vector3();

/**
 * Drops the body until its lowest ground contact rests on y = 0.
 *
 * The pitch is solved from joint centres, which sit inside the bone, so the
 * geometry around them still hangs below the floor. Rather than fudge an offset,
 * measure where the contacts actually ended up and shift by that.
 */
export function groundOn(root, markers, deep = true) {
  let lowest = Infinity;
  for (const marker of markers) {
    // Walk only this marker's own chain — a deep update here would touch every
    // one of the 668 meshes, and the plank solve calls this several times a frame.
    marker.updateWorldMatrix(true, false);
    marker.getWorldPosition(_probe);
    if (_probe.y < lowest) lowest = _probe.y;
  }
  if (!Number.isFinite(lowest)) return 0;
  root.position.y -= lowest;
  root.updateMatrix();
  if (deep) root.updateMatrixWorld(true);
  return lowest;
}

const _fa = new THREE.Vector3();
const _fb = new THREE.Vector3();

/**
 * Updates each muscle's girth from how far its two ends have travelled apart.
 *
 * Volume is conserved, so a muscle at 60% of its rest length is 1/sqrt(0.6) —
 * about 29% — thicker. Clamped, because the attachment markers are group
 * centroids rather than true origin and insertion, and a muscle whose ends barely
 * separate would otherwise blow up.
 */
export function updateGirth(fibres, strength = 1) {
  for (const f of fibres) {
    f.a.getWorldPosition(_fa);
    f.b.getWorldPosition(_fb);
    const ratio = f.restLen / Math.max(_fa.distanceTo(_fb), 1e-4);
    const girth = THREE.MathUtils.clamp(Math.sqrt(ratio), 0.75, 1.35);
    f.girth.value = 1 + (girth - 1) * strength;
  }
}

const _sp = new THREE.Vector3();

/**
 * Finds the body angle that puts the shoulder exactly an arm's length from its
 * planted hand.
 *
 * Deriving the pitch from trigonometry alone leaves the arm slightly too long or
 * too short, and the resulting mismatch gets absorbed by the IK reach clamp — so
 * the body drifts up and down through the rep and reads as bouncing rather than
 * pressing. Solving for the pitch that satisfies the constraint exactly removes
 * that: both hands and both toes stay welded to the floor.
 */
export function solvePlank({ root, rig, contacts, shoulderBone, handTarget, reach }) {
  const err = (pitchDeg) => {
    setRootTransform(root, { pitchDeg, lift: 0, rig, deep: false });
    groundOn(root, contacts, false);
    shoulderBone.updateWorldMatrix(true, false);
    shoulderBone.getWorldPosition(_sp);
    return _sp.distanceTo(handTarget) - reach;
  };

  // Shoulder height rises monotonically with pitch, so the error does too.
  let lo = 0;
  let hi = 55;
  if (err(hi) < 0) return hi;
  if (err(lo) > 0) return lo;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (err(mid) > 0) hi = mid;
    else lo = mid;
  }
  const pitch = (lo + hi) / 2;
  err(pitch);
  return pitch;
}

/**
 * Bisection on one scalar, with the last evaluation left applied.
 *
 * `solvePlank` is this shape specialised to the push-up's pitch, and it is the
 * reason hands and toes stay welded to the floor instead of the body bouncing:
 * deriving the number from trigonometry leaves a residual that the IK reach
 * clamp then absorbs. Any movement with a limb planted on something has the same
 * problem — a pull-up's hands on the bar, a squat's feet on the floor — so the
 * search is worth having on its own.
 *
 * `err` must be monotonic in the search variable over [lo, hi] and must leave
 * the rig posed at whatever value it last tried.
 */
export function solveScalar(err, lo, hi, iterations = 14) {
  const eLo = err(lo);
  const eHi = err(hi);
  // Unbracketed: the constraint cannot be met anywhere in range, so settle on
  // the end that misses by least rather than returning a value never applied.
  if (eLo > 0 && eHi > 0) {
    const end = Math.abs(eLo) <= Math.abs(eHi) ? lo : hi;
    err(end);
    return end;
  }
  if (eLo < 0 && eHi < 0) {
    const end = Math.abs(eLo) <= Math.abs(eHi) ? lo : hi;
    err(end);
    return end;
  }

  const rising = eHi > eLo;
  let a = lo;
  let b = hi;
  for (let i = 0; i < iterations; i++) {
    const mid = (a + b) / 2;
    const e = err(mid);
    if (e > 0 === rising) b = mid;
    else a = mid;
  }
  const found = (a + b) / 2;
  err(found);
  return found;
}

/* -------------------------------------------------------------- measure */

/**
 * Segment lengths and rest directions for both limbs, measured off the fitted
 * joint centres.
 *
 * Every motion needs these and none of them should hard-code a number: the whole
 * point of `rig.json` is that rebuilding the mesh set changes the measurements
 * and the movement still works. The push-up measured only the arm; legs are the
 * same computation one limb over.
 */
export function measureBody(rig) {
  const j = rig.joints;
  const at = (key) => {
    const p = j[key];
    return p ? new THREE.Vector3(p[0], p[1], p[2]) : null;
  };

  const arm = { upper: 0, fore: 0, rest: {}, frame: {} };
  const leg = { thigh: 0, shank: 0, rest: {}, foot: {} };

  for (const side of ["L", "R"]) {
    const shoulder = at(`shoulder.${side}`);
    const elbow = at(`elbow.${side}`);
    const wrist = at(`wrist.${side}`);
    const hip = at(`hip.${side}`);
    const knee = at(`knee.${side}`);
    const ankle = at(`ankle.${side}`);
    const toe = at(`toes.${side}`);
    const toetip = at(`toetip.${side}`);

    arm.rest[side] = {
      upper: elbow.clone().sub(shoulder).normalize(),
      fore: wrist.clone().sub(elbow).normalize(),
    };
    leg.rest[side] = {
      thigh: knee.clone().sub(hip).normalize(),
      shank: ankle.clone().sub(knee).normalize(),
    };

    // Lengths are taken from the left side only and shared. Left and right agree
    // to a tenth of a millimetre — the build asserts it — and one length per
    // limb keeps a solved pose exactly symmetric instead of a millimetre off.
    if (side === "L") {
      arm.upper = shoulder.distanceTo(elbow);
      arm.fore = elbow.distanceTo(wrist);
      leg.thigh = hip.distanceTo(knee);
      leg.shank = knee.distanceTo(ankle);
    }

    const f = rig.handFrames?.[`hand.${side}`];
    if (f) {
      arm.frame[side] = {
        fingerDir: new THREE.Vector3(...f.fingerDir),
        palmNormal: new THREE.Vector3(...f.palmNormal),
      };
    }

    // The foot's own frame: forward is ankle toward the toe knuckles, up is the
    // world up it rests at in the authored standing pose. Orienting the foot
    // needs two axes for the same reason the palm did — aiming alone leaves the
    // roll free, and a foot rolled onto its edge is as wrong as a hand was.
    leg.foot[side] = {
      forward: toe.clone().sub(ankle).normalize(),
      up: new THREE.Vector3(0, 1, 0),
      ankle,
      toe,
      toetip,
      // How far the ankle joint sits above the ground when the sole is flat.
      // Read from the toe contact rather than assumed, then corrected against
      // measured sole geometry once the meshes are bound.
      ankleHeight: ankle.y,
      toeReach: ankle.distanceTo(toe),
    };
  }

  return { arm, leg };
}
