/**
 * The fibre scale's guided pass, and the five demonstrations a press plays.
 *
 * THE FLOOR'S QUESTION: how does a muscle make force, and why does that force
 * fade across repeated contractions? The answer is not told, it is watched —
 * this floor's identity is WATCH, and every beat below moves a camera, a clock,
 * a model or a comparison. There are no speaking beats.
 *
 * THE SHAPE, from `docs/20260905-fix/fiber.md`:
 *
 *   descent      fascicle -> fibre -> sarcomere, entered rather than cut to
 *   machinery    myosin, then actin, then the cover that stops them meeting
 *   one pull     signal -> calcium -> cover moves -> cross-bridges -> shortening
 *   the set      ten repetitions, at speed, with nothing said over them
 *   the reveal   first repetition against last: the pulse held, the pull did not
 *   the cause    phosphate, which every pull leaves behind
 *   the bridge   all of it spent ATP, which is the next floor's question
 *
 * WHAT THE PASS REPLACED. Until 2026-09-05 the arrival was `fiberWalk` —
 * eighteen beats that moved nothing, by its own header — and the storyboard here
 * was played only by pressing a ring. Three of its ten beats could not play at
 * all: `stepsOf` files a `TOGETHER` beat into `finale` and `FiberScene`
 * destructured that and rendered it nowhere, so the whole-run beat and both
 * conclusion frames — the entire "the command never weakens but the pull fades"
 * payoff — reached no pixel. The ending had been moved into words, which is the
 * one thing this floor should never do with a comparison it can draw.
 *
 * EVERY INSTANT IS THE RUN'S, NOT A ROUND NUMBER. `soce_on`'s protocol is
 * `cycle_s: 0.65`, `stim_s: 0.1625`, `repetitions: 10`, `t_exercise_s: 6.5` —
 * the first two are the authors' (`SkelMuscleCa_MakeFigs.m:141`), the rest ours,
 * and `protocol.whose_protocol` says so. Beats derive their seeks from those
 * fields and from `forcePeaks`/`storeCeilings`, which sweep the shipped series.
 *
 * THE CAMERA POSITIONS ARE THE SCENE'S OWN, AND NOW ACTUALLY ARE. This
 * paragraph used to name coordinates — "the t-tubule anchor at x 1.4 and the
 * terminal cisterna at x 3.058" — while stating the rule that makes naming them
 * wrong. Both were two sarcomeres out of date by the time anyone read them
 * again, and three beats were aiming 15.3% of the model away at empty paper.
 * No beat types a position now: `closeOn` takes an anchor id and a standoff.
 *
 * WHY IT SLOWS DOWN AND SPEEDS UP. One calcium transient is 0.126 s FWHM and
 * the burst causing it is 0.1625 s: at 1x they are eight and ten frames and the
 * ORDER between them, which is the lesson, is gone before the eye finds either.
 * The mechanism beats run at a tenth to a quarter speed. The set runs at 1x,
 * because ten repetitions slowed down is a minute of watching and the thing
 * being compared is easier to see fast.
 */

/** How `fiberGeometry.js` frames each level — imported rather than copied, for
    the reason `WIDE` gives below. The triad's own coordinates used to be
    imported alongside it and are now not imported at all; the note under this
    import says why reading them from the built scene is the only form that
    survives the geometry moving. */
import { LEVELS } from "./fiberGeometry.js";

/* THE TWO TRIAD CONSTANTS ARE GONE, 2026-09-05, AND THIS IS THE THIRD TIME THE
   SAME MISTAKE WAS CAUGHT HERE.

   They were `const TRIAD_X = 1.4` and `const CISTERNA_X = 3 + TRIAD_GAP`. The
   second one already carried a note saying it had been typed as 3.058 while the
   geometry moved to 0.09 — and the fix that note describes was to import
   `TRIAD_GAP` and keep on typing the 3.

   The 3 was the number that mattered. `SARC_COUNT` went 3 -> 2 on canon D1 and
   `buildSarcomereLevel` recomputed its own anchors off `junctionX()`: the
   t-tubule to x 0.300 and the terminal cisterna to x 1.990. `LEVELS.sarcomere`'s
   frame comment states the second of those outright — "the cisterna's anchor is
   x = 1.99, y = 0.565" — so the geometry knew, and only the storyboard did not.

   Measured by `tourAimsAtTheModel.test.js` before it was fixed: three beats
   looked at [3.09, 0.57, 0], which is 15.3% of the model away from any part of
   it, and the beacon follows the camera. The pulsing ring that exists because
   the owner said *"i dont even know where the store is"* was pointing at empty
   paper for the whole ending.

   There is no constant here now. `closeOn` reads the anchor and stands off it,
   so a shot cannot survive the thing it is a shot of moving. */

/**
 * The wide framing is the level's own camera, so a beat that wants the whole
 * model asks for it BY IDENTITY — `FiberScene` compares `tour.camera` against
 * `spec.camera` and substitutes the fitted position when they are the same
 * array. Any other value is used as a literal world position.
 *
 * The old line said the same sentence and kept a copy, `[1.1, 1.8, 7.6]`. The
 * copy held for as long as nobody moved the level's own camera; on 2026-08-30
 * the framing came in to sit on one sarcomere instead of two and a half, and the
 * copy would have left three of this pass's beats establishing a shot the scene
 * never returns to.
 */
const WIDE = LEVELS.sarcomere.camera;
const FASCICLE_WIDE = LEVELS.fascicle.camera;
const FIBER_WIDE = LEVELS.fiber.camera;

/**
 * A BEAT'S PACE AND A BEAT'S WINDOW ARE TWO DECISIONS AND USED TO BE ONE NUMBER.
 *
 * `speed * ms/1000` is the run-seconds a beat covers, so writing both as
 * literals means changing how long a sentence is on screen also changes what the
 * beat is ABOUT. Naming the window and deriving the speed lets `ms` move for
 * reading time alone, which is what `tourPace.test.js` needs: at 200 words a
 * minute, less the line's own fade and a frame's slip, a beat that is short is
 * short in a way no browser has to be opened to see.
 */
const secondsPer = (windowS, ms) => windowS / (ms / 1000);

/**
 * @param protocol `soce_on`'s own protocol block.
 * @param ceilings `storeCeilings(scenario)` — where the store got back to after
 *   each repetition, measured off the shipped series rather than typed here.
 * @param peaks `forcePeaks(scenario)` — each repetition's own maximum force, and
 *   the size of that repetition's calcium pulse and phosphate load. The first
 *   and the last of these are the floor's whole ending.
 * @param muscle The mesh id of the muscle the visitor picked on the body scale,
 *   or null. The descent's first beat names it, which is the whole of "going in
 *   is going into THEIRS" — without it the pass opens on "a muscle", and the
 *   one they chose is a thing the app has forgotten by the time it matters.
 * @param points Every place in the built scene a shot may be composed on:
 *   `model.anchors` (the labelled callouts) followed by `model.sites` (points
 *   the storyboard needs that carry no plate — the triad, whose two halves are
 *   labelled a sarcomere apart so their plates do not collide). The scene hands
 *   its own positions in and this file types none of them, which is the whole of
 *   "an anchor moved in the geometry moves the shot with it".
 */
/**
 * A mesh id as a person would say it. "pectoralis-major" -> "Pectoralis major".
 *
 * SENTENCE CASE, NOT TITLE CASE. These names are anatomy and anatomy is written
 * with one capital — "Pectoralis major", "Biceps brachii" — and the app already
 * spells them that way where it names them. Title case would make the line read
 * as a label dropped into a sentence rather than as the sentence naming a thing.
 */
function readable(id) {
  const words = String(id ?? "").replace(/[-_]+/g, " ").trim();
  if (!words) return null;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function fiberTour(protocol, ceilings = [], peaks = [], points = [], muscle = null) {
  const anchorAt = (id) => points.find((a) => a.id === id)?.at ?? [0, 0, 0];

  /**
   * A CLOSE-UP, EXPRESSED AS A STANDOFF RATHER THAN A PLACE.
   *
   * `lookAt` is the anchor itself and `camera` is the anchor plus this vector,
   * so what a beat states is the RELATIONSHIP — "half a unit right of it, a
   * little above it, three units out" — and the absolute coordinates are the
   * scene's to supply. That is the difference between a shot that follows its
   * subject and a shot that was once beside it.
   *
   * AND IT RINGS WHAT IT SHOWS. `focus` is the PART — the id `stepsOf` groups a
   * demonstration under and the id a pressable handle is drawn for — so it has
   * to stay the labelled anchor's. Where the beacon goes is a separate question,
   * because a part can be drawn more than once: there are four t-tubules here
   * and the labelled one is at the far end of the sarcomere from the labelled
   * store. `focusAt` is the override `useTour` already reads, so a close-up
   * rings the instance it is actually pointing the camera at.
   */
  const closeOn = (id, [dx, dy, dz]) => {
    const at = anchorAt(id);
    return { lookAt: at, focusAt: at, camera: [at[0] + dx, at[1] + dy, at[2] + dz] };
  };

  /** The two halves of the triad, seen from the same side at the same height. */
  const TUBULE_STANDOFF = [0.9, 0.45, 3.1];
  const STORE_STANDOFF = [0.7, 0.53, 3.0];
  /** Back and down, far enough to hold both filament sets in one frame. */
  const FILAMENT_STANDOFF = [0.6, 0.5, 4.6];
/* Closer than the filament shot: tropomyosin is the thinnest strand on the floor. */
const COVER_STANDOFF = [0.4, 0.32, 3.0];
  /** In among the rods, close enough that one thick filament is the subject. */
  const ROD_STANDOFF = [0.35, 0.3, 2.4];
  /** One head and the molecule on it, and nothing else — the subject is a
      hundredth of the row's size, 0.17 long against 4.4.
      1.60 BACK, AND 0.84 WAS INSIDE THE ORBIT CLAMP. `FiberScene` gives
      `OrbitControls` `minDistance: 1.4`, so a shot composed at 0.844 is a shot
      the controls move: the pass frames it, the pass ends, and the first thing
      a viewer's hand does is push the camera out to 1.4 — the composition
      changing for a reason nothing on screen explains. Caught by
      `tourGrammar.test.js`, which is the fourth thing wrong with this molecule
      and the first that only a gate could see; the other three were a wrong
      sarcomere, a burial inside the lattice and a shot aimed at the anchor
      instead of the head, and all three were caught by looking.
      At 1.60 the visible half-height is 0.551, so the molecule is 15% of the
      frame — about 140 px on a 900 px stage, which is a subject and not a
      speck. */
  const HEAD_STANDOFF = [0.23, 0.3, 1.55];

  const cycle = protocol?.cycle_s;
  const stim = protocol?.stim_s;
  const reps = protocol?.repetitions;

  /* NO STORYBOARD WITHOUT A PROTOCOL. A pass built on undefined would seek to
     NaN and hold the run at its first frame while narrating a burst that never
     comes — worse than no pass, because it looks like one.
     `> 0` AND NOT `>= 0`: `null >= 0` is true in JavaScript, and the first
     version of this guard let a missing value through and built a pass whose
     beats seek to null. */
  if (!(cycle > 0) || !(stim > 0) || !(reps > 0)) return [];

  /* The ending compares the first repetition against the last. Fewer than two
     and there is no comparison to make, so there is no pass. */
  const first = peaks[0];
  const last = peaks[peaks.length - 1];
  if (!first || !last || first === last) return [];

  /* The second burst rather than the first: the first fires at t=0 with the
     store full and nothing yet to compare it against, and a viewer who arrives
     mid-beat has already missed it. */
  const muscleName = readable(muscle);

  const secondBurst = cycle;
  /* Where the whole set ends, in the run's own seconds. */
  const bout = reps * cycle;

  /**
   * EVERY BEAT STATES ITS LEVEL, EVEN THE ONES THAT DO NOT CHANGE IT.
   *
   * The descent's beats name a model and the rest of the pass used to name
   * none, on the reasoning that a beat which does not change the level does not
   * need to mention it. That is true while the pass plays in order and false
   * the moment it does not.
   *
   * Screenshotted 2026-09-05: parked on the closing beat — "So the signal is
   * still arriving. The muscle is simply making less force from it." — the
   * picture was the FIBRE level in extreme close-up. Nine seconds of the pass
   * had run, which reaches the fibre, and every beat after it was silent about
   * the level, so the model never came back. A visitor who interrupts anywhere
   * in the descent is left on a transitional rung with the main explorer on it,
   * and the reveal's own beats would draw their comparison over a model that
   * has no store, no calcium and no cross-bridges in it.
   *
   * So the level is carried forward: a beat that does not say inherits the last
   * one that did. Written here rather than typed onto nineteen beats, because
   * nineteen copies of one fact is how the copies start disagreeing.
   */
  const carryLevel = (beats) => {
    let held = null;
    return beats.map((b) => {
      if (b.level) held = b.level;
      return held && !b.level ? { ...b, level: held } : b;
    });
  };

  return carryLevel([
    /* ---- THE DESCENT ---------------------------------------------------- *
       Three levels, entered rather than cut between.

       WHY THIS NEEDED BUILDING AT ALL. The three levels have always existed and
       switching between them was a CUT: `spec.build()` swapped the whole group
       while the camera held still, and `fascicle` and `fiber` were authored
       with the IDENTICAL camera direction, so two of the three rungs differed
       only in what geometry appeared. Worse, every level's `frame` is fitted to
       fill the stage, so all three drew at the same apparent size — a ladder of
       scales where nothing changes scale.

       WHAT MAKES A DESCENT READ is a match cut: the outgoing object grows past
       the frame edge, and the incoming object opens at the size the piece you
       were just looking at had. So each level gets two beats — its own framing,
       then a push toward the part the next level IS. `enter` names that part
       and `FiberScene` resolves it against the live model, because the anchors
       belong to the geometry and this file may not hold a copy of them. */
    {
      ms: 3400,
      level: "fascicle",
      camera: FASCICLE_WIDE,
      lookAt: [0, 0, 0],
      seek: 0,
      speed: 0,
      /* NAMED WHEN WE KNOW IT, AND NOT NAMED WHEN WE DO NOT.
         `null` is a real state — the fibre scale has a URL of its own and a
         visitor can land on it without ever having pressed a muscle — and the
         line has to work cold. So the name is added to the sentence rather than
         the sentence being built around it: same clause, one more fact when
         there is one. */
      line: muscleName
        ? `${muscleName} is made of bundles called **fascicles**.`
        : "A muscle is made of bundles called **fascicles**.",
    },
    {
      ms: 3100,
      level: "fascicle",
      /* Toward the one fibre this fascicle level draws un-bowed and on the axis
         — it is the level's own way of saying "this is the one we follow". */
      enter: "focus",
      /* THE ONE FIBRE IN COLOUR, THE REST PAPER — owner, FIBER 4/10: the sentence is
         about the fibres and the spotlight is what says which thing that is. */
      focus: "focus",
      /* HELD, SO IT SAYS WHERE. Inheriting would be the same instant today and
         a different one the day the beat above it gains a speed. */
      seek: 0,
      speed: 0,
      line: "Inside each bundle are long **muscle fibres**.",
    },
    {
      /* NO LINE, WHICH IS THE SPEC'S OWN RHYTHM. `fiber.md` §1 gives the descent
         three captions and puts none at 1.8 s — "fiber 안으로 zoom, myofibrils가
         나타남", the picture arriving on its own. The sentence before it stays
         on screen while it does, which is what the line already does over the
         set and over the hero contraction. Shorter than it was for the same
         reason: nothing has to be read here. */
      ms: 2600,
      level: "fiber",
      camera: FIBER_WIDE,
      lookAt: [0, 0, 0],
      speed: 1,
    },
    {
      /* 4300: the md's third caption is the longest of the three. */
      ms: 4300,
      level: "fiber",
      /* COMPOSED, NOT PUSHED — owner, FIBER 6: *"Fiber가 화면 상으로 너무 내려가 있고"*.
         `enter: "myofibril"` aimed at an anchor near the fibre's far end and left
         the fibre low and cut off at the right. This frames the fibre across the
         middle, a little closer than the wide shot so the striations read. */
      camera: [0.9, 1.15, 4.7],
      lookAt: [0.2, -0.05, 0],
      speed: 1,
      line: "And inside a fibre, the pulling happens in repeating units called **sarcomeres**.",
    },
    {
      ms: 3700,
      level: "sarcomere",
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: 0,
      speed: 0,
      line: "This is a sarcomere. It's **where force is made**.",
    },

    /* ---- THE MACHINERY --------------------------------------------------- *
       Named before it is asked to do anything, and held still while it is
       named: `speed: 0`. A part introduced over a moving picture is a part
       nobody found. */
    {
      ms: 2800,
      ...closeOn("myosin", ROD_STANDOFF),
      focus: "myosin",
      /* HELD AT REST, WHERE A PART IS EASIEST TO SEE. t=0 is before the first
         burst on this run, so the lattice is at its resting length and nothing
         is moving under the name being given to it. */
      seek: 0,
      speed: 0,
      line: "These thick strands are **myosin**.",
    },
    {
      ms: 4400,
      ...closeOn("actin", FILAMENT_STANDOFF),
      focus: "actin",
      /* AND THIS ONE MOVES, WHERE THE ONE ABOVE DID NOT. Naming myosin wants a
         still frame; saying that it PULLS and the sarcomere SHORTENS over a
         still frame is the exact defect this floor was rebuilt to remove. Half
         a cycle at a fifth speed, opening on the burst, so the strands are
         visibly sliding under the clause that says they slide. */
      seek: secondBurst,
      speed: secondsPer(cycle * 0.5, 4400),
      line: "These thinner ones are **actin**. Myosin pulls on actin to shorten the sarcomere.",
    },
    {
      /* THE BEAT THAT MAKES THE SIGNAL MATTER. Without it the calcium is a
         thing that happens; with it the calcium is the answer to a question the
         viewer already has. Held at the instant before the second burst, which
         is the quietest frame this run offers: the store is most of the way
         back and the tubule is dark. */
      ms: 4600,
      /* NAME THE THING THAT IS LIT — 2026-09-07, owner (FIBER pace 1): *"tropomyosin +
         troponin is highlighted but never explained or are they even highlighted?"*
         Both: the plate said tropomyosin, the sentence said "covered", and the
         strand is thin enough that at FILAMENT_STANDOFF its colour barely read.
         So the word is in the line and the camera stands closer. */
      ...closeOn("tropomyosin", COVER_STANDOFF),
      focus: "tropomyosin",
      seek: secondBurst - stim,
      speed: 0,
      line: "At rest, **tropomyosin** covers the grab sites. Myosin has nothing to hold onto.",
    },

    /* ---- ONE PULL -------------------------------------------------------- *
       Signal, store, cover, pull. Each beat opens where the last one closed,
       and the run creeps so the ORDER between them is visible. */
    {
      /* The tube at the store's own junction, so "beside it" one beat later is
         a thing on screen and not a word. Starts a hair before the burst and
         creeps through it, so the pulse arrives while the line is being read
         rather than before the camera has landed. */
      ms: 4800,
      ...closeOn("triad-tubule", TUBULE_STANDOFF),
      focus: "t-tubule",
      seek: secondBurst - stim * 0.5,
      speed: secondsPer(stim * 1.4, 4800),
      line: "A contraction starts with an electrical signal. Watch it travel down the **T-tubule**.",
    },
    {
      /* 0.24 run-seconds — enough for the release and not enough to leave it.
         The measurement that set it: across this burst the framing changes by
         22,000 to 32,000 pixels a step and then falls to 604 once the calcium
         is out, so the release is the loudest thing on the stage and the beat
         is sized to sit on exactly that. */
      ms: 3400,
      ...closeOn("sr", STORE_STANDOFF),
      focus: "sr",
      seek: secondBurst,
      speed: secondsPer(0.24, 3400),
      line: "That signal opens the **calcium store** beside it.",
    },
    {
      /* Back to the filaments for the effect, one beat after the cause. The
         cover rolls 0.55 rad off the binding sites as troponin catches the
         calcium — which is drawn, and is why this beat is here and not a
         sentence on the beat above. */
      ms: 3600,
      ...closeOn("tropomyosin", COVER_STANDOFF),
      focus: "tropomyosin",
      seek: secondBurst + stim * 0.4,
      speed: secondsPer(0.3, 3600),
      line: "Calcium moves **tropomyosin** out of the way.",
    },
    {
      ms: 2400,
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: secondBurst,
      speed: secondsPer(0.18, 2400),
      line: "Now the machinery can **pull**.",
    },
    {
      /* AND THEN NOTHING IS SAID. This is the floor's hero frame: one whole
         cycle, wide, at a pace where the chain is separable — burst, release,
         cover, bridges, shortening, force. The spec is explicit that the line
         stops here and the picture carries it, and that is the difference
         between a floor that explains a mechanism and one that shows it. */
      ms: 3200,
      camera: WIDE,
      lookAt: [0, 0, 0],
      /* SEEKED BACK, AND NOT LEFT TO INHERIT. Without this the beat opens
         wherever the previous one's slow crawl ended — 0.82 s, which is after
         the burst — so the "complete contraction" would begin with the command
         already given and the calcium already out. It has to start before the
         signal, or it is not the whole chain. */
      seek: secondBurst - stim * 0.6,
      speed: secondsPer(cycle, 3200),
    },

    /* ---- THE SET --------------------------------------------------------- *
       Ten repetitions at 1x with nothing said over them. */
    {
      ms: 2400,
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: 0,
      speed: 0,
      line: "Now watch the **whole set**.",
    },
    {
      /* THE BEAT THAT COULD NOT PLAY. This is the wide whole-run beat that has
         been in the storyboard since 2026-08-26 and has never reached a pixel:
         it carried `part: TOGETHER`, `stepsOf` filed it into `finale`, and
         `FiberScene` destructured `finale` and rendered it nowhere.
         It is 1x and it is silent. Ten repetitions at a quarter speed is a
         minute of watching; the thing being compared — the first pull against
         the tenth — is easier to see fast, and easier still to see with nobody
         talking over it. Measured on the shipped run, this is what is drawn:
         rep  1 shortest 1.9466 um   84.5% of the drawn travel
         rep  5 shortest 2.0576 um   47.5%
         rep 10 shortest 2.1049 um   31.7%
         Monotonic, every repetition smaller than the one before. */
      ms: Math.round(bout * 1000),
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: 0,
      speed: 1,
      set: true,
    },

    /* ---- THE REVEAL ------------------------------------------------------ *
       Two archived instants and a cut between them. A ramp cannot show a
       difference this size; a cut can. */
    {
      ms: 3800,
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: last.frameAt ?? last.at,
      speed: 0,
      line: "The pull got weaker. But look at the **calcium signal**.",
    },
    {
      /* `compare` is this file's third new verb and `FiberScene` owns what it
         draws: the two meters, and which repetition is on screen. Nothing is
         said over these two — they ARE the sentence. */
      ms: 2400,
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: first.frameAt ?? first.at,
      speed: 0,
      compare: "first",
    },
    {
      ms: 2400,
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: last.frameAt ?? last.at,
      speed: 0,
      compare: "last",
    },
    {
      /* +500 ms on 2026-09-07: the title line (SAME SIGNAL, LESS FORCE) is read too — tourPace measured 3.49 s readable against 3.94 needed at 3.3 words/s */
      ms: 4400,
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: last.frameAt ?? last.at,
      speed: 0,
      compare: "both",
      line: "**SAME SIGNAL, LESS FORCE** — The calcium pulse barely changed. The force did.",
    },

    /* ---- THE CAUSE ------------------------------------------------------- *
       Phosphate, which has shipped in every fibre scenario since the first one
       and was drawn by nothing until 2026-09-05. */
    {
      ms: 4700,
      ...closeOn("atp-head", HEAD_STANDOFF),
      /* NO FOCUS — owner, FIBER pace 4: *"shouldn't we just show nothing highlighted, just zoomed in?"* The rods were lit and the phosphate the line is about was paper. */
      /* AND THE MOLECULE IS ON SCREEN FOR IT, at the owner's word 2026-09-05.
         This line has always been the floor's one sentence about ATP and the
         picture under it was a still frame of a rod. `atp` puts one molecule on
         one head; the head's own power stroke is the clock, so what a viewer
         watches is arrive, pull, split — and the third phosphate leaving is the
         first time anything says where the field of them came from.
         IT HAS TO PLAY. The stroke is `sin(time·9)` on the RUN's clock, so a
         held frame has no cycle at all: 4700 ms at 0.21 is about a second of
         run, which is one and a half swings — enough to see the order twice
         and not enough to become a loop. */
      seek: first.frameAt ?? first.at,
      speed: secondsPer(1.0, 4700),
      atp: true,
      line: "Every pull spends ATP, and one of the things left behind is **phosphate**.",
    },
    {
      /* THE ACCUMULATION, PLAYED. `Pi_myo_total` runs 1505 -> 6120 µM across
         the ten repetitions, 4.07x, and each grain of the drawn field carries
         its own threshold — so what this beat shows is the count rising, not an
         opacity ramp. One grain at the start of the bout, 79 by the tenth. */
      ms: 4200,
      camera: WIDE,
      lookAt: [0, 0, 0],
      seek: 0,
      speed: secondsPer(bout, 4200),
      line: "Across a set, phosphate **builds up** around the contractile machinery.",
    },
    {
      /* +1200 ms on 2026-09-07: the title line (WHY THE PULL FADES) is read too — tourPace measured 4.89 s readable against 6.06 needed */
      ms: 6500,
      camera: WIDE,
      lookAt: [0, 0, 0],
      /* THE COMMAND HAS TO BE ON SCREEN UNDER THIS LINE. It says the signal
         is still arriving, so the frame it says it over must be one where the
         tubule is firing — `frameAt` is the shared phase, 0.114 s into the
         cycle against a 0.1625 s stimulus, which is exactly that. Seeking the
         force PEAK instead lands at 0.164 by the tenth repetition, a hair after
         the burst ends, and draws a dark tubule under a sentence about a signal
         that has not weakened. */
      seek: last.frameAt ?? last.at,
      speed: 0,
      line: "**WHY THE PULL FADES** — So the signal is still arriving. The muscle is simply making less force from it.",
    },

    /* ---- THE BRIDGE ------------------------------------------------------ *
       The next floor's question, asked here so that going down is following
       something rather than pressing a magnifier. */
    {
      /* THE LAST FRAME IS THE MOLECULE, WHICH IS WHAT THE NEXT FLOOR IS ABOUT.
         This was wide and frozen — the whole sarcomere at rest under a sentence
         naming one molecule, so the thing a visitor is invited to follow was
         the one thing not on screen. `fiber.md` §13 asks for the myosin
         close-up here and it is right: the wash closes from this shot, and what
         it closes on should be the subject of the question it is carrying.
         Ending on a close-up is safe — `FiberScene` returns the camera to the
         level's own framing whenever a pass stops, however it stops. */
      ms: 4000,
      ...closeOn("atp-head", HEAD_STANDOFF),
      /* NO FOCUS — as above (FIBER pace 5). */
      seek: first.frameAt ?? first.at,
      speed: secondsPer(0.85, 4000),
      atp: true,
      bridge: true,
      line: "Every one of those pulls spent **ATP**. Follow that energy.",
    },
  ]);
}

/**
 * The five demonstrations a press plays, after the pass has run.
 *
 * WHY THIS IS A SEPARATE STORYBOARD. It used to be the same array, cut up by
 * `stepsOf` on each beat's `focus`, which meant one sequence had to be both a
 * lesson in order and a set of independent answers. It cannot be both: the
 * pass's t-tubule beat opens on a question the tropomyosin beat asked three
 * beats earlier, and pressing the t-tubule ring cold played that answer with no
 * question in front of it. Two storyboards, each written for its own job.
 *
 * ONLY PHYSICAL STRUCTURES GET A HANDLE. Myosin, actin, the tube, the store and
 * the cover are things that are there whether or not anything is happening.
 * Phosphate is not: it is a quantity that accumulates, it has no resting state
 * to be told about, and a persistent ring around it would say "this is a
 * component of a sarcomere", which is the wrong idea. It appears in the set and
 * in the comparison and nowhere else.
 */
const FIBRE_PART_STANDOFF = [0.5, 0.45, 2.3];
export function fiberParts(protocol, points = []) {
  /* `partAt` — where the part IS — when the anchor carries one (the fibre level's
     four, 2026-09-07 F2); the plate point otherwise. */
  const closeOn = (id, [dx, dy, dz]) => {
    const a = points.find((p) => p.id === id);
    const at = a?.partAt ?? a?.at ?? [0, 0, 0];
    /* The beacon and the guide's keep-off go where the part is too — with them on
       the plate, the guide sat on the nucleus it was describing. */
    return { lookAt: at, focusAt: at, camera: [at[0] + dx, at[1] + dy, at[2] + dz] };
  };
  const cycle = protocol?.cycle_s;
  const stim = protocol?.stim_s;
  if (!(cycle > 0) || !(stim > 0)) return [];
  const secondBurst = cycle;

  return [
    {
      id: "myosin",
      beats: [
        {
          ms: 4900,
          ...closeOn("myosin", [0.35, 0.3, 2.4]),
          focus: "myosin",
          seek: secondBurst + stim * 0.4,
          speed: secondsPer(0.4, 4600),
          line: "Myosin is the motor. When a binding site opens, it grabs actin and pulls.",
        },
      ],
    },
    {
      id: "actin",
      beats: [
        {
          /* THE POINT THAT IS WORTH THE RING. A first-timer's model of muscle is
             that the parts get shorter. They do not — they slide, and the
             A-band's fixed length is the one claim this whole scale can be
             checked against. */
          ms: 6400,
          ...closeOn("actin", [0.6, 0.5, 4.6]),
          focus: "actin",
          seek: secondBurst,
          speed: secondsPer(cycle, 5600),
          line: "Actin is the track myosin pulls on. The filaments slide past each other. They do not get shorter.",
        },
      ],
    },
    {
      id: "t-tubule",
      beats: [
        {
          ms: 5500,
          ...closeOn("triad-tubule", [0.9, 0.45, 3.1]),
          focus: "t-tubule",
          seek: secondBurst - stim * 0.5,
          speed: secondsPer(stim * 1.6, 5200),
          line: "The T-tubule carries the electrical signal deep inside the fibre, so the whole cell can contract together.",
        },
      ],
    },
    {
      id: "sr",
      beats: [
        {
          /* One whole cycle: release AND refill. The refill is the half a
             viewer never sees otherwise, and it is what makes the store a store
             rather than a source. */
          ms: 6100,
          ...closeOn("sr", [0.7, 0.53, 3.0]),
          focus: "sr",
          seek: secondBurst,
          speed: secondsPer(cycle, 5400),
          line: "This is the calcium store. Each signal releases calcium, then pumps it back in for the next contraction.",
        },
      ],
    },
    /* THE FIBRE LEVEL'S OWN FOUR — 2026-09-07, owner (FIBER pace 7): *"fiber main에서
       you can't really click"*. Pressing one zooms on it and the rest go paper,
       the way the sarcomere's five already do. One sentence each, no numbers. */
    {
      id: "sarcolemma",
      beats: [{ ms: 5200, ...closeOn("sarcolemma", FIBRE_PART_STANDOFF), focus: "sarcolemma", line: "The sarcolemma is the fibre's membrane. The electrical signal runs along it before diving inside." }],
    },
    {
      id: "myofibril",
      beats: [{ ms: 5200, ...closeOn("myofibril", FIBRE_PART_STANDOFF), focus: "myofibril", line: "A myofibril is a strand of sarcomeres end to end. A fibre is packed with them." }],
    },
    {
      id: "myonucleus",
      beats: [{ ms: 5200, ...closeOn("myonucleus", FIBRE_PART_STANDOFF), focus: "myonucleus", line: "A fibre has many nuclei along its length — one cell, made from many that fused." }],
    },
    {
      id: "mitochondrion",
      beats: [{ ms: 4800, ...closeOn("mitochondrion", FIBRE_PART_STANDOFF), focus: "mitochondrion", line: "Mitochondria make the ATP that every pull spends." }],
    },
    {
      id: "tropomyosin",
      beats: [
        {
          /* Before and after in one shot: the beat opens a hair before the
             burst and runs past the cover rolling clear, so the two states are
             the same frame a second apart rather than two descriptions. */
          ms: 5200,
          ...closeOn("tropomyosin", [0.6, 0.5, 4.6]),
          focus: "tropomyosin",
          seek: secondBurst - stim * 0.6,
          speed: secondsPer(0.5, 5200),
          line: "Tropomyosin is the cover. Calcium moves it aside so myosin can reach actin.",
        },
      ],
    },
  ];
}
