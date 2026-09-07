import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import MotionScene from "./MotionScene.jsx";
import DevFiberScene from "./DevFiberScene.jsx";
import SceneBoundary from "./SceneBoundary.jsx";
import CellScale from "./cell/CellScale.jsx";
import SignallingScale from "./signalling/SignallingScale.jsx";
import Descent from "./Descent.jsx";
import { beginCrossing, onDescent } from "./crossing.js";
// The cross-floor contract — the only thing the four floors share. See handoff.js.
import { BRIDGE, bridgeFor, CLOCK_OF_SCALE, makeHandoff } from "./handoff.js";
// import AssistantWidget from "./assistant/AssistantWidget.jsx"; // parked — see the note at its mount site
import { Scrim } from "./shell/AppShell.jsx";
import AskBell from "./guide/AskBell.jsx";
import AskBridge from "./ask/AskBridge.jsx"; // the API behind the box — one line, see ask/AskBridge.jsx
import { parseHash, serializeHash, currentRoute, go, onRoute } from "./scaleRoute.js";
import { getMotion } from "./motion/registry.js";
import { usePanelOpen } from "./shell/uiState.js";
import { getAssistantContext, readableSlug, setRouteContext, VIEW } from "./shell/assistantContext.js";
import "./styles.css";

/**
 * What the assistant's input offers to talk about, per scale. The context the
 * question itself carries is a different thing — shell/assistantContext.js,
 * written from here (the route) and by each scene (its own state).
 */
function assistantPlaceholder(state, scale) {
  if (scale === "fiber") return "Ask about contraction or the muscle fiber…";
  if (scale === "cell") return "Ask about calcium, ATP, or the cell…";
  if (scale === "signalling") return "Ask about AMPK, mTOR, or signaling…";
  if (scale === "body" && getMotion(state.exercise)) return "Ask about this movement…";
  return "Ask about this muscle or exercise…";
}

/**
 * The shell. It owns one thing — the scale state {exercise, muscle, scale, t} —
 * and its only decision is which scene draws that state.
 *
 * The hash is not a switch that picks a component; it is the serialization of
 * the state, and scaleRoute.js is the only thing that reads or writes it. That
 * is what makes `#pushup` and `#dev/muscle-fiber` ordinary rather than special:
 * both parse to a state like any other, so there is one code path down here
 * instead of a literal-hash comparison per route. It is also what makes a
 * descent shareable — whoever writes the hash has already written the state.
 *
 * Reading the hash reactively means switching scale does not reload, so hot
 * module replacement survives it and the GLB cache is not thrown away.
 *
 * An exercise with no motion falls through to the explorer rather than to the
 * scene, because the scene's fallback is the push-up: `#motion/deadlift` would
 * otherwise draw a push-up under a deadlift URL, which is the silent snap
 * CLAUDE.md §5 forbids. A scale with no scene falls through the same way, which
 * is why the body branch names its scale instead of being the default: an
 * unknown scale must reach the explorer, and MotionScene is not a cell.
 *
 * THAT GUARD USED TO BE ATTACHED TO THE BODY BRANCH, AND SO ONLY GUARDED THE
 * BODY. `#motion/deadlift/cell` and `#motion/deadlift/fiber` walked straight
 * around it and drew a push-up-derived scene under a deadlift URL — the exact
 * silent snap the paragraph above says is forbidden, committed by the paragraph
 * above. It is one test above the scale switch now, because the rule was never
 * about the body: no scene may draw for an exercise this app does not have.
 * `state.exercise` is null when no exercise was named at all (`#dev/muscle-fiber`
 * serialises to `motion//fiber`), which is legal and must still draw.
 *
 * The ride is the one thing here that is not the state: a dissolve needs both
 * ends of itself, and the scene that is being left unmounts halfway through it.
 * So <Descent> hangs off the shell, which is the only thing that outlives both
 * scales, and the shell holds the outgoing scale on screen until the wash has
 * covered it. The choice is in the URL from the instant it is made — the delay
 * is what the viewer sees, not what the app believes.
 */
function Router() {
  const [state, setState] = useState(() => {
    const route = currentRoute();
    if (window.location.hash) go(route, { replace: true }); /* an old `#` link, rewritten to its path once */
    return parseHash(route);
  });
  const [ride, setRide] = useState(null);

  /* THE DEEP SEAMS START RIDES TOO, SINCE 2026-09-03. `MotionScene` gets
     `onDescend` as a prop because it is a direct child; `WayIn` is three levels
     inside two other scenes, so it raises a signal instead — `crossing.js`
     carries why, and the measurement that found two of the three seams cutting
     with no transition at all.
     SUBSCRIBED HERE because this is where `<Descent>` is mounted and where the
     ride state lives; one listener, because there is one Descent. */
  useEffect(() => onDescent(setRide), []);
  const panelOpen = usePanelOpen();

  useEffect(() => {
    return onRoute(() => setState(parseHash(currentRoute())));
  }, []);

  /* THE SCALE YOU ARE LEAVING STAYS UP UNTIL THE RIDE ARRIVES — that is what a
     dissolve needs, and until 2026-09-03 this said `"body"` because the body was
     the only scale that could start one. The moment the two deep seams got rides
     of their own, this line dragged them home: measured, a cell-to-signalling
     ride mounted `MotionScene` under the wash and the screenshot came back
     showing the body's own transport and opacity sliders at
     `#bench_press/signalling`, with "Loading rig…" while it fetched a rig that
     screen does not use.
     The ride carries where it left from now. Falling back to `"body"` keeps the
     old behaviour for any ride that has not been told. */
  const scale = ride && !ride.arrived ? (ride.from ?? "body") : state.scale;

  /* The route layer of what the assistant is told (shell/assistantContext.js):
     which view this state draws, in the prompt's words, and the exercise and
     muscle the hash names. A scene overwrites these with sharper values when
     it has them; this is what every view has at minimum. */
  const view =
    scale === "fiber" ? VIEW.fiber
    : scale === "cell" ? VIEW.cell
    : scale === "signalling" ? VIEW.signalling
    : scale === "body" && getMotion(state.exercise) ? VIEW.motion
    : VIEW.body;
  useEffect(() => {
    setRouteContext({
      currentView: view,
      selectedExercise: getMotion(state.exercise)?.label ?? state.exercise ?? null,
      selectedMuscle: readableSlug(state.muscle),
    });
  }, [view, state.exercise, state.muscle]);
  // The instrument, MotionScene's pattern: what the next question would carry.
  useEffect(() => {
    window.__assistantContext = getAssistantContext;
    return () => {
      delete window.__assistantContext;
    };
  }, []);

  /* AN UNKNOWN EXERCISE FALLS BACK, AND THE ADDRESS BAR IS TOLD.
   *
   * Two requirements met at once, and they looked contradictory for an hour.
   * `motion-ui.spec.js` wants every legacy, misspelled and unknown route to
   * reach a real movement — "never a blank stage" — because a typed URL should
   * not strand somebody. This thread wanted the opposite: `#motion/deadlift`
   * used to draw a push-up, and `#motion/deadlift/cell` drew push-up-derived
   * AMPK chemistry, under a URL naming an exercise this app does not have.
   * That is the silent snap CLAUDE.md §5 forbids.
   *
   * Both are satisfied by rewriting the hash instead of refusing to draw. The
   * fallback happens, the stage is never blank — and the URL says what is on
   * screen, so nothing is claimed that was not drawn. Neither test had to give
   * anything up: theirs asserts the resolved movement and a body in the scene,
   * never that the garbage hash survives.
   *
   * `replace`, not `assign`: a typo should not cost a back-button press. */
  useEffect(() => {
    if (state.exercise === null || getMotion(state.exercise)) return;
    /* IDLE, NOT A MOVEMENT. Owner, 2026-09-03: *"이런거 그냥 idle로 가"*.
       This used to land on `push_up`, and the argument for it was that a typed
       URL should not strand anyone on a blank stage. That argument is fine and
       the choice was still wrong: landing on a push-up tells a visitor who typed
       `#deadlift` that this app HAS their exercise, and then shows them a
       different one. Idle shows a body doing nothing, which is true — the app
       has no deadlift, and now nothing on screen says otherwise.
       `idle` is not a registered motion (`getMotion("idle")` is false); it is the
       drawer's own first row and it serialises to an empty hash, which is where
       the menu's Idle button goes too. Measured, not assumed. */
    const corrected = serializeHash({ ...state, exercise: null, scale: "body" });
    go(corrected, { replace: true });
    setState(parseHash(corrected));
  }, [state.exercise]);

  /* WHICH MUSCLE YOU CAME IN THROUGH — decision #24, 2026-09-04.
     `DevFiberScene`'s viewbar has said `state?.muscle` since the header came off,
     with the reason beside it: "the descent's whole claim is that it is the same
     one all the way down". It has never rendered, because the only writer of
     `state.muscle` was the parser and `1a7a29d` stopped it carrying one.
     NOT BY WIDENING THE ADDRESS. That decision stands and `scaleRoute.test.js`
     pins it. This is the ride's fact, held here for as long as the viewer is
     below the body — the deep seams carry no muscle of their own, so going
     fibre → cell keeps the one you entered through rather than forgetting it.
     Cleared on the way back up: standing on the body, "you came in through the
     pectoralis" is no longer true. A shared link has no muscle and says none,
     which is the honest answer — it is where you ARE, and nobody walked in. */
  /* AND SINCE 2026-09-05 IT IS NOT ONLY THE MUSCLE — it is the handoff, and the
     widening happened here rather than anywhere new because this one value was
     ALREADY the whole of what crossed a floor boundary. `handoff.js` carries the
     contract and the reason; what changed at this site is that `cameFrom` holds
     an object instead of a string.
     `state.muscle` IS STILL WRITTEN, and that is not redundancy. `DevFiberScene`
     reads `state?.muscle` and has since the header came off; breaking it to make
     room for a richer field would be the orchestrator rebuilding a floor's
     internals, which is the one thing this session does not do. The string is
     derived from the handoff, so there is still one source. */
  const [cameFrom, setCameFrom] = useState(null);
  useEffect(() => {
    if (state.scale === "body") setCameFrom(null);
  }, [state.scale]);
  /* A HANDOFF DESCRIBES AN ARRIVAL, AND CLIMBING BACK OUT IS NOT ONE.
     Found 2026-09-05 by walking the whole descent and then walking back up:
     standing on ENERGY after coming up from SIGNALS, `handoff` still read
     `{from: "cell", to: "signalling", bridge: "ampk"}`. Every identity field in
     it was true — you did come in through the pectoralis — and the three that
     say WHERE YOU ARE were describing the floor below the one on screen. A
     floor branching on `bridge` to choose its arrival would have played the
     pull-back reveal for a viewer who had just walked up into it.
     STRIPPED, NOT CLEARED. `main.jsx` has kept the muscle across the deep seams
     since decision #24 and that is still right — "you came in through the
     pectoralis" survives going up, and so do the condition and the AMPK reading,
     because they are facts about the visit and not about the doorway. What goes
     is the doorway: `to`, `bridge` and the point on the glass, none of which
     mean anything once you are somewhere the ride did not put you. */
  const arrived = cameFrom && cameFrom.to === state.scale;
  const context = !cameFrom
    ? null
    : arrived
      ? cameFrom
      : Object.freeze({ ...cameFrom, to: state.scale, bridge: null, at: null });
  /* `scale` — the ride-aware one — and not the hash's: during the ride the
     leaving floor is still on screen and its shell read the DESTINATION's name
     (seen 2026-09-07: "ENERGY / Sarcomere" over the sarcomere, FIBER 14). */
  const below = context
    ? { ...state, scale, muscle: context.muscle?.key ?? null, handoff: context }
    : { ...state, scale };

  const scene = scale === "fiber" ? <DevFiberScene state={below} />
    : scale === "cell" ? <CellScale state={below} />
    : scale === "signalling" ? <SignallingScale state={below} />
    : scale === "body" && getMotion(state.exercise) ? <MotionScene exercise={state.exercise} state={state} onDescend={setRide} />
    : <App />;

  return (
    <>
      {/* THE BOUNDARY EXISTS AND WAS MOUNTED BY NOTHING — 2026-09-04.
          `SceneBoundary.jsx` has been in the tree's vocabulary and out of the
          tree itself: grepped, the only other file that names it is a comment in
          `webgl.jsx` explaining what it CANNOT catch. So a GLB that fails to
          arrive threw inside Suspense, nothing caught it, and React unmounted
          the whole app — measured 2026-09-04 with every `*.glb` aborted:
          `#root` empty, no sentence, no reload prompt, a white page.
          CLAUDE.md §9 is explicit that error copy is the one thing never cut,
          and the copy was written; it just had no way to be reached.
          KEYED ON THE SCALE, so leaving a scene that failed and coming back — or
          going somewhere else entirely — re-arms the boundary. Without the key a
          single failure would hold the error page for the rest of the visit,
          which is a worse lie than the blank one: the app would be working and
          refusing to say so. */}
      <SceneBoundary key={scale}>{scene}</SceneBoundary>
      {/* The interaction lock, out here with the assistant rather than inside
          the scene whose drawer it serves — a fixed-position scene root forms
          its own backdrop root, and a scrim inside one cannot blur what floats
          outside it (see AppShell.jsx). */}
      <Scrim />
      {/* THE QUESTION BOX IS BACK, AS BELL'S — 2026-09-07. Owner: *"lets make
          the visuals for the user text box first. then the api and claude
          connection the other agent will do it"*. Mounted here for the reason
          the assistant was: one box for four scenes. It asks the scale's own
          question — `assistantPlaceholder` below is what knows it — and holds
          the bottom-right corner that was Bell's (owner, 2026-09-07: *"i want
          the text box to be on the bottom right corner, where bell's default
          position is right now"*; Bell stands on the box now), stepping above
          the two floors' foot furniture a box this long reaches: the body's rep
          timeline when a motion is loaded, SIGNALS' time scrubber. The seams
          the other lane wires are in `guide/askBell.js`. */}
      <AskBell
        placeholder={assistantPlaceholder(state, scale)}
        over={scale === "signalling" ? "scrub" : scale === "body" && getMotion(state.exercise) ? "time" : null}
      />
      <AskBridge />
      {/* THE ASSISTANT IS UNMOUNTED, 2026-09-02, AND THE CHARACTER HAS ITS JOB.
          Owner: *"Anatomy Assistant가 저 캐릭터로 대체되는거야"*, and then
          *"질문 입력창도 일단 없에"*. So the bottom-right corner is the guide's
          now — `Guide` walks there and waits when it has nothing to say, which
          is the same corner this panel held.
          UNMOUNTED, NOT DELETED, and the word that decides that is 일단 — "for
          now". `AssistantWidget.jsx`, `assistant.css` and `shell/assistantContext.js`
          all stay where they are, with their gates still green, so putting the
          panel back is un-commenting this block. §8 says deletion is a procedure;
          this is not that decision yet, and pretending it is would throw away a
          working widget on a maybe.
          `assistantPlaceholder` above stays with it — it is the only thing that
          knows what each scale should be asked, and re-deriving that later from
          scratch is how the sentence would come back wrong. (And it is in use
          again since 2026-09-07, by `AskBell` above.) */}
      {/* NO <Director>. The film and `src/director/` went on 2026-08-30 — the
          owner deleted the ride, and the ride card with it. Rex's branch was cut
          before that, so his `main.jsx` still imports and mounts a component
          that is not in the tree; the merge failed to build on exactly this
          line. The note it replaces said the ride outlives all four scenes,
          which was true of a thing that no longer exists. <Descent> below is a
          different mechanism and stays. */}
      {/* Keyed on the moment it started, so a second descent is a second ride
          rather than a half-played one that never re-arms. */}
      {ride && (
        <Descent
          key={ride.startedAt}
          ride={ride}
          /* THE CROSSING BEGINS WHERE THE SCENE DOES — 2026-09-04.
             It used to be started by the presser (`WayIn.go`), 620 ms before the
             swap, so for the whole of the wash's `out` beat the attribute was on
             `<html>` while the OUTGOING canvas was still mounted: the body took
             the arriving scale's animation and opened at opacity 0. Under an
             opaque wash for the second half of it, visible for the first.
             Here, `arrived` and the crossing are the same instant by
             construction — this callback is what swaps `MotionScene` for the
             destination (see `scale` above) — and both paths get one, which the
             body's own descent never had at all.
             `at` is the muscle's place on the glass, so the destination grows
             out of what was pressed. Rides only ever go down; the ways out and
             the trail start their own crossings, both directions. */
          onArrive={() => {
            const [ax, ay] = ride.at ?? [];
            /* THE DIRECTION IS THE BRIDGE'S, NOT THE HASH'S — 2026-09-05.
               Every ride opened `down`, because until the seams were told apart
               there was only one thing a ride could mean. ENERGY → SIGNALS means
               the opposite of the other two and `handoff.js` already names it:
               `bridge === "ampk"` is a pull BACK, so the arriving floor opens on
               the node the viewer was already looking at and the network
               resolves around it (`crossing-back` in styles.css). The leaving
               half is `Descent.jsx`'s, shrinking about the same point, so the
               scale falls continuously across the cut instead of a push being
               answered by a pull. */
            const crossingFrom = ride.from ?? "body";
            const direction =
              /* Always down since 2026-09-07 (owner: every crossing goes IN); `bridgeFor` still
                 names the seam for the handoff below. */
              bridgeFor(crossingFrom, parseHash(currentRoute()).scale) === BRIDGE.ampk ? "back" : "down";
            beginCrossing(direction, Number.isFinite(ax) && Number.isFinite(ay) ? { x: ax, y: ay } : null);
            /* WHAT THE RIDE HANDED DOWN, BUILT INTO THE CONTRACT HERE.
               `handoff.js` is where the fields and the clock rule live; this is
               only the one place that knows both ends of a ride at the instant
               it lands. The destination is read off the hash rather than off
               `state`, for `WayIn`'s reason — the address was written before the
               ride started, so it is the answer that cannot be a frame stale.

               TOLERANT ABOUT `muscle`, DELIBERATELY. It is a mesh id string
               today and the BODY lane is building the object — key, label,
               group, role, meshes, centroid, axis — that `FiberScene`'s unused
               axis parameter has been waiting for. Accepting both is what lets
               that land without a second edit here, and it is the same shape
               `parseHash` already uses on the address: read what arrives, do not
               fail on the older spelling.

               A DEEP SEAM STILL MUST NOT ERASE THE MUSCLE. `fiber → cell` names
               no muscle of its own, so the previous handoff's muscle is carried
               rather than dropped — that was the old `if (ride.muscle)` guard
               and it is kept as the `??` below. */
            const to = parseHash(currentRoute()).scale;
            /* THREE SPELLINGS, ONE MUSCLE, and the middle one is the only one
               that has ever been safe to send.

               MEASURED BY THE BODY LANE, 2026-09-05, by trying the object form
               this file asked for: every descent became the error page. Their
               branch stands at a74ca12, where `handoff.js` does not exist and
               `main.jsx` still reads `{...state, muscle: cameFrom}` — so an
               object went straight into `state.muscle` and `DevFiberScene`'s
               `state.muscle.replace(...)` threw. `SceneBoundary` caught it and
               drew "Could not load this scene" for the whole of the app's first
               premise.
               So the lane sends the mesh id as a STRING and everything else
               beside it, which is the shape that cannot break a floor that has
               not merged this file yet. Folding the siblings back into one
               object is this seam's job, not theirs — the orchestrator owns
               what crosses, and a contract that only works once everyone has
               merged it is not a contract, it is a flag day. */
            const named = (() => {
              if (ride.muscle && typeof ride.muscle === "object") return ride.muscle;
              const key = ride.muscleKey ?? (typeof ride.muscle === "string" ? ride.muscle : null);
              if (!key) return null;
              return {
                key,
                label: ride.muscleLabel ?? null,
                group: ride.muscleGroup ?? null,
                role: ride.role ?? null,
                meshNames: ride.meshNames ?? null,
                centroid: ride.centroid ?? null,
                /* REAL, AND IT HAS BEEN SITTING THERE THE WHOLE TIME.
                   `fibreGeometry(rig, meshName)` has always returned an `axis`
                   beside the `fascicleLengthM` the descent card reads, fitted
                   per mesh chain by `rig.mjs`, and nothing has ever read it —
                   which is the whole reason `FiberScene`'s model-axis rotation
                   had no caller. Null for a muscle with no chain, which the
                   lane left null rather than filling in. */
                axis: ride.axis ?? null,
              };
            })();
            setCameFrom((prev) =>
              makeHandoff({
                from: ride.from ?? "body",
                to,
                exercise: state.exercise,
                muscle: named ?? prev?.muscle ?? null,
                run: ride.run ?? prev?.run ?? null,
                clock: ride.clock ?? CLOCK_OF_SCALE[ride.from ?? "body"] ?? null,
                t: ride.t ?? null,
                rep: ride.rep ?? prev?.rep ?? null,
                at: ride.at ?? null,
                /* Carried from the previous handoff when this ride does not
                   name one, for the reason the muscle is: a viewer who turned
                   the calcium path off on ENERGY and then went one floor
                   further has not turned it back on. */
                phaseName: ride.phaseName ?? prev?.phaseName ?? null,
                condition: ride.condition ?? prev?.condition ?? null,
                ampk: ride.ampk ?? prev?.ampk ?? null,
                phosphate: ride.phosphate ?? prev?.phosphate ?? null,
                phosphateFraction: ride.phosphateFraction ?? prev?.phosphateFraction ?? null,
              }),
            );
            setRide((r) => (r ? { ...r, arrived: true } : r));
          }}
          onDone={() => setRide(null)}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
