import { useCallback, useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { centreOf } from "../PickTrack.jsx";

import { LEVELS } from "../fiber/fiberGeometry.js";
import { advance, createFiberState, settleAt } from "../fiber/fiberSimulation.js";
import { loadScenario } from "../scenarioData.js";
import { closePreview, openPreview, paintPreview, render, stepPreview } from "./previewLevel.js";
import "./wayin.css";

/**
 * The way down from the body scale: a magnifier on every muscle the movement
 * uses, and one mini view of the fibre they all lead to.
 *
 * WHY THIS EXISTS AT ALL. The body scale had no visitor-facing way down —
 * measured 2026-09-03 by clicking through the app. `to-fiber` was real and
 * worked, and it lived inside the `⌘D` inspector, so the app's whole premise
 * (body → fibre → cell → signalling) was broken at its first step behind a
 * developer keystroke. `ScaleTrail`, which used to be the visible way between
 * scales, is rendered by nobody.
 *
 * ONE PREVIEW, MANY MAGNIFIERS, AND THE OWNER IS WHY IT IS THAT CHEAP. I had
 * said the mini view would have to draw each muscle's own fibre, which would
 * have made this much larger than the other two seams. The owner asked whether
 * it really had to — *"엥 아니 그 근육의 섬유를 꼭 그려야돼?"* — and it does not:
 * `buildFiberLevel()` takes no arguments. The fibre scale draws the same
 * sarcomere whichever muscle you arrive from. So there is one picture here, not
 * fourteen, and it is built once.
 *
 * THAT ALSO SETTLES THE ARCHITECTURE. `previewLevel` keeps ONE open preview in a
 * module variable and `openPreview` disposes whatever was there. Fourteen
 * `WayIn`s would have spent the whole mount stomping each other's render
 * targets. Here the preview is opened once, read once, and the resulting still
 * is shared by every magnifier — which is what it should be, because it is the
 * same picture.
 *
 * ONLY ONE OPENS AT A TIME. `open` holds a muscle name rather than a boolean, so
 * hovering a second magnifier moves the view rather than lighting two of them.
 */

/* THE PREVIEW LASTS AS LONG AS THE POINTER, AND NOT A SECOND LONGER — owner,
   2026-09-06. It used to hold for ten seconds after the pointer left, which is a
   window sitting open over the anatomy long after the question that opened it
   was answered, and on a body you are meant to be reading it is in the way. */
/** The gap the pointer may cross without closing it. `WayIn`'s number, because
    the two components are one control on two floors. */
const GRACE_MS = 420;

/** How often the open coin advances and repaints — see `paintPreview` for why
    twelve a second and not every frame. */
const STEP_MS = 80;

/* WHAT THE COIN PLAYS. `DEFAULT_MODE` is `twitch` — one contraction a second
   with the fibre at rest for most of it, so most frames of the coin are the same
   frame. `tetanus` is a held contraction: it goes and stays gone, which is the
   one thing a look this size can actually show. */
/* `tetanus` -> `twitch` ON 2026-09-07 (3b-2). Owner: the coin's sarcomere was
   *"메인이랑 색깔이 다른데"* — *"컬러 렌즈를 너가 해둔거 같았어"*. It was not a lens; it
   was a held contraction: calcium flooding, the rings in the calcium colour for
   every frame, while the floor at rest draws them blue. `twitch` is the floor's
   own unbound default — at rest most of the second, one pull — so the coin is
   the floor's picture, a little closer, which is what was asked for. */
const COIN_MODE = "twitch";



/* The fibre scale's own builder and its own camera, read off the table the fibre
   scale itself reads, so this cannot describe a destination that has moved. */
/* THE SARCOMERE, NOT THE FIBRE — 2026-09-07, owner, item 3b: *"body -> fiber는
   sacromere를 보여주는게 맞을 것 같아"*. The floor below still ARRIVES on the
   fascicle (its pass descends fascicle → fibre → sarcomere); what the coin
   promises is what the descent is FOR, and that is the sarcomere. Still the
   destination's own builder and its own camera, off the same table. */
const FIBER_SEAM = Object.freeze({
  to: "fiber",
  build: LEVELS.sarcomere.build,
  camera: LEVELS.sarcomere.camera,
  /* DRESSED AS THE FLOOR DRAWS IT AT REST — 2026-09-07 (3b-2). The owner: the
     coin's sarcomere was *"메인이랑 색깔이 다른데"*, like a colour lens. It was: the
     level is BUILT with its rings in the calcium colour and only `update`
     paints them into the resting blue every frame on the floor; the coin never
     called it, so it photographed a sarcomere the floor never shows. One
     resting state, one update — the same call `FiberScene` makes at 1295. */
  dress: (built) => built.update?.(createFiberState(), 0),
  /* 0.45 -> 0.40: BODY 3rd round, *"살짝 만 더 줌"*. Only this coin. */
  margin: 0.4,
  /* The picture a little to the left in the disc — owner, BODY 3rd round. */
  pan: 0.08, /* 0.18 -> 0.09 -> 0.08: owner, *"오른쪽으로 다시 9%"*, then *"1% 오른쪽"* */
  tilt: -0.05, /* -0.15 -> -0.10: owner, *"아래로 5% 다시"*. Negative aims below the subject, so the subject sits higher in the disc. */
});

/**
 * Where the magnifier stands, per frame, rather than where the muscle WAS.
 *
 * `usedSpots` boxes each muscle once — when the rig and the roles land — and the
 * body does not stay in that pose. So the door sat at the position the muscle
 * happened to occupy at load, and every movement since then walked out from
 * under it. On the bench press that reads as "the magnifier is roughly right the
 * first time and wrong afterwards", which is exactly how the owner described it;
 * on a stride it is simply somewhere else.
 *
 * Tracked from the mesh's own world bounding box rather than its matrix: 310 of
 * these are skinned, and a SkinnedMesh's transform is the bind pose, not where
 * the vertices ended up. The box is the honest answer and it is one per lens —
 * there are one or two on screen, not four hundred.
 */
function LensAnchor({ spot, children }) {
  const group = useRef(null);
  const at = useRef(new THREE.Vector3());
  useFrame(() => {
    const mesh = spot?.mesh;
    if (!group.current || !mesh) return;
    if (centreOf(mesh, at.current)) group.current.position.copy(at.current);
  });
  return (
    <group ref={group} position={spot.at}>
      {children}
    </group>
  );
}

export default function MuscleLens({ spots, onGo }) {
  const { gl } = useThree();
  const [ready, setReady] = useState(false);
  const coin = useRef(null);
  const [open, setOpen] = useState(null);
  /* THE GLYPH GOES WITH THE PRESS TOO — 2026-09-07 (4.3, seen in the stills):
     the disc went at once but the magnifier icon rode the whole dive, a little
     button floating on a muscle surface the camera was pushing into. This
     scene unmounts under the wash, so nothing resets it. */
  const [pressed, setPressed] = useState(false);
  const hold = useRef(0);

  /* BUILT ONCE FOR THE WHOLE SCENE. `LEVELS.fiber` is already the seam shape —
     its own builder and its own camera — so nothing is described here that the
     fibre scale does not itself declare. It needs no `lights`: the fibre scene
     draws under the shared `LIGHTS`, which is what `previewLevel` falls back to.
     Read a frame late for the reason `WayIn` reads a frame late — the renderer
     has to be past the real scene's own draw before a target readback is what
     the viewer would see. */
  useEffect(() => {
    if (!spots?.length) return undefined;
    openPreview(gl, FIBER_SEAM);
    const id = requestAnimationFrame(() => {
      render(gl, 1);
      setReady(true);
    });
    return () => {
      cancelAnimationFrame(id);
      setReady(false);
      closePreview();
    };
  }, [gl, spots?.length]);

  useEffect(() => () => clearTimeout(hold.current), []);

  /* AND NOW IT PLAYS. The fibre steps its OWN simulation — `advance` is the
     function `FiberScene` drives the real scale with — so the coin contracts the
     way the place it leads to contracts rather than to a motion invented here.
     NOTHING ENTERS REACT STATE. The first attempt set a PNG data URL twelve
     times a second, which re-rendered the drei `<Html>` this control lives in and
     replaced the button under the pointer; the view opened and shut on its own
     and I reverted it. `paintPreview` writes pixels straight to a canvas held by
     a ref, so the DOM never moves and this is cheaper besides — one readback,
     no PNG encode.
     TWELVE A SECOND, NOT SIXTY. Each step is a GPU readback, which stalls the
     pipeline; doing that inside `useFrame` would cost the real scene a stall per
     frame for the sake of a coin. */
  useEffect(() => {
    if (!open || !ready) return undefined;
    const st = createFiberState();
    /* THE FLOOR'S OWN REPETITION, NOT AN INVENTED TWITCH — 2026-09-07 (3b-2).
       Owner: *"그냥 그 Main그대로 보여주고 싶어 조금 줌인 되어서"*. The floor below
       arrives bound to `soce_on` and plays ONE PULL: one archived cycle at a
       fifth speed, opening just before the second burst (`runWindow` in
       `MuscleFiberVisualization`). The coin plays the same window from the same
       archive — 37 KB, fetched on the first hover and cached by `loadScenario`,
       so a visitor who never reaches for the door never pays. Until it lands
       (milliseconds here) the coin runs the floor's unbound default, `twitch`,
       which is also what the floor itself shows before its own fetch lands. */
    let scenario = null;
    let window_ = null;
    let alive = true;
    loadScenario("soce_on")
      .then((sc) => {
        if (!alive || !sc?.protocol?.cycle_s) return;
        const pr = sc.protocol;
        const from = pr.cycle_s - pr.stim_s * 0.6;
        window_ = { from, to: from + pr.cycle_s, speed: 0.2 };
        scenario = sc;
        settleAt(st, from, { mode: "rep", scenario });
      })
      .catch(() => {});
    const id = setInterval(() => {
      stepPreview(gl, (built) => {
        if (scenario && window_) {
          advance(st, (STEP_MS / 1000) * window_.speed, { mode: "rep", scenario });
          if (st.time >= window_.to) settleAt(st, window_.from, { mode: "rep", scenario });
        } else {
          advance(st, STEP_MS / 1000, { mode: COIN_MODE });
        }
        built.update?.(st, st.time);
      });
      paintPreview(gl, coin.current);
    }, STEP_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [open, ready, gl]);

  /* AS LONG AS THE POINTER, PLUS A GRACE — the same rule and the same 420 ms
     `WayIn` uses, so the two components that do this one job stop having two
     answers to it. The ten-second hold both of them carried is gone; the comment
     above this used to describe it and was left behind when the timer went.
     THE GRACE IS FOR A PICTURE THAT MOVES. The lens tracks a muscle through the
     movement, so on a bench press the control can slide out from under a pointer
     that has not moved at all — which is what the owner saw as *"it like blinks
     and goes away"*. It covers a body stepping out from under the pointer for a
     moment; it does not keep the disc up after you have walked away. */
  const show = useCallback((name) => {
    clearTimeout(hold.current);
    setOpen(name);
  }, []);
  const dismiss = useCallback((name) => {
    clearTimeout(hold.current);
    hold.current = setTimeout(() => setOpen((n) => (n === name ? null : n)), GRACE_MS);
  }, []);

  if (!spots?.length) return null;

  if (pressed) return null;
  return spots.map((spot) => (
    <LensAnchor key={spot.name} spot={spot}>
      <Html center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
        <div className={open === spot.name ? "wayin wayin--near" : "wayin"}>
          {/* A real button, so this is reachable by keyboard: the body scale's
              only other way down is a developer keystroke. Focus shows the view
              the same way a hover does, and the press commits. */}
          <button
            type="button"
            className="wayin__target"
            data-testid={`muscle-lens-${spot.name}`}
            aria-label={`Go inside — ${spot.label ?? spot.name}`}
            onPointerEnter={() => show(spot.name)}
            onPointerLeave={() => dismiss(spot.name)}
            onFocus={() => show(spot.name)}
            onBlur={() => dismiss(spot.name)}
            /* 4.1 — owner, 2026-09-07: *"hover 3d 는 바로 사라져"*. The disc used
               to sit through the press and go with the pointer; it goes with the
               press now, before the ride starts. */
            onClick={() => {
              setOpen(null);
              closePreview();
              setPressed(true);
              onGo?.(spot);
            }}
          />
          <span className="wayin__lens" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <circle cx="10.5" cy="10.5" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
              <line x1="15.2" y1="15.2" x2="20.4" y2="20.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>

          {open === spot.name && ready && (
            <div className="wayin__door">
              <span className="wayin__hole">
                <canvas className="wayin__disc" ref={coin} width={384} height={384} aria-hidden="true" />
              </span>
              {/* The muscle's name was deleted from under the disc, 2026-09-06.
                  It is on the plate standing on the muscle itself and in the
                  card; a third copy inside the preview is the same fact twice
                  more, over the one picture the preview exists to show.
                  WHAT REPLACES IT IS THE ACTION, at the owner's word the same
                  day: *"mini 3d (go inside)밑에 go inside text(항상 잘보이게
                  색깔을 잘 선택해서)"*. The disc shows WHERE the press goes; the
                  words say that it is a press at all — without them the preview
                  is a picture that happens to be under the pointer.
                  ON ITS OWN PLATE RATHER THAN ON THE PICTURE. "always legible"
                  cannot be a colour choice here: what is behind it is a live
                  3D render whose brightness changes every frame as the fibre
                  contracts. Ink on an opaque plate is legible against anything,
                  and a colour picked against one frame of that disc is not. */}
              <span className="wayin__go">Go inside →</span>
            </div>
          )}
        </div>
      </Html>
    </LensAnchor>
  ));
}
