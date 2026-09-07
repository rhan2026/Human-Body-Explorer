/**
 * The record, and it is no longer the product.
 *
 * WHAT LEFT, AND WHY IT IS NOT A DELETION. This was a `<dl>` of eleven rows —
 * band widths, girth, an ATP counter, the Hill curve's two outputs — and each
 * of them was a quantity a viewer had to carry four hundred pixels back to the
 * tissue it was about. `docs/fixing-prd.md` §1: everything that is not one of
 * §2's key numbers comes off the default view, and §2.1's three for this scale
 * are the store, the calcium peak and the force. The store and the burst count
 * moved ONTO the picture as gizmo callouts (`FiberScene.jsx:fiberGizmoItems`),
 * which is a promotion; the band arithmetic came off, and the A-band's claim
 * survives where it always mattered — on the callout that points at the band.
 *
 * WHAT STAYED IS THE THREE PUBLISHED SERIES, AS SHAPES RATHER THAN DIGITS. A
 * trace shows the whole run at once, which is the one thing a callout welded to
 * this instant cannot do: the store's ceiling falling rep by rep is a fact
 * about ten repetitions and no single frame holds it. That is what a panel is
 * for now — the reader who wants the record, not the reader who wants the
 * lesson.
 *
 * The badge is driven by `state.force !== null` — whether a scenario is
 * actually bound — and NOT by a prop. A prop is something a caller can forget
 * to pass, and the failure mode of forgetting is a `Derived` badge over an
 * invented curve, which is the exact overclaim the labels exist to prevent.
 */

import { SHOW_FIGURES, SHOW_SOURCES } from "../uiMode.js";
import EvidenceBadge from "../Evidence.jsx";
import { CA_FULL_SCALE_UM, storeFullScale } from "./fiberSimulation.js";
import { EXTENT } from "./fiberGeometry.js";
import { playheadX, tracePoints } from "./fiberTrace.js";

/** Said once, so the badge and the line cannot drift. */
/* SPELLED FROM THE CONSTANT, not beside it. This read "three sarcomeres" and
   the constant went to two on 2026-08-31 (canon D1) — a sentence that counts
   something the code decides is a second opinion, and this file's own rule is
   that a number on screen comes from the thing it describes. */
const SARC_COUNT_NOTE = `the sarcomere level draws ${EXTENT.sarcomereCount} sarcomeres end to end`;

/* EXPORTED, 2026-08-31, and it is Rex's line kept while this file's other change
   today is kept too. `DevFiberScene` reads the phase names from here rather than
   spelling a second copy of them — which is this project's own rule about a
   count or a name living in one place, applied to a table it was already
   applying it to. The merge failed to build on exactly this word. */
export const PHASE_LABEL = {
  rest: "At rest",
  activated: "Activated",
  relaxing: "Relaxing",
  top: "Lockout",
  eccentric: "Lowering · eccentric",
  bottom: "Bottom",
  concentric: "Pressing · concentric",
};

function Bar({ value, tone = "load" }) {
  return (
    <span className="fiber-bar">
      <span className={`fiber-bar__fill fiber-bar__fill--${tone}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

/**
 * The same row, showing the whole run instead of only this instant.
 *
 * The bar was true and nearly always empty: ten repetitions on a 0.65 s cycle
 * with a 0.1625 s stimulus means the transient is a quarter of each cycle for
 * the first half of the run and absent for the second, so a viewer who looks
 * lands between twitches and reads "At rest". Measured on `soce_on.json`: 29.42
 * µM at t=2.76 s against 0.174 at t=3.8. The reps were always there; nothing on
 * screen carried them.
 *
 * Falls back to the bar whenever the series is not bound, rather than drawing a
 * flat line — an empty plot and a real one that happens to be flat look the
 * same, and only one of them is a fact about the muscle.
 */
function Trace({ value, series, t, grid, tone = "load", full = 1 }) {
  const points = tracePoints(series, full);
  if (!points) return <Bar value={value} tone={tone} />;
  const x = playheadX(t, grid.t0, grid.tEnd);
  return (
    <span className="fiber-trace">
      <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} className={`fiber-trace__line fiber-trace__line--${tone}`} vectorEffect="non-scaling-stroke" />
        <line x1={x} x2={x} y1="0" y2="20" className="fiber-trace__head" vectorEffect="non-scaling-stroke" />
      </svg>
    </span>
  );
}

/** The values of one published series, or null when nothing is bound. */
const seriesOf = (scenario, name) => {
  try {
    return scenario?.series(name)?.values ?? null;
  } catch {
    return null;
  }
};

/**
 * What each row is, when a scenario IS bound. BINDING.md §2a.
 *
 * THREE ENTRIES, AND IT USED TO BE NINE. Six of them labelled rows that have
 * come off (§1) — the Hill curve's two outputs, the band arithmetic, the girth
 * rule, the arbitrary-unit ATP counter. They are not listed here "for later":
 * an evidence word with no number under it is apparatus with nothing to hold,
 * and the day one of those rows comes back it comes back with its own word.
 * What is left is three published series and nothing derived from them.
 *
 * Unbound, every row is `Illustrative` — the panel is then reading the invented
 * curve and there is nothing to distinguish.
 */
const BOUND_EVIDENCE = {
  clock: ["Derived", "the archived sample this frame landed on"],
  calcium: ["Derived", "Ca_myo_total from the published run, on a display scale"],
  store: ["Derived", "Ca_SR_total from the published run, against its own first sample"],
  tension: ["Derived", "force_relative from the published run"],
};

/**
 * One row's badge.
 *
 * DECLARED HERE, AT MODULE SCOPE, AND IT MATTERS. This was a closure inside
 * `FiberMetrics` so it could read `bound` — which made it a NEW component type
 * on every render, so React unmounted and rebuilt the whole subtree sixty times
 * a second. Nothing looked wrong: the numbers updated and the badges drew. The
 * cost only appears once a badge has state — the reveal opened and was destroyed
 * on the next frame, and Playwright, trying to click one, reported "element was
 * detached from the DOM" until it timed out. A control that cannot survive one
 * animation frame cannot be pressed by a person either.
 *
 * `bound` and `scenario` travel as props for the same reason they always did:
 * unbound, these numbers are the invented curve and no scenario file stands
 * behind them, so handing the badge a record would let a viewer open Francis et
 * al. underneath a quantity Francis never produced. One condition decides the
 * word and the record together and neither can be forgotten alone.
 */
function Ev({ of, bound, scenario }) {
  const [word, why] = bound
    ? BOUND_EVIDENCE[of]
    : ["Illustrative", "no published run is bound — this is the invented curve"];
  return (
    <EvidenceBadge title={why} source={bound ? scenario : null}>
      {word}
    </EvidenceBadge>
  );
}

export default function FiberMetrics({ state, extent, range = null, scenario = null }) {
  if (!state) return null;

  // Bound or not. Read off the state rather than taken as a prop, so there is no
  // way to render a `Derived` badge over the invented curve by forgetting one.
  const bound = state.force !== null && state.force !== undefined;
  /* What the cisternae in the scene are drawn against, taken from the same
     function they are drawn through. Null unbound — the invented curve has no
     store, and a row reading 0 would claim a depletion nothing modelled. */
  const storeFull = bound && scenario ? storeFullScale(scenario) : null;

  return (
    <div className="fiber-metrics">
      {/* THE REQUEST THIS SCENE COULD NOT HONOUR. The clamp in FiberScene is
          honest only because this paragraph exists — the cell and signalling
          scales have said so since they were written and this one snapped in
          silence, which is the bug CLAUDE.md §5 names. The requested number is
          printed at the precision it was asked at: rounding it is how the
          signalling banner ended up printing "-0 s". */}
      {range && (
        <p className="note cell-out-of-range">
          <strong>{range.requested} s is outside this run.</strong> The archive covers {range.t0} to{" "}
          {range.tEnd} s — the clock below starts at the nearest instant it has.
        </p>
      )}
      <p className="label">State</p>
      <p className="fiber-phase">{state.phaseLabel ?? PHASE_LABEL[state.phase] ?? state.phase}</p>

      {SHOW_FIGURES && (
      <dl className="meta meta--evidence">
        {/* WHAT TIME IT IS, and it was nowhere. Q24 R4 measured the three deep
            scales at one instant: signalling printed "2.0 min", this scene's
            clock stood at 1.91 s with nothing on the page saying so, and the
            cell printed no time at all. `SignallingReadout.jsx` had already
            written the reason down for its own scale — a scrubber whose
            position is nowhere on screen is a control a viewer cannot aim —
            and this scale has a scrubber.
            THE POSITION, NOT THE SPAN. Same file, same rule: "16.0 of 44.9 min"
            became "16.0 min" because the span is the run's and the position is
            the viewer's. Read off `state.time`, which is the clock the scene
            itself advances, so a printed time that stops following it is a red
            gate rather than a stale caption. */}
        {bound && Number.isFinite(state.time) && (
          <>
            <dt>t <Ev of="clock" bound={bound} scenario={scenario} /></dt>
            <dd>{state.time.toFixed(1)} s</dd>
          </>
        )}
        <dt>Free calcium <Ev of="calcium" bound={bound} scenario={scenario} /></dt>
        <dd>
          <Trace
            value={state.calcium}
            series={seriesOf(scenario, "Ca_myo_total")}
            full={CA_FULL_SCALE_UM}
            t={state.time}
            grid={scenario?.grid ?? {}}
            tone="calcium"
          />
        </dd>
        {/* THE OTHER HALF OF THE SAME SUBSTANCE, and it sits directly under the
            free calcium on purpose: what leaves this row arrives in that one.
            A trace and not a bar because `Ca_SR_total` is a published series,
            which is the rule stated below. Full scale is the run's own first
            sample rather than a constant — see `storeFullScale`. */}
        {storeFull && (
          <>
            <dt>Stored calcium <Ev of="store" bound={bound} scenario={scenario} /></dt>
            <dd>
              <Trace
                value={state.storeFraction ?? 0}
                series={seriesOf(scenario, "Ca_SR_total")}
                full={storeFull}
                t={state.time}
                grid={scenario?.grid ?? {}}
                tone="calcium"
              />
            </dd>
          </>
        )}
        {/* NO BINDING-SITE AND NO CROSS-BRIDGE ROW, AND THE ABSENCE IS THE
            POINT. Both were `activationFrom` — a Hill curve with textbook
            constants nobody fitted to this model — and both drew as bars rather
            than traces so the shape said `Illustrative` without a word. §1 is
            stricter than that distinction: a quantity that is not one of §2.1's
            three does not sit on the default view at all. Neither claim is lost,
            because both are DRAWN — tropomyosin rolls off its binding sites and
            the heads attach and stroke, which is where an unfitted curve is
            honest as motion and was overclaiming as digits.
            If either ever returns it returns as a BAR: a trace means a published
            series, a bar means ours (docs/clock-and-events.md §4). */}
        <dt>Relative tension <Ev of="tension" bound={bound} scenario={scenario} /></dt>
        <dd>
          {/* `force_relative` is already 0 to 1 in the export, so full scale is
              1 and no constant is needed here.

              AND IT IS THE ONE TRACE THAT CAN CARRY A NUMBER. Q14 R4,
              2026-08-27: all three traces were a name, a badge and a line, with
              no scale anywhere — `Stored calcium` has its number on the plate
              (`622 µM of 941`) and the other two had none on the screen at all.
              A wiggle with no ruler is a shape.
              Only this one gets fixed. `Free calcium` is drawn against
              `CA_FULL_SCALE_UM`, and `fiberSimulation.js` says what that is in
              its own words — *"a modelled concentration shown on an INVENTED
              scale, which is a weaker claim than the concentration itself"*.
              Printing our scale as a ruler would be §5's failure with a decimal
              point. `force_relative` is the authors' own fraction of maximum, so
              "of maximum" is their word and not ours. */}
          <span className="fiber-trace__read">
            {state.tension != null ? state.tension.toFixed(2) : "—"} <span className="muted">of maximum</span>
          </span>
          <Trace
            value={state.tension}
            series={seriesOf(scenario, "force_relative")}
            t={state.time}
            grid={scenario?.grid ?? {}}
          />
        </dd>
      </dl>
      )}


      {/* THE FATIGUE SENTENCE IS NOT HERE ANY MORE and this note is what stops
          it coming back. `Force is falling. The store is empty.` now sits on the
          stage, over the cisternae it is about (`MuscleFiberVisualization`), and
          a second copy in the panel would put one measured claim on screen
          twice. Its window is `forceIsFalling`, held to the shipped archives in
          `scenarioDrive.test.js`, which is where the condition still lives.

          THE SARCOMERE BLOCK WENT WITH IT — A-band, I-band, H-zone, filament
          overlap, girth and the arbitrary-unit ATP counter. Seven numbers, none
          of them §2.1's, all of them describing a drawing that is on screen at
          full size a few hundred pixels away. The A-band's claim survives on the
          callout that points at the A-band, which `fiberGeometry.test.js` still
          measures the drawing against. */}

      {/* The published run is 13 s long and the tab is not, so the scene replays
          it. The replay refills the SR store 716.6 -> 941.2 µM between two
          frames while force stays flat across the same seam, which is exactly
          the shape of a recovery that never happened. Naming the repeat is what
          keeps the reset from being read as physiology. */}
      {/* SHORTENED, AND DUE TO DIE. `lane/tissue` d88d7a9 turns the replay seam
          into a visible cut — the run holds on its last sample, cuts in one
          frame, holds on the first — so the jump has nowhere to be read as
          physiology and this sentence apologises for a defect the app no longer
          has. THE CONDITION IS NOW MET — the cut landed, and `FiberScene.jsx` says
          so in its own words: it "ends still, cuts in one frame, and starts still".
          So all three of these survived the merge that was meant to kill them and
          are now apologising for a defect that is gone. Tracked in `TODO.md` rather
          than removed here, because deleting visible copy is a screen change and
          CLAUDE.md §4 wants that seen in a browser, not inferred from a green
          gate. */}
      {state.lap > 0 && (
        <p className="note fiber-lap">
          Replay {state.lap + 1} — the SR refilling at the seam is the recording restarting.
        </p>
      )}

      {/* A NUMBER, SO IT CARRIES A WORD. Q15 R4, 2026-08-27: the three scales
          write this line three ways and only one of them was consistent.
          Signalling's carries a `Curated` badge over its "121 species, 259
          interactions"; the cell's carries none and needs none, because it says
          outright "No measured extent". This one said **6.6 µm — 3 sarcomeres**
          and carried nothing at all: a figure on screen with no way to its
          source, which is §5's floor rather than a nicety.
          `Derived`, because it is `SARC_COUNT` — how many this scene chooses to
          draw, ours — times `FILAMENT.restLength`, the standard resting
          sarcomere. Neither half is measured off a specimen and the product is
          arithmetic, which is exactly what the word means. */}
      {SHOW_FIGURES && extent && (
        <p className="note fiber-extent">
          {/* AND THE SEAM IN THE SENTENCE, not only in the badge. Q25 R4: the
              cell's line says "No measured extent: the AMPK model is well-mixed
              and carries no geometry" and signalling's says "No measured
              extent: the layout is ours", both on the page. This one stated a
              physical size and stopped, with the seam one press away — which
              keeps §5's floor and still leaves a viewer who presses nothing
              reading one scale's extent as measured and the next two as drawn.
              Five words, and they are true of all three levels this table
              holds: the figure is what the scene chooses to show, not something
              read off a specimen. The badge underneath keeps the whole of it. */}
          Field of view: {extent}. Not measured — what this scene draws.{" "}
          <EvidenceBadge
            title={
              `ours: ${SARC_COUNT_NOTE}. The 2.2 µm resting sarcomere is a standard value, not one measured ` +
              `here, and the field of view is the product — how much tissue this scene chooses to draw. ` +
              `No published model is behind it: this is a fact about the drawing, not about muscle.`
            }
          >
            Derived
          </EvidenceBadge>
        </p>
      )}
    </div>
  );
}
