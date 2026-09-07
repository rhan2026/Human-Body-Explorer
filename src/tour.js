/**
 * The guided pass: the camera moves, something fires, and a number changes
 * while you watch it.
 *
 * WHY THIS EXISTS, in the owner's words, after a night spent building the wrong
 * thing: *"숫자가 그림 위로 가는게 아니라 막 줌인 되고 줌아웃되고 막 this is blah
 * blah this fires when blah blah — and the number drops or it fills up. like
 * literally numbers do matter bcz of paper but not so much"*.
 *
 * What shipped before this was a LAYOUT: every quantity moved out of the panel
 * and onto a plate anchored to the thing it counted. That fixed where the
 * numbers were and changed nothing about what a viewer does — the screen was
 * still still, and reading it was still the job. A plate is a caption with
 * better placement.
 *
 * The ask is a SEQUENCE. The camera goes to the thing, the thing fires, the
 * quantity moves while the eye is on it, and one short line says what just
 * happened. The number is the evidence that the story is real — that is what
 * "numbers do matter bcz of paper" means — and it is not the subject. Nobody
 * remembers 941 µM. They remember that it went down and did not come all the
 * way back.
 *
 * THE BEATS ARE DATA AND THIS FILE HAS NONE. A scale hands in its own
 * storyboard, because where the camera should be is a fact about that scene's
 * geometry and when something fires is a fact about that run's protocol.
 * Everything here is the machinery for playing one.
 *
 * INTERRUPTION IS THE FIRST FEATURE, NOT THE LAST. `cinematic.js` already
 * settled this argument for the descent shot: the four events in `INTERRUPTS`
 * end it immediately, and pointermove is deliberately not among them because a
 * resting mouse jitters. A guided pass a viewer cannot get out of is worse than
 * no guided pass, and one that ends on the wrong event never gets to finish.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { holdTour } from "./tourControl.js";


/**
 * Which beat is on screen after `elapsed` ms, and how far into it.
 *
 * Pure, and separated from the hook for the reason `gizmoLayout.js` gives about
 * itself: a solver inside a component is a solver nobody can put a number to.
 * Returns `null` past the end, which is how the caller knows to hand back.
 *
 * @param beats [{ ms, camera, lookAt, seek, speed, line }]
 */
export function beatAt(beats, elapsed) {
  if (!Array.isArray(beats) || beats.length === 0 || !(elapsed >= 0)) return null;
  let start = 0;
  for (let i = 0; i < beats.length; i += 1) {
    const span = Math.max(0, beats[i].ms ?? 0);
    if (elapsed < start + span) return { index: i, beat: beats[i], into: elapsed - start, start };
    start += span;
  }
  return null;
}

/**
 * HOW LONG A BEAT'S LINE HAS TO BE ON SCREEN BEFORE THE NEXT ONE REPLACES IT.
 *
 * Every rule in this file so far is about whether a beat says the truth. This
 * one is about whether anyone gets to finish reading it, which no gate in the
 * project could ask until now.
 *
 * WORDS_PER_SECOND is 3.3 — 200 words a minute — and it is chosen to be
 * GENEROUS TO THE STORYBOARD rather than accurate about readers. Silent reading
 * of ordinary prose is 200 to 250 wpm; captions over moving pictures are
 * budgeted at 160 to 180 by every broadcast guideline there is, because the eye
 * is also doing something else, and these sentences carry numbers and words
 * like "cisterna". At 3.3 a beat fails this only when it is clearly short, so a
 * failure is not a matter of taste.
 *
 * FADE_MS is subtracted because the line does not arrive when the beat does:
 * `.fiber__spent--tour` animates in over 260 ms and all three scales use it
 * (`fiber.css`, and `CellScale.jsx` / `SignallingScale.jsx` both render that
 * class). The test reads the number out of the stylesheet rather than trusting
 * this comment.
 */
export const WORDS_PER_SECOND = 3.3;

/**
 * HOW MUCH LESS THAN ITS OWN `ms` A BEAT ACTUALLY GETS.
 *
 * A storyboard's `ms` is a promise the frame loop keeps to about a frame and a
 * half. The player checks the elapsed time once per animation frame and the DOM
 * writes the new line on the render after that, so the sentence a viewer sees
 * is on screen for `ms` plus or minus a small amount that is not always
 * positive.
 *
 * Measured 2026-08-27 with a MutationObserver installed by `addInitScript`,
 * before the app's own scripts run, across all twenty-three beats of the three
 * passes: the spread is +83 to -83 ms around the declared value, centred near
 * zero. So the pace rule has to budget for the bad end, or a beat sized to pass
 * in the file misses on the glass — which is exactly the failure CLAUDE.md §4
 * names, "게이트 초록 ≠ 보인다".
 *
 * 150 IS THE SECOND ANSWER AND THE FIRST ONE IS THE LESSON. The rule shipped
 * with no budget at all, and two fibre beats sized to clear it by 16 and 13 ms
 * came back at 2659 and 2969 against requirements of 2684 and 2987 — green in
 * `tourPace.test.js`, short on the glass. Budgeting the worst slip that run had
 * shown, 83, rounded to 100, left one beat failing by 13 ms on the NEXT run,
 * where the worst slip was -120. A jitter tail does not stop growing because
 * you have sampled it twice.
 * So 150 is the worst seen with room, and every beat is sized to clear the rule
 * by another 150 on top rather than to sit on it. Chasing a distribution one
 * boundary at a time is how a pacing pass turns into a series of them.
 */
export const FRAME_SLIP_MS = 150;

/** The reading time a line needs, in ms. A beat with no line needs none. */
export function readingMs(line) {
  const words = String(line ?? "").trim().split(/\s+/).filter(Boolean).length;
  return (words / WORDS_PER_SECOND) * 1000;
}

/** How long the whole pass runs, so the chrome knows how long to stay down. */
export function tourLength(beats) {
  return (beats ?? []).reduce((sum, b) => sum + Math.max(0, b.ms ?? 0), 0);
}

/**
 * Every distinct camera setup in a storyboard, in order of first appearance.
 *
 * Used by the tests rather than the app: a storyboard whose camera never moves
 * is a slideshow with a soundtrack, and that is the failure this whole file is
 * a correction of. Cheap to compute, and it makes "the camera moves" something
 * a test can ask rather than something a comment claims.
 */
export function cameraStops(beats) {
  const seen = [];
  for (const b of beats ?? []) {
    const key = (b.camera ?? []).join(",");
    if (key && !seen.includes(key)) seen.push(key);
  }
  return seen;
}

/**
 * Whether a guided camera move is welcome here.
 *
 * A pass that drives the camera, changes speed and swaps what is drawn is the
 * literal subject of `prefers-reduced-motion`, and this project already honours
 * it for the crossing wash and the cinematic. Read once rather than watched: a
 * viewer who turns it on mid-pass is asking for the next screen to be calm, not
 * for this one to stop halfway through a sentence.
 *
 * THIS GUARD WAS REMOVED ON 2026-08-27 AND PUT BACK THE SAME DAY, and the round
 * trip is worth more than the guard.
 *
 * The argument for removing it was measured and, as far as it went, true: with
 * the preference on, the fibre scale showed no sentence at any point while the
 * run PLAYED NORMALLY — calcium cycling, filaments sliding, store emptying. All
 * of the movement was still there and only the narration had been withheld, from
 * the viewer least able to reconstruct it from the picture. Every stylesheet in
 * the project answers the preference with `animation: none` — keep the thing,
 * drop the movement — and `useCameraTransition` already turns its ease into a
 * cut, so the pass would have run without a single slide.
 *
 * What that reasoning did not have is the number.
 * `photosensitivity.spec.js` measures this scene's luminance envelope UNDER THIS
 * PREFERENCE, and says why in its own words: "it is the setting a photosensitive
 * viewer actually has, `tour.js` honours it for that reason, and under it this
 * scene is exactly the scene this bound was calibrated against." With the guard
 * gone the envelope went from under 8 levels to **41.4**, because a cut between
 * two framings is not a small thing to a viewer who asked for stillness — it is
 * the largest luminance step this scene can make. The same file records 52.29
 * for the moving case.
 *
 * So: the narration gap is real and it is the price. A pass IS a camera film,
 * the sentences are written for the framings they arrive on ("The command
 * arrives down here" means nothing at the level framing), and the standing note
 * is what this project gives a viewer who cannot have the film. Giving them the
 * sentences would mean giving them the framings, and the framings are the thing
 * the preference is about.
 */
/**
 * The event a pass sends when it finishes — ended on its own, or ended by the
 * viewer.
 *
 * NOBODY LISTENS TO IT AS OF 2026-08-30. It was exported so `director/ride.js`
 * could wait on the same string this file dispatches and neither could drift
 * alone; the film was deleted that day at the owner's word ("자동 투어 없에")
 * and took the only listener with it. The dispatch is kept — it costs one line
 * and it is the seam anything that has to wait for a pass would use — but a
 * reader should not go looking for the other end of it.
 *
 * Why the ride needed it, since the reason is the argument for keeping the
 * event rather than the film: the shot list was 9/9/14 fixed seconds per deep
 * scale, set before the passes grew to ~30 s each — so the default film played
 * 2 of the fibre's 8 beats and cut away before "The command never weakens",
 * which is the sentence the whole project exists to hand a visitor (Q20 R1,
 * measured). A fixed time cannot know when a pass is done; this event can.
 */
/**
 * A storyboard, cut into the parts it is about.
 *
 * WHY THIS EXISTS — canon D2ⓐ. A pass USED TO play AT a viewer: it opened on
 * arrival, narrated for forty seconds, and any press stopped it, so the more
 * somebody explored the less the screen taught. That is the model this file
 * replaced, not the one it describes. The owner asked for the other order —
 * *"조작기가 먼저 → 방문자가 뭔가를 하고 → 결과가 그림에서 보이고 → 글은 그
 * 뒤에 짧게"* — and the storyboards already have the shape that needs: every
 * beat carries `focus`, the id of the part its sentence is about. Beats about
 * one part are that part's DEMONSTRATION, and a press is what starts it.
 *
 * ORDER IS THE STORYBOARD'S, not the anchors'. A part takes the position of
 * its first beat, so the rings across the picture read left to right in the
 * order the pass would have walked them, and the physiology's own sequence
 * survives being taken out of a queue.
 *
 * BEATS WITH NO FOCUS ARE THE OPENER and they are returned separately rather
 * than dropped. On the fibre that is one wide beat naming the picture, which
 * under a press model has no part to belong to and is what the scale says
 * about itself before anyone touches it (canon G1).
 *
 * `part` EXISTS BECAUSE `focus` WAS DOING TWO JOBS. It says which part a beat
 * belongs to; `focus` says which part the picture should single out, and those
 * are the same thing in every beat but one. The fibre's closing beat is the
 * store's conclusion — the store's camera, the store's second ceiling — and it
 * carries no focus on purpose, because its sentence RULES THE STORE OUT and a
 * ring still burning on the store made "waste around the strands" read as waste
 * inside it (`fiberTour.js` records that screenshot). Grouping on `focus` alone
 * filed that beat as an opener, so pressing the store ended on "Remember this
 * colour" — a setup whose payoff had been sorted into a different pile. Measured
 * in a browser, 2026-08-31, before this line existed.
 *
 * AND THE SIGNALLING SCALE NEEDED IT THE OTHER WAY ROUND, WHICH IS WHY THIS
 * READS `"part" in beat` RATHER THAN `beat.part ?? beat.focus`. That scale has
 * no focus-less beat at all: its opening beat is the wide one naming the
 * picture, and it carries `focus: "doors"` because a beacon has to land on
 * something while it plays. Grouped on `focus`, the scale had NO opener — so
 * the one sentence saying what the whole picture is (canon G1) was filed as the
 * first half of the doors' demonstration and shown only to whoever pressed the
 * doors. On the scale canon S1 says nobody can read, that is the sentence to
 * lose last.
 * `??` cannot express the override: it reads a declared `part: null` as "not
 * stated" and falls back to the focus, which is the whole thing being
 * overridden. So a beat that DECLARES no part has none, whatever it points at.
 *
 * AND THE THIRD PILE IS THE SECOND HALF OF THE TOUR. The owner specified the
 * deep scales' cycle twice and made it exact on 2026-08-31: *"Main → Tour
 * (각자 설명, 같이 이뤄져서 뭐가 일어나는지 설명) → Main(여기서 켜짐)"*. A part
 * explaining itself is one half; what happens when the parts act TOGETHER is
 * the other, and it was never reachable as itself — `part` had two piles and a
 * beat about the whole run fits neither. It is not the opener, which is what
 * the scale says before anybody has pressed anything, and it is not any one
 * part's demonstration.
 *
 * So each such beat filed itself under whichever part its camera happened to be
 * on, and the fibre is where that shows: "Watch the whole run: every burst just
 * as bright. The command never weakens, but the pull fades." is the ANSWER to
 * the question tropomyosin's beat ends on — "Burst after burst, is that pull
 * weaker?" — and it sat inside the t-tubule's demonstration because the camera
 * was back at the tubule. Pressing tropomyosin asked and never told; pressing
 * the tubule told without asking. The store's last two beats went the same way:
 * "Remember this colour" and "At the end, never that colour again" are the
 * story's conclusion filed as the store's description.
 *
 * WHAT THIS IS NOT: A SIXTH RING. The first version of this cut gave the
 * whole-run half its own `Handle`, dark until every part had been seen, on the
 * reading that a visitor presses their way to the ending — and it needed two
 * things nothing in the app could supply: a place for a control about no place,
 * and a name for it, which would have been the one string in the pass that no
 * anchor and no beat already wrote. The owner spelled the structure out on
 * 2026-08-31 and it is the other way round — the tour is AUTOMATIC and runs
 * before anybody presses anything:
 *
 *   1  arrive        no text at all, the run playing
 *   2  tour          each part explained, in the storyboard's order
 *   3  tour          "전체적으로 어떻게 working 하는지" — the whole run
 *   4  main          no text again, the way down, and every part pressable
 *
 * So this group is not something to reach; it is where state 2 ends and state 3
 * begins. THE ONE PROPERTY THAT MAKES BOTH READINGS COME OUT OF ONE ARRAY is
 * that `finale` is a CONTIGUOUS TAIL of the storyboard on all three scales: the
 * automatic sequence is the beats played straight through and needs no
 * reordering, while a press in state 4 plays one `steps` entry. Held by
 * `tourGrammar.test.js`, because it is the thing a new beat in the wrong place
 * would quietly break.
 *
 * A STRING AND NOT A SYMBOL: it shares a field with every other `part` value
 * and those are anchor ids, so a Symbol would be the one value in the field
 * that cannot be printed, compared in a test message, or put in a `data-`
 * attribute. It is a reserved id instead — no anchor may be called `together`.
 */
export const TOGETHER = "together";

export function stepsOf(beats = []) {
  const opener = [];
  const finale = [];
  const order = [];
  const byId = new Map();
  for (const beat of beats) {
    const part = "part" in beat ? beat.part : beat.focus;
    if (part === TOGETHER) {
      finale.push(beat);
      continue;
    }
    if (!part) {
      opener.push(beat);
      continue;
    }
    if (!byId.has(part)) {
      byId.set(part, []);
      order.push(part);
    }
    byId.get(part).push(beat);
  }
  return { opener, steps: order.map((id) => ({ id, beats: byId.get(id) })), finale };
}

/**
 * Whether the scale's own opening sentence is still standing.
 *
 * IT IS NOT THE CASCADE'S LENGTH, AND THAT WAS THE BUG. Canon D5's arrival is
 * the plate cascade, and the first version stood the opener for exactly as long
 * as that ran. Measured 2026-08-31 against this file's own reading rule: the
 * fibre's opener is 14 words and needs 4242 ms, the cell's 11 words and 3333 ms,
 * the signalling's 27 words and 8182 ms — against a cascade of 1720 to 1980 ms.
 * The one sentence that says what the whole picture IS (canon G1) was getting
 * under a quarter of its own reading time, on the scale where it matters most.
 *
 * Caught by the signalling lane, in the structure I had handed it as finished.
 *
 * SO IT USES THE RULE EVERY OTHER LINE USES. `readingMs` at 3.3 words a second,
 * plus the 260 ms the sentence spends fading in and the 150 ms of frame slip
 * `FRAME_SLIP_MS` records — the same three terms `tourPace.test.js` subtracts
 * when it checks a beat. Whichever is longer, this or the cascade, is how long
 * the scale speaks for; the caller ORs the two rather than this file knowing
 * about plates.
 *
 * Then the foot goes back to the run's own phase note, which is live status and
 * must stay reachable. A press takes it from there and keeps it.
 */
export function useOpenerStanding(line) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    if (!line) {
      setUp(false);
      return undefined;
    }
    setUp(true);
    /* 260 is the fade `fiber.css` gives `.fiber__spent--tour`; the pace test
       reads it out of the stylesheet rather than trusting a number in a comment,
       and if the two ever disagree that test is the one that is right. */
    const done = setTimeout(() => setUp(false), readingMs(line) + 260 + FRAME_SLIP_MS);
    return () => clearTimeout(done);
  }, [line]);
  return up;
}

/**
 * HOW LONG A SCALE HAS THE PICTURE TO ITSELF BEFORE ITS TOUR SPEAKS.
 *
 * The owner's state 1 — *"화면으로 들어가면 아무런 텍스트 없이 (Full Animation the
 * default)만 보여"*. Short on purpose: it is not a pause for effect, it is the
 * moment a visitor needs to see that the thing MOVES before anything is said
 * about it, so the opening beat arrives into a picture rather than onto a blank.
 * Longer reads as a scene that failed to load — this project has a screenshot of
 * exactly that misreading on the cell scale, which is why its stage now says
 * what it is doing while it waits.
 *
 * One constant for three scales, because it is one decision.
 */
export const SILENT_MS = 1600;

/**
 * THE SENTENCE WITHOUT ITS MARKUP — 2026-09-07. Storyboard lines carry
 * `**term**` (bold, a marker) and `**TITLE** — sentence` (a title line) for the
 * guide's bubble; the three floors also print the same line into a live region
 * for a screen reader, and "asterisk asterisk one rep asterisk asterisk" is not
 * the sentence. This is what reaches anything that is not the guide.
 */
export function plainLine(line) {
  return line == null ? line : String(line).replace(/\*\*/g, "");
}

export const PASS_ENDED = "hpe:pass-ended";

export function motionWelcome() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTour(beats, { onSeek, onSpeed, onLine, onFocus, enabled = true, nonce = 0, paused = false, skippable = true } = {}) {
  const welcome = useRef(null);
  if (welcome.current === null) welcome.current = motionWelcome();
  const allowed = enabled && welcome.current;
  const [now, setNow] = useState(0);
  const [stopped, setStopped] = useState(false);
  const started = useRef(null);
  const lastBeat = useRef(-1);
  const held = useRef(null);
  const [, setHeldNonce] = useState(0);
  const cbs = useRef({ onSeek, onSpeed, onLine, onFocus });
  cbs.current = { onSeek, onSpeed, onLine, onFocus };

  /* `again` — AND IT HAS TO CLEAR FOUR THINGS, NOT ONE. Q12 R3, 2026-08-27:
     the strip grew a control that re-armed `enabled`, and the pass did not come
     back. `enabled` was never what stopped it. A press is one of `INTERRUPTS`
     and sets `stopped`, which gates both effects below; and `started` keeps the
     wall-clock the first run began at, so even with `stopped` cleared the tick
     would resume mid-storyboard and `lastBeat` would suppress the entry effect
     of the beat it landed on.
     A COUNT AND NOT A FLAG: a viewer who watches it twice is one viewer, and
     re-arming on an unchanged flag re-arms nothing. Zero on mount, so arriving
     is untouched. (`home` on the camera was the other count of this shape; it
     went on 2026-08-31 with the `enabled` term it fed — the deep scales return
     to their own framing now, always.) */
  useEffect(() => {
    if (!nonce) return;
    started.current = null;
    lastBeat.current = -1;
    held.current = null;
    setNow(0);
    setStopped(false);
  }, [nonce]);

  /* TOUCHING THE SCENE NO LONGER ENDS THE PASS — 2026-09-06. Owner: *"지금
     클릭하면 그냥 화면을 돌리고 뭐 줌 할 수 있는데 투어는 안멈춰"*, of how it
     should be, and *"지금은 클릭하면 투어가 멈춰"* of how it was.
     WHAT STOOD HERE listened for `INTERRUPTS` — pointerdown, keydown, wheel,
     touchstart — in the capture phase and set `stopped`, which is one-way. So
     turning the model to see the other side of it and ending the explanation
     were THE SAME GESTURE, and a visitor could not do the first without doing
     the second, or know afterwards which one they had done.
     EXEMPTING BUTTONS WAS TREATING THE SYMPTOM. Earlier today Pause had to be
     excused from this list because pressing it killed the pass it was pressed to
     hold; the next control would have needed the same excuse. The rule itself
     was the defect: "touching is ending".
     SO ENDING IS ITS OWN CONTROL. `skip` below is the only thing that sets
     `stopped`, and `Ways` draws it beside Pause while a pass runs — announced
     through `tourControl.js`, because the transport is mounted by the page and
     the pass runs inside the canvas.
     THE PASS STILL YIELDS, and that has not changed: `held` holds a beat when a
     visitor presses a part, and Pause freezes the whole storyboard. What is gone
     is the silent, unrecoverable end. */
  const skip = useCallback(() => setStopped(true), []);
  /* STEP TO THE NEXT BEAT BY HAND — 2026-09-07. Owner: *"make a small arrow
     button that manually moves the user to bell's next text bubble"*. A beat
     ends when its `ms` runs out, and the clock is `Date.now() - started`, so
     moving on is subtracting whatever is left of this beat from the start —
     the same shift `paused` already does in the other direction. Nothing else
     has to know: the tick below re-reads `beatAt` and the entry effects fire
     for the beat it lands on, exactly as they would have on their own. */
  /* THE PASS WAITS AT EVERY BEAT — owner, 2026-09-07: *"the dialogue should not
     proceed unless the button is clicked thats the whole point"*. `gate` is how
     far the clock may run: the end of the beat being held. The tick below caps
     `now` at it, so a beat plays and then STOPS, camera and all, until the
     arrow moves the gate on.
     THE CLOCK IS SHIFTED, NOT RESET, exactly as `paused` does it — while the
     gate holds, wall time keeps passing and `started` absorbs the difference, so
     stepping on continues from where the pass stopped rather than jumping by
     however long the visitor read for. */
  /* BY INDEX, NOT BY A TIME. The first cut held a millisecond and asked
     `beatAt` which beat that was — but the end of beat n IS the start of beat
     n+1, so it answered the next one and the step landed a beat further on than
     the visitor asked for. The beat being held is a number; the clock is
     derived from it. */
  const gateIndex = useRef(0);
  const endOf = useCallback(
    (i) => beats.slice(0, i + 1).reduce((sum, b) => sum + Math.max(0, b.ms ?? 0), 0),
    [beats],
  );
  const next = useCallback(() => {
    if (started.current === null) return;
    /* TO THE NEXT BUBBLE, NOT THE NEXT BEAT — owner: *"moves the user to bell's
       next text bubble"*. SIGNALS leaves beats wordless so the camera has room,
       and with the pass waiting at every one of them a press on a silent beat
       looked like a press that did nothing: measured, the first press moved the
       pass on and the sentence stayed (correctly — a silent beat holds the last
       line). So a step runs on until it reaches a beat that actually says
       something, or off the end, which is the pass finishing by its own path. */
    let i = gateIndex.current + 1;
    while (i < beats.length && !beats[i]?.line) i += 1;
    const to = endOf(i - 1);
    gateIndex.current = i;
    started.current = Date.now() - to;
    setNow(to);
  }, [beats, endOf]);
  useEffect(() => {
    /* `skippable: false` — a part's demonstration runs on this engine too and must
       not put Skip in the corner (owner, SIGNALS 22). */
    if (!allowed || stopped || !beats.length || !skippable) return undefined;
    return holdTour({ id: `${nonce}:${beats.length}`, skip, next });
  }, [allowed, stopped, beats.length, nonce, skip, next]);

  /* PAUSE FREEZES THE STORYBOARD AND RESUME CONTINUES IT — 2026-09-06. Owner:
     *"pause하면 tour도 멈추고 resume하면 그 자리에서 tour start"*.
     Until now the only way to stop a pass was `stopped`, which is an INTERRUPT
     and is one-way: the transport's Pause button is a `pointerdown`, so pressing
     it did not pause the pass, it killed it, and there was no way back to the
     beat you were on. The two states are genuinely different — an interrupt
     means "I want to touch this instead", a pause means "hold, I am coming
     back" — so this is a second gate rather than a second way to set the first.
     THE CLOCK IS SHIFTED, NOT STOPPED. `now` is wall-clock minus `started`, so
     holding the tick would make the pass jump forward by the whole pause when it
     resumed. Pushing `started` forward by the paused duration is what makes
     "resume at that beat" true rather than approximately true. */
  const pausedAt = useRef(null);
  useEffect(() => {
    if (paused) {
      if (pausedAt.current === null) pausedAt.current = Date.now();
      return;
    }
    if (pausedAt.current !== null) {
      if (started.current !== null) started.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
    }
  }, [paused]);

  useEffect(() => {
    if (!allowed || stopped || paused) return undefined;
    started.current = started.current ?? Date.now();
    const id = setInterval(() => {
      /* CAPPED INSIDE THE HELD BEAT — see `next`. A millisecond short of its
         end, so `beatAt` keeps answering the beat the visitor is looking at
         rather than the one after it. Wall time keeps running while it waits;
         the clock does not, and `next` hands `started` the difference so
         nothing jumps when the visitor steps on. Past the last beat there is
         nothing left to hold and the pass ends as it always did. */
      const raw = Date.now() - started.current;
      const i = gateIndex.current;
      setNow(i < beats.length ? Math.min(raw, Math.max(0, endOf(i) - 1)) : raw);
    }, 100);
    return () => clearInterval(id);
  }, [allowed, stopped, paused, beats, endOf]);

  const forced = held.current;
  /* A HELD BEAT IS FROZEN AT ITS OWN OPENING, not left running inside itself.
     The first version held the BEAT and let the run play on within it, so a
     still captured from `__tourHold(2)` was the moment the burst had just
     ENDED — measured `stim: 0` on the beat whose entire subject is the burst
     arriving. A design review of a moving thing needs the frame the beat is
     about, and that frame is its seek. */
  const at =
    allowed && !stopped
      ? forced != null && beats?.[forced]
        ? { index: forced, beat: { ...beats[forced], speed: 0 }, into: 0, start: 0 }
        : beatAt(beats, now)
      : null;

  /* Entry effects, once each. `index` is the dependency rather than the beat
     object, because a storyboard rebuilt on every render would otherwise re-seek
     the run every frame and pin it to the beat's own instant. */
  useEffect(() => {
    if (!at || at.index === lastBeat.current) return;
    lastBeat.current = at.index;
    const { beat } = at;
    if (typeof beat.seek === "number") cbs.current.onSeek?.(beat.seek);
    if (typeof beat.speed === "number") cbs.current.onSpeed?.(beat.speed);
    cbs.current.onLine?.(beat.line ?? null);
    /* THE SUBJECT, FOR THE PICTURE TO POINT AT. Design pass 2026-08-30: the
       owner watched the pass and said "i dont even know where the store is" —
       the line names a thing and nothing on screen singles it out. A beat may
       carry `focus`, the id of the anchor its sentence is about; the scene
       hands it to the plates, the named plate lights and the rest step back.
       Null between subjects and when the pass ends. */
    /* The id lights the plate; a coordinate places the beacon. NOT the
       anchor's `at` — that is where the LABEL hangs, offset above the part so
       the plate clears it, and the first version rang empty space beside the
       tubule.
       lookAt was the second answer and it is only usually right: it is a
       CAMERA fact, and on the signalling scale every beat looks at the same
       centre band, so the ring pulsed on blank paper through all eight beats
       while the narration said "this pillar". That scale worked around it
       inside its own scene before this line was fixed.
       So: a beat may state where its subject IS (`focusAt`) when that differs
       from where the camera points, and lookAt stays the default because for
       most beats the two coincide. */
    cbs.current.onFocus?.(
      beat.focus ? { id: beat.focus, at: beat.focusAt ?? beat.lookAt ?? null } : null,
    );
  }, [at?.index]);

  /* And the line goes when the pass does, whether it ended or was ended.
     `lastBeat.current >= 0` IS THE WHOLE FIX AND IT COST A GATE TO FIND.
     `at` is undefined in two completely different situations: after the last
     beat, and BEFORE THE FIRST — every scale builds its beats from a scenario it
     is still fetching, so the first render of a cold page has `beats: []` and no
     current beat. This effect reported "the pass is over" in both, and all three
     scales latch on it: `if (line === null) setTourOn(false)`, which is correct
     for an ending and fatal for a beginning.
     Measured 2026-08-28, Q17 R10: on the fibre, the FIRST page load in a fresh
     browser lost the race 1 time in 8 — beats built, clock running, `again`
     already offered and not one line ever shown. A test opens exactly one cold
     page, so `gate-the-ride`'s "moving between deep scales" hit it and timed out
     at 60 s waiting for a sentence that had been cancelled before it existed.
     The cell and signalling latch the same way and lose the same race less
     often, being smaller scenes.
     `lastBeat` starts at -1 and is written when a beat fires, so this says: only
     report an ending to something that had a beginning. */
  useEffect(() => {
    if (!at && lastBeat.current >= 0) {
      cbs.current.onLine?.(null);
      cbs.current.onFocus?.(null);
      // And say so to anyone steering by it — the ride advances on this. On a
      // viewer interrupt the ride has already stopped synchronously in the
      // event's capture phase, so the dispatch (post-render) finds no ride and
      // advance() returns; ride.js removes its listener in stop() regardless.
      if (typeof window !== "undefined") window.dispatchEvent(new Event(PASS_ENDED));
    }
  }, [!at]);

  /* HOLD A BEAT SO IT CAN BE LOOKED AT, the same debug surface and the same
     reason as `window.__fiberState`: this scene is judged from outside, from a
     still frame, and a beat that is 1.6 s long cannot be photographed by a tool
     whose round trip is longer than that. `__tourHold(i)` parks the pass on beat
     i indefinitely; `__tourHold(null)` lets it run on from there.
     Read-only in the sense that matters — it changes nothing about what the pass
     IS, only when it moves — and it is the only way a design review of a moving
     thing can be about one frame at a time. */
  useEffect(() => {
    window.__tourHold = (i) => {
      /* `useState` bails out when the next value equals the last, so a nudge has
         to actually change something — the first version incremented by zero and
         held nothing. A counter nobody reads is the cheapest thing that does. */
      held.current = typeof i === "number" ? i : null;
      setHeldNonce((n) => n + 1);
    };
    window.__tourBeats = () => (beats ?? []).map((b, i) => ({ i, ms: b.ms, line: b.line ?? null }));
    return () => {
      delete window.__tourHold;
      delete window.__tourBeats;
    };
  }, [beats]);

  return {
    running: !!at,
    index: at?.index ?? -1,
    /* THE EFFECTIVE BEAT, and it has to come from here rather than be looked up
       again. `SignallingScale` read `beats[tour.index]` out of the array, which
       is the beat as WRITTEN — so a held beat's speed override never reached it
       and the run kept playing under a frozen still. Two lookups of one thing is
       two answers the moment either is adjusted. */
    beat: at?.beat ?? null,
    camera: at?.beat.camera ?? null,
    lookAt: at?.beat.lookAt ?? null,
    /* ENDED AND INTERRUPTED ARE NOT THE SAME ENDING, and the camera is where
       the difference shows. A pass that runs out has to give the scene back
       whole — `FiberScene.jsx` says why: "a pass that ends by abandoning the
       camera in a close-up has taken the scene away", and the viewer never
       asked to be left in that close-up.

       An interrupt is the opposite. The viewer pressed something because they
       want to look at what is on screen NOW, and the scene answering by gliding
       away to its default framing takes it from the one person who reached for
       it. Measured 2026-08-27 on the fibre pass: a bare Shift keypress, which
       moves no camera of its own, ended the pass and pulled the camera off the
       cisterna back to the wide framing — 35.1% of the stage changed and the
       tissue went from 23.1% of it to 15.2%. */
    interrupted: stopped,
    /* THE ONLY WAY TO END A PASS. Returned as well as registered, so a floor that
       wants its own control does not have to reach through `tourControl`. */
    skip,
    stop: () => setStopped(true),
  };
}
