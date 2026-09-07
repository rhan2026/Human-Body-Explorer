/**
 * The fibre scale, as the shell renders it.
 *
 * It began as the sandbox behind #dev/muscle-fiber and is now reached from the
 * body scale too: main.jsx maps every state whose `scale` is "fiber" here,
 * #dev/muscle-fiber included. Its own header used to say "prototype · not wired
 * to the anatomy page", which stopped being true the moment a muscle could be
 * clicked into it — so it is gone rather than left to mislead, and nothing has
 * replaced it (CLAUDE.md §9: empty by default).
 *
 * The sarcomere is still on its own clock — the muscle and the instant travel in
 * the hash but nothing here reads them yet — and the footer says so. What has
 * changed is where its numbers come from: calcium, force and the SR store are
 * now the published model's output rather than a hand-authored curve, and the
 * footer carries the evidence type because a number without its label does not
 * ship (CLAUDE.md §5). That label is the smallest honest one, not a paragraph.
 *
 * If the scenario fails to load, this does NOT fall back to the invented curve.
 * A silent fallback would put an unlabelled number on screen under a label that
 * says otherwise, which is worse than showing nothing.
 *
 * Everything except <MuscleFiberVisualization> is scaffolding. The component
 * underneath takes exercise state as props and knows nothing about the route.
 */

import { useEffect, useRef, useState } from "react";

import MuscleFiberVisualization from "./fiber/MuscleFiberVisualization.jsx";
import Ways from "./shell/Ways.jsx";
import { loadScenario } from "./scenarioData.js";
import AppShell from "./shell/AppShell.jsx";
import { setSceneContext } from "./shell/assistantContext.js";
import { EXERCISE_MODES } from "./fiber/fiberSimulation.js";
import { LEVELS } from "./fiber/fiberGeometry.js";
import { PHASE_LABEL } from "./fiber/FiberMetrics.jsx";
import EvidenceBadge from "./Evidence.jsx";

const SCENARIO_ID = "soce_on";

export default function DevFiberScene({ state }) {
  const [scenario, setScenario] = useState(null);
  const [status, setStatus] = useState("loading");
  const [playing, setPlaying] = useState(true);
  // The view's controls, owned here and rendered in the shared drawer — the
  // visualization runs with `showControls={false}`, which its own docstring
  // calls "the mode the real integration uses". The metrics panel stays where
  // the numbers are.
  /* THE FLOOR OPENS ON THE FASCICLE — 2026-09-06. Owner: *"들어가면 Fasicle이
     보여야지 왜 Sarcomere가 보여.... 하 말이 안되잖아 시작이 Fasicle인데"*.
     The pass has always run fascicle -> fascicle -> fiber -> fiber -> sarcomere
     (`fiberTour.js`), so the storyboard was already right; what was wrong was
     the scene mounting one level PAST its own first beat, so a visitor landed on
     the sarcomere, the pass pulled them back out to the fascicle, and the
     descent read as overshooting and correcting. */
  const [level, setLevel] = useState("fascicle");
  const [mode, setMode] = useState("twitch");
  const [intensity, setIntensity] = useState(0.7);
  const [active, setActive] = useState(true);
  const [labels, setLabels] = useState(true);
  const [passing, setPassing] = useState(false);
  // The archived repetition takes over the moment it arrives, as the old
  // `scenario ? "rep" : "twitch"` prop did.
  useEffect(() => {
    if (scenario) setMode("rep");
  }, [scenario]);
  /* The clock, for the header's handle on it. `onState` fires per frame and
     hands back the simulation's own mutable ref, so the number is read out
     immediately and the React write is throttled to 10 Hz — the same throttle
     the metrics panel one level down already uses. */
  const liveT = useRef(0);
  const liveState = useRef(null);
  const [shownT, setShownT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setShownT(liveT.current), 100);
    return () => clearInterval(id);
  }, []);

  // What this scene tells the Anatomy Assistant (shell/assistantContext.js),
  // at the same 10 Hz: the simulation's phase in the words the metrics panel
  // uses, the controls as set, the clock, and whether the run is the
  // published one or the illustrative fallback. Cleared on unmount.
  useEffect(() => {
    const sim = liveState.current;
    const phase = sim ? sim.phaseLabel ?? PHASE_LABEL[sim.phase] ?? sim.phase ?? null : null;
    setSceneContext({
      fiberStage: [
        phase,
        `${EXERCISE_MODES[mode]?.label ?? mode} mode`,
        `${LEVELS[level]?.label ?? level} view`,
        `stimulus ${active ? "on" : "off"} at ${Math.round(intensity * 100)}% intensity`,
        `${playing ? "playing" : "paused"} at t = ${shownT.toFixed(2)} s`,
        scenario ? "bound to the published run" : "unbound — illustrative drive",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }, [shownT, mode, level, active, intensity, playing, scenario]);
  useEffect(() => () => setSceneContext(null), []);

  useEffect(() => {
    let live = true;
    loadScenario(SCENARIO_ID)
      .then((s) => {
        if (!live) return;
        setScenario(s);
        setStatus("ready");
      })
      .catch((e) => {
        if (!live) return;
        setStatus(`Could not load scenario "${SCENARIO_ID}" — ${e.message}`);
      });
    return () => {
      live = false;
    };
  }, []);

  const provenance = scenario?.provenance;

  return (
    <main className="app">
      {/* NO DRAWER, SO NO ☰ — 2026-09-06, the owner's *"body 밑 단계에서는 hamburger
          left side bar 없어도 될듯"*. Four things were in it and three were second
          copies of something already on the stage: "← Back to Motion" is Ways'
          go-up, the brand block is the viewbar, "Click here to go inside — the
          cell" is the lens standing in the scene. `FiberControls` was reduced by
          `bound={!!scenario}` to a single chip, and that chip now stands in the
          level plate (`MuscleFiberVisualization`, `.fiber-levels__names`) where a
          visitor can reach it without dimming the floor to do it.
          The "About this data" pair went with them: it is behind
          `uiMode.js`'s `SHOW_SOURCES = false`, the owner's own 2026-08-30 switch,
          so it drew nothing on any screen. */}
      {/* THE HEADING SAYS WHICH LEVEL — 2026-09-06, owner: *"header에 Body
          Benchpress이런거 있잖아 Fiber도 Label transition될 때 Fiber Fasicle
          이렇게 보여줘"*. `AppShell` already draws a small floor name over a large
          subject and BODY fills the subject with the movement; this floor had
          nothing in it, so the one fact that actually changes on this screen —
          which of the three levels you are looking at — was readable only from
          the ladder. No new furniture: the slot existed and was empty. */}
      <AppShell scale={state?.scale} title={LEVELS[level]?.label ?? null} />

      {/* THE VIEW BAR IS GONE, AND WITH IT THE LAST PLACE THIS FLOOR NAMED A
          MUSCLE — 2026-09-06. It read `Muscle fiber` over the muscle the descent
          came through, and the owner has now said this more times than I have
          acted on it: *"내가 100번 말한거 같은데 들어온 이상 어떤 muscle인지는
          진짜 ㅈ도 1도 상관이 없어"*. The floor draws one archived sarcomere
          whatever muscle you pressed upstairs, so the name was decoration on a
          picture that does not depend on it.
          The scale's own name was the bar's other job and it did not need a
          second bar: the shell paints it top-left, and as of this pass it paints
          the LEVEL with it — `FIBER · Fascicle` — which is the one fact about
          this screen that actually changes. */}
      <Ways state={state} playing={playing} onPlaying={setPlaying} />

      <div className="body body--single">
        <MuscleFiberVisualization
          /* THE LEVEL LADDER HAD NO WAY TO REACH THIS STATE — 2026-09-04.
             `MuscleFiberVisualization` draws the Fascicle/Fiber/Sarcomere ladder
             only when it owns the level, and it never does here: the scene keeps
             `level` and hands it down. So the control canon F2 asked to float on
             the stage — *"Gizmos식 토글도 제발 main 화면 안에 디자인 ㅈㄴ 잘
             입혀서 floating하게 어딘가에 두는걸 목표로 해"* — was drawn on no
             screen at all, and a viewer could not move between the fibre's three
             levels. Measured 2026-09-04: the fibre's visible controls were the
             menu trigger, pause, the two ways out, the magnifier and five rings.
             Nothing else. */
          /* NO `notice` — the §5 archived-run disclosure that used to ride this
             slot was deleted on 2026-09-06 with the whole notice stack, at the
             owner's *"8번 빼 그냥 아예 빼 … 내말이 canon이야"*. The slot itself is
             gone from `MuscleFiberVisualization`; the loading line and the
             scenario error keep their own `.statusbar` below. */
          onLevel={setLevel}
          /* The names switch's real owner — the local one is a no-op here
             (`showControls={false}`). */
          onShowLabels={setLabels}
          /* THE MUSCLE THE VISITOR PICKED UPSTAIRS. It was already on this
             screen twice — the drawer's subtitle and the viewbar's — and the
             guided pass, which is what a first-time visitor actually meets,
             opened on "A muscle is built from bundles like this one" without
             saying WHICH muscle they had just gone into. `fiber.md` §1 draws
             the descent as "Pectoralis Major -> Fascicle -> Muscle Fiber ->
             Sarcomere"; the first arrow is the one that makes it theirs. */
          muscle={state?.handoff?.muscle?.label ?? state?.muscle ?? null}
          /* THE FIBRE DIRECTION OF THE MUSCLE THEY PICKED, and this prop has
             been waiting for a caller since it was written. `FiberScene` says
             so itself — "`FiberScene` can already rotate its model onto a
             supplied axis and no caller has ever passed one" — so every fibre
             ever drawn has lain along +X whatever muscle the visitor came down
             through.
             `rig.mjs` fits a fibre line per mesh chain and `fibreGeometry`
             returns its direction; BODY packs it into the handoff. NULL is a
             real answer and not a gap — rig.mjs drops the line where a chain's
             two end centroids are under 10 mm apart — and `FiberScene`'s effect
             already branches on it, leaving the default framing. */
          axis={state?.handoff?.muscle?.axis ?? null}
          onPassing={setPassing}
          exerciseMode={mode}
          intensity={intensity}
          isActive={active}
          level={level}
          showLabels={labels}
          scenario={scenario}
          /* The instant the hash names. Without it every descent landed at t=0
             however far into the rep the viewer was, so "the same repetition
             continues at fibre level" was a sentence the screen did not keep. */
          startAt={state?.t ?? 0}
          playing={playing}
          onPlaying={setPlaying}
          onState={(s) => { liveT.current = s.time; liveState.current = s; }}
          showControls={false}
        />
      </div>

      {/* Loading and failure stay ON SCREEN, not in the drawer — CLAUDE.md §9
          forbids hiding what is loading or what failed behind a click. */}
      {status !== "ready" && (
        <div className="statusbar">
          {status === "loading" ? <span>Loading the model output…</span> : <span>{status}</span>}
        </div>
      )}
    </main>
  );
}
