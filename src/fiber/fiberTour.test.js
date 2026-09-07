import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cameraStops, tourLength } from "../tour.js";
import { fiberParts, fiberTour } from "./fiberTour.js";

/**
 * THE GATE THIS FILE EXISTS FOR: A LINE MAY NOT POINT THE OTHER WAY FROM ITS
 * NUMBER.
 *
 * A guided pass says "watch it empty" and the store is supposed to fall while
 * that sentence is on screen. Measured in a browser on 2026-08-26, the first
 * version did the opposite: the beat covered 0.65 to 1.25 s of the run, which is
 * the drop and then the whole refill, and `storeFraction` was read RISING from
 * 0.42 to 0.58 under a line telling a viewer it was emptying. Nothing was green
 * about it and nothing was red either — no gate in this project could see a
 * sentence disagreeing with the series it narrates.
 *
 * So this one can. Each beat has a seek, a speed and a duration, which is a
 * window over the run: `[seek, seek + speed * ms / 1000]`. The shipped series
 * is read over that window and asked to move the way the line says. It is the
 * same discipline as `signallingClaims.test.js` — the screen may not say a thing
 * the file does not do — one layer up, where the thing being said is a story.
 */

const RUN = JSON.parse(
  await readFile(new URL("../../public/scenarios/soce_on.json", import.meta.url), "utf8"),
);
const T = RUN.series?.t ?? RUN.t;
const STORE = RUN.series?.Ca_SR_total ?? RUN.Ca_SR_total;
const PROTOCOL = RUN.protocol;

/** The archive's nearest row, the way `scenarioData.js`'s `sample` picks one. */
function storeAt(t) {
  let best = 0;
  for (let i = 1; i < T.length; i += 1) if (Math.abs(T[i] - t) < Math.abs(T[best] - t)) best = i;
  return STORE[best];
}

/** `storeCeilings`' own arithmetic, off the shipped bytes rather than the app. */
const firing = (t) => {
  const k = Math.floor(t / PROTOCOL.cycle_s);
  return k < PROTOCOL.repetitions && t - k * PROTOCOL.cycle_s < PROTOCOL.stim_s;
};
const CEILINGS = [];
for (let k = 1; k < PROTOCOL.repetitions; k += 1) {
  let bestI = null;
  for (let i = 0; i < T.length; i += 1) {
    const t = T[i];
    if (t < k * PROTOCOL.cycle_s || t >= (k + 1) * PROTOCOL.cycle_s || firing(t)) continue;
    if (bestI === null || STORE[i] > STORE[bestI]) bestI = i;
  }
  if (bestI !== null) CEILINGS.push({ rep: k + 1, at: T[bestI], value: STORE[bestI] });
}
/** `forcePeaks`' own arithmetic, off the shipped bytes rather than the app —
    the same discipline the ceilings above are built with. */
const FORCE = RUN.series?.force_relative ?? RUN.force_relative;
const CA = RUN.series?.Ca_myo_total ?? RUN.Ca_myo_total;
const PEAKS = [];
for (let k = 0; k < PROTOCOL.repetitions; k += 1) {
  let bi = null;
  let ca = -Infinity;
  for (let i = 0; i < T.length; i += 1) {
    if (T[i] < k * PROTOCOL.cycle_s || T[i] >= (k + 1) * PROTOCOL.cycle_s) continue;
    if (bi === null || FORCE[i] > FORCE[bi]) bi = i;
    if (CA[i] > ca) ca = CA[i];
  }
  if (bi !== null) PEAKS.push({ rep: k + 1, at: T[bi], frameAt: T[bi], force: FORCE[bi], calcium: ca });
}
if (PEAKS.length) {
  const phase = PEAKS[0].at;
  for (const r of PEAKS) r.frameAt = (r.rep - 1) * PROTOCOL.cycle_s + phase;
}

const BEATS = fiberTour(PROTOCOL, CEILINGS, PEAKS);
const PARTS = fiberParts(PROTOCOL);

/**
 * THE PASS AS A VISITOR ACTUALLY MEETS IT — canon D2ⓐ, and the reason several
 * cases below no longer count.
 *
 * Nothing plays end to end any more. `stepsOf` cuts the storyboard into the
 * parts it is about, every part gets a pressable ring, and a press runs that
 * part's own beats; `FiberScene.jsx` hands `useTour` one step at a time. So
 * "the last beat" and "the ending a viewer sees" stopped being the same thing,
 * and any case that found its subject by counting was grading a beat by an
 * accident of position. Measured today: opener 4.7 s, then myosin 2.6, actin
 * 3.3, t-tubule 11.9, sr 16.7, tropomyosin 4.5.
 *
 * These indices have already gone stale twice — once when the fibre pass gained
 * its two introduction beats and once when D2ⓐ landed — so the cases find their
 * beats by part or by what the line says, never by number.
 */
/**
 * TWO STORYBOARDS SINCE 2026-09-05, and this file grades both.
 *
 * `fiberTour` is the guided pass — played whole, on arrival, in order. It is
 * the thing every case about sequence and about the ending is about.
 * `fiberParts` is the five demonstrations a press plays, one at a time.
 *
 * They used to be one array cut up by `stepsOf` on each beat's `focus`, and
 * that arrangement is the reason three of the pass's beats spent nine days
 * unreachable: anything marked `TOGETHER` went into `stepsOf`'s `finale`, which
 * `FiberScene` destructured and drew nowhere. There is no pile that nothing
 * renders any more, so there is no way for a beat to be graded here and unseen
 * on screen — which is what several of these cases were quietly doing.
 */
const partOf = (id) => {
  const step = PARTS.find((s) => s.id === id);
  assert.ok(step, `there is no demonstration for "${id}" — a case has lost its subject`);
  return step.beats;
};

test("the shipped run is the one this storyboard was written against", () => {
  assert.ok(Array.isArray(T) && T.length > 100, "soce_on ships no time series");
  assert.equal(PROTOCOL.repetitions, 10);
  assert.ok(PROTOCOL.cycle_s > 0 && PROTOCOL.stim_s > 0);
});

test("no protocol, no pass — a storyboard on undefined would seek to NaN", () => {
  assert.deepEqual(fiberTour(undefined, CEILINGS), []);
  assert.deepEqual(fiberTour({ cycle_s: 0.65 }, CEILINGS), [], "a partial protocol is not a protocol");
  /* AND NO CEILINGS MEANS NO ENDING. The pass ends by comparing the first
     repetition's recovery against the last one's; fewer than two of them and
     there is no comparison to make, so there is no pass rather than a pass whose
     last two beats are the same frame twice. */
  /* AND NO PEAKS MEANS NO ENDING. The pass ends by comparing the first
     repetition against the last; fewer than two and there is no comparison to
     make, so there is no pass rather than a pass whose last two beats are the
     same frame twice. The precondition moved from the store's ceilings to the
     force peaks when the ending stopped being about the store — the comparison
     is force against calcium now, which is what the floor is for. */
  assert.deepEqual(fiberTour(PROTOCOL, CEILINGS, []), [], "no measured peaks, no comparison, no pass");
  assert.deepEqual(fiberTour(PROTOCOL, CEILINGS, [PEAKS[0]]), [], "one repetition is not a comparison");
});

test("the camera moves, which is the whole correction this pass is", () => {
  assert.ok(
    cameraStops(BEATS).length >= 3,
    `the pass has ${cameraStops(BEATS).length} framings; two is a cut and one is the slideshow this replaced`,
  );
  const [first] = BEATS;
  const last = BEATS.at(-1);
  assert.notDeepEqual(first.camera, last.camera, "it opens and closes on the same shot");
});

test("every beat seeks somewhere the archive actually has", () => {
  for (const beat of BEATS) {
    if (typeof beat.seek !== "number") continue;
    assert.ok(
      beat.seek >= T[0] && beat.seek <= T.at(-1),
      `"${beat.line}" seeks to ${beat.seek}, outside the archive's ${T[0]}–${T.at(-1)}`,
    );
  }
});

test("no beat inherits its clock: a picture that depends on the beat before it is not a beat", () => {
  // The defect this catches by construction. Beat 4 used to run on from wherever
  // beat 3 left the clock, so how long beat 3 had been on screen decided which
  // half of the cycle beat 4 showed.
  //
  // NOT EVERY BEAT, AND THE EXEMPTION IS THE DESCENT. Since 2026-09-05 the pass
  // opens on the fascicle and the fibre, where nothing phase-dependent is drawn
  // or claimed: those two levels read three fields off the state
  // (`crossBridges`, `length`, `girth`) and no calcium, no store and no
  // stimulus reach them at all. A beat there may run on, and giving each one
  // its own seek would restart the run mid-descent, which is a visible jump for
  // no gain.
  //
  // WHERE IT STILL BITES, and it is stated as two rules rather than as a list
  // of beats so a new beat inherits the discipline:
  //   · a HELD beat (speed 0) is one specific instant, so it must name it;
  //   · a SARCOMERE beat is drawn from calcium, the store and the stimulus,
  //     all of which are phase.
  for (const beat of BEATS) {
    const held = beat.speed === 0;
    const onStage = beat.level === "sarcomere";
    if (!held && !onStage) continue;
    assert.equal(
      typeof beat.seek,
      "number",
      `"${beat.line ?? "(silent beat)"}" ${held ? "is held" : "is on the sarcomere"} and starts ` +
        `wherever it happens to be`,
    );
  }
});

test("the beat about the store covers a window that actually contains the drop", () => {
  /* THE WORDING MOVED ON 2026-08-30 (T3). The release got its own beat — "The
     store opens. Watch the calcium pour out." — and this beat, whose camera
     sits on the cisterna for the whole fall and refill, took the return. What
     this test grades is the WINDOW, not the sentence, so it finds the beat by
     either wording rather than by the one that happened to exist first. */
  /* THE WORDING HAS MOVED TWICE. It was "dumps its calcium", then "pulled back
     in", and since the 2026-09-05 rebuild the pass says "That signal opens the
     calcium store beside it" — the release got the beat and the refill is shown
     by the store's own press demonstration. What this grades is the WINDOW, so
     it finds its subject by every wording that has ever meant it. */
  const beat =
    BEATS.find((b) => /dumps its calcium|pulled back in|opens the calcium store/i.test((b.line ?? "").replace(/\*\*/g, ""))) ??
    partOf("sr")[0];
  assert.ok(beat, "no beat is about the store emptying, so this test is watching nothing");
  const span = (beat.speed ?? 1) * (beat.ms / 1000);

  /* WHAT THIS ASKED FOR FIRST, AND WHY IT WAS THE WRONG QUESTION. It looked for
     a window over which the store mostly FALLS, because the line said "watch it
     empty". There is no such window: `Ca_SR_total` drops in about 50 ms and
     refills over the remaining 600 ms of the cycle, so every beat long enough to
     read is mostly refill and no speed fixes that. The line was the thing that
     had to give, and it did — it now says both halves.
     What the beat must still do is CONTAIN the drop. A window that opens after
     the plunge shows a store quietly filling under a sentence about it dumping,
     which is the same defect one step subtler. */
  const STEPS = 40;
  const walk = Array.from({ length: STEPS + 1 }, (_, i) => storeAt(beat.seek + (span * i) / STEPS));
  const floor = Math.min(...walk);
  assert.ok(
    floor < walk[0] * 0.7,
    `"${beat.line}" covers ${beat.seek.toFixed(3)}–${(beat.seek + span).toFixed(3)} s, over which the ` +
      `store only falls from ${walk[0].toFixed(1)} to ${floor.toFixed(1)} µM. The release is not in ` +
      `frame, so what a viewer watches under that sentence is the refill alone.`,
  );
  assert.ok(
    walk.indexOf(floor) < STEPS / 2,
    "the drop happens in the back half of the beat, so most of what is watched precedes the event",
  );

  /* AND IT HAS TO OPEN ON A RELEASE, which is the assertion that gives the two
     above their teeth. Probed 2026-08-26: moving this beat's seek 0.25 s and
     then 0.45 s later left both of them green, because the cycle is 0.65 s and
     almost any window that long catches the NEXT burst's drop. "Contains a
     fall" is nearly free; "opens on the fall it is about" is not.
     Burst onsets are integer multiples of `cycle_s` — that is what
     `stimulusAt` does with the same two fields — so this asks the seek to be
     one, within the archive's own step. */
  const step = (T.at(-1) - T[0]) / (T.length - 1);
  const offBurst = Math.abs(beat.seek / PROTOCOL.cycle_s - Math.round(beat.seek / PROTOCOL.cycle_s));
  assert.ok(
    offBurst * PROTOCOL.cycle_s <= step * 2,
    `"${beat.line}" opens at ${beat.seek.toFixed(3)} s, which is ` +
      `${(offBurst * PROTOCOL.cycle_s).toFixed(3)} s away from any burst onset. It is narrating a ` +
      `release it did not start on, and the drop it happens to catch belongs to the next one.`,
  );
});

test("the ending is a cut between two repetitions, both at one phase and both held", () => {
  /* WHAT THIS GRADED BEFORE, AND WHY IT MOVED. It graded `stepsOf`'s `finale` —
     two frozen store ceilings, the run's first refill against its last. Two
     things happened to that. The pile was rendered by nothing, so the ending it
     was grading had not reached a pixel since 2026-08-26; and the ending itself
     changed subject when the floor was rebuilt around its real question. The
     comparison is FORCE against CALCIUM now, which is what the fibre scale is
     for: measured on this run, force keeps 37.2% of the first repetition and
     the calcium pulse keeps 99.5%.

     The three assertions are the same three as before, re-aimed:
     two frames, both held, and both drawn from the archive rather than typed. */
  const cmp = BEATS.filter((b) => b.compare);
  assert.ok(
    cmp.length >= 3,
    `the ending shows ${cmp.length} comparison frames; it needs the first, the last and the pair`,
  );

  const first = cmp.find((b) => b.compare === "first");
  const last = cmp.find((b) => b.compare === "last");
  assert.ok(first && last, "the ending does not name both of the repetitions it compares");

  for (const beat of cmp) {
    assert.equal(beat.speed, 0, `a comparison frame is a frozen instant; "${beat.compare}" is playing`);
  }

  /* BOTH FRAMES AT ONE PHASE, and this is the assertion that cost a screenshot.
     Force peaks drift later within their cycle as the run tires — 0.114 s in
     the first repetition and 0.164 in the tenth, against a 0.1625 s stimulus —
     so seeking each repetition's own peak drew the T-tubule FIRING in one frame
     and dark in the other. That is the one variable the line over them says
     does not change. `frameAt` holds the phase; this holds `frameAt`. */
  const phase = (t) => t - Math.floor(t / PROTOCOL.cycle_s) * PROTOCOL.cycle_s;
  assert.ok(
    Math.abs(phase(first.seek) - phase(last.seek)) < 1e-6,
    `the two frames sit at ${phase(first.seek).toFixed(3)} s and ${phase(last.seek).toFixed(3)} s of ` +
      `their cycles. The command is drawn differently in each, under a line saying it did not change.`,
  );

  /* AND THEY ARE DIFFERENT REPETITIONS, which is what makes it a comparison.
     A pass built on one measured peak returns [] rather than showing the same
     frame twice — the guard above grades that — and this holds the other end. */
  assert.ok(
    Math.abs(first.seek - last.seek) > PROTOCOL.cycle_s,
    "the ending cuts between two instants less than a repetition apart",
  );

  /* NEITHER INSTANT IS TYPED. Both come from `forcePeaks`, which sweeps the
     shipped series; a literal here would put a viewer on the wrong frame the
     first time the archive is re-exported. */
  for (const beat of [first, last]) {
    assert.ok(
      PEAKS.some((p) => Math.abs(p.frameAt - beat.seek) < 1e-9),
      `the "${beat.compare}" frame seeks ${beat.seek.toFixed(3)} s, which is not one of the run's own ` +
        `measured repetitions`,
    );
  }
});

test("the pass has substance, and no one demonstration outstays a viewer", () => {
  const whole = tourLength(BEATS);
  assert.ok(whole > 12_000, `the whole storyboard runs ${(whole / 1000).toFixed(1)} s — too little to teach`);

  /* THE CEILING IS PER DEMONSTRATION NOW, AND THE UNIT IS THE CHANGE. This held
     the WHOLE storyboard under 45 s, which was the right unit while the pass
     opened on arrival and narrated every beat at whoever had just landed. D2ⓐ
     ended that: a press runs one part, so 45 s of storyboard is a budget nobody
     spends in one sitting and capping it caps how much the scale may teach.
     NOT A WEAKENING, and this is the part to check before touching it: the
     whole is still held at 45 s by `tourPace.test.js`'s "no pass grows past
     what someone will sit through", which grades all three scales off the same
     number. What is new here is the per-part bound, which nothing had — the
     store's demonstration is 16.7 s of it, the largest, and the one a beat
     lengthened for the reading-rate rule would grow. */
  const long = PARTS
    .map((s) => [s.id, tourLength(s.beats)])
    .filter(([, ms]) => ms >= 45_000)
    .map(([id, ms]) => `${id} runs ${(ms / 1000).toFixed(1)} s`);
  assert.deepEqual(long, [], `a single press plays longer than anyone will sit through:\n  ${long.join("\n  ")}`);
});

/**
 * NO BEAT MAY CLAIM STILLNESS WHILE THE COMMAND IS FIRING.
 *
 * Three rounds of a design review that muted the sentences and read the frames
 * cold found the same shape of defect three times, and this is the half of it a
 * test can hold. The opening beat said "One sarcomere, holding still" and froze
 * at t=0 — where `soce_on`'s first burst fires, so the tubule was at full orange
 * in the frame claiming nothing was happening. The conclusion said the supply was
 * gone and froze 2 ms into the ninth burst.
 *
 * The rule is not "no beat may fire". A beat ABOUT a burst should open on one.
 * The rule is that a beat whose words deny motion may not open on the loudest
 * motion this scene has.
 */
test("a beat that says nothing is happening does not open mid-burst", () => {
  const firingAt = (t) => {
    const k = Math.floor(t / PROTOCOL.cycle_s);
    return k < PROTOCOL.repetitions && t - k * PROTOCOL.cycle_s < PROTOCOL.stim_s;
  };
  /* THE MATCHER HAD A WORD WITH TWO MEANINGS IN IT. It was
     `/still|holding|at rest|quiet|nothing/i`, and the pass's closing line is
     "So the signal is still arriving" — where "still" means CONTINUING and the
     sentence is an affirmation that the command has not weakened. The test read
     it as a denial of motion and demanded a dark tubule under a line whose
     whole point is that the tubule is firing. A frame is not wrong for matching
     a regex; the regex was wrong.
     Phrases now, not the bare word, and every one of them denies the picture
     rather than describing the run. */
  const denies = /holding still|standing still|at rest|nothing is happening|nothing happens|quiet|no burst/i;
  for (const beat of BEATS) {
    if (!denies.test(beat.line ?? "")) continue;
    assert.ok(
      !firingAt(beat.seek),
      `"${beat.line}" opens at ${beat.seek.toFixed(3)} s, which is inside a burst. The tubule is at ` +
        `full strength in a frame whose own sentence says nothing is happening.`,
    );
  }
});

/**
 * THE FLOOR'S CENTRAL CLAIM, CHECKED AGAINST THE RUN THAT MAKES IT.
 *
 * This replaces two cases written for a sentence the pass no longer says. They
 * graded "The same burst, N times. It never gets weaker." — a claim about what
 * the COMMAND delivers, made while the store, the largest coloured thing in
 * frame, was visibly weakening beside it. The rebuild moved the claim to where
 * it belongs: the ending compares the calcium PULSE against the FORCE, and both
 * are drawn as bars a viewer can put side by side rather than as a pronoun.
 *
 * What has not changed is the discipline, and it is the reason this file exists:
 * a line may not point the other way from its number. Measured off the shipped
 * archive, per repetition:
 *
 *   calcium pulse   27.15  27.14  26.95  28.46  29.42 …  26.74     99.5% kept
 *   peak force      0.871  0.725  0.622  0.544  0.485 …  0.324     37.2% kept
 *
 * So all three halves are pinned: the flat thing is flat, the falling thing
 * falls, and the sentence names which is which rather than saying "it".
 */
test("the ending's claim is the one the run actually makes", () => {
  const claim = BEATS.find((b) => /calcium pulse barely changed/i.test(b.line ?? ""));
  assert.ok(claim, "no beat makes the floor's central claim — this test has lost its subject");

  const kept = (a, b) => b / a;
  const caKept = kept(PEAKS[0].calcium, PEAKS.at(-1).calcium);
  const forceKept = kept(PEAKS[0].force, PEAKS.at(-1).force);

  assert.ok(
    caKept > 0.9,
    `the line says the calcium pulse barely changed and it keeps ${(caKept * 100).toFixed(1)}% of the ` +
      `first repetition. That is not "barely".`,
  );
  assert.ok(
    forceKept < 0.6,
    `the line says the force did change and it keeps ${(forceKept * 100).toFixed(1)}% of the first ` +
      `repetition. A difference this small is not what the ending is built on.`,
  );
  /* AND THE TWO HAVE TO BE FAR APART, which is the assertion the two above
     cannot make on their own: both could pass on a run where everything fell a
     little, and the picture would then be two bars a viewer cannot tell apart
     under a sentence insisting they differ. */
  assert.ok(
    caKept - forceKept > 0.4,
    `the two quantities keep ${(caKept * 100).toFixed(1)}% and ${(forceKept * 100).toFixed(1)}% — ` +
      `too close for a cut to show, whatever the sentence says`,
  );

  /* IT NAMES THEM. The defect the old case was written for was a pronoun: "it
     never gets weaker" takes its subject from whatever the eye is on, and on
     this screen the eye is on the store. Both quantities are named here. */
  assert.match(claim.line, /calcium/i, "the claim does not say which signal held");
  assert.match(claim.line, /force/i, "the claim does not say which quantity fell");
});

/**
 * AND THE SET IS PLAYED BEFORE IT IS TALKED ABOUT.
 *
 * The comparison only means anything to somebody who watched the thing being
 * compared. `fiber.md` is explicit that the whole set runs with the narration
 * stopped — *"말을 안 하는 게 중요해. 사용자가 관찰해야 하니까"* — and this is
 * the beat that had been unreachable since 2026-08-26: it carried
 * `part: TOGETHER`, `stepsOf` filed it into `finale`, and `FiberScene` drew
 * `finale` nowhere. The floor's entire payoff was in a pile nothing rendered.
 */
test("the whole set plays, at speed, with nothing said over it", () => {
  const set = BEATS.find((b) => b.set);
  assert.ok(set, "no beat plays the whole set — the comparison has nothing to compare");
  assert.equal(set.line, undefined, "something is said over the set; the point is that nothing is");
  assert.equal(set.speed, 1, `the set plays at ${set.speed}x; ten repetitions slowed down is a minute`);
  assert.equal(set.seek, 0, "the set does not start at the beginning of the run");

  const covered = set.speed * (set.ms / 1000);
  const bout = PROTOCOL.cycle_s * PROTOCOL.repetitions;
  assert.ok(
    covered >= bout - 0.05,
    `the set beat covers ${covered.toFixed(2)} s of a ${bout.toFixed(2)} s bout, so a viewer told to ` +
      `watch the whole set does not see the end of it`,
  );

  /* AND IT COMES BEFORE THE COMPARISON, which is the ordering the whole
     sequence rests on. */
  const firstCompare = BEATS.findIndex((b) => b.compare);
  assert.ok(
    BEATS.indexOf(set) < firstCompare,
    "the comparison is drawn before the set it compares has been played",
  );

  /* ── AND EVERY PART IS TAUGHT BEFORE THE WHOLE ───────────────────────────
     This is the invariant `tourGrammar.test.js` holds for the other two deep
     scales, held here instead because this floor's storyboard no longer has the
     shape that gate reads.

     THE GRAMMAR IT REPLACES. That gate asks that `stepsOf`'s `finale` — the
     beats marked `TOGETHER` — be a non-empty contiguous TAIL, because on a
     scale where ONE array serves both the automatic tour and the per-part
     presses, being the tail is what makes "state 2 then state 3, in order"
     free. The fibre split into two storyboards on 2026-09-05 (`fiberTour` for
     the pass, `fiberParts` for the presses) precisely because one array cannot
     be both: the pass's t-tubule beat answers a question the tropomyosin beat
     asked three beats earlier, so pressing that ring cold played an answer with
     no question. With no `TOGETHER` beat left, `finale` is empty and that gate
     reads it as "no state 3 at all".

     WHAT ACTUALLY PLAYS STATE 3 — the owner's *"전체적으로 어떻게 working
     하는지"* — is the `set` beat and the `compare` beats. And the ordering
     rule survives the split intact: everything that teaches a PART comes
     first. What does NOT survive is "the whole-run beats are the last ones",
     and deliberately: the cause and the bridge come after the whole, because
     they are why the whole did what it did. A pass that ended on the set would
     have shown the fatigue and never named it. */
  const teaching = BEATS.map((b, i) => (b.focus ? i : -1)).filter((i) => i >= 0);
  const setAt = BEATS.indexOf(set);
  const late = teaching.filter((i) => i > setAt && !BEATS[i].atp);
  assert.deepEqual(
    late.map((i) => `beat ${i}: ${BEATS[i].line ?? "(silent)"}`),
    [],
    "a part is introduced after the whole set has played, so the sequence shows how everything " +
      "works together before it has explained the pieces",
  );
});

test("the sarcomere's plates and the pass's subjects are one list", async () => {
  const { LEVELS } = await import("./fiberGeometry.js");
  const model = LEVELS.sarcomere.build();
  const plates = model.anchors.map((a) => a.id).sort();
  model.dispose();

  /* THE PASS'S SUBJECTS ARE ITS PARTS, NOT ITS `focus` VALUES — canon D2ⓐ. This
     built the list from `b.focus`, which was the same list until a beat needed
     to belong to a part without pointing at it: the store's conclusion carries
     `part: "sr"` and no focus on purpose, because its sentence rules the store
     OUT and a ring still burning on the store made "waste around the strands"
     read as waste inside it (`tour.js` carries the screenshot). `stepsOf` is
     what the scene itself groups by, so this now grades the list a visitor can
     actually press rather than a list that happens to coincide with it. */
  /* 2026-09-07 (FIBER pace 7, owner: *"fiber main에서 you can't really click"*): the fibre
     level's four plates press too, so the pass's subjects are the UNION of the two
     pressable levels' plates — the fascicle still offers nothing. */
  const fibre = LEVELS.fiber.build().anchors.map((a) => a.id);
  const pressable = PARTS.map((s) => s.id).sort();
  assert.deepEqual(pressable, [...plates, ...fibre].sort(), "a plate without a demonstration, or a demonstration without a plate");
});

/**
 * A ROLE CLAUSE ON A PLATE IS THE PASS'S JOB DONE TWICE.
 *
 * Same canon line, other half. `T-tubule · carries the signal` and
 * `Tropomyosin + troponin · calcium lands on troponin` each said what their
 * element DOES, standing on the picture, while the beat framing that element
 * said the same thing in a sentence. What a clause may still carry is a SECOND
 * NAME — `· thick`, `· thin`, `· the store` — because no beat supplies one, and
 * the store's is the word the pass itself uses for the cisterna.
 *
 * Checked by shape rather than against a list of blessed strings: a name is
 * short and a role is a phrase. Three words is the line, and the three clauses
 * that ship sit at one, one and two.
 */
test("no sarcomere plate explains itself in a clause", async () => {
  const { LEVELS } = await import("./fiberGeometry.js");
  const model = LEVELS.sarcomere.build();
  const wordy = model.anchors
    .map((a) => [a.label, (a.label.split(" · ")[1] ?? "").split(/\s+/).filter(Boolean)])
    .filter(([, words]) => words.length > 3)
    .map(([label]) => label);
  model.dispose();

  assert.deepEqual(
    wordy,
    [],
    `a plate is explaining itself: ${JSON.stringify(wordy)}. A clause may be a second name for the ` +
      `thing (· thick, · the store); what it DOES belongs to the beat that frames it`,
  );
});
