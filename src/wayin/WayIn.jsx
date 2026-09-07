import { useCallback, useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { beginDescent } from "../crossing.js";
import { hashForScale, nextScale, parseHash, SCALE_LABEL, currentRoute, go as goRoute } from "../scaleRoute.js";
import { closePreview, openPreview, render, stillOf } from "./previewLevel.js";
import "./wayin.css";

/**
 * The way in, standing in the picture beside the thing you would enter.
 *
 * NOT A CORNER. The corners are spoken for and both are about the ride: the
 * top-left says what this is, the top-right holds the pause and the ways out.
 * The way IN is the one control whose meaning is a place, so it lives at that
 * place. The owner's sentence for the body scale was "운동에서 쓰는 muscle 옆에,
 * 모델과 안 겹치게"; `at` is that generalised — an anchor the scene hands us,
 * already offset sideways so the ring never sits on what it points at.
 *
 * HIDDEN WHILE A PASS RUNS. A tour is the showing, the main state is the
 * touching. `visible` is the scale's own `!tourOn`; there is no second latch.
 *
 * WHAT HOVER SHOWS is the destination itself — its own builder, its own
 * exported camera, rendered by this scene's renderer into a texture and read
 * back once. `previewLevel.js` carries why that cannot drift from what you
 * actually arrive at, and the measurement that let it build on mount rather
 * than behind a delay: under 5 ms, against the 150 that would have forced a
 * loading state into this component.
 *
 * NO `hint` PROP, AND IT LASTED ONE AFTERNOON. It let a caller hang a sentence
 * under the ring, and the body scale hung *"Each repetition sends a command
 * down… go inside to see how."* there. The owner settled the scales' structure
 * the same day and it deleted the sentence rather than moving it: a scale a
 * visitor is touching shows the animation and no prose, and the ring already
 * says "there is a way in" by being a way in. Words that describe an
 * affordance standing next to that affordance are the affordance twice.
 * Flagged, grepped (`src`, `tests`: no other caller, no spec steered by it),
 * removed, grepped again. The clamp that kept the block on a 320 px screen went
 * with it — it existed only because the block existed.
 *
 * ONE READBACK PER OPEN, not per frame. `readRenderTargetPixels` stalls the
 * pipeline, so it runs once, when a viewer asks, and the disc is the still it
 * returns. The dolly the preview module can do is not used here for the same
 * reason — animating it would mean reading back every frame to show it.
 */
/**
 * How long the view stays up after the pointer has left.
 *
 * TEN SECONDS WAS THE OLD ANSWER AND IT BECAME THE COMPLAINT — 2026-09-06,
 * owner: *"fiber, energy, signalling 단계에서 zoom hover가 안없어져"*. On
 * 2026-09-03 they asked for *"한번 호버 하면 10초간 뜸"*, and the reason was
 * real: a view that lives only under the pointer cannot be read, because moving
 * a few pixels to look INTO the picture closes the thing you were looking at.
 * The fix over-reached. A 176 px disc that sits over the scene for ten seconds
 * after you have walked away is not a view you were given time to read, it is a
 * panel that will not go.
 * AND THE BODY NEVER DID THIS. `MuscleLens` closes on leave, which is why the
 * floor the owner uses most has never had the complaint — two components doing
 * the same job by different rules, which is the thing this seam exists to stop.
 * A GRACE RATHER THAN A HOLD solves the original problem completely: the disc is
 * inside the same wrapper the pointer entered, so moving onto it fires no leave
 * at all, and the grace only covers the gap between two elements. 420 ms is
 * about twice the slowest hand-off measured between the lens and the disc.
 */
const GRACE_MS = 420;

/**
 * @param carry WHAT THE FLOOR ABOVE KNOWS THAT THE FLOOR BELOW WANTS.
 *   Merged into `beginDescent`'s payload, additively and last, so a scale that
 *   passes nothing is exactly what it was. FIBER and ENERGY are the only seam
 *   where this is worth anything: they replay the SAME archived bout on the
 *   same protocol clock, so "you came down at repetition 7" survives the
 *   crossing and can be honoured. Across ENERGY -> SIGNALS the clock changes
 *   and the integration contract drops these on its own; nothing here has to
 *   know that.
 *   Only what is measured. `t`, `rep` and the phosphate are the run's; there is
 *   no ATP-demand series in a fibre scenario, so none is sent. The ATP in the
 *   bridge sentence is a true statement about a mechanism, not a number, and
 *   inventing one to fill this field is the trade this repo does not make.
 */
/**
 * `onWant` — the floor's chance to START paying for the seam.
 *
 * OWNER, 2026-09-06, choosing how ENERGY pays for its coin: *"2번으로 하고"* —
 * build it on the first hover, so *"안 누르는 방문자는 값을 안 낸다"*. The build
 * moved (see `open`); the FETCH did not. ENERGY still downloaded all three Fowler
 * scenarios on arrival, because this component returned null until `seam`
 * existed and a seam that needs a fetch could not exist before it. The 2026-09-06
 * pass audit found the record saying the visitor pays nothing and the network
 * saying 228 KB. So the lens now stands on `visible` alone, and the first hover
 * asks the floor for the seam; the disc opens when it lands, which on this
 * machine is under a second. A floor whose seam costs nothing passes no `onWant`.
 */
export default function WayIn({ at, seam, visible = true, radius = 0.14, carry = null, onGo = null, onWant = null, onLeave = null }) {
  const { gl } = useThree();
  const [still, setStill] = useState(null);
  const [near, setNear] = useState(false);
  const hole = useRef(null);
  const hold = useRef(0);
  const target = useRef(null);
  useEffect(() => () => clearTimeout(hold.current), []);

  /* IT MUST NOT OPEN OFF THE EDGE. The window is centred on a point in the
     SCENE, and the two seams put that point near the right of their pictures —
     the fibre's opened to x 1283 in a 1280 stage. Three pixels there, but the
     anchor is a 3D position and the stage is every width this app is used at, so
     the number is not the point: an anchor near an edge opens a window past it.
     NUDGED, NOT MOVED. The door stays on its anchor and slides only as far as it
     has to, so it still reads as belonging to that place rather than as a panel
     that lives in a corner. Measured after the growth transition, and again on
     resize, because both change the answer. */
  useEffect(() => {
    const el = hole.current;
    if (!el) return undefined;
    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      parent.style.translate = "-50% -50%";
      const r = el.getBoundingClientRect();
      const over = Math.max(0, r.right + 8 - window.innerWidth) - Math.max(0, 8 - r.left);
      if (over) parent.style.translate = `calc(-50% - ${Math.round(over)}px) -50%`;
    };
    const id = setTimeout(fit, 260); // after the width transition settles
    fit();
    window.addEventListener("resize", fit);
    return () => { clearTimeout(id); window.removeEventListener("resize", fit); };
  }, [near, still]);
  const on = visible && !!seam;

  /* BUILT ON THE FIRST HOVER, NOT ON MOUNT — 2026-09-06. Owner, choosing between
     three ways to pay for this: *"2번으로 하고"*.
     WHAT IT COSTS AND WHY IT IS NOT A BUG. The coin has to be honest, so it is
     built by the DESTINATION'S OWN builder — and signalling's takes the routes,
     which means the cell floor was downloading all three Fowler scenarios on
     arrival to draw a 176 px circle. Every visitor paid it; only the ones who
     reach for the door get anything for it.
     Deferring changes nothing about the honesty and moves the bill to the moment
     someone asks. Measured when this file was written: build under 1 ms, upload
     and read back 1.5–3.7 ms per destination. The seam's own fetch is the part
     that is not free, and `seam.build` cannot run before it lands anyway — which
     is why the disc has always waited for `on`.
     WHAT STAYS ON MOUNT is nothing but the cleanup: whatever was opened is
     closed when this leaves, so a descent does not leave a render target and a
     PMREM room behind it. */
  useEffect(() => () => closePreview(), []);

  /* `open`/`close` ARE ABOUT THE POINTER NOW, not about the picture. The
     picture is made on mount (see the effect above); these say whether anyone is
     looking at it. The re-read is kept for the case the effect's frame lost the
     race — a disc that came back blank is worse than one read twice. */
  /* TEN SECONDS, NOT WHILE-YOU-HOVER. Owner, 2026-09-03: *"한번 호버 하면 10초간
     뜸"*. A view that lives only under the pointer cannot be read — a viewer who
     moves a few pixels to look INTO the picture closes the thing they were
     looking at. It stays up on its own, and a fresh hover restarts the ten. */
  /* THE BUILD, HERE RATHER THAN ON MOUNT — see the effect above. Both halves
     are in one tick deliberately: `openPreview` draws the target once and
     `render`/`stillOf` read it, and putting a frame between them is what let a
     previous version read a target the real scene had already overwritten.
     RENDER IMMEDIATELY BEFORE READING. The target was drawn once when this
     mounted, and by the time a viewer hovers, many frames of the real scene have
     gone through the same renderer — the first version read a target whose
     contents were no longer there and the disc came back blank. One render and
     one readback in the same tick, a few milliseconds, once per open. */
  const build = useCallback(() => {
    openPreview(gl, seam);
    render(gl, 1);
    setStill(stillOf(gl));
  }, [gl, seam]);
  const open = useCallback(() => {
    setNear(true);
    clearTimeout(hold.current);
    if (still) return;
    /* NO SEAM YET: ask for it. The effect below builds the moment it lands,
       for as long as the pointer is still here. */
    if (!on) {
      onWant?.();
      return;
    }
    build();
  }, [still, on, build, onWant]);
  /* A SEAM THAT ARRIVES UNDER A WAITING POINTER. `open` ran before there was
     anything to build; this finishes what it started, once. */
  useEffect(() => {
    if (near && on && !still) build();
  }, [near, on, still, build]);

  /* LEAVING CLOSES IT, after the grace above. Was a no-op while the ten-second
     hold owned the closing; the hold is gone and this is what closes it now. */
  const close = useCallback(() => {
    clearTimeout(hold.current);
    hold.current = setTimeout(() => setNear(false), GRACE_MS);
  }, []);

  /* ON `visible`, NOT ON `on` — a lens that cannot exist until its seam has
     been fetched is a lens nobody can hover to ask for the seam. */
  if (!visible) return null;
  /* WHERE THIS GOES IS KNOWN BEFORE THE SEAM IS — the floor below is a fact of
     the address, not of the fetch. The first cut read `seam.to` in the
     accessible name and took the whole floor down with a null the moment the
     lens stood without its seam: "Cannot read properties of null (reading
     'to')", SceneBoundary, no canvas. */
  const to = seam?.to ?? nextScale(parseHash(currentRoute()).scale);

  const go = () => {
    /* PRESSED BEFORE THE SEAM LANDED — a hover precedes a press, so the fetch is
       already in flight; there is nothing honest to cross into yet. */
    if (!on) {
      onWant?.();
      return;
    }
    /* A FLOOR MAY TAKE ITS OWN PRESS — 2026-09-06. Added when the cell's
       `See the network →` was deleted at the owner's word (*"아예 필요없어 돋보기
       있잖아"*) and the lens had to inherit what that button did.
       It is not a second way down; it is the same way down on a floor whose
       crossing is different in kind. ENERGY → SIGNALS is the one seam where the
       camera pulls BACK rather than zooming in — AMPK becomes one node among
       many — and that retreat happens IN the scene, before the swap, so the
       press has to reach the scene rather than the router. The rectangle goes
       with it because the wash still has to close on the thing that was pressed,
       and only this component knows where that is. */
    if (onGo) {
      const box = target.current?.getBoundingClientRect();
      onGo({ at: box ? [box.left + box.width / 2, box.top + box.height / 2] : null });
      return;
    }
    /* THE POINT, MEASURED ONCE AND USED TWICE. The wash centres on it here and
       `main.jsx` grows the destination out of it at the swap — the crossing used
       to start from the middle of the window, where the pressed muscle almost
       never is. */
    const r = target.current?.getBoundingClientRect();
    /* NOT `beginCrossing` HERE. It belongs to the arriving scene and this press
       is 620 ms ahead of it — `main.jsx`'s `onArrive` starts it, off the same
       point, at the instant the swap happens. Starting it here put the arriving
       scale's animation on the outgoing canvas. */
    /* AND THE RIDE, which these two seams did not have. See `crossing.js` for
       what was measured: this scale cut straight to the next one while the body
       scale played a four-second descent, because only `MotionScene` could start
       one.
       `at` IS WHERE THE MAGNIFIER IS, so the wash closes around the thing that
       was pressed — the same role `bestPick`'s projected point plays on the body.
       Read off the DOM rather than projected, because here the control IS a DOM
       element and its rectangle is the honest answer.
       `spanM` IS NULL AND THAT IS NOT A GAP. The card's fact is a muscle's own
       span against a sarcomere; there is no muscle at these seams.
       `descentFacts` already returns null for it and the card already branches. */
    /* `onLeave` — the floor's chance to take its furniture down the instant the
       press lands (owner, FIBER 14: *"go inside할때 막 text box들이 따라와"*). */
    onLeave?.();
    beginDescent({
      startedAt: performance.now(),
      /* The scale this ring is standing on, read off the hash the same way `go`
         reads it to write the next one — so the scene under the wash is the one
         a viewer is actually leaving. */
      from: parseHash(currentRoute()).scale,
      name: SCALE_LABEL[seam.to],
      spanM: null,
      at: r ? [r.left + r.width / 2, r.top + r.height / 2] : null,
      reduced: !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      /* A FUNCTION OR AN OBJECT. FIBER hands a function, because what it
         carries — the clock, the repetition, the phosphate — is only true at
         the instant the control is pressed, and a memoised object freezes it at
         whenever the memo last ran. */
      ...((typeof carry === "function" ? carry() : carry) ?? {}),
    });
    /* The address is read here rather than threaded down as a prop. Three
       components sit between a scene and its page, and `scaleRoute.js` already
       declares the hash the only thing that says where a viewer is — asking it
       is shorter than passing a copy of it through the middle. */
    goRoute(hashForScale(parseHash(currentRoute()), seam.to));
  };

  return (
    <group position={at}>
      {/* THE DOOR IS THE ROOM, 2026-09-03, AND THIS REPLACES THREE ORANGE RINGS.
          Owner: *"오렌지 링 자체가 마음에 안들어"*.

          WHAT THE RINGS WERE FOR, so it is not lost. Canon D7 asked for a way in
          that could not be mistaken for a part, and once `Handle.jsx` put a ring
          on every part of these scales a single ring read as a sixth part —
          screenshotted at 1280x900 with five handles up, same shape, same size,
          the only difference a dot in the middle. The answer then was to differ
          in KIND: rings nested and fading inward, the shape of something you go
          THROUGH.

          IT SOLVED THE WRONG HALF. Three rings still say only "a way in is here";
          they never said where it went, which is why a sentence had to be hung
          under them and a disc had to be earned by hovering. A control that
          needs a caption to explain itself is a control that has not been drawn.

          SO THE PICTURE OF THE DESTINATION IS THE CONTROL. `previewLevel` already
          renders the next scale — its own builder, its own camera, its own paper
          — and it was already being shown, just three interactions late. Shown
          from the start it does every job the rings were doing and the one they
          could not: it is unmistakably not a part, because no part on this stage
          is a window with another room in it, and it says WHERE by being where.
          Nothing is left in the 3D scene at all now, so there is no orange and
          nothing competing with `Handle.jsx`'s rings for meaning. */}

      <Html center zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
        <div
          className={near ? "wayin wayin--near" : "wayin"}
          onPointerEnter={open}
          onPointerLeave={close}
        >
          {/* A real button, so the descent is reachable by keyboard at all.
              First press opens, second commits — the same two beats a pointer
              gets, rather than a control that acts before it has shown you
              where it goes. */}
          <button
            type="button"
            ref={target}
            className="wayin__target"
            data-testid="way-in"
            aria-label={`Go inside — ${SCALE_LABEL[to]}`}
            aria-expanded={!!still}
            onFocus={open}
            onBlur={close}
            /* ONE PRESS. The two-beat press — open, then commit — existed
               because the first press was the only way to find out where the
               control went. The disc is standing now, so the second beat was
               asking a visitor to confirm a thing they can already see. */
            onClick={go}
          />

          {/* A MAGNIFIER STANDING, AND THE VIEW IS WHAT IT OPENS. Owner:
              *"그냥 돋보기 아이콘 같은거 한번 호버 하면 10초간 뜸 그 미니 3d
              view가"*. The window itself stood here for one build and it was the
              right instinct and the wrong object: a picture of the next room,
              always open, is a second picture competing with the one a visitor
              is reading. A magnifier is small, says "there is more to see here"
              in a shape everyone already knows, and is not mistakable for a part
              — which is the job canon D7 gave the three rings and the reason
              they had to differ in KIND. */}
          <span className="wayin__lens" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <circle cx="10.5" cy="10.5" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
              <line x1="15.2" y1="15.2" x2="20.4" y2="20.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </span>

          {near && still && (
            <div className="wayin__door">
              <span className="wayin__hole" ref={hole}>
                <img className="wayin__disc" src={still} alt="" />
              </span>
              {/* THE SAME DOOR THE BODY HAS — 2026-09-06, owner: *"모든층에 body처럼
                  밑에 라벨 없어고 go inside button"*. What stood here was the
                  destination's NAME, which is a caption; `MuscleLens` on the body
                  has carried a press-me line since the last pass and these two
                  are the same control on different floors. One shape, one word,
                  every floor. */}
              <span className="wayin__go">Go inside →</span>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
