/**
 * Eases the camera between scale levels instead of cutting.
 *
 * Kept apart from the scene because the real body-to-cell transition will drive
 * the same easing from the anatomy page's camera, and should not have to import
 * a mesh builder to do it.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { INTERRUPTS } from "../cinematic.js";

const _target = new THREE.Vector3();

/**
 * @param to      world-space camera position to settle at, as [x, y, z]
 * @param lookAt  orbit target to settle at
 * @param enabled false hands control straight back to the user
 * @param nonce   change it to re-arm the ease at an unchanged destination, so a
 *                Reset can recover the framing after the user has orbited away
 */
/**
 * `firm` — 2026-09-07. A move to a floor's OWN framing (arrival, exercise switch,
 * the walk's return from its lean) must arrive: it is not a nudge a viewer can
 * decline, it is where the picture lives. The interrupt below used to disarm it
 * like any other ease, and three readers hunting the BODY angle found the same
 * thing from three directions — a Ctrl+R held a beat too long (its keydown
 * repeats land in the new document), a trackpad's inertial wheel, a click to
 * focus the window, any of them inside the first ~0.6 s, and the target was left
 * between the origin and the preset with nothing ever re-arming it. A lean
 * toward a picked muscle or the walk's subject stays interruptible: that is
 * attention, and a hand outranks it.
 */
export function useCameraTransition(to, lookAt = [0, 0, 0], enabled = true, nonce = 0, { firm = false } = {}) {
  const firmRef = useRef(firm);
  firmRef.current = firm;
  const { camera, controls } = useThree();
  const goal = useRef(new THREE.Vector3(...to));
  const goalTarget = useRef(new THREE.Vector3(...lookAt));
  const settling = useRef(false);
  const calm = useRef(null);
  if (calm.current === null) {
    calm.current =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // A new destination re-arms the ease. While it is armed the user's own orbit
  // input is overridden, so it disarms as soon as it arrives rather than
  // fighting the controls forever.
  useEffect(() => {
    goal.current.set(...to);
    goalTarget.current.set(...lookAt);
    settling.current = enabled;

  }, [to[0], to[1], to[2], lookAt[0], lookAt[1], lookAt[2], enabled, nonce]);

  /* A HAND ANYWHERE OUTRANKS THE MOVE, WHICHEVER MOVE IT IS.
     `cinematic.js` states the principle — "the viewer reaching for a control is
     the one signal that always outranks the shot" — and `tour.js` implements it
     for the pass, with four INTERRUPTS that end it on the way down. It stopped
     at the pass's last frame. The move AFTER it did not yield: measured
     2026-08-27, the fibre's return from its conclusion [3.79, 1.10, 3.00] to the
     level framing [1.10, 1.80, 7.59] is **5.36 units over 778 ms** — larger than
     the 4.725 of the biggest move inside the pass — and a 140 px drag begun on
     the frame the sentence went left the camera 0.010 from the level framing.
     The drag was thrown away, in the one window a viewer is most likely to reach
     into, because the sentence has just gone and the controls have just
     returned.
     THE SAME FOUR EVENTS, NOT ORBITCONTROLS' `start`. The first version listened
     for `start`, which fires when a gesture begins to drive the camera — and
     three of this project's four INTERRUPTS never reach the controls at all. So
     a viewer who stopped the pass with a key or a wheel still lost the frames
     between their input and React's effect: `tour.js` sets `stopped`, the render
     goes round, `enabled` arrives false here, and an ease in flight has covered
     ground by then. Measured on the fibre, stopping mid-move with a keypress —
     [1.269, 1.687, 6.967] carried on to [1.393, 1.605, 6.501], **0.489 units**,
     against a comment in `FiberScene.jsx` promising the camera stays exactly
     where it was stopped. The cell and signalling scales read 0.000 in the same
     test, because neither happened to be mid-move, which is how this survives a
     screenshot.
     Capture phase and the same list `cinematic.js` publishes, so one vocabulary
     covers the pass, the chrome and the camera. It disarms every user of this
     hook and that is right for all of them: a pointerdown that is about to arm
     the ease anyway — the level ladder, Reset — re-arms it through the effect a
     moment later, and a viewer who grabs the camera out of a Reset has decided
     where to look. */
  useEffect(() => {
    const yieldToHand = () => {
      if (firmRef.current) return;
      settling.current = false;
    };
    for (const type of INTERRUPTS) window.addEventListener(type, yieldToHand, true);
    return () => {
      for (const type of INTERRUPTS) window.removeEventListener(type, yieldToHand, true);
    };
  }, []);

  useFrame((_, delta) => {
    if (!settling.current) return;

    /* A CUT, NOT AN EASE, WHEN A VIEWER HAS ASKED FOR ONE. Seven files in this
       app honour `prefers-reduced-motion` — the pass, the wash, the cinematic,
       four stylesheets — and the one that actually moves a camera had none. So a
       reduced-motion viewer lost the twelve moves that were designed and kept
       the ones that were not: switching exercise still glided 1.259 units and
       swung the aim 24.6°, which is 65% of the frame's height, and the fibre
       level ladder still slid 1.517.
       Disabling it would be the wrong answer. What reduced motion asks for is
       not to be slid at, and Reset and the level ladder are function rather than
       decoration — a Reset that does not reset is worse than one that cuts. So
       the ease becomes a cut and everything still arrives.
       Read once, per `tour.js`'s own reasoning: "a viewer who turns it on
       mid-pass is asking for the next screen to be calm, not for this one to
       stop halfway through a sentence." */
    const k = calm.current ? 1 : 1 - Math.exp(-delta / 0.12);
    camera.position.lerp(goal.current, k);

    if (controls) {
      _target.copy(controls.target).lerp(goalTarget.current, k);
      controls.target.copy(_target);
      controls.update();
    } else {
      camera.lookAt(goalTarget.current);
    }

    /* SETTLED MEANS BOTH HALVES SETTLED, AND SETTLED MEANS EXACT — 2026-09-07.
       This ended the ease when the POSITION was within 0.01 and left the target
       wherever its own lerp had got to. On a fresh load the camera already
       starts at the preset, so the position was "there" on the first frames and
       the target — easing from wherever OrbitControls had it — was abandoned a
       few frames in. Measured on the bench press (tests/one-off/angle.mjs):
       position [2.35, 1.35, 2] on every arrival, target [0, 0.456, 0.29], then
       [0, 0.433, 0.276], then [0, 0.432, 0.275] against an aim of
       [0, 0.55, 0.35] — a different picture on every reload and on browser back,
       the same position each time. Arriving by a hash switch the position was
       far, the ease ran long enough for the target to catch up, and it landed
       right, which is why that path looked fine in isolation.
       So: the ease ends only when both are within tolerance, and it ends by
       writing the goal exactly, so a frame-time that differs between two
       reloads cannot leave two different endpoints. */
    const targetGap = controls ? controls.target.distanceTo(goalTarget.current) : 0;
    if (camera.position.distanceTo(goal.current) < 0.01 && targetGap < 0.01) {
      camera.position.copy(goal.current);
      if (controls) {
        controls.target.copy(goalTarget.current);
        controls.update();
      } else {
        camera.lookAt(goalTarget.current);
      }
      settling.current = false;
    }
  });

  /* WHERE THE CAMERA IS, FOR A GATE TO READ, on every scale that eases.
     Q4 R3 gated "an interrupt leaves the camera alone" against the tissue's own
     silhouette and the gate came back 1 pass / 2 fail on three runs — because a
     sarcomere CONTRACTS, so its x extent changes with the run whether or not
     the camera moved. A measurement that cannot tell the subject from the lens
     is worse than none. Every other layer here publishes what it draws from;
     this is the lens doing the same. */
  useEffect(() => {
    window.__cameraState = () => ({
      position: camera.position.toArray().map((v) => +v.toFixed(4)),
      target: controls ? controls.target.toArray().map((v) => +v.toFixed(4)) : null,
      fov: camera.fov,
    });
    return () => {
      delete window.__cameraState;
    };
  }, [camera, controls]);
}
