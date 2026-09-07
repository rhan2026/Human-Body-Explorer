import { valuesOf } from "../cell/cellChain.js";
import { HERO_IDS } from "./heroNetwork.js";

/**
 * What the guide says on the signalling scale, and which of the twelve it says
 * it beside.
 *
 * WHY THIS IS A WALK AND NOT A TOUR — the same argument as `cellWalk.js`, and
 * the same evidence. `SignallingScale.jsx` stands its storyboard down with
 * `const beats = useMemo(() => [], [])`, because the old pass narrated a census
 * picture of bands that no longer exists and was screenshotted doing visible
 * damage. The owner's instruction is that the character explains, so the words
 * come back with none of what was wrong with them: no camera, no seek, nothing
 * touched in the run, every anchor a `HERO_NODES` id, once on arrival.
 *
 * IT FOLLOWS THE EXERCISE, NOT A TOGGLE. Owner: *"selection은 거의 없고 운동에
 * 따라 다르게"*. `SignallingScale` already maps the movement upstairs to an arm
 * through `workoutMapping.js`; this takes that arm and says what that arm does.
 *
 * ── REWRITTEN 2026-09-02 TO THE CELL SCALE'S SHAPE ──────────────────────────
 * The owner wrote `cellWalk.js` out by hand and every other scale is to match
 * it. The move that makes it work is not the numbers, it is the order: name a
 * thing, say what it DOES, build the expectation the reader already arrives
 * with, and only then show the archive disagreeing. A surprise a reader did not
 * first believe is just a fact. This screen's expectation is handed to us —
 * everybody is taught that lifting builds muscle and running builds
 * mitochondria — and the archive both confirms it upstream and refuses it
 * downstream, which is the whole reason this scale is worth a visit.
 *
 * ── THE PATH I GOT WRONG, AND IT HAD SHIPPED ────────────────────────────────
 * The file this replaces said of AMPK on the resistance arm: *"This one your
 * workout never moves at all"*, and `heroWalk.test.js` guarded that sentence
 * with `max(v) - v[0] === 0`. Both are wrong in the same way. Measured over the
 * shipped `fowler_resistance` samples, AMPK runs 0.0792 → 0.0667: its PEAK is
 * its own first sample, so a peak-minus-start gate reads a clean zero while the
 * series walks steadily DOWNWARD through the back half of the bout. A gate that
 * can only see one direction certified a sentence that is false in the other.
 * Every number here is now measured first-to-LAST, and the gate asks the
 * archive about the end.
 *
 * ── WHAT THE ARCHIVE ACTUALLY SAYS, re-measured 2026-09-02 ──────────────────
 * First sample → last, over the shipped 45-minute runs. `fowler_rest` holds
 * every one of these flat, which is what licenses reading them as the bout:
 *
 *   integrin   R 0 → 1.000        E flat at 0
 *   B_AR, ROS  R flat at 0        E 0 → 0.989
 *   RhoA       R 0.434 → 0.958    E 0.434 → 0.822
 *   JNK        R 0.510 → 0.968    E 0.510 → 0.935
 *   AMPK       R 0.079 → 0.067    E 0.079 → 0.180
 *   PGC_1a     R +25.8%           E +25.7%
 *   Mito_Bio   R +8.2%            E +7.6%
 *
 * So: the doors are clean and opposite, the trunk is shared, AMPK is the one
 * relay that genuinely splits — and PGC-1α, the very next node downstream of
 * it, does not split at all. The ending is then the wrong way round from the
 * story a visitor arrives with, by a margin far too small to be a story of its
 * own. §5: *"거부보다 표시"* — show the gap and say how small it is, rather than
 * picking whichever headline it flatters.
 */

/**
 * @typedef {object} WalkBeat
 * @property {string} id      stable
 * @property {string} anchor  a `HERO_NODES` id
 * @property {string} line    one sentence, present tense, about what is there
 * @property {number} ms      how long it holds
 */

/**
 * Where a series starts and where it ends, over a loaded archive.
 *
 * FIRST-TO-LAST AND NOT FIRST-TO-PEAK, for the reason in the header: a peak is
 * blind to a fall, and one of the claims on this screen is a fall. `peak` and
 * `low` are here because a beat quotes a door that never leaves zero, and
 * "never" is a statement about the whole series rather than about its ends.
 */
function span(run, name) {
  const v = valuesOf(run, name);
  if (!Array.isArray(v) || v.length < 2) return null;
  const nums = v.map(Number);
  if (!nums.every(Number.isFinite)) return null;
  return {
    first: nums[0],
    last: nums[nums.length - 1],
    peak: Math.max(...nums),
    low: Math.min(...nums),
  };
}

/** How far a span ends from where it started, as a percentage of its start. */
const change = (s) => (s && s.first !== 0 ? ((s.last - s.first) / s.first) * 100 : null);

/**
 * @param arm  "resistance" or "endurance" — decided by the movement upstairs
 * @param arms the loaded archives, `{ resistance, endurance, control }`
 * @returns {WalkBeat[]} empty unless both bouts are in: most of these sentences
 *   are comparisons, and a comparison with one side missing is a claim.
 */
export function heroWalk(arm, arms) {
  if (!arms?.resistance || !arms?.endurance) return [];
  /* MEETS BOTH ARCHIVE SHAPES — see `valuesOf`. The first cut read
     `run.series[name]` directly and came back empty against the loader, so this
     scale stayed silent while every gate stayed green, because the gates read
     the bytes off disk. */
  const lifting = arm !== "endurance";
  const mine = lifting ? arms.resistance : arms.endurance;
  const other = lifting ? arms.endurance : arms.resistance;

  const myDoor = lifting ? "integrin" : "B_AR";
  const theirDoor = lifting ? "B_AR" : "integrin";
  const door = span(mine, myDoor);
  const shut = span(mine, theirDoor);
  const jnkMine = span(mine, "JNK");
  const jnkOther = span(other, "JNK");
  /* AMPK IS NAMED BY BOUT, NOT BY "YOURS". Its claim is a DIRECTION — one bout
     raises it, the other lowers it — and a sentence phrased as "yours" would
     flip its own meaning between the two arms while the archive did not. */
  const ampkR = span(arms.resistance, "AMPK");
  const ampkE = span(arms.endurance, "AMPK");
  const jnkE = span(arms.endurance, "JNK");
  const pgcMine = span(mine, "PGC_1a");
  const pgcOther = span(other, "PGC_1a");
  const mitoMine = span(mine, "Mitochondrial_Biogenesis");
  const mitoOther = span(other, "Mitochondrial_Biogenesis");
  const minutes = mine?.protocol?.bout_minutes;

  const spans = [door, shut, jnkMine, jnkOther, ampkR, ampkE, jnkE,
    pgcMine, pgcOther, mitoMine, mitoOther];
  if (spans.some((s) => s === null)) return [];
  const rises = [jnkMine, jnkOther, pgcMine, pgcOther, mitoMine, mitoOther].map(change);
  if (rises.some((n) => n === null || !Number.isFinite(n))) return [];

  const pct = (v) => `${v.toFixed(1)}%`;
  const num = (v) => v.toFixed(3);
  const gap = Math.abs(change(mitoMine) - change(mitoOther));

  return [
    {
      id: "open",
      anchor: myDoor,
      /* THE SEAM WHERE THE SECOND WORKOUT APPEARED FROM NOWHERE. A novice read
         (2026-09-04): *"BODY에서 운동을 하나 고르라고 했고 하나 골랐습니다. 갑자기
         두 개가 됐고 제가 비교하고 있습니다. 아무도 안 물어봤는데요."* The floor
         is a comparison and it has to say so, from the visitor's own choice. */
      line: "You picked one workout. This floor asks what a different one would have done to the same cell.",
      ms: 6600,
    },
    {
      id: "frame",
      anchor: myDoor,
      /* THE STANDING SUBTITLE'S JOB, SPOKEN — owner, 2026-09-05. It read "a
         workout switches on a network inside the cell, and what the network does
         decides how the muscle adapts", which is the frame for everything below
         and was being said in a second voice beside the one saying it. */
      line: "A workout switches on a network inside the cell, and what that network does decides how the muscle changes.",
      ms: 7000,
    },
    {
      id: "clock",
      anchor: myDoor,
      /* A DIFFERENT CLOCK, AND NOBODY SAID SO. The floors above are one set,
         seconds long. This one runs over the session and the hours after it,
         which is why nothing here happens while you watch a repetition. */
      line: "And a different clock. The floors above were one set, seconds long. This plays out over the whole session and the hours after it.",
      ms: 4200,
    },
    {
      id: "door",
      anchor: myDoor,
      /* NAME IT, SAY WHAT IT DOES, THEN SHOW IT WORKING — the owner's own
         order: *"this is atp atp does this -> this is this"*. */
      /* A NOVICE READ (2026-09-04) STOPPED ON THE WORD "door": *"문이 갑자기
         생깁니다. 세포에 문이 있다는 걸 이미 알고 있어야 합니다."* A cell has no
         eyes; what it has is receptors, each shaped for one message. Say that
         once, and every "door" after it lands. */
      line: "A cell cannot see what you are doing. What it has is **doorways** in its surface, each one shaped to let a single kind of message in.",
      ms: 7000,
    },
    {
      id: "mine",
      anchor: myDoor,
      line: lifting
        ? "**Integrin** is the one that answers to being pulled on. Lifting pulls."
        : "**B-AR** is the one that answers to adrenaline, and endurance work floods the muscle with it.",
      ms: 5600,
    },
    {
      id: "opens",
      anchor: myDoor,
      line: "Watch your workout arrive. **That door opens.**",
      ms: 5000,
    },
    {
      id: "shut",
      anchor: theirDoor,
      /* THE OTHER DOOR IS THE POINT OF THE SCREEN and it is measured: on a
         resistance run B_AR is 0.000 at every one of the archive's samples,
         which is why this quotes the peak and not the last value. */
      line: "The other workout's door is right here, and **yours does not open it.** The cell has already told the two apart.",
      ms: 6200,
    },
    {
      id: "relay",
      anchor: lifting ? "RhoA" : "ROS",
      line: lifting
        ? "Past the doorway the message is handed along, one switch to the next, until it reaches a relay called **JNK**."
        /* NOT "B-AR → ROS": the endurance input opens BOTH doors itself, and
           `HERO_LINKS` carries no edge between them. An arrow drawn for
           symmetry is still an invented arrow. */
        : "Past the doorway the message is handed along, one switch to the next, until it reaches a relay called **JNK**.",
      ms: 5600,
    },
    {
      id: "trunk",
      anchor: "JNK",
      /* BOTH BOUTS MOVE THIS ONE. The doors are what differ; almost nothing
         after them is. */
      /* JNK USED TO APPEAR ONCE AND DO NOTHING — the novice read: *"한 번
         등장해서 아무 일도 안 하고 사라집니다. 왜 알려준 건지 모르겠습니다."*
         It is the first place the two routes touch, and that is the whole point
         of it here: the separation the door made does not last. Said that way,
         it sets up the ending instead of decorating the middle. */
      line: "And the other workout's route arrives at **JNK** too. Both of them raise it — the first place the two have anything in common.",
      ms: 7200,
    },
    {
      id: "taught",
      anchor: "AMPK",
      line: "Now the part everybody is taught: lifting builds muscle, running builds staying power. Two workouts, two results.",
      ms: 7000,
    },
    {
      id: "split",
      anchor: "AMPK",
      /* THE ONE CLEAN SPLIT IN THE MODEL, AND IT POINTS DOWNWARD UNDER
         RESISTANCE. The sentence this replaces said resistance "never moves it
         at all"; the archive says it ends below where it began.
         THE DIRECTION IS THE CLAIM AND THE PICTURE CAN SHOW A DIRECTION, so the
         four values that used to be here are gone. What a figure is for on
         these scales is a thing the drawing CANNOT say; "one goes up and the
         other goes down" is not one of those. */
      line: "**AMPK** is the sensor you met one floor down. It is the one relay the two workouts really disagree about. Running raises it. Lifting sends it **the other way.**",
      ms: 8000,
    },
    {
      id: "expect",
      anchor: "PGC_1a",
      /* THE EXPECTATION, AND THE ARROWS ARE THE MODEL'S OWN EDGES — `linksOf`
         resolves AMPK → PGC_1a and PGC_1a → Mitochondrial_Biogenesis against
         the shipped edge list, and the gate re-asks it. */
      line: "AMPK feeds a switch called **PGC-1α**, and PGC-1α tells the cell to build more **mitochondria**.",
      ms: 6100,
    },
    {
      id: "mito",
      anchor: "Mitochondrial_Biogenesis",
      line: "Mitochondria are the parts that burn fuel with oxygen. More of them is what makes you harder to tire out.",
      ms: 6600,
    },
    {
      id: "chainexpect",
      anchor: "PGC_1a",
      line: "So you might expect this: **running turns AMPK up → PGC-1α up → more mitochondria. Lifting does the opposite.**",
      ms: 7200,
    },
    {
      id: "same",
      anchor: "PGC_1a",
      /* THE BREAK. The relay splits cleanly and the very next node downstream
         of it does not split at all. */
      line: "But that is not what happens. PGC-1α rises by **almost exactly the same amount** under both. The relay split. What it feeds did not.",
      ms: 8600,
    },
    {
      id: "out",
      anchor: "Mitochondrial_Biogenesis",
      /* THE MISMATCH, SHOWN. Two bouts that enter at opposite ends of the
         network arrive within a point of each other here — resistance very
         slightly AHEAD, which is the wrong way round from the story. */
      line: "And the thing the whole floor is about — building more mitochondria — **ends up almost the same too.**",
      ms: 6800,
    },
    
    {
      id: "surprise",
      anchor: "Mitochondrial_Biogenesis",
      /* THE OLD ENDING ERASED THE FLOOR'S OWN PREMISE and cost the reader their
         trust in the whole descent. The novice read: *"헬스랑 달리기가 같은
         결과를 낸다는 건 제가 아는 사실과 정면으로 다릅니다 … 마지막 줄을 읽고
         든 생각은 '오, 신기하다'가 아니라 '이 사이트 말을 믿어도 되나'
         였습니다."* They are right and the sentence was overclaiming: what is
         equal here is ONE output of ONE model, not the two workouts. Saying
         which is which costs a line and buys back the floor. */
      line: "That does not mean the two workouts are the same. They plainly are not, and this cell told them apart at the door.",
      ms: 6600,
    },
    {
      id: "scope",
      anchor: "Mitochondrial_Biogenesis",
      line: "It means **this one output is not where the difference shows up.**",
      ms: 4600,
    },
    {
      id: "surprise2",
      anchor: "Mitochondrial_Biogenesis",
      /* THIS USED TO RESTATE THE JNK BEAT AND IT WAS THE LAST THING READ. The
         read: *"열 줄 전에 이미 준 비트로 여정 전체를 끝내는 건 가장 밋밋한
         퇴장입니다."* It also promised a cause it does not have: the other three
         floors each hand back a mechanism under the surprise (phosphate,
         calcium) and this one only has a result. Saying that plainly is worth
         more than a fourth flourish, and CLAUDE.md §5 asks for the mismatch to
         be shown rather than dressed. */
      line: "Where the two workouts actually part company is somewhere else in the cell — and **this model does not draw that part.**",
      ms: 6600,
    },
    {
      id: "scale",
      anchor: myDoor,
      /* WHAT THE INPUT ACTUALLY IS, in the archive's own words:
         *"two dimensionless scalars in [0,1] and a duration. Nothing calibrates
         1.0 against %1RM or %VO2max — no mapping from a real workout exists."*
         A first-year reading a screen that says "your workout" should be told
         once that the model's input is a dial and not a weight. */
      line: minutes
        ? `One thing to know about all of that: the input here is a **dial from 0 to 1**, held for ${minutes} minutes.`
        : "One thing to know about all of that: the input here is a **dial from 0 to 1**, not a weight.",
      ms: 6200,
    },
    
  ].filter((beat) => HERO_IDS.includes(beat.anchor));
}
