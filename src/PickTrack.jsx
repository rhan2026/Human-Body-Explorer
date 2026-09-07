import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* Reported at 20 Hz, not every frame. The three lower scales' callouts already
   move every frame because they are inside the R3F tree and cost one matrix
   each; this crosses into React state, where a set per frame is a render per
   frame for a line two numbers long. A pick that lags 50 ms is a pick nobody
   sees lag. */
const TICK_MS = 50;
/* Below this the report is noise: the leader's own stroke is 1 px. */
const MOVED_PX = 1;

const _v = new THREE.Vector3();
const _box = new THREE.Box3();

/**
 * Where the picked thing IS, this frame, rather than where the pointer was.
 *
 * `PickLeader` and the front door's pick pill were anchored to the `clientX`
 * and `clientY` the click carried, redrawn only on `resize`. Everything that
 * moves the muscle without resizing the window then moves the muscle and leaves
 * the answer behind: the body plays by default, the camera orbits, and
 * switching exercise re-frames the whole scene without clearing the pick.
 * Estimated drift off the camera presets and `rig.json`'s joints — a pull-up
 * lifts the body about 0.30 m against a 2.594 m frame (12-14%, some 100 px on
 * an 830 px stage), freestyle swings an arm a full metre (about 47%), running's
 * stride about a third of the frame — against a leader that is 405 px long.
 *
 * `Gizmos.jsx` already answers this on the three scales below, every frame, and
 * its comment forbids exactly the state this leaves behind: *"A callout for a
 * thing a viewer cannot see is worse than no callout: it is a label on
 * nothing."* The front door and the body scale are the two screens a first-time
 * viewer meets, so they get the same convention rather than a different one.
 *
 * THE MESH, NOT THE POINT IT WAS HIT AT. The first version projected the world
 * coordinate the raycast returned, which is a fixed point in the room: the body
 * animates around it and the projection never moves. What has to be tracked is
 * where the MUSCLE is now, so this boxes the object every tick — the same
 * `Box3.setFromObject` and centre that `bestPick` uses to choose the ride's
 * muscle, on a clock instead of once.
 *
 * Found by the gate rather than by reading: the run advanced two seconds and
 * the leader's far end had not moved by a single pixel.
 */
/**
 * Where an object is NOW, in world space.
 *
 * A BOUNDING BOX IS THE WRONG ANSWER FOR HALF OF THEM, and `MotionScene.jsx`
 * already says why about its own framing gate: *"The skinned muscles are not
 * walked: their bind-pose geometry box says nothing about where the GPU puts
 * them."* A `SkinnedMesh`'s `matrixWorld` barely moves — the skeleton moves the
 * vertices — so `Box3.setFromObject` returns the same box every frame. The
 * first version of this used it and the gate caught it: the run advanced two
 * seconds and the leader's far end had not moved by one pixel.
 *
 * So a skinned mesh is sampled the way the GPU draws it, through
 * `applyBoneTransform`, at a handful of vertices spread across the buffer. Eight
 * is enough for a centre to follow a muscle and cheap enough for a 20 Hz tick;
 * anything unskinned still gets its box, which for a mesh parented to an
 * animated segment is exact.
 */
const SAMPLES = 8;
const _p = new THREE.Vector3();

export function centreOf(object, out) {
  if (object.isSkinnedMesh) {
    const pos = object.geometry?.attributes?.position;
    if (!pos || !object.skeleton) return false;
    out.set(0, 0, 0);
    const step = Math.max(1, Math.floor(pos.count / SAMPLES));
    let n = 0;
    for (let i = 0; i < pos.count; i += step) {
      object.applyBoneTransform(i, _p.fromBufferAttribute(pos, i));
      out.add(object.localToWorld(_p));
      n += 1;
    }
    if (!n) return false;
    out.divideScalar(n);
    return true;
  }
  _box.setFromObject(object);
  if (_box.isEmpty()) return false;
  _box.getCenter(out);
  return true;
}

export default function PickTrack({ name, onScreen }) {
  const { camera, gl, scene } = useThree();
  const last = useRef({ t: 0, x: null, y: null });
  const cb = useRef(onScreen);
  cb.current = onScreen;

  useEffect(() => {
    if (!name) cb.current?.(null);
    last.current = { t: 0, x: null, y: null };
  }, [name]);

  useFrame(() => {
    if (!name) return;
    /* `performance.now()`, not the frame clock: R3F's clock is shared and this
       only needs a wall-clock throttle, not the scene's own time. */
    const now = performance.now();
    if (now - last.current.t < TICK_MS) return;
    last.current.t = now;

    const object = scene.getObjectByName(name);
    if (!object || !object.visible) {
      if (last.current.x !== null) cb.current?.(null);
      last.current = { t: now, x: null, y: null };
      return;
    }
    if (!centreOf(object, _v)) return;
    _v.project(camera);
    /* BEHIND THE CAMERA IS NOT ON THE GLASS. `project` mirrors a point behind
       the lens into the frame, so an orbit past the body would otherwise leave
       the answer pointing at a plausible-looking place on the wrong side. Same
       reason `Gizmos` culls at ndc.z > 1. */
    if (_v.z > 1) {
      if (last.current.x !== null) cb.current?.(null);
      last.current = { t: now, x: null, y: null };
      return;
    }
    const rect = gl.domElement.getBoundingClientRect();
    const x = rect.left + ((_v.x + 1) / 2) * rect.width;
    const y = rect.top + ((1 - _v.y) / 2) * rect.height;
    if (
      last.current.x !== null &&
      Math.abs(x - last.current.x) < MOVED_PX &&
      Math.abs(y - last.current.y) < MOVED_PX
    ) {
      return;
    }
    last.current = { t: now, x, y };
    cb.current?.([x, y]);
  });

  return null;
}
