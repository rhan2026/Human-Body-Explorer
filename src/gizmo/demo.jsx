/**
 * The gizmo against real geometry, at the framings it actually has to survive.
 *
 * A SEPARATE ENTRY POINT, NOT A ROUTE. `scaleRoute.js` says SCALE_ORDER is the
 * only list of scales and main.jsx says the hash is state rather than a switch;
 * a sandbox is neither a scale nor a state, so putting it in that grammar would
 * cost the app a fake scale to buy this file a URL. Vite serves any root HTML in
 * dev and builds only index.html, so this exists at
 * http://localhost:<port>/gizmo-demo.html and weighs nothing in production.
 *
 * Three framings because the failure is a framing failure: the cell scale's five
 * callouts were built, rendered and off-canvas at 1024 px, and nobody saw it
 * because nobody looked at 1024 px. 320 is a phone, 768 a tablet, and the stage
 * fills the window otherwise.
 */

import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { LIGHTS, CONTROLS, SCENE } from "../anatomyStyle.js";
import { buildCellLevel, CELL_CAMERA } from "../cell/cellGeometry.js";
import { LEVELS } from "../fiber/fiberGeometry.js";
import { advance, createFiberState } from "../fiber/fiberSimulation.js";
import Gizmos from "./Gizmos.jsx";
import "../styles.css";
import "./gizmo.css";

/**
 * Numbers on the demo are the shape a real caller passes, and they are labelled
 * `Illustrative` because that is what they are: hand-authored to exercise the
 * component, computed by nothing. Labelling them anything else here would be the
 * §5 failure committed in the one file whose whole job is to demonstrate §5.
 *
 * KEYED ON ANCHOR ids, so an entry whose id no anchor carries is spread into
 * nothing. `"a-band"` was one from 2026-08-31, when canon F1 cut the sarcomere
 * from eight plates to the five the pass stops on and the A-band lost its
 * anchor; deleted here 2026-08-31 with no change to what the demo draws. The
 * sarcomere framing therefore exercises the plate WITHOUT a number, which is a
 * shape a real caller passes too.
 */
const NUMBERS = {
  "ampk-subunit": { value: "0.312", unit: "mM", evidence: "Illustrative", why: "a demo value, computed by nothing" },
  nucleotide: { value: "6.489", unit: "mM", evidence: "Illustrative", why: "a demo value, computed by nothing" },
};

/**
 * Every level's `update` has to be called or the geometry is not the geometry:
 * an InstancedMesh whose matrices were never written leaves every instance on
 * the identity, so the first capture of this demo showed a sarcomere as one
 * blob at the origin and the gizmos pointing at it were pointing at nothing.
 *
 * The cell arms are the frozen resting state `cellGeometry.test.js` uses rather
 * than a loaded scenario. This page demonstrates a COMPONENT, and a demo that
 * fetches two published runs to draw a callout would be claiming the callout
 * needs them.
 */
const CELL_REST = {
  atpBeads: 30, adpBeads: 5, ampBeads: 1,
  atpBeadsControl: 30, adpBeadsControl: 5, ampBeadsControl: 1,
  pAMPK: 18, pAMPKControl: 18,
  demand: 0.399187, demandControl: 0.399187,
};

const SCENES = {
  cell: { label: "Cell", build: buildCellLevel, camera: CELL_CAMERA, drive: (m) => m.update(CELL_REST) },
  sarcomere: { label: "Sarcomere", build: LEVELS.sarcomere.build, camera: LEVELS.sarcomere.camera, drive: fibre },
  fiber: { label: "Fiber", build: LEVELS.fiber.build, camera: LEVELS.fiber.camera, drive: fibre },
  fascicle: { label: "Fascicle", build: LEVELS.fascicle.build, camera: LEVELS.fascicle.camera, drive: fibre },
};

/** The unbound curve, which is what `advance` gives with no scenario — the
 *  fibre scale's own honest fallback, labelled `Illustrative` there and here. */
function fibre(model, state, dt) {
  advance(state, dt);
  model.update(state, state.time);
}

const WIDTHS = { "320": "320px", "768": "768px", full: "100%" };

function Scene({ which }) {
  const spec = SCENES[which];
  const model = useMemo(() => spec.build(), [spec]);
  const sim = useRef(createFiberState());
  const { camera } = useThree();

  useFrame((_, dt) => spec.drive(model, sim.current, Math.min(dt, 0.05)));

  /* The instrument, in the same shape as `window.__rigDebug` and
     `window.__fiberState`, and for the same reason those exist: a measurement
     of "did dollying in put an anchor behind the camera?" that cannot read the
     camera can only ever say "I saw nothing", which is not the same answer.
     Demo-only — the component ships no globals. */
  useEffect(() => {
    window.__gizmoCam = () => ({
      pos: camera.position.toArray().map((v) => +v.toFixed(3)),
      distance: +camera.position.length().toFixed(3),
    });
    return () => {
      delete window.__gizmoCam;
    };
  }, [camera]);

  const items = useMemo(
    () =>
      model.anchors.map((a) => ({
        id: a.id,
        label: a.label,
        at: a.at,
        swatch: a.swatch,
        // NO `provenance`. A record is passed only when the number is a function
        // of that scenario's values (lane 4's rule, and CLAUDE.md §5's): hanging
        // a real record off a demo value would attribute a hand-typed number to
        // somebody's published model. The badge answers with the word and this
        // number's own sentence, and says no record is attached.
        ...(NUMBERS[a.id] ?? {}),
      })),
    [model],
  );

  return (
    <>
      <ambientLight intensity={LIGHTS.ambient} />
      <directionalLight position={LIGHTS.key.position} intensity={LIGHTS.key.intensity} />
      <directionalLight position={LIGHTS.fill.position} intensity={LIGHTS.fill.intensity} />
      <primitive object={model.group} />
      <Gizmos items={items} />
      <OrbitControls
        makeDefault
        enableDamping={CONTROLS.enableDamping}
        dampingFactor={CONTROLS.dampingFactor}
        target={[0, 0, 0]}
      />
    </>
  );
}

function Demo() {
  const [which, setWhich] = useState("cell");
  const [width, setWidth] = useState("full");

  return (
    <main className="press" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ display: "flex", gap: "1rem", padding: "0.6rem 1rem", alignItems: "center", flexWrap: "wrap" }}>
        <span className="label">Scale</span>
        {Object.entries(SCENES).map(([id, s]) => (
          <button key={id} data-testid={`scene-${id}`} onClick={() => setWhich(id)} aria-pressed={which === id}>
            {s.label}
          </button>
        ))}
        <span className="label">Stage</span>
        {Object.keys(WIDTHS).map((w) => (
          <button key={w} data-testid={`width-${w}`} onClick={() => setWidth(w)} aria-pressed={width === w}>
            {w}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, width: WIDTHS[width], borderLeft: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>
        <Canvas
          key={which}
          data-testid="gizmo-canvas"
          camera={{ position: SCENES[which].camera, fov: SCENE.camera.fov, near: SCENE.camera.near, far: SCENE.camera.far }}
          gl={SCENE.gl}
          dpr={SCENE.dpr}
          style={{ background: SCENE.background }}
        >
          <Scene which={which} />
        </Canvas>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
