import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { INTERRUPTS } from "../cinematic.js";
import { GUIDE_ARRIVED } from "./arrived.js";
import { markWalkDone, walkAlreadyDone, walkFrom } from "./firstWalk.js";

/**
 * Plays a walk: holds one beat, resolves where it stands, moves on.
 *
 * WHY THIS IS NOT `useTour`. The deep scales' `useTour` plays a storyboard
 * against a RUN — its beats seek a clock, hold an instant, and end when the
 * archive does. This walk has no run behind it: its beats end when a VISITOR
 * does something, and the whole point of the first three is that they wait. A
 * pass that advances on a timer would tell somebody to press the menu and then
 * carry on talking to an empty room.
 *
 * So a beat ends on whichever comes first: the thing it was waiting for
 * happening, or its own patience running out. The patience matters as much as
 * the wait — a guide that will not move on until you obey is a modal dialogue
 * wearing a face, and this app already deleted one of those.
 *
 * WHERE IT STANDS is resolved per frame while a beat is up, not once when it
 * starts. The hamburger, a lit muscle and the way down are three different
 * layouts, the body moves, and the window resizes; an anchor read once is a
 * guide standing where a thing used to be.
 */

/** How often the anchor is re-read, in ms. `PickTrack` picked the same rate for
    the same job: a plate that re-aims sixty times a second is fifty aimings
    nobody can see, and the spring in `Guide.jsx` draws every frame regardless. */
const AIM_MS = 50;

/** How long a beat waits for the guide to arrive before its clock starts
    anyway, in ms. `Guide.jsx` travels at most `MAX_SPEED` (560 px/s), so the
    longest crossing a 1280 px stage allows is ~2.3 s plus the settle; this is
    the floor above that, for a guide that is NOT coming — not mounted, hidden,
    or aimed at an anchor that never resolves — so no walk can be held forever
    by a character that is not there. `guideArrives.test.js` holds the two
    numbers against each other. */
const ARRIVE_GRACE_MS = 3500;

/**
 * @param enabled   whether the walk may run at all
 * @param state     `{ exercise, picked, descended }` — what the visitor has done
 * @param resolve   `(anchor) => {x, y} | null` in stage pixels; null skips the beat
 */
export function useWalk(enabled, state, resolve, seenKey = undefined, options = undefined) {
  /* PAUSE RATHER THAN END, WHERE A SCALE ASKS FOR IT.
     Every interrupt used to be terminal: one wheel tick, one stray key, one drag
     to look at the other side of the body, and the walk was over AND filed as
     seen, with nothing on screen offering it back. That is the right default for
     a pass that seeks a clock — restarting one mid-archive is incoherent — but
     it is the wrong one for a walk whose whole invitation is "turn this thing
     around and press it". Treating the visitor touching the scene as a mistake
     to be punished is exactly backwards on a floor about exploring.
     OPT-IN, and off by default, because the three deep scales run their own
     walks through this same hook and changing what an interrupt means to them
     is not this floor's call. */
  const pauseOnInterrupt = !!options?.pauseOnInterrupt;
  const [paused, setPaused] = useState(false);
  /* THE BEATS COME IN AS A LIST OR AS THE BODY'S OWN LADDER. The three deep
     scales build their own from an archive (`cellWalk`, `heroWalk`) and have
     nothing to skip; the body's are filtered by what the visitor has already
     done. */
  const beats = useMemo(
    () => (!enabled ? [] : Array.isArray(state) ? state : walkFrom(state)),
    [enabled, state],
  );
  const [index, setIndex] = useState(0);
  const [at, setAt] = useState(null);
  /* THE LAST SENTENCE WHOSE PLACE WAS FOUND, which is not always the current
     beat's. Measured 2026-09-01: with no muscle picked, the `down` beat's anchor
     does not exist, so it spoke for 544 ms — at the PREVIOUS beat's coordinates,
     because `at` still held them — and vanished. Half a second of a sentence
     standing in the wrong place is worse than the beat never playing.
     So the words wait for the walk. A beat says nothing until its anchor
     resolves; until then the guide carries the line it already had, which is
     also what a person does when they walk across a room mid-explanation. A
     beat that never resolves is skipped having never spoken. */
  const [spoken, setSpoken] = useState(null);
  const held = useRef(null);
  const beat = beats[index] ?? null;

  /* THE PATIENCE STARTS WHEN THE EXPLAINING DOES. Owner, 2026-09-06: *"when it
     has to move to a designated spot to explain, it should hop onto the spot
     and the explaining should start when the character has arrived at the
     spot"*. A beat's `ms` is how long its sentence STANDS, and it used to start
     the frame the beat did, with the character still crossing the stage —
     watched on SIGNALS, the first sentence stood for 1.1 s of its beat. The
     guide says when it has arrived (`arrived.js`), and the clock below starts
     on that. `ARRIVE_GRACE_MS` is the floor under the wait, for a guide that is
     not coming. Reset per beat: each spot is its own arrival. */
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    setArrived(false);
    if (!beat) return undefined;
    const here = () => setArrived(true);
    window.addEventListener(GUIDE_ARRIVED, here);
    const floor = setTimeout(here, ARRIVE_GRACE_MS);
    return () => {
      window.removeEventListener(GUIDE_ARRIVED, here);
      clearTimeout(floor);
    };
  }, [beat]);

  /* THE VISITOR CAN END A BEAT, AND THAT IS THE COMMON CASE. `state` changing to
     satisfy `until` is what usually moves this on; the timer below is the floor
     under it, not the driver. Recomputed rather than watched, because
     `walkFrom` already knows how to skip what is done. The timer waits for the
     arrival above; the visitor's own move does not — pressing the thing a beat
     asked for ends it wherever the character is. */
  useEffect(() => {
    if (!beat || paused) return undefined;
    if (beat.until && !Array.isArray(state) && state?.[beat.until]) {
      setIndex((i) => i + 1);
      return undefined;
    }
    if (!arrived) return undefined;
    const id = setTimeout(() => setIndex((i) => i + 1), beat.ms ?? 4000);
    return () => clearTimeout(id);
  }, [beat, state, paused, arrived]);

  /* AN ANCHOR THAT CANNOT BE FOUND SKIPS ITS BEAT. `firstWalk.js` carries why: a
     guide standing at the origin talking about something off screen is worse
     than one that did not mention it. Tried for a few frames before giving up,
     because a control can be one render behind a scene that just mounted. */
  useEffect(() => {
    if (!beat) {
      setAt(null);
      setSpoken(null);
      return undefined;
    }
    let misses = 0;
    const aim = () => {
      const point = resolve(beat.anchor);
      if (point) {
        misses = 0;
        setAt((prev) =>
          prev && Math.abs(prev.x - point.x) < 0.5 && Math.abs(prev.y - point.y) < 0.5 ? prev : point,
        );
        setSpoken((prev) => (prev?.id === beat.id ? prev : { id: beat.id, line: beat.line }));
        return;
      }
      misses += 1;
      if (misses > 12) setIndex((i) => i + 1);
    };
    aim();
    const id = setInterval(aim, AIM_MS);
    return () => clearInterval(id);
  }, [beat, resolve]);

  /* THE VISITOR'S WAY OUT, AND IT WAS MISSING.
     `stop` has been on this hook's return since it was written and NOTHING EVER
     CALLED IT — measured 2026-09-02 by grepping every scene. The cell's walk is
     thirteen beats and seventy-eight seconds long since the owner's rewrite, and
     for all of it a visitor who wanted to look at something else had no way to
     end it. Every other narration in this app already ends on the first
     pointer, key, wheel or touch; `tour.js` arms exactly these four in exactly
     this phase and says why — *"a press on a control ends the pass on its way
     down rather than after the control has already acted"*.
     ARMED HERE RATHER THAN LEFT TO EACH SCENE, because four scenes remembering
     to wire the same four listeners is four chances to forget, and the one that
     forgot is how this got shipped. */
  useEffect(() => {
    if (!enabled || !beat) return undefined;
    const out = (event) => {
      /* NOT REACHING FOR THE SCENE: the transport (`.ways`, the rule `tour.js`
         set), the question box, and the character itself. `INTERRUPTS` has
         keydown and pointerdown in it, so without this the first letter typed
         to Bell — or picking Bell up to move it — ended the narration it was
         about (2026-09-07). */
      if (event.target?.closest?.(".ways, .ask, .guide__body, .guide__next")) return;
      if (!pauseOnInterrupt) return stopRef.current();
      /* FILED AS SEEN EVEN THOUGH IT IS ONLY PAUSED. Without this a visitor who
         touched the scene, went down into a muscle and came back got the walk
         again from beat zero — the pause kept the index, but the scene remounts
         on the way back and a fresh index with no record reads as a fresh walk.
         Being offered the tour a second time is the failure the seen-key exists
         to prevent; the Resume control is what keeps the paused one reachable. */
      markWalkDone(seenKey);
      setPaused(true);
    };
    for (const type of INTERRUPTS) window.addEventListener(type, out, true);
    return () => {
      for (const type of INTERRUPTS) window.removeEventListener(type, out, true);
    };
  }, [enabled, beat, pauseOnInterrupt, seenKey]);

  /* A NEW KEY IS A NEW WALK, AND THE COUNTER HAS TO KNOW.
     `stop()` parks `index` at `MAX_SAFE_INTEGER` — that is how an interrupt ends
     a walk. When the body scale went to one key per workout, changing the
     workout stopped remounting anything: the hash changes, `MotionScene` stays,
     and this hook kept the parked index. So the very first effect below saw
     `index >= beats.length` against the NEW key and marked the new workout's
     walk done before it said a word. Measured 2026-09-02: pick bench press,
     interrupt it, switch to swimming, and `sessionStorage` came back holding
     both `hpe.guide.firstWalk.bench_press` and `...swimming_freestyle` with the
     swimmer never having spoken.
     Reset on the key rather than on the beats, because the beats change shape
     for reasons that are not a new walk — a muscle gets picked, a list reloads —
     and restarting the narration every time a visitor clicks something is the
     modal-dialogue failure this hook's header already refuses. */
  /* THE INDEX BELONGS TO A KEY, AND THAT PAIRING IS A REF BECAUSE STATE IS TOO
     SLOW HERE. Resetting `index` with `setIndex(0)` is a state update: it lands
     on the NEXT render. The `markWalkDone` effect below runs in the SAME commit
     as this one, so on the render where the key changes it sees the new key
     beside the OLD parked index and files the new walk as spent. Measured
     exactly that way — both keys in `sessionStorage`, the swimmer never having
     spoken — and the first fix, which was this reset alone, did not move it.
     The ref settles within the commit, so the guard below is reading the truth
     rather than a value that is one render behind. */
  const indexKey = useRef(seenKey);
  if (indexKey.current !== seenKey) {
    indexKey.current = seenKey;
    if (index !== 0) setIndex(0);
    if (at) setAt(null);
    if (spoken) setSpoken(null);
  }

  /* ONE WALK PER KEY. Recorded when it runs out rather than when it starts, so a
     visitor who arrives and immediately navigates away has not spent theirs. */
  useEffect(() => {
    /* `indexKey` guards the pairing — see above. Without it a key change files
       the new walk as spent using the previous walk's index. */
    if (indexKey.current !== seenKey) return;
    if (enabled && beats.length && index >= beats.length) markWalkDone(seenKey);
  }, [enabled, beats.length, index, seenKey]);

  /* The listener above is armed once per beat and must not re-arm every time
     `stop`'s identity changes, so it reaches the current one through a ref. */
  const stopRef = useRef(() => {});

  const stop = useCallback(() => {
    markWalkDone(seenKey);
    setIndex(Number.MAX_SAFE_INTEGER);
  }, [seenKey]);

  /* Resuming keeps the beat that was interrupted rather than restarting the
     walk. Its patience starts over — the elapsed time is not tracked — so an
     interrupted beat gets its full `ms` again. Said plainly because the first
     version of this comment claimed the beat "carries on", which is what a
     reader would then assume is implemented; the beat's `ms` is the only thing
     tuning the walk's pace, and a beat that silently doubles is worth knowing
     about before someone tunes against it. */
  const resume = useCallback(() => setPaused(false), []);

  stopRef.current = stop;
  held.current = beat;
  return {
    at: beat ? at : null,
    line: beat ? spoken?.line ?? null : null,
    id: beat?.id ?? null,
    /* WHAT THE PICTURE SHOULD BE DOING while this beat is up. Read off the beat
       itself rather than the spoken line, so a wordless beat still drives the
       scene — the body's walk opens with one. */
    show: beat?.show ?? null,
    running: !!beat,
    paused: paused && !!beat,
    stop,
    resume,
  };
}

/** Whether this tab has already been walked through. */
export { walkAlreadyDone };
