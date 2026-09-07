import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Bounds, GizmoHelper, GizmoViewcube, Html, OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { hashForScale, go } from "./scaleRoute.js";

import { canonicalExerciseId } from "./motion/registry.js";
import { Floor } from "./motion/props.jsx";
import AppShell from "./shell/AppShell.jsx";
import MotionList from "./shell/MotionList.jsx";
import GroupChips from "./shell/GroupChips.jsx";
import OpacityDock from "./shell/OpacityDock.jsx";
import { usePanelOpen } from "./shell/uiState.js";
import { PAPERS } from "./trace/papers.js";
import Guide from "./guide/Guide.jsx";
import { describeRoles, setSceneContext, VIEW } from "./shell/assistantContext.js";
import { SHOW_GROUPS, SHOW_MUSCLE } from "./shell/showGroups.js";
import { markWalkDone, walkAlreadyDone } from "./guide/firstWalk.js";


const MODELS = {
  muscles: "/models/muscles-individual.glb",
  shell: "/models/body-shell.glb",
  skeleton: "/models/skeleton.glb",
};

/** Opening camera. The set is Y-up, facing +Z; the view cube drives it after. */
const CAMERA_START = [0, 0.9, 3.0];
const CAMERA_TARGET = [0, 0.9, 0];

/**
 * Layer opacities: the DEFAULTS for the dock's sliders (owner, 2026-08-31 —
 * "add a skin & skeleton opacity slider on the bottom corner").
 *
 * The defaults keep the old readings: skin faint enough to read as body
 * context without occluding the muscles — ~4.7% of the surface has muscle
 * geometry sitting up to 12 mm OUTSIDE the shell, which leaks through a
 * near-opaque skin, so a viewer turning the slider up sees that leak; it is
 * the mesh set's, not the slider's.
 */
const SHELL_OPACITY = 0.18;
const SKELETON_OPACITY = 0.55;

/**
 * Which exercises animate is no longer a list kept here — it is whatever the
 * motion registry holds. A list in this file is a list that goes stale the first
 * time someone adds a movement and forgets to come back.
 */
/* THE ROUTE IS BUILT BY `scaleRoute.js`, NOT ASSEMBLED HERE. A template literal
   spelling `#motion/${id}` is a second grammar for the app's addresses, and the
   moment the real one changes — it already has once, when a muscle segment left
   the middle of the hash — a hand-typed one keeps making the old shape and the
   parser tolerates it until it does not. `frontDoor.test.js` holds this by name.
   `hashForScale` takes the state and the scale it is going to and returns the
   whole address, which is the only place that knows what an address looks
   like. */
const motionRouteFor = (key) => hashForScale({ exercise: canonicalExerciseId(key) }, "body");

/* EXPORTED, 2026-09-01. `MotionScene`'s Activation legend reads the labels off
   this table rather than spelling them again — the three words and the three
   opacities are one fact, and this file already holds the argument for what each
   tier means. `roleLegend.test.js` reads the same table against
   `styles.css`'s swatch ramp, so a fourth place to write them down is a fourth
   chance for the key and the picture to disagree. */
export const ROLE_STYLE = {
  primary: { label: "Primary", opacity: 1, emissive: 0.35 },
  secondary: { label: "Secondary", opacity: 0.55, emissive: 0.08 },
  stabilizer: { label: "Stabilizer", opacity: 0.25, emissive: 0 },
  // Uninvolved muscles are hidden outright rather than dimmed — a faint muscle
  // still reads as "slightly active", which is exactly the wrong signal.
  //
  // The group palette is this page's identity, and it flows the other way
  // now: the owner tried the press scene's effort ramp here for an afternoon
  // (2026-08-30) and reversed it — the press scene wears THESE group colours
  // instead, so the two pages still share one language.
  inactive: { label: "Not involved", opacity: 1, emissive: 0, hidden: true },
};

function useManifest() {
  const [manifest, setManifest] = useState(null);
  useEffect(() => {
    fetch("/mapping/muscle-map.json")
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setManifest(false));
  }, []);
  return manifest;
}

/**
 * Walk up to the node that carries the glTF extras written by the build.
 *
 * Keyed on `group`, which every mesh has. Keying on `muscleKey` silently skips
 * the 321 meshes outside the exercise roster, leaving them in the source's red
 * material and visible when they should be hidden.
 */
function findMuscleNode(object) {
  let node = object;
  while (node && !node.userData?.group) node = node.parent;
  return node ?? null;
}

function MuscleLayer({ manifest, groupSel, muscleOpacity, selectedKey, onSelect, query }) {
  const gltf = useGLTF(MODELS.muscles, true, true);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    const needle = query.trim().toLowerCase();

    scene.traverse((object) => {
      if (!object.isMesh) return;
      const node = findMuscleNode(object);
      if (!node) return;

      const { group, muscleLabel } = node.userData;
      // Since the unification this page is Idle: no exercise, no roles — the
      // group chips are the one highlighting control (owner, 2026-08-31).
      const passesGroup = !groupSel || groupSel.has(group);
      const passesQuery = !needle || muscleLabel.toLowerCase().includes(needle);
      const style = ROLE_STYLE.secondary;
      // Mesh name, not muscleKey: the latter is null for every non-roster mesh,
      // so selecting one of them would highlight all 321 at once.
      const isSelected = node.name === selectedKey;

      object.visible = passesGroup && passesQuery && muscleOpacity > 0.02;

      const material = object.material.clone();
      material.color.set(manifest.groups[group]?.color ?? "#cccccc");
      material.transparent = style.opacity * muscleOpacity < 0.999;
      material.opacity = style.opacity * muscleOpacity;
      material.depthWrite = style.opacity > 0.5;
      material.emissive = new THREE.Color(manifest.groups[group]?.color ?? "#ffffff");
      material.emissiveIntensity = isSelected ? 0.7 : style.emissive;
      material.roughness = 0.72;
      object.material = material;
    });
  }, [scene, groupSel, muscleOpacity, selectedKey, query, manifest]);

  const handleClick = (event) => {
    const node = findMuscleNode(event.object);
    if (!node) return;
    event.stopPropagation();
    /* WHERE THE POINTER WAS, because the answer has to land beside the
       question. Measured 2026-09-05 at 1440x900: the confirmation landed
       **596 px** from the pick it confirms, because the pill was pinned to the
       bottom centre of the stage wherever the pointer went. `gate-legibility`
       has held the same rule for the body scale since 2026-08-26 ("a pick's
       answer is either beside the pick or joined to it") and the front door is
       the one screen where a viewer actually POINTS at something.
       CLIENT COORDINATES, not the canvas's. The pill is positioned against the
       viewport so the number does not have to be re-based on a stage that moves
       when the drawer opens. */
    onSelect({ ...node.userData, meshName: node.name, at: [event.clientX, event.clientY] });
  };

  /**
   * The cursor, which was the whole of the defect.
   *
   * A person walked in on 2026-08-17, saw the chest light up for the bench
   * press, moved onto it and wrote: "the muscles light up and are not
   * clickable." They were clickable — `handleClick` has been here the whole time
   * and it does select. Nothing on screen said so and nothing changed when the
   * pick landed, so the most obvious gesture in the app read as dead. Two
   * pointer handlers and a strip below are the entire fix, and the lesson is
   * that an affordance nobody can see is indistinguishable from a missing one.
   */
  return (
    <primitive
      object={scene}
      onPointerDown={handleClick}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    />
  );
}

function StaticLayer({ url, opacity, color, depthWrite, side }) {
  const gltf = useGLTF(url, true, true);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    scene.traverse((object) => {
      if (!object.isMesh) return;
      const material = object.material.clone();
      if (color) material.color.set(color);
      material.transparent = opacity < 1;
      material.opacity = opacity;
      // X-ray needs the shell to stop writing depth, otherwise it occludes the
      // muscles behind it however faint it is. That single flag is what
      // separates "translucent skin" from "fog over the anatomy".
      /* STATED, NOT INHERITED FROM A THRESHOLD. This read `depthWrite ??
         opacity > 0.6` again on Rex's branch, and a fractional threshold makes
         every intermediate opacity its own rendering mode: a layer at 0.55
         writes depth and the same layer at 0.45 does not, so the skeleton came
         back double-coated at exactly the settings a viewer drags through.
         `>= 1` is the honest line — a layer either is opaque or it is not — and
         a caller that needs the other answer passes it. */
      material.depthWrite = depthWrite ?? opacity >= 1;
      /* AND WHICH FACES ARE DRAWN, STATED FOR THE SAME REASON. A shell seen from
         inside needs both sides or it disappears when the camera goes in; a
         skeleton drawn double-sided coats itself. Left to a default, one of the
         two is always wrong, and which one depends on where the camera happens
         to be. */
      if (side !== undefined) material.side = side;
      material.side = THREE.DoubleSide;
      object.material = material;
    });
  }, [scene, opacity, color, depthWrite, side]);

  if (opacity <= 0) return null;
  return <primitive object={scene} />;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="loader">Loading anatomy · {Math.round(progress)}%</div>
    </Html>
  );
}

/**
 * Test hook, MotionScene's pattern: overlay-ui.spec.js reads the camera back
 * out of the scene to prove the drawer never moves it. The drawer is a fixed
 * overlay precisely so the stage — and therefore the camera and the fitted
 * bounds — cannot change size when it opens.
 */
function ExplorerDebug() {
  const { camera, controls, scene } = useThree();
  useEffect(() => {
    window.__explorerState = () => ({
      camera: camera.position.toArray(),
      target: controls ? controls.target.toArray() : null,
      controlsEnabled: controls ? controls.enabled : null,
      // Computed on request, never per frame: where the loaded body actually
      // stands, for placing the ground under it by measurement.
      sceneMinY: new THREE.Box3().setFromObject(scene).min.y,
    });
    return () => {
      delete window.__explorerState;
    };
  }, [camera, controls, scene]);
  return null;
}

/** Bell's introduction is once a visit; see the note where it is read. */
const GREETED_KEY = "hpe.guide.greeted";

export default function App() {
  const manifest = useManifest();
  // null until the viewer touches the chips = every group on, which is the
  // owner's Idle default ("all muscle groups will be highlighted").
  const [groupSel, setGroupSel] = useState(null);
  // The skin slider left (owner, 2026-08-31, second thought): the shell holds
  // the fixed 0.18 everywhere; the dock drives muscles and skeleton instead.
  const [muscleOpacity, setMuscleOpacity] = useState(1);
  const [skeletonOpacity, setSkeletonOpacity] = useState(SKELETON_OPACITY);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  // The drawer's open state lives in the shared shell (shell/uiState.js) —
  // this scene only reads it, to flip OrbitControls off while the page is
  // locked. The drawer overlays the stage, so the canvas never resizes and
  // the camera cannot move however many times it toggles.
  const panelOpen = usePanelOpen();

  /* ── BELL, ON THE FRONT DOOR ────────────────────────────────────────────────
   *
   * Owner, 2026-09-06, walking the app: *"idle 상태여도 그 Character는 보여야돼
   * 뭐 pick an Exercise from the left side bar 뭐 이런식으로 … 처음에는 Hello,
   * I'm your blah blah -> Pick an Exercise blah blah to get started"*.
   *
   * THE EXPLORER HAD NO GUIDE AT ALL. Every other floor mounts one; this screen
   * — the first thing anybody sees — had nobody on it, so the character a
   * visitor meets on the body arrived as a stranger one screen in.
   *
   * TWO LINES, AND THE SECOND ONE NEVER LEAVES. That is the whole of the ask
   * and it is the opposite of a pass: a walk ends and goes quiet, and the owner
   * has said twice today that this character must not go quiet — *"얘는 죽지
   * 않아 항상 마지막에는 뭔 액션으로 안내해줘야돼"*. So the greeting is the
   * temporary one and the instruction is the resting state, not the other way
   * round.
   * NOT `useWalk`. That hook exists to play a storyboard and to remember it was
   * played; both are wrong here — there is no storyboard, and a visitor who
   * comes back to the front door still needs to be told where to start.
   * `at` IS NULL, so Bell walks to its home corner and stands there. The
   * position is `Guide`'s own; this only says what it says. */
  /* ONCE A VISIT, NOT ONCE A MOUNT — 2026-09-07. Owner: *"when the user enters
     the idle page the second time and onwards, the intro message from bell
     shouldnt come out"*. The front door remounts every time a visitor comes
     back up from a scale, and "Hi — I'm Bell" was introducing itself again each
     time. `firstWalk.js`'s session helpers are what every other once-a-visit
     thing here uses, private-window guard and all, so this borrows them with a
     key of its own.
     MARKED WHEN THE GREETING RUNS OUT, not when it starts — `useWalk` settled
     that: a visitor who arrives and leaves inside four seconds has not spent
     theirs. `sessionStorage`, so a new tab is a new visitor. */
  const [greeted, setGreeted] = useState(() => walkAlreadyDone(GREETED_KEY));
  useEffect(() => {
    if (greeted) return undefined;
    const id = setTimeout(() => {
      setGreeted(true);
      markWalkDone(GREETED_KEY);
    }, 4200);
    return () => clearTimeout(id);
  }, [greeted]);

  // What this screen tells the Anatomy Assistant (shell/assistantContext.js):
  // the choices that live only here — the exercise and the pick never touch
  // the hash on the explorer — so the widget out at the Router can answer
  // "this muscle" on the front door. Cleared when the scene unmounts.
  useEffect(() => {
    // Idle since the unification (owner, 2026-08-31): this page selects no
    // exercise any more — the rail navigates to the motion windows instead —
    // so the context carries the pick alone.
    setSceneContext({
      currentView: VIEW.body,
      selectedExercise: null,
      selectedMuscle: selected ? [selected.muscleLabel ?? selected.meshName, selected.groupLabel].filter(Boolean).join(" · ") : null,
      /* WHAT THE BODY IS SHOWING, so Bell can see the state it just set and a
         visitor's own chip presses reach it too. Null while every group is on,
         which is what `groupSel` null means and what the block prints as
         "None" — the whole body, nothing singled out. */
      highlightedMuscles: groupSel && manifest?.groups ? [...groupSel].map((k) => manifest.groups[k]?.label ?? k) : null,
    });
  }, [selected, groupSel, manifest]);

  /* BELL SHOWS A MOVEMENT'S MUSCLES BY SWITCHING THE REST OFF — 2026-09-07.
     Owner: *"when i ask bell about excercises not on the list, it identifies
     what muscles are used but cannot highlight them on the idle model ...
     unselect the irrelevant muscles groups instead of highlighting the
     requested muscles directly"*. The app ships six exercises and a deadlift is
     not one of them, so there is no scenario to load; what there IS is this
     `groupSel`, the same state the chips drive, where anything outside the set
     is hidden. So the seam sets it, and the mechanism is the owner's own.
     UNKNOWN KEYS ARE DROPPED and an all-empty ask is ignored: a model naming a
     group this mesh set does not have must not blank the body. Every group at
     once is `null` rather than a full Set, which is the same picture and the
     state the All chip produces, so the chips read as All afterwards. */
  useEffect(() => {
    if (!manifest?.groups) return undefined;
    const keys = Object.keys(manifest.groups);
    const show = (event) => {
      const asked = Array.isArray(event.detail?.groups) ? event.detail.groups : [];
      const known = asked.filter((g) => keys.includes(g));
      if (!known.length) return;
      /* A search left over from a `show_muscle` would AND with the groups and
         leave one muscle standing where a whole movement was asked for. */
      setQuery("");
      setGroupSel(known.length === keys.length ? null : new Set(known));
    };
    window.addEventListener(SHOW_GROUPS, show);
    return () => window.removeEventListener(SHOW_GROUPS, show);
  }, [manifest]);

  /* AND ONE MUSCLE, WHICH IS A DIFFERENT GRAIN — 2026-09-07. Owner: *"when a
     user requests highlight just 'this' muscle on motion or idle, unselect
     every other muscle"*. A group cannot say "this one": asking for just the
     pectoralis major would light the whole chest.
     SO IT DRIVES THE SEARCH, the other highlighting control (owner,
     2026-08-31), which on this floor hides what does not match — the same
     "unselected" the chips mean here. The groups go back on with it, or a
     muscle in a switched-off group would be singled out and then hidden by the
     chips; and the search box shows the name, so the visitor can see why the
     body is filtered and clear it with a control they already have. */
  useEffect(() => {
    const single = (event) => {
      const label = typeof event.detail?.label === "string" ? event.detail.label.trim() : "";
      if (!label) return;
      setGroupSel(null);
      setQuery(label);
    };
    window.addEventListener(SHOW_MUSCLE, single);
    return () => window.removeEventListener(SHOW_MUSCLE, single);
  }, []);
  useEffect(() => () => setSceneContext(null), []);

  if (manifest === false) {
    return <div className="fatal">Could not load /mapping/muscle-map.json — run `npm run build` in ../anatomy-mesh-set first.</div>;
  }
  if (!manifest) return <div className="fatal">Loading manifest…</div>;

  const showMotion = (key) => {
    // Setting the hash is enough — the router in main.jsx listens for hashchange.
    go(motionRouteFor(key));
  };

  return (
    <main className="app">
      {/* The ▶ Watch it happen trigger left the front door at the owner's ask
          (2026-08-31): it overlapped the shell title, and like the descent
          doors it waits behind the button this app is promised (TODO.md).
          The film itself still runs — ride.spec drives it through
          ride.start(); what is gone is only the on-screen offer. */}
      <AppShell
        scale={null}
        drawer={<>
          <section className="drawer__brand">
            {/* THE SAME NAME THE SHELL SAYS, three centimetres away. These two
                were `Human Performance Explorer` here and `Human Body Explorer`
                in the corner — one screen, two products. Settled 2026-09-05 at
                the owner's word: *"Human Body 로 가자"*. `AppShell.jsx` carries
                the corner half; the folder and the UCSD programme credit keep
                the other name, because neither is what this is called. */}
            <strong>Human Body Explorer</strong>
            {/* One line saying what you are about to SEE, not what the project
                is about — it survived the header it used to live in, because a
                person who opens the menu cold still needs it
                (gate-first-time-walk, panel 1). */}
            {/* THE ONE LINE THAT NAMES THE DESCENT, AND IT WAS TEACHING THE
                RETIRED WORD. It read "the muscle, the fibre, the cell and the
                signalling" — `cell` as a level below `fibre`, which is the
                exact claim `docs/20260905-fix/cell.md` retired the name over: "A
                muscle fiber is already a cell, so presenting 'Cell' as a deeper
                anatomical level is misleading." Renaming the navigation and
                leaving this sentence would have moved the word out of the
                buttons and left it in the promise.
                IT IS PROSE, SO IT IS NOT THE FOUR LABELS. `SCALE_LABEL` is for
                controls; this is the sentence a person reads cold, and it now
                says what each floor is FOR — the chain the canon states as the
                product's argument: visible movement → the muscle → its
                machinery → the energy that runs it → what it signals. */}
            <span className="drawer__sub">
              Watch a repetition, then follow it down into the muscle, its machinery, the energy
              that runs it and the signals it sets off.
            </span>
          </section>

          <section>
            {/* The unified rail (owner, 2026-08-31): Idle IS this page, the
                movements are the motion windows. In-place exercise selection
                left with it — and took the workout form and the Activation
                role filter, which had nothing to stand on without a selected
                exercise. workout-mapping-reaches-the-screen.spec records the
                suspension; the form returns wherever exercise selection
                lands next. */}
            <MotionList
              exercises={manifest.exercises}
              activeId="idle"
              onPick={(key) => {
                if (key !== "idle") showMotion(key);
              }}
            />
          </section>

          <section>
            <p className="label">Search</p>
            <input
              className="input"
              placeholder="Biceps, deltoid…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </section>

          <section>
            <p className="label">Muscle group</p>
            <GroupChips
              groups={manifest.groups}
              selected={groupSel ?? new Set(Object.keys(manifest.groups))}
              onChange={setGroupSel}
            />
          </section>

          {/* DATA, AT THE FOOT OF THE DRAWER — 2026-09-07, owner: *"3논문 + cc by sa home에서
              hamburger 맨 밑으로"*. The three papers the floors run (`trace/papers.js`,
              one line each, the paper reachable) and the anatomy licence. The mesh
              counts that stood here until 2026-08-31 are not asked for. */}
          <section>
            <p className="label">Data</p>
            <ul className="papers">
              {Object.values(PAPERS).map((paper) => (
                <li key={paper.cite}>
                  <a href={paper.href} target="_blank" rel="noreferrer">{paper.cite} ↗</a>
                  <span className="papers__hint">{paper.hint.split(" · ").at(-1)}</span>
                </li>
              ))}
            </ul>
            <p className="credit">Sources: BodyParts3D, © The Database Center for Life Science — CC BY-SA 2.1 Japan · Z-Anatomy by Gauthier Kervyn — CC BY-SA 4.0</p>
          </section>
        </>}
      />

      <div className="body body--single">
        <section className="stage">
          <Canvas
            camera={{ position: CAMERA_START, fov: 32, near: 0.01, far: 100 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: true }}
          >
            <ambientLight intensity={1.35} />
            <directionalLight position={[3, 5, 4]} intensity={2.6} />
            <directionalLight position={[-4, 1, -2]} intensity={1.1} />
            <pointLight position={[0, -2, 3]} intensity={0.7} />

            {/* The press scene's grid floor, under this standing body too —
                one ground plane for both pages. OUTSIDE the Bounds group: the
                fit must frame the body, not a 4-metre floor. Centred (z=0),
                where the model stands; the press offsets its floor forward
                because its bodies travel. */}
            <Floor z={0} />

            <Suspense fallback={<Loader />}>
              <Bounds fit clip margin={1.12}>
                <group>
                  {/* DEPTH IS STATED HERE, NOT DERIVED FROM THE SLIDER'S VALUE.
                      Both layers are dragged through every opacity between 0 and
                      1, and a threshold inside `StaticLayer` made each side of it
                      a different rendering mode: the skeleton wrote depth at 0.55
                      and stopped at 0.45, so it double-coated itself halfway
                      through a drag. Neither of these should ever write depth —
                      they are the see-through shells the muscles are read
                      THROUGH — so they say so, and the slider decides only how
                      visible they are. `frontDoor.test.js` holds this. */}
                  <StaticLayer
                    url={MODELS.shell}
                    opacity={SHELL_OPACITY}
                    color="#e3d6cc"
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                  <StaticLayer
                    url={MODELS.skeleton}
                    opacity={skeletonOpacity}
                    color="#e8e2d8"
                    depthWrite={false}
                    side={THREE.FrontSide}
                  />
                  <MuscleLayer
                    manifest={manifest}
                    groupSel={groupSel}
                    muscleOpacity={muscleOpacity}
                    selectedKey={selected?.meshName}
                    onSelect={setSelected}
                    query={query}
                  />
                </group>
              </Bounds>
            </Suspense>

            {/* Disabled while the drawer is open — the scrim already blocks the
                pointer; this closes the keyboard-and-wheel path too. A prop
                flip, not a remount. */}
            <OrbitControls makeDefault enabled={!panelOpen} enableDamping dampingFactor={0.08} minDistance={0.4} maxDistance={8} target={CAMERA_TARGET} />
            <ExplorerDebug />

            {/* Replaces the front/back/side/reset bar: the cube carries the
                current orientation and its faces are the presets. */}
            <GizmoHelper alignment="top-right" margin={[78, 78]}>
              <GizmoViewcube
                faces={["Right", "Left", "Top", "Bottom", "Front", "Back"]}
                color="#f7f8fa"
                textColor="#161c24"
                strokeColor="#c3cad6"
                hoverColor="#2f6fd0"
              />
            </GizmoHelper>
          </Canvas>

          {/* What the pick landed on. The selection has always been held here —
              it drove the emissive on one mesh out of 467 and nothing else —
              which is a confirmation only for someone already looking at the
              right pixel. Empty until something is picked (CLAUDE.md §9). */}
          {/* Bell's line changes once and then holds. `announce` is off after
              the greeting so a screen reader is not re-read the same standing
              sentence every time this component renders. */}
          <Guide
            at={null}
            line={
              greeted
                ? "Open the menu on the left and pick an exercise to start."
                : "Hi — I'm Bell. I'll take you from a movement down to the molecules that make it."
            }
            announce={!greeted}
          />

          <OpacityDock
            sliders={[
              { label: "Muscles", value: muscleOpacity, onChange: setMuscleOpacity },
              { label: "Skeleton", value: skeletonOpacity, onChange: setSkeletonOpacity },
            ]}
          />

          {selected && (
            <div
              className={selected.at ? "pick pick--at" : "pick"}
              /* NUDGED UP AND CLAMPED IN. Above the pointer rather than under
                 it, so the pill never covers the mesh it names, and held a
                 pill's width off either edge so a pick near the rim still reads.
                 Inline because it is a measurement, not a style. */
              style={
                selected.at
                  ? {
                      left: `${Math.min(Math.max(selected.at[0], 96), window.innerWidth - 96)}px`,
                      top: `${Math.max(selected.at[1] - 34, 16)}px`,
                    }
                  : undefined
              }
              data-testid="explorer-pick"
            >
              <strong>{selected.muscleLabel ?? selected.meshName}</strong>
              {selected.groupLabel && <span> · {selected.groupLabel}</span>}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

Object.values(MODELS).forEach((url) => useGLTF.preload(url, true, true));
