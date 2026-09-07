/**
 * TEMPORARY — prototype controls only.
 *
 * These stand in for the exercise state the anatomy page will eventually supply.
 * Deleting this file and passing `showControls={false}` is the whole removal:
 * nothing else imports it, and MuscleFiberVisualization already accepts every
 * value it sets as a prop.
 *
 * Markup reuses styles.css .chip / .label / .chips so it looks like the
 * explorer's existing left panel rather than a debug overlay.
 */

import { useId } from "react";

import { EXERCISE_MODES } from "./fiberSimulation.js";

/**
 * The same three the body scale offers, and deliberately not a fourth.
 *
 * A slower one is available for free and is not here: below 0.25x a 13 s run
 * takes a minute of staring, and the two events this control exists for — the
 * 0.1625 s burst and the 0.126 s transient it causes — are already tens of
 * frames apart at a quarter speed. There is no reading a 0.1x adds.
 */

/* THE `Scale` SECTION LEFT THIS PANEL, 2026-08-30 (canon F2).
   *"fiber만 sarcomere ↔ 다른 레벨 전환이 있다 … Gizmos식 토글도 제발 main 화면
   안에 디자인 ㅈㄴ 잘 입혀서 floating하게 어딘가에 두는걸 목표로 해."* It was
   three `.chip`s behind ☰, which is the one place a first-time visitor does not
   look — and it is the only control in the descent that changes what is DRAWN
   rather than how it plays, so it is the one that most has to be on the stage.
   `MuscleFiberVisualization` renders it now, floating, and hides it while the
   guided pass runs.
   THE LEVEL'S `note` WENT WITH IT rather than following it onto the picture.
   §9's default is an empty screen and F1's ruling in the same canon is that the
   pass explains an element, not standing text; a sentence under a floating
   toggle is standing text with a smaller font. `LEVELS[key].note` is untouched
   in `fiberGeometry.js` and is what the fascicle and fibre levels' own passes
   will say when they exist. */

export default function FiberControls({
  bound = false,
  exerciseMode,
  onExerciseMode,
  motion,
  intensity,
  onIntensity,
  isActive,
  onActive,
  showLabels,
  onShowLabels,
  /** True while a guided pass is running — it folds the names itself. */
  passing = false,
}) {
  const intensityId = useId();
  return (
    <div className="fiber-controls">
      {/* THE `Contraction` SECTION IS GONE ON A BOUND RUN, 2026-08-30.
          Its chips were already hidden there (the note below says why), which
          left a heading whose entire content was one provenance sentence —
          "From the published model's force, calcium and the store." — with no
          control under it. The fibre lane's own first-visitor audit logged it;
          what forced it was the right-hand column coming off, because the
          section then rode up into the top-left toolbar and sat ON the picture:
          measured 2026-08-30 at 1280x860, the toolbar was 430x368 against an
          812 px stage, 45% of the height, which is `styles.css`'s "the
          instrument panel is eating the instrument" arriving on a desktop.
          Unbound the section is real — the chips are there and the note
          describes what they do — so it is hidden with them rather than
          deleted. */}
      <section hidden={bound}>
        <p className="label">Contraction</p>
        {/* AND THE CONTRACTION CHIPS GO THE SAME WAY ON A BOUND RUN. Q12 R2,
            2026-08-27: sampled the store trajectory under all three modes and
            binned it by time — across 21 shared instants the largest difference
            was **0.002**, and that one is the binning. The mode does not touch a
            bound run; the run is the published bout whatever chip is lit.
            Worse than inert, because two of them then print a sentence about a
            mechanism the picture is not showing: press `Tetanus` and the panel
            says "Stimuli arrive faster than calcium clears, so twitches fuse"
            over the Francis ten-repetition bout. `fiberSimulation.js` had
            already written the rule for its own field — *"Replaces `note` when a
            scenario is bound, because the note is false then"* — and gave a
            `boundNote` to `rep` alone, which is the mode a bound scene opens on.
            With the chips down the mode stays `rep` and the note stays the true
            one. They come back the moment a scenario is not driving. */}
        {!bound && (
          <div className="chips">
            {Object.entries(EXERCISE_MODES)
              .filter(([key]) => key !== "rep" || motion)
              .map(([key, spec]) => (
                <button
                  key={key}
                  className={exerciseMode === key ? "chip chip--on" : "chip"}
                  aria-pressed={exerciseMode === key}
                  onClick={() => onExerciseMode(key)}
                >
                  {spec.label}
                </button>
              ))}
          </div>
        )}
        <p className="note fiber-mode-note">
          {/* The unbound note calls this illustrative. Once a scenario drives it that
              is false, and a stale label under live model output is worse than none. */}
          {(bound && EXERCISE_MODES[exerciseMode]?.boundNote) || EXERCISE_MODES[exerciseMode]?.note}
        </p>
      </section>

      {/* INTENSITY AND `stimulate` ARE FREE-RUN CONTROLS AND A BOUND RUN HIDES
          THEM. Q12, 2026-08-27 — measured on the route a visitor actually
          reaches, with the clock held still and then running:

            `Intensity` moved its own label 70% → 100% and moved NOTHING in the
            model. `fiberSimulation.js:513` says why, and says it deliberately:
            "`intensity` deliberately does NOT multiply this. It is a UI slider;
            a published fraction_of_maximum times a slider is an invented number
            that would inherit the scenario's `Derived` badge."

            `stimulate` changed no pixel and no number at a frozen instant —
            `advance` does not run while the clock is stopped, so a viewer who
            pauses to look and then presses gets no answer at all. With the run
            going it does exactly one thing: `state.force = isActive ? … : 0`,
            three lines under that comment. **That is the same multiplication
            the comment forbids**, by zero, and `state.evidence` is set from the
            scenario's provenance on the line above it.

          So one of them does nothing and the other does something §5 does not
          allow. Both stay for the unbound dev route, where they are the real
          controls of a free simulation. `labels` is untouched — it works, and
          Q11 R10 measured what it does. */}
      {!bound && (
      <section>
        {/* THE ONLY CONTROL IN THE APP WITH NO NAME AT ALL. The same sweep that
            found the strip's glyph found this: an `input[range]` whose accessible
            name computed to the empty string, because a `<p>` sitting above a
            control is a paragraph, not a label. The strip's scrubber has carried
            `aria-label="Time"` since it shipped; this one had nothing.
            `aria-labelledby` rather than a second copy of the word: the text is
            already on screen, it already carries the live percentage, and a
            hidden duplicate would be a second place for the two to disagree. */}
        <p className="label" id={intensityId}>
          Intensity · {Math.round(intensity * 100)}%
        </p>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          aria-labelledby={intensityId}
          value={intensity}
          onChange={(e) => onIntensity(+e.target.value)}
        />
      </section>
      )}

      <section>
        <p className="label">Playback</p>
        <div className="chips">
          {/* THE STRIP THE NEXT PARAGRAPH SENDS THINGS TO NO LONGER EXISTS.
              TODO.md's canon of 2026-08-30 (D3) deleted it: the run plays
              itself, the rate is the constant `MuscleFiberVisualization` names,
              and pause is A4's, top-right, on all four screens. What is below
              is kept as the argument for what those controls were FOR — it is
              the reason they must not come back into this panel — but nothing
              it names as a destination is on the screen today. */}
          {/* THE RATE MOVED TO THE STRIP ON 2026-08-27, and the reason is that
              two of the three scales already had it there. `Timeline.jsx` is the
              shared transport and it takes `replay`/`onReplay`; the cell and the
              signalling scales pass them and this one did not, so its chips sat
              in the panel. Measured at 1201 px: PANEL 1007,324 here against
              stage 338,639 on both scales below — the same control in a
              different place on the FIRST scale a viewer descends into, moving
              the moment they go one level further. Q10's failure said plainly.
              The comment that was here is worth keeping because it is still the
              argument for the chips existing at all: this scale forced 1x the
              moment a scenario bound and said so only in a comment, while one
              calcium transient is 0.126 s FWHM and the burst causing it is
              0.1625 s. Both are shorter than the eye can use, and the ORDER
              between them is the lesson. "The lit chip is the declaration" now
              happens on the strip, and `driven` travels there with it —
              `DevFiberScene` owns the rate and `MuscleFiberVisualization`
              reports the pass up through `onDriven`.
              AND `pause` FOLLOWED IT ON 2026-08-27, because the reason it was
              left behind did not survive being measured. The claim was that a
              word beside a glyph is a smaller difference. It is not a difference
              at all — it is the SAME STATE drawn twice: pressing this one turned
              the strip's glyph into `▶` and this word into `play` in the same
              frame. Two buttons, one fact, **727 px apart** at 1201 px (panel
              946,324 against strip 299,655), on the one scale of the three that
              had them. The body has the same pair 96 px apart inside one
              transport block, where a viewer sees both change at once; here the
              twin is off in the other corner. The cell and signalling carry the
              glyph alone, so removing the word is what makes the three layers
              one product rather than three to learn. */}
          {!bound && (
            <button
              className={isActive ? "chip chip--on" : "chip"}
              aria-pressed={isActive}
              onClick={() => onActive(!isActive)}
            >
              stimulate
            </button>
          )}
          {/* THE CHIP SAYS WHAT IS ON SCREEN, NOT WHAT THE STATE IS. Q12 R8,
              2026-08-27: while a pass runs, `FiberScene` folds the six anatomy
              names itself — the line and a plate saying the same thing in the
              same place collide, 770 px², measured. The chip stayed LIT through
              all of that, so a viewer pressing it saw the opposite of its label:
              plates went 0 → 2 and the chip went dark. They turned labels
              "off" and labels appeared.
              Dark while a pass drives, and a press then means ON. It is the
              argument the strip's rate chips were built on — "the lit chip is a
              STATEMENT and the statement was false for the whole of every
              guided pass", measured 2026-08-27 across the fibre's beats, where
              the chips read "0.5×" while the pass drove the run at 0.086,
              0.073, 0.217, 1 and 0 — applied to the other control the pass
              overrides. Quoted rather than cited: `director/Timeline.jsx` made
              it and was deleted on 2026-08-31. The press ends the pass on its way down (cinematic.js),
              so what the viewer gets is the names, which is what the chip
              promised. */}
          <button
            className={showLabels && !passing ? "chip chip--on" : "chip"}
            aria-pressed={showLabels && !passing}
            onClick={() => onShowLabels(passing ? true : !showLabels)}
          >
            labels
          </button>
        </div>
      </section>
    </div>
  );
}
