/**
 * The signalling scale's guided pass.
 *
 * The reading `docs/fixing-prd.md` §2.3 asks for, walked instead of printed:
 * *"Different entrances, shared trunk."* Nothing here states that sentence. The
 * camera goes up to the inputs, the resistance fan lights, the endurance fan
 * lights somewhere else, four of the lit lines turn out to land on the same four
 * nodes; then one column climbs while the other sits on its tick, then the other
 * one climbs; then the trunk both of them feed; and last, parked at the run's
 * final sample, the twelve outputs with the two bouts drawn as one mark on every
 * one of them. The sentence is what a viewer is left with.
 *
 * THE CONTROL IS THE STORY, SO A BEAT TURNS IT. The fibre pass's equivalent of
 * this is the camera crossing from the t-tubule to the store — a move in space.
 * Here the move is a move in the CHIP: you cannot see that a door is a door
 * until you shut it and the column under it stays put (SignallingScale.jsx says
 * this about the chips, and this pass is that argument made without asking a
 * first-time viewer to press anything). So each beat carries an `arm`, the scene
 * draws `beat.arm ?? the viewer's chip`, and when the pass ends or is interrupted
 * the chip is what is on screen again — the override is derived per frame, not
 * stored, so there is no state left to hand back and nothing to forget to.
 *
 * EVERY BEAT CARRIES BOTH, AND FOR THE SAME REASON. `seek`, because a beat that
 * inherits the clock is a beat whose picture depends on how long the one before
 * it ran (fiberTour.js paid for that one in a browser). And `arm`, because a beat
 * that inherits the CHIP is a beat whose picture depends on what the viewer
 * pressed before the pass started.
 *
 * NO INSTANT IS TYPED. Two of them are the run's own ends — `grid.t0` is 0 and
 * `runSeconds` is measured off `grid.tEnd` by the caller — and the third is where
 * the two split beats leave the clock, computed from their own windows below so
 * the trunk beat opens where they closed instead of rewinding. The counts in the
 * lines are `routesOf`'s, off the shipped bytes: nine doors, six doors, four of
 * eleven shared, the trunk's population, twelve outputs. None of them is written
 * down here, and `signallingTour.test.js` checks each line against what the file
 * derived.
 *
 * THE PAPER'S NUMBER IS NOT IN HERE AND MUST NOT ARRIVE. The archive ships 264
 * arrows and the paper quotes 259 interactions; they answer different questions
 * (`scenarioData.js`) and neither belongs in a line. The test forbids both.
 *
 * NO PULSE, NO PROPAGATION RATE. Same refusal `signallingGeometry.js` makes about
 * the lit entry edges: this export ships no speed at which a signal travels, so
 * an animated one would be a claim the model does not make — and `gate-no-strobe`
 * and `photosensitivity` are measuring. What moves during this pass is the run's
 * own clock and the camera.
 */

import { TOGETHER } from "../tour.js";
import { secondsPerMinute } from "./signallingBinding.js";
import { BANDS, SPAN, SIGNALLING_CAMERA } from "./signallingGeometry.js";

/**
 * How much of the run one wall second covers at speed 1.
 *
 * CONTRACT — this is the scale's own compression and there is exactly one of it.
 * One model minute per wall second, so the 45-minute protocol takes about three
 * quarters of a minute to watch. Real time is forty-five minutes of staring and
 * no compression at all is a still frame of a result whose whole point is that it
 * takes time to arrive.
 *
 * Derived points to keep in step: `SignallingScale.jsx`'s frame loop, which is
 * the only thing that steps this clock, and `signallingTour.test.js`, which needs
 * it to know what run each beat actually covers — `[seek, seek + speed * this *
 * ms/1000]`. It lived in SignallingScale.jsx as `MINUTES_PER_SECOND * secondsPerMinute`
 * until the pass needed to measure a window, and a test that retyped the 60 could
 * have gone green over a scene that had changed it.
 */
export const RUN_SECONDS_PER_SECOND = 60;

/**
 * Square-on at `back`, centred on `y`. The scale's own axis, which is not a taste:
 * `signallingGeometry.js` puts the camera at x = 0 so world x maps to screen x
 * linearly, and a yaw would make every anchor's screen position depend on its z.
 * A pass that swung around the Y would break the anchors' contract for the whole
 * time it ran.
 */
const on = (y, back) => ({ camera: [0, y, back], lookAt: [0, y, 0] });

/* THE FRAMINGS ARE THE GEOMETRY'S, not four numbers that looked right once.
   Each is centred on the band it is about — `BANDS[band].y + SPAN / 2` is the
   middle of that band's marks — so a band moved in `signallingGeometry.js` moves
   the shot with it. Only the distance back is typed, and it is chosen so the
   band's widest slot stays inside the frame at the narrowest aspect the app is
   used at (0.99): half-width is `back * tan(fov/2) * aspect` with the shell's
   38° fov, which puts the bound at about 0.34 * back. */
const WIDE = { camera: SIGNALLING_CAMERA, lookAt: [0, 0, 0] };
/* Between the inputs' marks and the trunk's floor, because that is what the lit
   entry lines span: they run from the input's slot down to the FLOOR of whatever
   band their target sits in, and the furthest of those is the trunk. A close-up
   on the inputs band alone would cut the fan off at the knees. */
const DOORS = on((BANDS.membrane.y + SPAN + BANDS.cytosol.y) / 2, 2.6);
/* Both split columns, which is why this one is the widest of the four: they are
   pushed out to ±0.62 and are 0.34 and 0.22 half-wide, so the frame has to hold
   x = -0.96 to 0.84 or the comparison the beat is about is off screen. */
const SPLIT = on(BANDS.cytosol.y + SPAN / 2, 3.2);
const TRUNK = on(BANDS.cytosol.y + SPAN / 2, 2.7);
/* NO `OUTPUTS` STOP. It was computed here and used by no beat — a fifth camera
   stop to anyone reading, and a corpse. The conclusion moved to `WIDE` and the
   paragraph below says why; the number it names is kept there rather than as a
   binding nothing reads. */

/**
 * The two split beats' window, and where the trunk beat therefore opens.
 *
 * 9 model minutes, and it is measured rather than picked: the resistance column
 * does most of its travel in the first half-minute and is still climbing at 9,
 * while the column it never touches has drifted 0.021 of a [0,1] activity — under
 * the 0.05 the panel calls "different", which is what lets the line say the other
 * column stays on its tick. By the end of the run that drift is 0.050 and the
 * sentence would be false.
 */
/* THE TWO 2600s ABOVE ARE 3600 AND 2700 SINCE 2026-08-27, and both are held
   beats, so the raise is pace and nothing else — this pass had the fewest short
   beats of the three and still had two. See `tourPace.test.js`: at 200 words a
   minute, less the tour line's 260 ms fade, "One muscle cell's network. Both
   bouts start on the same mark." needed 3.33 s of readable time and had 2.34.
   `SPLIT_MS` is untouched; those beats already had room. */
const SPLIT_MS = 4500;
const SPLIT_SPEED = 2;
const TRUNK_FROM = (SPLIT_MS / 1000) * SPLIT_SPEED * RUN_SECONDS_PER_SECOND;

/**
 * @param protocol the resistance arm's own protocol block.
 * @param routes `routesOf(arms)` — the doors, the columns, the trunk, the outputs.
 * @param runSeconds the archive's last instant in seconds, measured by the caller
 *   off `grid.tEnd` rather than typed here.
 */
export function signallingTour(protocol, routes, runSeconds, descendedArm = null) {
  const doors = routes?.doors;
  const rDoors = doors?.resistance?.steps?.length ?? 0;
  const eDoors = doors?.endurance?.steps?.length ?? 0;
  const sharedDoors = doors?.shared?.length ?? 0;
  const allDoors = doors?.all?.length ?? 0;
  const trunk = routes?.shared?.length ?? 0;
  const outputs = routes?.outputs?.length ?? 0;
  const bout = protocol?.bout_minutes;

  /* NO PASS WITHOUT THE THINGS ITS LINES NAME. Every guard below is a sentence
     this storyboard would otherwise say over a picture that does not support it:
     no doors and it announces a fan that is not lit, no trunk and it names a band
     with nothing in it, no run and every beat seeks to NaN while the clock sits
     at the first frame under a line about the end.

     `Number.isFinite`, NOT `>= 0`. `null >= 0` is true in JavaScript, and that
     exact trap shipped on the fibre scale: a missing measurement went through the
     guard and built a pass whose last beat seeked to null, parking the run at
     zero under a line about the run's end. Here the missing measurement would be
     `runSeconds`, and zero is where this pass's own opening beat sits — so the
     last two beats would have shown the same picture and only one of them would
     have been telling the truth. */
  if (!Number.isFinite(runSeconds) || runSeconds <= 0) return [];
  if (!(rDoors > 0) || !(eDoors > 0) || !(sharedDoors > 0)) return [];
  if (!(trunk > 0) || !(outputs > 0)) return [];
  /* AND THE BOUT HAS TO COVER THE RUN. The last beat parks on the archive's final
     sample and calls it where the two bouts land; that reading holds only while
     the input is still on there. The fibre run is 6.5 s of work and 6.5 s of
     recovery, and an export of this network with a recovery tail would put this
     pass's conclusion inside it without changing a line of the storyboard. */
  if (!(bout > 0) || bout * secondsPerMinute < runSeconds) return [];

  /* WHERE THE BEACON SITS, PER BEAT — measured 2026-08-30 in a browser: the
     ring was drawn at `beat.lookAt` (tour.js hands `onFocus` the lookAt, which
     is a CAMERA fact), and every signalling lookAt is a band centre at x = 0 —
     so on seven of eight beats the beacon pulsed over empty paper between the
     bands while the line talked about a column at ±0.62 or the doors at the
     top. `focusAt` is the beat's SUBJECT, from the same BANDS the marks are
     drawn from, never typed.
     THE DOOR BEATS SIT AT THE BAND FLOOR, not the band top: they all seek 0,
     and at the archive's first sample the input marks read near baseline —
     measured 2026-08-30, a ring at `inputs.y + SPAN` floated 120 px above the
     mark it was pointing at. */
  const doorsAt = [0, BANDS.membrane.y, 0];
  /* THE COLUMNS ARE SIDES OF A COMPARTMENT NOW, not bands of their own, so a beat
   about resistance points at the LEFT of the cytosol and one about endurance at
   the right. `outputs` and `shared` keep pointing at a whole compartment's
   middle, which is what they always meant. */
  /* THE VISITOR'S OWN WORKOUT GOES FIRST. This is the one scale where the
     archive tells two exercises apart — the paper ships both bouts and
     `armFor` already decides which one an exercise is drawn as — and the pass
     led with resistance whatever the visitor picked. It was rebuilt onto the
     new five-band geometry from a base that predated this, so it is restored
     here rather than written twice: ordering, not new copy. With a resistance
     visitor every string is byte-for-byte what it was. */
  const lead = descendedArm === "endurance" ? "endurance" : "resistance";
  const other = lead === "resistance" ? "endurance" : "resistance";
  const gloss = { resistance: "lifting weights", endurance: "steady work" };
  const doorSlot = (armName) => [
    (armName === "resistance" ? -1 : 1) * BANDS.membrane.half * 0.7,
    BANDS.membrane.y,
    0,
  ];
  const Cap = (w) => w[0].toUpperCase() + w.slice(1);
  const columnAt = (band) =>
    band === "resistanceOnly"
      ? [-BANDS.cytosol.half * 0.6, BANDS.cytosol.y + SPAN / 2, 0]
      : band === "enduranceOnly"
        ? [BANDS.cytosol.half * 0.6, BANDS.cytosol.y + SPAN / 2, 0]
        : band === "shared"
          ? [0, BANDS.cytosol.y + SPAN / 2, 0]
          : [BANDS.outcome.x, BANDS.outcome.y + SPAN / 2, 0];

  return [
    {
      /* The whole Y, holding still on the settled baseline the protocol's
         `start_state` describes — nothing has been asked of this cell yet. */
      /* T13/T27: eighteen words; the pace gate set the number. */
      /* 5700 -> 8600. The first-visitor audit found the deepest scale severed
         from the one above it: nothing here named the sensor, the exercise, or
         what a tick is, and the two sentences that did live inside evidence
         tooltips that no longer render. The pass had 8.5 s spare under the
         45 s ceiling, so the handoff is spoken instead. */
      ms: 9000,
      ...WIDE,
      seek: 0,
      speed: 0,
      arm: "both",
      focusAt: doorsAt,
      /* THIS BEAT BELONGS TO NO PART — canon D2ⓐ, 2026-08-31. Under a press
         model a storyboard is cut into demonstrations and the beat with no part
         is the OPENER: the sentence the scale says about itself before anybody
         touches it, standing while the names arrive rather than waiting behind a
         ring. Every other beat here names a piece of the picture; this one names
         the picture.
         Declared rather than left off, because `focus` stays. The beacon has to
         land somewhere while this plays and the doors are where the run starts,
         so the two fields disagree here exactly as they disagree on the fibre's
         closing beat — and `stepsOf` reads `part` first for that reason. Without
         the declaration this scale had no opener at all and the line was filed
         as the doors' first half, reachable only by pressing the doors. */
      part: null,
      /* "HOLDING STILL" LEFT A VIEWER WITH A QUESTION THE FRAME ANSWERS. At
         t = 0 all 97 pairs coincide, so the network draws in ONE arm's colour —
         which is honest, they are identical — while both arm swatches sit in the
         legend beside it. A design review read that cold: the picture says one
         colour, the legend says two, and nothing says why.
         What is actually in the frame is the pass's whole setup. They start on
         the same mark; the middle of the pass is where they come apart; the last
         beat is that they arrive on the same mark anyway. Saying so costs a
         clause and turns a monochrome opening from a puzzle into a premise. */
      focus: "doors",
      line: /* "One cell's network", not "One muscle cell's network". Q14 R7, 2026-08-27:
       R1 of the same question shortened the panel's field-of-view line by that
       word to buy a denominator for two plates, and left this beat saying the
       longer form — one thing, two names, on one screen, which is the defect
       Q10 R3 and Q11 R1 both spent a round on.
       This side is the one that gives, because a viewer arriving here has come
       down through CELL and the trail still says so: the descent has already
       established which cell, and repeating it is the word the panel needed. */
      /* T13, 2026-08-30: the opening now receives the story the cell scale just
            handed down — its closing line is "staying on is its signal to change the
            muscle" — and says what this picture IS in the depth table's words:
            the signal spreading through a web. "Both bouts start on the same
            mark" survives as the second sentence's job, one beat later. */
         /* "START TOGETHER" IS LOAD-BEARING: at t = 0 every drawn pair coincides,
            so the scene opens in one arm's colour, and the test that guards this
            line checks the claim against the frame. */
         /* "THE SIGNAL FROM WORKING MUSCLE", not "that signal": T27 opened this
            scale cold and the pronoun had no antecedent — it leaned on the cell
            scale's closing line, which a shared link never played. This form
            reads the same for a descender (it IS that signal) and stands alone
            for a cold arrival. */
         "Same cell as upstairs — now the orders it sends. The sensor there sent them. " +
        "Each grey tick is that cell doing nothing. Both workouts start together.",
    },
    {
      /* IN TO THE DOORS WITH THE RUN HELD, so what a viewer watches is the fan
         lighting rather than a hundred marks drifting under it. The chip is the
         only thing that changes across the next three beats, which is the whole
         point: same instant, same camera, different door. */
      /* 4000 -> 5600, for the clause naming which of the two workouts is the
         visitor's own. It was known here and said only in a tooltip. */
      ms: 5600,
      ...DOORS,
      seek: 0,
      speed: 0,
      arm: lead,
      focus: `split-${lead}`,
      /* The resistance INPUT's own slot — the mark the lit fan pours out of.
         `inputs.half` is where `slotsFor` puts the first of two door marks. */
      focusAt: doorSlot(lead),
      line: /* THE COUNTS LEFT THE PASS (T13): figures are out of the UI and six had
            survived in these lines — the fibre's were swept in T3. The guards
            above still use the counts to refuse an unlit pass; the sentences no
            longer print them. */
         /* ONE ARM, ONE NAME. The first draft said "lifting weights" here while
            beat 5 and the WORKOUT chips say Resistance — one thing under two names
            is the cell scale's CAMK lesson again, a layer up. The beginner word
            rides in apposition so the chip's word stays the anchor. */
         `${Cap(lead)}, ${gloss[lead]}, comes in here and lights these doors.`,
    },
    {
      /* The fan crosses the canvas. This is the beat the pass exists for — it is
         the picture of "different entrances", and no sentence has to claim it. */
      ms: 2600,
      ...DOORS,
      seek: 0,
      speed: 0,
      arm: other,
      focus: `split-${other}`,
      focusAt: doorSlot(other),
      line: `${Cap(other)}, ${gloss[other]}, lights different doors.`,
    },
    {
      /* Both fans lit at once, and the four shared first steps are the four marks
         with a line arriving from each side. The trunk, one layer earlier than the
         trunk (`signallingBinding.js` on `doors.shared`). */
      ms: 3000,
      ...DOORS,
      seek: 0,
      speed: 0,
      arm: "both",
      focus: "doors",
      focusAt: doorsAt,
      line: "A few doors light from both sides.",
    },
    {
      /* THE EXPERIMENT, RUN FOR THE VIEWER. One bout on screen: its own column
         climbs and the other column's marks sit on the no-exercise ticks. The
         line says both halves because both are measured over exactly this window
         — see TRUNK_FROM above, and the test that walks the shipped series across
         it rather than trusting this comment. */
      ms: SPLIT_MS,
      ...SPLIT,
      seek: 0,
      /* FASTER THAN ANY CHIP, AND THE MEASUREMENT IS WHY. The chips stop at 1x
         because that is a rate a person can read a whole run at; a beat is not
         reading a whole run, it is being shown one contrast, and at 1x this one
         would end at 4.5 of the run's 45 minutes with the second column not yet
         obviously still. Nothing about the model is being sped up — this is the
         replay rate, the same number the chips set, and the clock beside it goes
         on reading the model's own minutes. */
      speed: SPLIT_SPEED,
      arm: lead,
      focus: `split-${lead}`,
      focusAt: columnAt(`${lead}Only`),
      line: `The clock starts. ${Cap(lead)} climbs; the other column stays on its tick.`,
    },
    {
      /* The same window again with both arms drawn, so the second column comes
         alive without the first one having to be taken away. Re-seeking rather
         than running on: this is the same nine minutes, and it is only a
         comparison if it is the same nine minutes. */
      ms: SPLIT_MS,
      ...SPLIT,
      seek: 0,
      speed: SPLIT_SPEED,
      arm: "both",
      focus: `split-${other}`,
      focusAt: columnAt(`${other}Only`),
      line: "Same minutes again, both workouts on. Now the other column climbs too.",
    },
    {
      /* Down to the trunk, opening where the two beats above closed, and running
         on through the middle of the bout — 20 model minutes over which every
         mark in this band is still moving under both arms. */
      ms: 4000,
      ...TRUNK,
      seek: Math.min(TRUNK_FROM, runSeconds),
      speed: 5,
      arm: "both",
      /* AND IT ASKS, BECAUSE THE NEXT BEAT IS A SURPRISE AND WAS BEING GIVEN
         AWAY AS AN ANNOUNCEMENT. Beats 1-6 build one expectation and build it
         well: two bouts, different doors (9 and 6, 4 shared), different columns,
         then one trunk. Anybody following that arrives at the outputs expecting
         two endings — and the next beat says there is one. That is the whole
         point of this scale and a viewer was being TOLD it.
         Two words turn the last beat from a statement into an answer, and the
         pace gate set the budget: "So the outputs differ?" made twelve words
         needing 3.64 s of a beat that offers 3.59, so it is two. The scale
         renders 99 of its 200 words here, so the room was never the constraint
         — the reading clock was. The question is not rhetorical decoration: it
         is the only place in 74 controls and 30 beats where a viewer is invited
         to be wrong before being shown. */
      focus: "trunk",
      focusAt: columnAt("shared"),
      /* THE MIDDLE IS WHERE THE TWO WORKOUTS ACT TOGETHER, so this beat and its
         answer below are the pass's second half rather than a fifth part. The
         two were ALREADY one demonstration — `part: "trunk"` on the answer put
         them there — and this moves the pair whole; the question and the
         answer stay adjacent, which is the only thing that mattered about them.
         WHAT IT COSTS: the trunk anchor loses its ring, so the scale offers
         three parts and a finale rather than four parts. The trunk is not a
         part of this picture that acts on its own — it is what the two paths
         become — and it is the one anchor whose `at` and `label` the finale's
         own control can stand on without inventing either. */
      part: TOGETHER,
      line: "Different doors, the same middle. Do they end the same?",
    },
    {
      /* HELD, AND PARKED ON THE RUN'S LAST SAMPLE. Held for the reason the fibre
         pass had to learn twice: a beat that narrates a conclusion and keeps
         playing has moved off its own point by the time the sentence has been
         read. And `speed: 0` is what keeps it there — `SignallingScale.jsx` gates
         the clock's step on the speed, so the seam hold at `tEnd` is not spent
         either, and the pass does not end by cutting the network back to its
         baseline under a line about where it arrived.
         WHAT THE LINE MAY SAY, WHICH IS LESS THAN THE POINT IT MAKES. At this
         instant the twelve pairs are 0.0383 apart at the widest, which is under
         the 0.05 the panel calls "different" and far under the 0.173 at which two
         marks stop overlapping — so "one mark" is a statement about the picture,
         checkable against the same values the marks are drawn from. What it does
         NOT say is that the two bouts did the same thing: one of those twelve
         moved under resistance and barely moved under endurance, and 45 minutes
         is one session, not training (§2.3, and the panel carries that qualifier
         beside this). */
      /* THE WIDE FRAMING, AND THE REASON IS THE WORD "ONE". A design review
         measured this beat cold: it says the two bouts arrive as one mark and
         shows twelve marks each split warm-over-cool at their midpoint — and the
         only thing that could teach a viewer to read a two-colour lump AS one
         mark, namely a pair that is visibly two, was outside the frame. Nineteen
         of the twenty-five pairs that do separate by the end of this run sit
         above the outputs band; at `OUTPUTS` (back 2.2) six were in shot and all
         six at the top edge, and both arm-colour legend callouts were off screen
         entirely at ndc.y +1.12.
         `SIGNALLING_CAMERA` is the framing this scene's anchor contract was
         written against and the only one where all five anchors satisfy it. It
         is also beat 0's, so the pass closes on the frame it opened on: then,
         everything was one; now, twenty-five pairs have come apart and the
         bottom twelve have not. The marks halve in size, and a small mark with a
         reference beats a large one without. */
      /* T13: twenty-four words; the gate asked 7.58 s of readable time. */
      ms: 8200,
      ...WIDE,
      seek: runSeconds,
      speed: 0,
      arm: "both",
      /* THE ANSWER BELONGS TO THE QUESTION'S DEMONSTRATION — canon D2ⓐ,
         2026-08-31. This line opens on "Almost.", which is an answer word: it
         replies to the trunk beat's "Do they end the same?" and the comment
         there says that question is the one place in this app where a viewer is
         invited to be wrong before being shown. Cut on `focus`, the two landed
         in different piles — pressing the trunk ended on a question nothing
         answered, and pressing the outputs opened on an answer to a question
         nobody had been asked. That is the fibre's store defect read backwards,
         and `part` is the field it was added for.
         SO THE OUTPUTS BAND GETS NO RING, and that is the cost. `focus` still
         points the picture and the plate at the outputs while this plays, which
         is where the answer IS; what a visitor presses is the trunk, which is
         where the camera starts and where the question is asked. A ring on the
         outputs would have had to open on "Almost." */
      /* `TOGETHER` SINCE 2026-08-31, AND IT MOVED WITH ITS QUESTION. It said
         `part: "trunk"` — the pairing above is unchanged and was already right;
         what changed is which pile the pair is in. */
      part: TOGETHER,
      /* AND IT SAYS WHERE THE SPLIT DID LAND, because a viewer who answered
         the beat above with "different" was not simply wrong. Seventeen of the
         fifty-eight shared nodes ARE apart at this instant and nineteen of the
         twenty-five separated pairs sit above the outputs band — which is why
         the framing three paragraphs down is as wide as it is. The picture was
         already showing the other half of the answer and the line was not
         naming it, so the surprise read as a correction instead of a location.
         NO NUMBER, and that is `SignallingScale.jsx`'s rule rather than
         thrift: the trunk plate two hundred pixels away says `17 of 58 telling
         the arms apart` at this same instant, and one quantity printed in two
         roots can differ by a tick. The line points; the plate counts. */
      /* THE THIRD SENTENCE IS THE PAPER'S AXIS, added 2026-08-30 (Q29 R3). The
         two above are true of what is drawn — absolute activity, where the
         widest of the twelve is 0.0383 and a mark is wider than that. Fowler's
         Figure 2 does not plot activity. It plots "fractional changes from
         baseline", and their abstract's result lives there: "endurance exercise
         preferentially activates inflammation". Read that way against the
         control arm, our own twelve reproduce it — protein degradation -8.7 %
         under resistance against -0.6 % under endurance, inflammation +5.8
         against +10.0. So a viewer who left this beat with "the two bouts end
         the same" left with the opposite of the paper's headline, on a screen
         holding the data that shows it.
         NO NUMBER, per the rule above: the line points and the record counts.
         The outputs plate's `why` carries the widest, read off the arms rather
         than typed, because four more words on the plate itself put this scale
         at 204 of its 200. Beat 5000 -> 6900 ms. My arithmetic said 6100, then 6700; the gate said 6.36 s of readable time and it is the one that counts. */
      focus: "outputs",
      focusAt: columnAt("outputs"),
      line:
        "Almost. Down here, one mark. Higher up, many dots still show two — " +
        "the split stayed near the doors. Against the ticks, everything moved.",
    },
  ];
}
