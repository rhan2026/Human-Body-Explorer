/**
 * What the guide says to somebody who has just arrived, and what the picture
 * does while it says it.
 *
 * SIX BEATS AND A SILENCE. The walk this replaced had sixteen, and the count was
 * never the problem — ELEVEN OF THEM CHANGED NOTHING ON SCREEN. A visitor read
 * eleven sentences against one unmoving picture and had to take every one on
 * trust. On this floor in particular that is fatal: its whole lesson is that a
 * muscle can be working hard while barely moving, which is exactly the sort of
 * claim nobody believes from a caption. So every beat here carries a `show`, and
 * `MotionScene` performs it — the clock is seeked, the roles are re-weighted,
 * the movement is slowed, the key is revealed, the camera leans.
 *
 * WHAT WENT, AND WHY IT WAS NOT A CUT FOR LENGTH:
 *   - the three "Primary muscles are…" definitions. Not wrong, EARLY. A
 *     definition read before the picture means anything is a vocabulary test,
 *     and the same fact costs one sentence and no memory once somebody has
 *     watched it happen. The role words arrive on the SELECTION CARD now, at the
 *     moment a muscle has been pressed and the visitor wants them.
 *   - the expectation-and-correction pair, the chain, and the crew metaphor.
 *     Three separate novice reads had already rejected the expectation in the
 *     same words — nobody believes a movement uses one muscle — and the metaphor
 *     was standing in for a picture that can now show a team directly.
 *   - every sentence that counted something. Owner, 2026-09-04: *"숫자는 필요가
 *     없어 … 그냥 이해를 돕는거야"*. The picture already says how many: they are lit.
 *
 * WHAT SURVIVED, because it was never about the script:
 *   - WHERE IT STANDS is an anchor NAME, not a coordinate, resolved by the scene
 *     at the moment the beat plays — the hamburger, the body and a lit muscle are
 *     three different layouts at three different widths.
 *   - A beat whose anchor cannot be resolved is SKIPPED rather than drawn at the
 *     origin. A guide standing in the top-left corner talking about something
 *     else is worse than a guide that did not mention it. (This is not
 *     hypothetical: the old `down` beat's anchor lived only inside the ⌘D
 *     inspector, so the one line that said there was anything below this floor
 *     was dropped after twelve missed frames on every single visit.)
 *   - No line claims a result, names a paper, or promises what is below. §5, and
 *     the plainer reason that a guide who oversells the next screen is a guide
 *     you stop believing on the screen after that.
 *   - Nothing here says anything about force, contribution, activation level or
 *     newtons. The role layer is a curated mapping and three weights of
 *     brightness is the whole of what the archive behind this screen carries.
 */

/**
 * @typedef {object} Beat
 * @property {string} id        stable, so a scale can say which one it is on
 * @property {string} anchor    what to stand beside — resolved by the scene
 * @property {string|null} line one sentence, present tense, about what is there
 * @property {string} [until]   the thing that ends this beat, for the scene
 * @property {number} [ms]      how long to hold if nothing ends it
 * @property {object} [show]    WHAT THE PICTURE DOES while this beat is up —
 *   the field this walk was missing. See `bodyWalk` below.
 */

/**
 * WHAT A BEAT DOES TO THE SCENE.
 *
 * The old walk had no such field, and that absence WAS the defect: eleven of
 * its beats changed nothing at all, so a visitor read eleven sentences against
 * one unchanging picture and had to take every one of them on trust. A
 * narration that asserts what the image could have demonstrated is a lecture,
 * and this floor's whole subject — that a muscle can be working hard while
 * barely moving — is precisely the kind of claim nobody believes from a caption.
 *
 * So every beat below carries one of these, and the scene applies it:
 *   seek      "start" | "peak" — where to put the movement clock. "peak" is
 *             resolved by sampling the movement's own effort curve, not typed,
 *             so it lands on the right instant for all six movements.
 *   speed     playback rate while this beat is up.
 *   emphasis  a multiplier per role on top of the shipped role weights. This is
 *             how "the brightest ones drive it" and "these others are holding
 *             you still" are SHOWN: the same picture, re-weighted, twice.
 *   pulse     step the three roles up one at a time so the rule being stated is
 *             visible while it is being read.
 *   legend    reveal the role key.
 *   focus     "primary" — lean the camera toward the biggest prime mover.
 * Anything omitted is left where it was, so a beat only says what it changes.
 */

/** The first line names the visitor's own movement, because "one rep" is wrong
    for a runner and "one stride" is wrong for a swimmer, and a guide that opens
    by mis-naming what you are watching has spent its credibility on beat one.
    Read off the registry's `category` where it can be, so a seventh movement
    inherits an answer instead of needing a new branch. */
export function watchLine(motionId, category) {
  if (motionId === "swimming_freestyle") return "Watch **one stroke cycle**.";
  if (category === "endurance") return "Watch **one stride**.";
  return "Watch **one rep**.";
}

/**
 * The body scale's walk.
 *
 * SIX BEATS AND A SILENCE, down from sixteen. What went is every sentence that
 * defined a term before the visitor had seen the thing it named — the three
 * "Primary muscles are…" definitions, the expectation-and-correction pair, the
 * chain, and the crew metaphor. They were not wrong, they were early: a
 * definition read before the picture means anything is a vocabulary test, and
 * the same fact costs one sentence and no memory once the visitor has watched
 * it happen. The role words now arrive on the selection card, at the moment
 * somebody has pressed a muscle and actually wants to know.
 *
 * @param roles      the chosen movement's role lists, as `muscle-map.json`
 *   stores them — `{ primary: [...], secondary: [...], stabilizer: [...] }`
 * @param movement   `{ id, category, duration }` for the first line and Beat 1's
 *   length; a walk with no movement still runs, it just cannot time one cycle
 * @returns {Beat[]}
 */
export function bodyWalk(roles = null, movement = null) {
  /* A TIER WITH NOTHING IN IT DOES NOT GET EMPHASISED, and a movement with only
     one filled weight has no contrast to show — so it gets the watching beats
     and not the two that stake themselves on a difference between roles. All
     six movements fill all three today; `roleMap.test.js` only guarantees
     `primary`, so this is the guard against a curation change quietly turning
     the floor's discovery beat into a sentence about nothing. */
  const filled = roles
    ? ["primary", "secondary", "stabilizer"].filter((r) => (roles[r] ?? []).length > 0)
    : [];
  const contrast = filled.length > 1;
  /* One clean cycle, from the movement itself. Floored so a very short loop
     still gets long enough to register as a whole movement rather than a
     flicker, and capped so a long one does not hold the walk hostage. */
  const cycleMs = Math.min(7000, Math.max(3000, Math.round((movement?.duration ?? 4) * 1000)));

  return [
    /* BEAT 0 — NO WORDS. The old walk opened by announcing "This is a human
       body", which a human body does not need help saying. A second of the
       movement running with nothing on top of it is what the sentence was for. */
    {
      id: "arrive",
      anchor: "body",
      line: null,
      ms: 1100,
      /* NO SEEK HERE. The scene's clock already starts at zero when it mounts,
         so this one only ever fired ~0.7 s in — a rewind from mid-cycle that
         reads as the body hopping upward right after a refresh (on running,
         head +4.7 cm, mid-stride to the top of the bounce). Beat 1 does the
         seek that matters, and says why. */
      show: { speed: 1 },
    },
    {
      id: "watch",
      anchor: "body",
      line: watchLine(movement?.id, movement?.category),
      /* AND THIS SEEK WENT TOO — 2026-09-06, and it is the last of the hop the
         owner has now reported three times (*"새로고침하면 몸이 살짝 올라간다"*,
         then *"go inside하고 chrome back button 눌러서 돌아가잖아? 그럼 또 위로
         올라가 있어"*).
         The argument for it was real: told to watch one rep and dropped in
         halfway is the beat contradicting itself. What has changed underneath is
         that the walk now runs on EVERY arrival rather than once per tab, and
         every arrival is a fresh mount with the clock at zero — so by the time
         this beat speaks, the visitor is 1.1 s into a rep they watched begin.
         They are watching a whole one; they simply started it a sentence ago.
         Measured before removing it: the rewind moved the head 2.0 cm and, on a
         running stride, snapped the pose from mid-stride to the top of the
         bounce. A jump that size to make a sentence exactly true rather than
         nearly true is the wrong trade, and it is the one the owner keeps
         seeing. */
      ms: cycleMs,
      show: { speed: 1 },
    },
    {
      id: "many",
      anchor: "lit",
      line: "**More than one muscle** is working here.",
      ms: 3800,
      /* The sentence and the reveal are the same event: everything with a part
         to play steps forward, everything without steps back hard. Before this
         beat the body is anatomy; after it, it is a cast. */
      show: { emphasis: { primary: 1.12, secondary: 1.12, stabilizer: 1.12, none: 0.3 } },
    },
    {
      id: "rule",
      anchor: "body",
      line:
        "The colors tell you which muscle groups you're looking at. " +
        "The **brightness** tells you what job they are doing.",
      ms: 7000,
      /* THE RULE IS DEMONSTRATED WHILE IT IS READ. The legend appears and the
         three weights step up one at a time underneath it, so "brightness tells
         you the job" is a thing happening on screen rather than an instruction
         to remember. Nothing recolours — that would break the very rule the
         sentence is stating. */
      show: { legend: true, pulse: true },
    },
    ...(contrast
      ? [
          {
            id: "movers",
            anchor: "lit",
            line: "The **brightest muscles** drive the movement.",
            ms: 5200,
            /* Isolate the primaries, put the clock on the instant the movement
               is working hardest, and lean the camera toward the biggest one.
               The visitor is not told which muscles are primary; they are shown
               which ones are left when the others go quiet. */
            show: {
              emphasis: { primary: 1, secondary: 0.3, stabilizer: 0.2, none: 0.06 },
              seek: "peak",
              focus: "primary",
            },
          },
          {
            id: "holders",
            anchor: "body",
            line:
              "**Working, not moving** — Some muscles create the movement. " +
              "Others work to keep the rest of the body from moving.",
            ms: 7600,
            /* THIS IS THE FLOOR'S WHOLE POINT, and it only lands if the picture
               contradicts the expectation at the same moment. The movers drop
               back, the stabilisers come up, and the movement slows — so what is
               on screen is a set of muscles plainly lit and plainly not going
               anywhere. Said instead of shown, this is the one claim a visitor
               has no reason to accept. */
            show: {
              emphasis: { primary: 0.32, secondary: 0.28, stabilizer: 1.3, none: 0.06 },
              speed: 0.35,
            },
          },
        ]
      : []),
    {
      id: "pick",
      anchor: "lit",
      line: "So a working muscle is **not always a moving muscle**. Press the magnifier on one and we'll follow it inside.",
      until: "picked",
      ms: 9000,
      /* Everything back to its own weight, full speed, and the floor is theirs.
         The legend stays — it is the one thing from the walk that is still
         useful once the walk has gone. */
      show: { emphasis: null, speed: 1, legend: true },
    },
  ];
}

/**
 * Which beats can play right now.
 *
 * THE WALK IS NOT A QUEUE, IT IS A LADDER. A visitor who presses a muscle during
 * beat two has answered the last beat before it played, so anything already true
 * is skipped rather than fast-forwarded.
 *
 * @param state `{ picked, roles, movement }`
 */
export function walkFrom(state) {
  const done = { picked: !!state?.picked };
  return bodyWalk(state?.roles, state?.movement).filter((beat) => !beat.until || !done[beat.until]);
}

/**
 * THE GUIDE DOES NOT COME BACK. One walk per visit, and the scene remembers
 * across a descent and back — measured against the thing that makes an assistant
 * hateful, which is not what it says but that it says it again.
 *
 * `sessionStorage` and not `localStorage`: coming back tomorrow to a screen that
 * assumes you remember it is the other failure. A tab is the right unit for "I
 * have already been shown this".
 */
const SEEN_KEY = "hpe.guide.firstWalk";

/* ONE KEY PER SCALE, added 2026-09-01. The body's walk and the three deep
   scales' walks are four different explanations of four different pictures, and
   a visitor who was walked through the body has not been walked through the
   signalling network. A single key marked all four done the moment the first
   one played. */

export function walkAlreadyDone(key = SEEN_KEY) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    /* A private window throws on access. A guide that cannot remember should
       still run once rather than crash, so the failure means "not seen". */
    return false;
  }
}

export function markWalkDone(key = SEEN_KEY) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* Nothing to do and nothing to say: the walk played, and not remembering it
       is a smaller cost than an error a visitor cannot act on. */
  }
}
