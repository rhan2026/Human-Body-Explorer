import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseHash, currentRoute, onRoute } from "../scaleRoute.js";
import { onTour, runningTour } from "../tourControl.js";

import { readingMs } from "../tour.js";
import { SAY_AGAIN } from "./sayAgain.js";
import { guideArrived } from "./arrived.js";
import { BELL_SAYS } from "./askBell.js";
import { useBellSays } from "../ask/bellSays.js";
import "./guide.css";

/**
 * The guide: a character who walks to the thing being explained and says it.
 *
 * WHY THIS EXISTS, and it is the answer to a complaint the owner made for four
 * days running. The explanation on every scale was a sentence, and the argument
 * was always about where to put the sentence: *"이건 canvas지 table이 아니라고
 * 했잖아"*, *"밑에 박아두지마라 가장 효과적인 위치를 찾아라"*, *"판을 좀 자유롭게
 * 사용해라 — like i hate when things are just stuck at the bottom"*. Every answer
 * moved the words somewhere and every answer was a place.
 *
 * The owner's answer, 2026-09-01: *"쟤가 다니면서 대부분 모든 설명은 쟤가 하는거야"*.
 * The most effective position for an explanation is BESIDE THE THING IT
 * EXPLAINS, and the only way a sentence gets there is if something carries it.
 * So the words stop having a home and get a courier.
 *
 * WHAT IT REPLACES AND WHAT IT DOES NOT. It replaces the tour's own line — the
 * `.fiber__spent` subtitle at the foot of the three deep scales — and takes over
 * the guided pass on the body scale, which never had one. It does NOT replace a
 * plate: a plate is a NAME sitting on the part it names, which is already beside
 * its subject, and canon G1 wants those. Nor does it replace §9's protected copy
 * (loading, progress, error) — a character saying "still loading" is a character
 * a viewer will wait for instead of a message they can act on.
 *
 * ── WHICH SIDE THE CHARACTER STANDS ON, corrected 2026-09-01 ──────────────────
 * The first cut had this exactly backwards and a screenshot caught it: pointing
 * at the pectoral, the character sat 350 px away at the right edge of the stage
 * and THE BUBBLE COVERED THE MUSCLE. The owner: *"얘는 오른쪽이고 말풍선이
 * 왼쪽이고 얘가 어케 돌아다녀야 할지 어케 말할지를 너가 좀 맞춰봐"*.
 *
 * The order is: SUBJECT · CHARACTER · BUBBLE. The character is the near half —
 * it is what points, so it stands next to the thing — and the words trail away
 * from the picture, which is the only arrangement where a bubble long enough to
 * be worth reading cannot land on the subject. The tail then always runs from
 * the bubble back toward the character, i.e. back toward the subject.
 *
 * ── HOW IT MOVES ─────────────────────────────────────────────────────────────
 * It hops. The first cut slid on a critically damped spring — correct for a
 * name plate, wrong for a character, because a thing with a face that glides is
 * a sticker being dragged. The owner: *"좀 얘가 귀엽게 움직이게 하고"*.
 *
 * So travel is an ARC PER STEP, driven by how fast it is actually going rather
 * than by a fixed animation: the spring still decides where it is, and the hop
 * is a function of that speed, so it takes big bounds across a screen and small
 * ones on arrival, and it settles by itself. It squashes on landing and stretches
 * at the top, it leans into the direction it is travelling, and standing still it
 * breathes. THE BUBBLE DOES NOT BOUNCE — text that moves is text nobody finishes,
 * so the hop is on the character alone and the words ride level beside it.
 *
 * AND IT TRAVELS, 2026-09-07. Owner: *"when bell moves around to its designated
 * spot for explanation in the fibre and cell signaling and what not, it almost
 * teleports. make this a bit slower and make movement more natural"*. The spring
 * was the name plate's — omega 14, settled in 235 ms — and a spring's first
 * frame accelerates at omega² times the WHOLE distance: across a stage that is
 * a jump, and the settle was so short there was no middle to the journey. Three
 * bounds now, each a named number: `MAX_ACCEL`, so it leans into a start rather
 * than snapping (and brakes no harder than that either); `MAX_SPEED`, so a
 * crossing has a cruise in the middle of it; and the spring itself at omega 8,
 * so the last stretch is a settle rather than a stop. The bounds are clamped
 * on the VECTOR, not per axis, or a diagonal trip would bend. And the hop
 * cadence is a `STRIDE` — one bound per so many px, off the speed — so it
 * bounds across the stage rather than gliding with a shiver.
 *
 * ── IT CAN BE PICKED UP, 2026-09-06 ──────────────────────────────────────────
 * Owner: *"make a new text bubble that has the same margin width as the
 * character. also, i want to make the character dragable"*. The bubble half is
 * the sheet's (`guide.css`: a CSS bubble beside the character, its tail stopping
 * at the character's frame). The drag is here, and it is the Anatomy Assistant's drag because it
 * is the same problem: pointer capture so one code path serves mouse and finger
 * and so the events never reach the canvas underneath — a drag must not orbit
 * the model — a 3 px dead zone so a tap is not a move, and nothing written to
 * React state per frame. The loop below already owns the box's position and
 * reads the dropped spot per frame like everything else.
 *
 * WHAT A DROP MEANS. The spot becomes where the character waits: it outranks the
 * home corner and the `avoid` dodge — both are guesses about where waiting is
 * free, and the visitor has just said where — and it outranks the beat it was
 * dropped UNDER, too. Owner, later the same day: *"the character should be
 * draggable in all windows"* — the first cut let the anchor win absolutely, so
 * during a beat the character did not follow the finger at all. What a drop
 * does not outrank is the NEXT spot: a new anchor is the character being called
 * somewhere to explain, and it goes, clearing the drop. Nothing is persisted: a
 * new visit starts in the corner, like the assistant's box did.
 *
 * AND WHEN IT IS LET GO, IT DROPS. Owner, same day: *"when i drag and release, i
 * want the character to descend slightly and stop with a 'thud, as if a heavy
 * object has been dropped onto the ground"*. The spring the box travels on is
 * critically damped: it EASES onto its target, and a thing that eases onto the
 * ground has no weight. So the release is not a new spring target. The resting
 * spot is set `DROP` px under the hand, the fall is under `GRAVITY` and stops
 * dead on arrival, and the body takes the hit: compressed in proportion to its
 * landing speed and let back up by a spring of its own that is LESS than
 * critically damped, so it settles with one small rebound — the squash the hop
 * already uses, spent all at once. The words do not move: the bubble is laid out
 * above a body whose transform is its own, so the thud is the character's alone.
 *
 * THE POINT KEPT IS THE CHARACTER'S OWN LEFT EDGE AND FEET, in stage
 * coordinates, not the box's. The bubble may swap sides to find room, and when
 * it does the character has to stay under the finger — a box-relative point
 * would jump it by its own width on every swap.
 *
 * ── SAID, AND PUT AWAY, 2026-09-06 ───────────────────────────────────────────
 * Owner: *"the text bubble should disappear after a few seconds after the
 * appropriate reading time of the text within has past. if the user requests to
 * reshow the text through the text box feature our other agent is working on,
 * then the same content should reappear"*. So a sentence has a life: it pops,
 * it gets `readingMs` (the rule every other line obeys, from `tour.js`, counted
 * from the first letter rather than the last) plus `LINGER_MS`, and then the
 * bubble fades — `--said`, which is not `--hushed`:
 * hushed is having nothing to say and the character dims for it; said is the
 * ordinary end of a sentence and the character does not. The line itself is
 * kept, so `sayAgain()` (`sayAgain.js`, the seam the text box plugs into) brings
 * the same sentence back with its pop for another reading time. A new line
 * always shows: the timer is the sentence's, and starts over with it.
 *
 * ── TYPED, NOT PASTED, 2026-09-06 ────────────────────────────────────────────
 * Owner: *"the text should appear in the text bubble letter by letter, as if it
 * is typed manually. this is aimed to increase legibility and interactiveness"*.
 * `TYPE_MS` a letter, from a clock rather than a counter so a slow frame drops
 * letters instead of stretching the sentence, with a caret while it runs. THE
 * WHOLE SENTENCE IS IN THE BOX FROM THE FIRST FRAME, the untyped part in
 * transparent ink (`typedOut`, `.guide__untyped`): the bubble is as wide as its
 * sentence and the box is placed off its own width, so a bubble growing a letter
 * at a time would re-wrap and walk the character with it. The reading time
 * starts when the typing ends. Anyone who asked for reduced motion gets the
 * sentence whole.
 *
 * ── IT ARRIVES, THEN IT SPEAKS, 2026-09-06 ───────────────────────────────────
 * Owner: *"when it has to move to a designated spot to explain, it should hop
 * onto the spot and the explaining should start when the character has arrived
 * at the spot"*. The line used to change the frame the beat did, with the
 * character still crossing the stage — the words said "this one" from the far
 * side of the picture. Now a new line waits in `pending`, the bubble hides for
 * the trip (`--going`), and the loop hands the line to `shown` the frame the
 * character is within `ARRIVE` px of its target and no longer moving — and not
 * while it is being held or is falling, either: a sentence begins where the
 * character stands, so it begins when the character stands. The reading time,
 * the typing and the fade all start from that frame, which is what they mean —
 * and so does the BEAT: the guide says `guideArrived()` on that frame
 * (`arrived.js`), and `useWalk` starts the beat's patience on it rather than on
 * the beat's own start, so a sentence gets its `ms` standing still.
 *
 * ── AN ANSWER, HANDED IN, 2026-09-07 ─────────────────────────────────────────
 * Owner: *"lets make the visuals for the user text box first"*. The question
 * box (`AskBell.jsx`) sends through `askBell`; whatever answers sends back
 * through `bellSays` (`askBell.js`), and that lands here as an ASIDE: a line
 * from outside the walk, said where the character stands, at once — no trip,
 * because nobody named a spot — typed, timed and faded like any other line. The
 * walk's next beat supersedes it (a new `line` clears the aside), so an answer
 * never talks over the narration for longer than the narration allows.
 */

/** The spring, critically damped, omega 8 rad/s: ~0.7 s to settle the last
    hundred pixels. Was 14 — the name plate's, ~235 ms — and that was the
    teleport (owner, 2026-09-07). The plate is a label and may snap; a thing with
    a face arrives. */
const W = 8;
/** How fast it may travel, in px/s. The bound that gives a crossing a middle:
    at 560 a 1280 px stage is a 2.3 s journey, a 300 px hop to the next muscle
    about 0.7 s with the ramps. */
const MAX_SPEED = 560;
/** How hard it may accelerate or brake, in px/s². At 3000 it reaches full
    speed in under 0.2 s — a lean and a push, not a snap — and the braking a
    critically damped omega-8 spring asks for from full speed (~850) is well
    under it, so the bound never causes an overshoot. */
const MAX_ACCEL = 3000;
/** One bound per this many px of travel. The hop's phase advances at
    speed / STRIDE, so it takes more bounds when it goes further, not longer
    ones — long low bounds read as gliding. */
const STRIDE = 120;
/**
 * The picture the guide stands on. `.stage` IS THE FRONT DOOR'S, ADDED 2026-09-06
 * WITH BELL. Without it the explorer's guide fell through to `document.body` and
 * took its home corner off the WINDOW rather than off the picture — the same
 * class of bug as a home computed once: the character stands where the corner
 * would be if the stage were the page, and it is not.
 */
const stageOf = (el) => el?.closest(".press__stage, .fiber__stage, .stage") ?? document.body;
/** How far the character stands from the point it is talking about, in px.
    Close enough to read as "this one", far enough not to cover it. */
const REACH = 58;
/** Height of a bound, in px, at full stride. */
const HOP = 18;
/** Speed, in px/s, above which it is travelling rather than standing. */
const MOVING = 26;
/** How close to the stage's own edge the box may come, in px. */
const PAD = 12;
/** How far a beat's spot must move, in px, to be a NEW spot — one worth hiding
    the bubble for the trip and clearing a drop for. `useWalk` re-aims an anchor
    every 50 ms and the body moves under a rep, so a spot drifts; the spring
    follows a drift with the words up, and only a real move is a trip. */
const RETRIP = 24;
/** The air between Bell's feet and the top of its question box, in px, when
    it stands at home on top of the box (see the home note in the loop). */
const ON_BOX = 10;
/**
 * THE APP'S OWN FURNITURE, WHICH BELL MAY NOT COVER — owner, 2026-09-07: *"bell
 * should not overlap with other elements in the window, like user text box,
 * graphs, buttons. it can overlap with the figures when it moves around to
 * explain stuff"*.
 *
 * Everything a visitor reads or presses, and nothing they are being shown. The
 * canvas is deliberately absent: the picture is the subject, and a guide that
 * may not cross it could not walk to anything on it.
 *
 * `.ask` is here even though home stands ON it — Bell's feet sit `ON_BOX` above
 * its top, so the two never overlap at rest, and this is what keeps a BEAT from
 * parking the bubble across the box on its way past.
 */
const CHROME = [
  ".shell-title", // the floor's name and the exercise picker
  ".ways", // Pause, the way up, Go Home
  ".ask", // the question box
  ".evidence", // the paper and its graphs
  ".opacity-dock", // the muscle and skeleton sliders
  ".menu-trigger", // the hamburger
  ".press__view", // the motion floor's view toggle and its panel
  ".scale-time", // SIGNALS' run scrubber
].join(", ");

/** How near its target the character must be, in px, to count as arrived and
    start speaking. Under the spring's last few pixels, which it covers in the
    time a bubble takes to pop. */
const ARRIVE = 3;
/** One letter, in ms. ~36 a second — a quick typist; slow enough to be seen
    arriving, fast enough that a reader is never waiting on it. */
const TYPE_MS = 28;
/** How long the bubble stays after its sentence has been read, in ms. Owner:
    *"a few seconds after the appropriate reading time"* — the reading time is
    `readingMs` at 3.3 words a second; this is the few seconds. 3000, then 1000
    (*"the text box could disappear 2 seconds earlier compared to rn"*), then
    500 with the double-count below (*"text bubble dissappear 2 seconds
    faster"*). */
const LINGER_MS = 500;
/** How far the character falls when let go, in px. A drop, not a fall: enough
    to be seen leaving the hand, not enough to land somewhere else. */
const DROP = 18;
/** Gravity for that drop, in px/s². Earth at this scale (1 m ≈ 900 px) would be
    ~9,000 and over in 60 ms — read as a snap, not a drop. 2,600 lands 18 px in
    ~120 ms at ~300 px/s, which is fast enough to have weight and slow enough
    to be watched. */
const GRAVITY = 2600;
/** The landing squash's spring: omega 26 rad/s and a damping ratio of 0.5, so
    the body comes back up through neutral once, a little, before it settles —
    the difference between a thing that has stopped and a thing that has hit. */
const THUD_W = 26;
const THUD_Z = 0.5;
/** How close the box's foot may come to the stage's, in px.
 *
 *  WAS 40 AND IT OUTRANKED THE HOME CORNER. `HOME_Y_WIDE` is what says where
 *  Bell waits, and this clamp sat under it: measured 2026-09-06, lowering the
 *  home from 26 to 8 moved the box not at all, because `Math.min(r.height - 40,
 *  …)` had already decided. Owner: *"bell 더 오른쪽 더 밑으로 왼쪽에 slider랑
 *  비슷한 레벨로"* — the left dock stands at `bottom: 18px`, so that is the line
 *  the two share. A clamp that quietly wins over the value it is clamping is a
 *  knob nobody can turn.
 */
const FOOT = 18;

/**
 * `**like this**` comes out bold.
 *
 * WHY A WALK NEEDS IT AT ALL. The owner wrote the cell scale's narration out by
 * hand, 2026-09-01, and every term a reader meets for the first time is bold in
 * it — ATP, PCr, ADP, AMP, AMPK, CaMKK2 — with the surprise bold at the end. A
 * paragraph explaining six new nouns to somebody who knows none of them needs
 * to say which word is the new one; flat text makes the reader find that out by
 * reading twice.
 *
 * TWO ASTERISKS AND NOTHING ELSE. Not a markdown renderer — this is one span in
 * one bubble and the only thing a walk beat has ever wanted is a word picked
 * out. Anything more is a parser nobody asked for, and a parser is a thing that
 * can be wrong about a sentence.
 *
 * AND IT TYPES. The first `n` visible letters are shown; the rest are PRESENT
 * in transparent ink (see the header), so the box has its final width and line
 * breaks from the first frame. The caret rides the boundary and takes no width
 * (the sheet pulls its 2 px back), so it cannot move a word to the next line.
 */
/* A TITLE, WHEN A BEAT EARNS ONE — 2026-09-07, owner: *"title을 다 쓰지는 말고
   진짜 중요할 때는 써도 돼"*. `**TITLE** — sentence` puts the title on its own
   line above the sentence (`.guide__title`); anything else in `**` is a term,
   bold with a marker (*"색깔도 살짝"*). The markup stays the one the storyboards
   already use. The title is typed first, then the sentence — one clock, and the
   " — " between them is markup, so it is neither typed nor counted. */
const TITLED = /^\*\*([^*]+)\*\* — (.+)$/s;
const plain = (line) => (typeof line === "string" ? line.replace(TITLED, "$1$2").replace(/\*\*/g, "") : "");

function typedOut(line, n) {
  /* Hushed and silent beats hand a null through; there is nothing to type. */
  if (typeof line !== "string") return line;
  const titled = TITLED.exec(line);
  if (titled) {
    return [
      <span className="guide__title" key="t">{typedOut(titled[1], n)}</span>,
      ...typedOut(titled[2], n - titled[1].length),
    ];
  }
  const done = n >= plain(line).length;
  let left = n;
  return line.split(/\*\*/).map((part, i) => {
    const seen = part.slice(0, Math.max(0, left));
    const rest = part.slice(seen.length);
    const caret = !done && left >= 0 && left <= part.length && rest !== "" ? <span className="guide__caret" aria-hidden="true" /> : null;
    left -= part.length;
    const term = i % 2 === 1;
    const node = (
      <>
        {/* THE MARKER RIDES THE LETTERS, NOT THE WORD — 2026-09-07. Owner: *"the
            yellow underscore appears before the text is written. make it so that
            the yellow underscore appears simultaneously with the word
            highlighted"*. It did: the whole sentence is in the box from the
            first frame so the width never re-wraps, and the highlighter was on
            the `<b>`, which spans the untyped remainder too — so the stripe was
            drawn under letters that had not arrived. It goes on the TYPED half
            instead, an inline span whose background is only as wide as its own
            text, so the yellow grows one letter at a time with the word.
            THE PADDING STAYS ON THE `<b>`: it is width, and width that changed
            while typing would re-wrap the sentence, which is the one thing this
            whole design exists to prevent. */}
        {term ? <span className="guide__mark">{seen}</span> : seen}
        {caret}
        {rest && <span className="guide__untyped">{rest}</span>}
      </>
    );
    return term ? <b className="guide__term" key={i}>{node}</b> : <span key={i}>{node}</span>;
  });
}

/**
 * `clear` — circles in the SAME stage pixels as `at`, that Bell must not sit on.
 *
 * OWNER, 2026-09-06, on ENERGY: *"In the resting/main state, the right-bottom
 * guide house + bubble still sit on top of the CaMKK2 region … this is still
 * the main visible problem in ENERGY"*, and they named the fix — *"use focus
 * object bounding box, use bubble bounding box avoidance, choose opposite
 * quadrant"*.
 *
 * WHY A PROP AND NOT A SELECTOR. The thing being covered is not in the DOM. It
 * is a molecule in a WebGL scene, and the only place that knows where it landed
 * this frame is the render loop that drew it — which is exactly where the beat
 * anchors are already projected, into `guideRef`, for `at`. So this arrives the
 * same way `at` does, through the same `useAim` poll, in the same coordinates.
 *
 * AND IT IS FOR REST, WHICH IS THE HALF THAT HAD NOTHING. While a beat plays,
 * `at` is the subject and the scoring already keeps off it. At rest there is no
 * anchor at all, so Bell goes to its home corner and whatever the floor left in
 * that corner is covered — measured 1280x800: the bubble across CaMKK2, and on
 * SIGNALS the zone legend before `data-guide-clear`. `avoid` cannot serve here:
 * it also walks the home corner sideways by the element's width.
 */
/**
 * `avoid` — a selector for something that shares Bell's home corner.
 *
 * MEASURED 2026-09-06 on the body with a muscle picked: Bell's box is
 * 784-1126 x 555-760 and the selection card's is 1028-1260 x 515-668. They
 * overlap, and both belong there — the corner is Bell's job (it is the one the
 * Anatomy Assistant held) and the card is what the visitor just asked for by
 * clicking.
 * SO BELL STEPS ASIDE, AND ONLY AT HOME. A beat's anchor is a claim about where
 * to look and must not be moved; the home corner is where Bell waits, and
 * waiting somewhere else is free. A spot the visitor dragged it to is neither:
 * it is where they said to wait, and the dodge does not apply there.
 * A SELECTOR RATHER THAN A NUMBER because the card's width is the card's — it
 * grows with a longer muscle name, and a constant here would be right for
 * "Pectoralis major" and wrong for "Sternocleidomastoid".
 */
/**
 * WHAT IT SAYS WHEN NOTHING ELSE IS SPEAKING — 2026-09-06. Owner, of the three
 * floors below the front door: *"다 bell never dies always points at next
 * action"*.
 *
 * It never died — `visible` has been unconditional since 2026-09-02 — but it
 * went SILENT the moment a pass ended, because every line it has ever spoken
 * belonged to a beat: `tourLine ?? walk.line ?? opener`, and when the storyboard
 * finishes all three are null. So a visitor who watched the whole pass was left
 * with a character standing in the corner with nothing to say, on a floor whose
 * next move — press a part, turn the path off, go deeper — is the one thing the
 * screen does not spell out anywhere else.
 *
 * ONE LINE PER FLOOR, AND IT IS THE NEXT ACTION, not a description of the
 * screen. §9 lets in exactly what is happening now and the owner asked for this
 * one, so it is a verb and a target and nothing else.
 *
 * READ OFF THE HASH RATHER THAN PASSED IN. This component is the one piece of
 * chrome on all four surfaces, and the hash is what says which floor it is
 * standing on — so no floor has to remember to hand it a line, and a floor that
 * is added gets a sentence by being in the map rather than by editing its own
 * page. It is also the only way to do this without editing two files that
 * another lane is in the middle of.
 */
/** How much better another corner has to be before the character moves. Squared
    pixels of overlap: about a tenth of a small plate, so a real collision moves
    it and a shifting anchor does not. */
const HOLD_CORNER = 900;
/** What a corner costs per pixel it would have to travel to reach. Owner,
    2026-09-07: *"why does bell go to a random corner when it explains? center
    bell around the model when it explains"*. All four candidates sit within a
    reach of the subject, so every one of them IS around the model — but with
    only coverage to go on, two corners that cover nothing scored the same and
    the winner changed from beat to beat, which is what reads as random. Costing
    the walk makes the near side of the subject the default, so Bell circles the
    thing it is talking about instead of crossing the picture to say the next
    sentence. Kept under `HOLD_CORNER`, so the corner it is already standing in
    still wins a close call. */
const TRAVEL_COST = 3;

const RESTING = Object.freeze({
  body: "Press the magnifier on a muscle to go inside.",
  fiber: "Press a part to see what it does — or the magnifier to go deeper.",
  cell: "Try turning the calcium path off.", /* the magnifier is offered once the comparison has played — CellScale hands the second prompt (owner, cell C3) */
  signalling: "Press any part of the network to see what it does.",
});

export default function Guide({ at: anchor, line, name = null, visible = true, announce = true, avoid = null, clear = null, hush = false, onDone = null, resting: restingProp }) {
  const box = useRef(null);
  const body = useRef(null);
  const pos = useRef(null);
  const vel = useRef({ x: 0, y: 0 });
  const phase = useRef(0);
  const clock = useRef(0);
  const raf = useRef(0);
  /* WHICH SIDE THE BUBBLE IS ON, AND THE LOOP OWNS IT — not React.
     Owner, 2026-09-07: *"the character is facing issues when dragged the icon
     oscillates like crazy"*. Measured on a drag across the stage: the frame the
     side decision flipped, the character teleported 290 px and back.
     The box is one flex row and the side class decides which END the character
     sits at, so a flip moves the character by the bubble's width; the loop
     cancels that by moving the BOX the other way. Both have to happen in the
     same paint, and while the class came from React state they could not —
     the loop writes the transform in its own frame and React commits the class
     in another, so one paint always showed the new class against the old
     transform. Freezing the side while held only moved the flash to the
     release; measuring `offsetLeft` only moved it a frame.
     So the class is written here, beside the transform, from the same decision.
     It is the same argument the drag already makes about state: a per-frame
     visual is not something to route through a render.
     THE LAYOUT EFFECT BELOW IS WHY THIS SURVIVES A RENDER. React sets
     `className` wholesale, so any re-render (a new sentence, the fade, the
     thinking dots) would drop a class the loop had added. It runs after EVERY
     commit — no dependency array on purpose — and before paint, so the class
     the loop chose is put back without a frame in between. */
  const sideRef = useRef("right");
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.classList.toggle("guide--right", sideRef.current === "right");
    el.classList.toggle("guide--left", sideRef.current !== "right");
    /* AND THE BOX FOLLOWS THE CHARACTER IN THIS PAINT, NOT THE NEXT ONE.
       The bubble appearing, going quiet or fading is React's doing, and it
       changes the row's width in the commit; the loop's transform is written a
       frame later. One paint of the new layout under the old transform moves
       the character by a whole bubble — measured at up to 2,800 px/s against a
       walking pace of 560, which is the owner's *"teleports somewhere else"*.
       The loop already positions by the character (see it); this is the same
       arithmetic, run where the layout just changed. */
    if (pos.current && body.current) {
      el.style.transform = `translate3d(${pos.current.x - body.current.offsetLeft}px, ${pos.current.y}px, 0)`;
    }
  });
  /** WHETHER IT STANDS ABOVE OR BELOW ITS SUBJECT, the other half of the corner
      the scoring below picks. A ref for the reason `sideRef` is: the loop
      re-picks it every frame, and the hysteresis needs last frame's answer. */
  const below = useRef(false);
  const [shown, setShown] = useState(null);
  /* On its way somewhere with something to say: the bubble hides for the trip.
     Not `--hushed` — that is having nothing to say, and dims the character. */
  const [going, setGoing] = useState(false);
  /* The floor's own next-action line, used only when nothing else is speaking.
     Recomputed on every route change so climbing back up changes what it says. */
  const [scale, setScale] = useState(() => parseHash(currentRoute()).scale);
  useEffect(() => {
    const read = () => setScale(parseHash(currentRoute()).scale);
    return onRoute(read);
  }, []);
  /* A floor may hand its own prompt, or `null` for none — `undefined` alone falls back to the map (CellScale hushes the prompt while its comparison plays, 2026-09-07). */
  const resting = restingProp === undefined ? RESTING[scale] ?? null : restingProp;
  /* AND A SILENT BEAT IS SILENT — 2026-09-06. The resting line is the answer to
     "the pass ended and the character has nothing to say"; it is the WRONG
     answer to "the pass is running and this beat says nothing on purpose".
     SIGNALS leaves two beats wordless (1.4 s and 2.2 s) so the camera has room,
     and a prompt to press something is exactly what must not appear in them.
     READ FROM `tourControl`, NOT FROM A PROP, for the same reason Skip is: this
     component is mounted by each floor's page and the pass runs inside that
     floor's canvas, so a prop would mean editing three pages. */
  const [pass, setPass] = useState(() => runningTour());
  const passing = !!pass;
  useEffect(() => onTour(setPass), []);
  /* Whether the sentence on screen is the pass's own rather than an answer the
     visitor asked for. The arrow is the pass's control and must not appear on a
     reply — owner, 2026-09-07: *"voluntary inqueires from the user should
     function as it is now"*. */
  const [fromAside, setFromAside] = useState(false);

  /* THE LINE CHANGES ON A BEAT, THE POSITION EASES BETWEEN THEM — AND THE WORDS
     WAIT FOR THE POSITION. Keeping the text in state and the position in a ref
     is deliberate: the words are a discrete thing a reader reads, and
     re-rendering sixty times a second to move a box is what the 10 Hz readout on
     the body scale was doing wrong. The latest line sits in `pending`; the
     animation loop, which is the only thing that knows where the character IS,
     moves it into `shown` on arrival (see the header). `shownRef` mirrors the
     state for the loop, whose closure is older than the last render. */
  const pending = useRef(null);
  const shownRef = useRef(null);
  const goingRef = useRef(false);
  /* The aside — an answer handed in through `bellSays`. Outranks the walk's
     line until the walk's NEXT line, which clears it. */
  const aside = useRef(null);
  /* WHAT IT HAS TO SAY, decided here and queued for the loop. The beat's line
     if there is one; otherwise the floor's resting prompt — unless a pass is
     running (a wordless beat is wordless on purpose) or the floor has hushed it.
     `hush` — THE FLOOR SAYS: NOTHING, RIGHT NOW. Added 2026-09-07 for ENERGY's
     pull-back: the 1.2 s in which the camera retreats before the ride to
     SIGNALS, during which the resting prompt was still up — "then press the
     magnifier", to a visitor who had just pressed it. The character stays
     (owner: *"캐릭터는 항상 보여야돼"*); only the words go. */
  /* A WORDLESS BEAT IS NOT AN INSTRUCTION TO GO QUIET — 2026-09-07. Owner, of
     SIGNALS: *"the first two text dialogues bell tells the user dissapears
     almost immediately after it is shown"*. Measured: the first sentence stood
     for 1.6 s and vanished. SIGNALS leaves beats wordless on purpose, "so the
     camera has room", and `said` is null through them — so a sentence was being
     cleared by a beat that had nothing to say instead of by its own reading
     time. A pass that says nothing is not a pass that says stop: the last
     sentence stays and retires on its own clock (`--said`).
     HUSH IS STILL HUSH. A floor asking for silence (ENERGY's pull-back) means
     it, and so does the end of the pass, where `resting` takes over with a line
     of its own. Only the silent beat holds the last one. */
  const holdLast = useRef(false);
  useEffect(() => {
    const said = hush ? null : line ?? (passing ? null : resting);
    holdLast.current = !hush && passing && !line;
    pending.current = said;
  }, [line, hush, passing, resting]);
  useEffect(() => {
    aside.current = null;
  }, [line]);
  useEffect(() => {
    const told = (event) => {
      aside.current = typeof event.detail === "string" && event.detail.trim() ? event.detail : null;
    };
    window.addEventListener(BELL_SAYS, told);
    return () => window.removeEventListener(BELL_SAYS, told);
  }, []);

  /* SAID, AND PUT AWAY — see the header. `said` is the bubble having had its
     reading time; `again` counts the asks, and keys the sentence's span so the
     pop replays on each. Both start over with every new line. */
  const [said, setSaid] = useState(false);
  const [again, setAgain] = useState(0);
  /* How many letters of `shown` are in ink. Driven by a clock in the effect
     below; identical values are dropped by React, so a frame with no new letter
     costs no render. */
  const [count, setCount] = useState(0);

  useEffect(() => {
    setSaid(false);
    if (!shown) return undefined;
    /* THE TYPING IS NOT SPENT BEFORE THE READING STARTS — 2026-09-07. This was
       `typingMs + readingMs + LINGER`, which charges twice for the same words:
       the letters arrive one at a time and are read as they land, so by the
       last letter the sentence has already been read down to its last few
       words. The reading clock runs from the FIRST letter now, which is what a
       reader actually does.
       It cannot fade mid-sentence, and that is arithmetic rather than luck:
       typing costs TYPE_MS a character and reading costs about 50 ms a
       character (1000 / 3.3 words a second, over a word and its space), so the
       reading time outlasts the typing for any sentence whose words average
       under about eleven characters. `guideTypes.test.js` holds that margin. */
    const done = setTimeout(() => setSaid(true), readingMs(shown) + LINGER_MS);
    return () => clearTimeout(done);
  }, [shown, again]);

  useEffect(() => {
    const total = plain(shown).length;
    /* Less motion asked for: the sentence, whole, at once. */
    if (!shown || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setCount(total);
      return undefined;
    }
    setCount(0);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const n = Math.min(total, Math.floor((now - t0) / TYPE_MS));
      setCount(n);
      if (n < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, again]);

  useEffect(() => {
    const ask = () => setAgain((n) => n + 1);
    window.addEventListener(SAY_AGAIN, ask);
    return () => window.removeEventListener(SAY_AGAIN, ask);
  }, []);

  /* ── THE API LANE'S ONE BLOCK, 2026-09-07 ─────────────────────────────────
     Owner, to the other session: *"make the visuals for the user text box
     first. then the api and claude connection the other agent will do it"*.
     The answer itself arrives through `bellSays` above and is typed like any
     line — that is the talking. What the box cannot say on its own is the
     WAIT and the FAILURE: `ask/AskBridge.jsx` puts the one store `ask/bellSays.js`
     into `thinking` while the model runs and into `error` when it cannot, and
     while it holds either the bubble shows that instead of the line — the
     dots, or the error line (§9: never faded, cleared by the next question).
     It is never hidden for a trip (`--going` yields) and never put away on the
     line's clock. Idle is the whole of the rest, untouched. */
  const says = useBellSays();
  const answering = says.status !== "idle";

  /* PICKED UP — see the header. `held` is the drag in progress (pointer id, the
     grip's offset from the character's left edge and feet, and whether it has
     moved 3 px yet); `parked` is where the character was last put down, as its
     own left edge and feet in stage coordinates, or null for the corner. Both
     are refs: the animation loop reads them per frame, and a render per
     pointermove is exactly the churn the 3D page next door cannot afford. */
  const held = useRef(null);
  const parked = useRef(null);
  /* The fall after a release ({ vy }, or null), and the landing squash — a
     spring on the body's vertical scale, `s` below zero while compressed. */
  const fall = useRef(null);
  const thud = useRef({ s: 0, v: 0 });

  /* A NEW SPOT CLEARS THE DROP; THE SAME SPOT DOES NOT. By distance, not
     identity: an anchor is re-aimed every 50 ms and drifts with the body, and a
     drift must neither tear the character out of the visitor's hands nor count
     as a trip. Gaining or losing an anchor is always a move. */
  const lastSpot = useRef(null);
  /* A spot it has not stood on yet. Set by a new anchor (or losing one — the
     walk home is a trip too), cleared by the loop on arrival. While it is set
     the bubble hides, even if the line has not changed: the words are said
     where the character stands, not carried across the stage to the next spot
     — which is what happened on the body walk when a beat moved the anchor a
     render before it moved the line (watched 2026-09-06). */
  const moved = useRef(false);
  useEffect(() => {
    const was = lastSpot.current;
    const now = anchor ? { x: anchor.x, y: anchor.y } : null;
    const far = !was !== !now || (was && now && Math.hypot(was.x - now.x, was.y - now.y) > RETRIP);
    if (far) {
      if (now) parked.current = null;
      moved.current = true;
    }
    lastSpot.current = now;
  }, [anchor]);

  const pickUp = (event) => {
    // One drag at a time, by the first finger down: a second touch must not
    // steal the character or leave two captured pointers fighting over it.
    if (held.current || event.isPrimary === false) return;
    const rect = body.current.getBoundingClientRect();
    held.current = {
      id: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.bottom,
      x0: event.clientX,
      y0: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const carry = (event) => {
    const grip = held.current;
    if (!grip || event.pointerId !== grip.id) return;
    if (!grip.moved && Math.hypot(event.clientX - grip.x0, event.clientY - grip.y0) < 3) return;
    grip.moved = true;
    const r = stageOf(box.current).getBoundingClientRect();
    parked.current = { x: event.clientX - grip.dx - r.left, y: event.clientY - grip.dy - r.top };
  };

  const putDown = (event) => {
    const grip = held.current;
    if (!grip || event.pointerId !== grip.id) return;
    held.current = null;
    if (grip.moved && parked.current) {
      /* LET GO: the ground is DROP under the hand, and the loop takes it there
         under gravity — see the header. A tap (never moved) drops nothing. */
      parked.current = { x: parked.current.x, y: parked.current.y + DROP };
      fall.current = { vy: 0 };
    }
  };

  /* WHERE IT STANDS WHEN IT HAS NOWHERE TO BE. Owner, 2026-09-02: *"캐릭터는
     항상 보여야돼"* — they left the body scale mid-narration, picked a different
     workout, and the character was gone. It was gone because it only ever
     existed while a beat was playing: `visible={walk.running}` and, here,
     `if (!at) return null`. A guide that vanishes when it stops talking is a
     tour, and the owner asked for an inhabitant.
     So a beat's anchor is now where it GOES, not what keeps it alive. With no
     beat it walks to the bottom-right of its own stage and waits there, hushed —
     `guide.css` already drops the bubble and dims the character for exactly that
     state, which is the shape this needed and it was already built.
     BOTTOM-RIGHT because that is the corner the Anatomy Assistant used to hold,
     and the character is taking that job. */
  /* MOVED OUT AND DOWN, 2026-09-06. Owner, walking it: *"bell 더 오른쪽 더 밑으로
     왼쪽에 slider랑 비슷한 레벨로"* — the left dock sits at `bottom: 18px`, and
     Bell was floating well above and inside it (measured: box 784-1126 x
     555-760 in an 800px window, so 40 up from the foot and 154 in from the
     right). The two are the same kind of furniture and should stand on the same
     line.
     AND OUT AGAIN, same day: *"bell더 오른쪽으로"*. 52 still left 110 px of
     paper past the character; 24 puts it as near the edge as the clamp `PAD`
     allows without the bubble's shadow running off. */
  const HOME_X = 4;
  /* HOW FAR UP THE HOME CORNER SITS, AND IT IS TWO NUMBERS BECAUSE A PHONE PUTS
     FURNITURE THERE — 2026-09-05.
     26 px is right on a wide stage: the bottom-right corner is empty and the
     character waits in it. At 390 px it is not empty. Every deep floor stacks
     its controls along the foot at that width — measured on SIGNALS, the
     timeline, SHOW and TRACE occupy the bottom 111 px of a 734 px stage — and
     the ENERGY lane reported the same collision on its own floor, the
     character's feet about 10 px into its controls.
     RAISED RATHER THAN MOVED SIDEWAYS: the corner is the job (it is the one the
     Anatomy Assistant held, per the note above) and a character that changes
     corners with the window is a character a viewer has to find again. It
     stands in the same corner, higher up, above what a phone puts under it.
     READ PER FRAME with the rest, for the reason the note below gives — a home
     computed once is a character standing where the corner used to be. */
  const HOME_Y_WIDE = 8;
  const HOME_Y_NARROW = 150;
  /* AND SINCE 2026-09-07 THE CORNER HOLDS THE QUESTION BOX, AND BELL STANDS ON
     IT. Owner: *"i want the text box to be on the bottom right corner, where
     bell's default position is right now ... thus, bell's default would have to
     move somewhere else"*. Somewhere else is on top of the box: the corner
     stays Bell's corner, and a character perched on its own question box reads
     as the box being its. The box's top is read PER FRAME in the loop, like
     the dodge — the box steps above two floors' furniture and folds to a pill
     on a phone — and the two numbers above stay as the floor under it. */

  useEffect(() => {
    if (!visible) return undefined;
    const stage = stageOf(box.current);
    let prev = 0;
    const step = (now) => {
      const el = box.current;
      if (!el) return;
      const dt = Math.min(0.05, prev ? (now - prev) / 1000 : 1 / 60);
      prev = now;
      clock.current += dt;

      const r = stage.getBoundingClientRect();
      const w = el.offsetWidth || 200;
      const cw = body.current?.offsetWidth || 0;
      /* Read per frame like everything else here: the stage resizes, and a home
         computed once is a character standing where the corner used to be. */
      const floorY = r.width <= 560 ? HOME_Y_NARROW : HOME_Y_WIDE;
      /* On top of the question box, wherever its top is this frame; never
         lower than the floor's own minimum (a phone stacks controls there). */
      const askBox = document.querySelector(".ask")?.getBoundingClientRect();
      const homeY = Math.max(floorY, askBox ? r.bottom - askBox.top + ON_BOX : floorY);
      /* CENTRED ON ITS QUESTION BOX — owner, 2026-09-07: *"move bells default
         position to the center of the text box, same y coordinates"*. Home used
         to be a SUBJECT point at the stage's right edge that Bell walked up
         beside; it is a spot for the CHARACTER itself now, read off the box
         every frame exactly as the height above it already was.
         SO IT TAKES THE DROP'S CONVENTION, not the anchor's: `x` is the
         character's own left edge rather than something to stand next to, which
         is what keeps it centred whichever side the bubble ends up growing
         toward — and the bubble does still choose its side, because it is the
         long half and the stage's edges have not moved. */
      const home = askBox
        ? { x: askBox.left + askBox.width / 2 - r.left - cw / 2, y: r.height - homeY }
        : null;
      /* Read per frame with the rest: the thing being avoided appears and
         disappears with a press, and its width follows its own text. Only the
         cornered fallback below uses it now — the card and the box do not share
         a corner any more, because the box took it and Bell stands on the box. */
      const dodge = avoid ? document.querySelector(avoid)?.getBoundingClientRect() : null;
      const homeX = dodge ? HOME_X + dodge.width + 16 : HOME_X;
      /* PUT DOWN BY THE VISITOR: the spot it was left at outranks home and the
         beat it was dropped under — the visitor has said where. The NEXT beat
         clears it (the effect above): being called somewhere to explain is the
         one thing a drop yields to. Home rides in the same slot because it is
         the same kind of thing, a place for the character to be. */
      const put = parked.current ?? (anchor ? null : home);
      const at = put ?? anchor ?? { x: r.width - homeX, y: r.height - homeY, r: 0 };

      /* WHICH SIDE HAS ROOM FOR THE WHOLE THING, decided against the stage and
         not the window: these scales sit inside a stage that is not the whole
         page, and a bubble that fits the window can still hang off the picture.
         The test is the full box because the bubble is the long half — asking
         whether the character fits would put it on a side its words cannot use. */
      /* Clearance is the gap PLUS however wide the subject is — an anchor that
         does not say gets the gap alone, which is right for a point. */
      /* No reach from a spot the visitor chose: the character is exactly where
         it was left, and the point is its own left edge rather than a subject
         beside it — so the room on each side is what is left past the
         character, and the bubble is the rest of the box. */
      const reach = put ? 0 : REACH + (at.r ?? 0);
      const h = el.offsetHeight || 200;
      /* THE BUBBLE HANGS ABOVE, so the box is translated up by its full height
         and `h + floor` is the highest its foot may go. The floor used to be
         `.scale-head`'s bottom, and NOTHING HAS RENDERED THAT CLASS SINCE THE
         HEADER WAS REWORKED (the shell's furniture, below): it was silently
         `PAD` on every floor, and now it says so. */
      const floor = PAD;
      const wasRight = sideRef.current === "right";

      /* WHAT IT MUST NOT COVER — 2026-09-06. Both deep floors sent the same
         complaint and the owner handed it here rather than to either of them:
         on ENERGY the bubble sat across the ATP close-up, and on SIGNALS it sat
         on the JNK convergence, which is that floor's most important frame.
         Their rule, verbatim: *"Focused 3D object's projected bounding box +
         label bounding box를 피해서 guide bubble quadrant를 선택"*. The list is
         rectangles in stage pixels; the scoring below and the lift after it
         both read it. */
      const forbid = [];
      if (at.r) forbid.push({ x: at.x - at.r, y: at.y - at.r, w: at.r * 2, h: at.r * 2 });
      /* The floor's own "not on this" list, in the same pixels as the anchor. */
      for (const c of clear ?? []) {
        if (c && c.r > 0) forbid.push({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });
      }
      /* The label the beat put on the part — the owner names it alongside the
         object, and on both deep floors it is the plate `Gizmos` marks focused. */
      /* `[data-guide-clear]` — FURNITURE A FLOOR HAS MARKED. Added 2026-09-06
         for SIGNALS' zone legend, which is text on the stage that no beat ever
         speaks: not the subject, not a `.gizmo--focus` plate, and so invisible
         to the scoring below until the floor says so. It is not `avoid` because
         `avoid` also walks the home corner sideways by the element's width —
         correct for the body's selection card, which shares that corner, and
         wrong for a caption that merely happens to be under the guide. */
      const plates = [".gizmo--focus", "[data-guide-clear]", avoid].filter(Boolean).join(", ");
      for (const el2 of plates ? stage.querySelectorAll(plates) : []) {
        const b = el2.getBoundingClientRect();
        if (b.width > 1 && b.height > 1) {
          forbid.push({ x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height });
        }
      }
      const overlap = (a, b) =>
        Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
        Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      /* THE SHELL'S FURNITURE, WHICH IS NOT IN THE STAGE AND WAS NOT BEING
         AVOIDED AT ALL — 2026-09-06. What stood here was a ceiling computed from
         `.scale-head`, and NOTHING HAS RENDERED THAT CLASS SINCE THE HEADER WAS
         REWORKED: the app draws `.shell-title--floor`, `scaleHead.css` still
         styles a class with no element, and both this and `Gizmos.jsx` were
         asking for it. So the ceiling was silently `PAD` on every floor, and the
         SIGNALS lane's still of the land beat has the bubble across "Cell
         Signalling" — the one beat whose whole point is that the inputs at the
         top are visible.
         A CEILING WAS THE WRONG SHAPE ANYWAY. The heading is a box in a corner,
         not a horizontal line: forbidding the whole band above its bottom edge
         costs the guide the entire top of the picture to protect two words. It
         goes in the same list as everything else and the scoring handles it.
         QUERIED ON THE DOCUMENT, because the shell is the stage's parent, not
         its child. The arithmetic is unchanged — both are viewport rectangles. */
      /* THE REST OF THE FURNITURE, 2026-09-07 — owner: *"bell should not overlap
         with other elements in the window, like user text box, graphs, buttons.
         it can overlap with the figures when it moves around to explain stuff"*.
         That sentence is the whole rule, and its second half is why the CANVAS
         is not on this list: the picture is what Bell is talking about, and a
         guide that may not cross it cannot walk to anything. What it must not
         cover is the chrome — the question box, the evidence plates and their
         graphs, the sliders, and every button.
         BY CLASS AND ON THE DOCUMENT, like the two above: the shell is the
         stage's parent, and `getBoundingClientRect` is viewport pixels either
         way. An absent element simply matches nothing. */
      for (const el2 of document.querySelectorAll(CHROME)) {
        const b = el2.getBoundingClientRect();
        if (b.width > 1 && b.height > 1) {
          forbid.push({ x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height });
        }
      }

      /* TWO KINDS OF POINT, TWO WAYS TO STAND AT ONE. A spot the visitor chose
         (or home, which rides in the same slot) is where the CHARACTER is, and
         the only freedom left is which side the bubble grows toward. A beat's
         anchor is a SUBJECT to stand beside, and the box may take any of four
         corners around it. */
      let pick;
      if (put) {
        /* SCORED, NOT JUST MEASURED FOR ROOM — 2026-09-07. This branch used to
           ask only which side had space, which is the same question the four
           corners below stopped asking a day earlier and for the same reason:
           room says nothing about what the bubble would COVER. At home that put
           the words across the evidence plate whenever the plate was on the
           bubble's side. The character does not move — the visitor or the box
           chose where it stands — so the only freedom is the side, and it goes
           to whichever covers less.
           THE CANDIDATE IS THE BOX AS IT WOULD REALLY BE DRAWN: the character
           sits at the box's left end standing right and its right end standing
           left, so the offset is the bubble's own width, and the clamp is the
           one that keeps the CHARACTER on the picture (see below). */
        const y = Math.min(r.height - FOOT, Math.max(h + floor, at.y));
        const placePut = (right) => {
          const off = right ? 0 : w - cw;
          const px = Math.max(PAD - off, Math.min(at.x - off, Math.max(PAD - off, r.width - PAD - cw - off)));
          let score = forbid.reduce((sum, f) => sum + overlap({ x: px, y: y - h, w, h }, f), 0);
          /* AND WHAT IT WOULD PUT OFF THE PICTURE, in the same px² the overlaps
             are in — 2026-09-07, caught measuring the front door. This branch
             clamps the CHARACTER rather than the box (below), which is what
             keeps a dragged Bell under the finger; the price is that the bubble
             may hang off the edge and nothing here noticed. With both sides
             covering no chrome the scores tied at zero, the hysteresis kept the
             standing side, and the bubble sat 67 px off the right of a 1280 px
             stage. Off the picture is a kind of covering: it is the words, and
             they are not readable. */
          const offStage = (Math.max(0, -px) + Math.max(0, px + w - r.width)) * h;
          score += offStage;
          /* The same cost the corners pay for a place they cannot really reach. */
          score += Math.abs(px - (at.x - off)) * 6;
          return { right, below: below.current, x: px, y, score };
        };
        const sides = [placePut(true), placePut(false)];
        const bestSide = sides.reduce((a, c) => (c.score < a.score ? c : a));
        const stayingSide = sides.find((c) => c.right === wasRight);
        /* HYSTERESIS, AND NOT A LUXURY: a character parked where the two scores
           are close flips on the jitter of its own spring. The standing side has
           to be beaten by a real margin, the same one the corners use. */
        pick = stayingSide && stayingSide.score <= bestSide.score + HOLD_CORNER ? stayingSide : bestSide;
      } else {
        /* THE QUADRANT IS CHOSEN AGAINST WHAT IT WOULD COVER — 2026-09-06.
           WHAT WAS THERE BEFORE dodged on one axis and by room rather than by
           overlap: it asked which SIDE had space, and took the subject's own `y`.
           So a subject that fills the frame — which is what a close-up is — left
           no side fitting, the clamp took over, and the words landed on the
           thing they were about. Asking "which side has room" cannot answer
           "what am I covering".
           SO IT SCORES THE FOUR CORNERS. Each is the box this thing would occupy
           standing right or left, above or below; the score is how much of the
           forbidden rectangles it would cover, plus what it would push off the
           stage. Lowest wins.
           HYSTERESIS, because a character that re-picks every frame is a
           character that vibrates: the standing choice has to be beaten by a
           real margin, not by a pixel. */
        const place = (right, under) => {
          const rawX = right ? at.x + reach : at.x - reach - w;
          const rawY = under ? at.y + reach + h : at.y - reach;
          const px = Math.max(PAD, Math.min(rawX, r.width - w - PAD));
          const py = Math.min(r.height - FOOT, Math.max(h + floor, rawY));
          /* `y` is the box's FOOT — the bubble hangs above it — so the rectangle
             it actually occupies starts a full height higher. */
          const boxAt = { x: px, y: py - h, w, h };
          let score = forbid.reduce((sum, f) => sum + overlap(boxAt, f), 0);
          /* What the clamp had to move it by is a cost too: a corner it cannot
             reach is a corner it is only pretending to stand in. */
          /* 40 -> 6 ON 2026-09-06. On a 390 px stage NO corner fits, so every
             candidate clamps by a hundred pixels or more — at 40 a clamp of 200 px
             scores 8,000 against a plate overlap worth at most about 2,000, and
             the choice stopped being about coverage at exactly the width where
             coverage matters most. Measured before: desktop 0 px² of overlap,
             phone 254. The clamp still costs something, because a corner it cannot
             reach is a corner it is only pretending to stand in — it just no longer
             outvotes the thing this is for. */
          score += (Math.abs(px - rawX) + Math.abs(py - rawY)) * 6;
          /* AND WHAT IT WOULD HAVE TO WALK — see `TRAVEL_COST`. Measured from
             the CHARACTER's own place in each candidate, which is where it would
             end up standing, not from the box's corner. */
          const off = right ? 0 : w - cw;
          score += Math.hypot(px + off - (pos.current?.x ?? px + off), py - (pos.current?.y ?? py)) * TRAVEL_COST;
          return { right, below: under, x: px, y: py, score };
        };
        const corners = [place(true, false), place(true, true), place(false, false), place(false, true)];
        const best = corners.reduce((a, c) => (c.score < a.score ? c : a));
        const staying = corners.find((c) => c.right === wasRight && c.below === below.current);
        pick = staying && staying.score <= best.score + HOLD_CORNER ? staying : best;
      }
      const wantRight = pick.right;
      /* THE CLASS FIRST, THEN THE MEASUREMENT, THEN THE POSITION — all in this
         frame. Toggling the class reflows the row, so the `offsetLeft` read on
         the next line is where the character sits UNDER THE SIDE JUST CHOSEN,
         not under the one before it. That ordering is the whole fix: the two
         halves of a side change can no longer be a frame apart. */
      if (wantRight !== wasRight) {
        sideRef.current = wantRight ? "right" : "left";
        el.classList.toggle("guide--right", wantRight);
        el.classList.toggle("guide--left", !wantRight);
      }
      below.current = pick.below;
      /* Where the character IS inside the box, measured rather than derived
         from the side — it also handles the hushed box, whose bubble is
         display:none and whose offset is therefore zero. */
      const charOffset = body.current?.offsetLeft ?? 0;
      /* SUBJECT · CHARACTER · BUBBLE. Beside a subject the corner above already
         put the box's edge a reach away. At a spot of the visitor's the point IS
         the character's left edge, so the character's own offset comes off —
         and it stays under the finger whichever side the bubble takes. */
      /* THE CHARACTER IS WHAT MOVES, AND WHAT IS TRACKED — 2026-09-07. Owner:
         *"it mvoes fast here slower another teleports somewhere else"*. The
         teleport was not the travel: the spring carried the BOX, and the
         character rides at whichever end of that box the side puts it, so the
         frame a bubble appeared or went away the box changed width and the
         character jumped by the bubble — measured, peaks of 2,295 px/s against
         a walking speed of 560, on a beat that had not moved at all.
         So the position this loop springs is the CHARACTER's, and the box is
         derived from it every frame by the offset measured just above. A bubble
         that appears now grows away from a character that has not moved. */
      const boxX = put ? at.x - charOffset : pick.x;
      /* WHAT HAS TO STAY ON THE PICTURE DEPENDS ON WHAT THE POINT IS.
         For a beat, the point is a SUBJECT and the box is the thing being
         placed beside it, so the whole box is kept on the stage — a bubble
         half off the screen is the failure that clamp was written for.
         For a spot the visitor chose (or home), the point is the CHARACTER,
         and keeping the whole box on would drag the character away from the
         finger whenever the bubble ran out of room: measured at the left edge,
         the character sat 288 px right of the pointer until the side flipped
         and snapped it back. So the CHARACTER is what is kept on, and the
         bubble is left to the side decision above, whose whole job is finding
         it room. */
      const lo = put ? PAD - charOffset : PAD;
      const hi = put ? r.width - PAD - cw - charOffset : r.width - w - PAD;
      pick.x = Math.max(lo, Math.min(boxX, Math.max(lo, hi)));
      /* AND IF THE WINNER STILL COVERS SOMETHING, LIFT IT CLEAR — 2026-09-06.
         The four candidates are all within `reach` of the anchor, so when the
         ANCHOR ITSELF is on the thing, every corner is on it too and the scoring
         picks the least-bad rather than a clear one. That is what happens at
         rest: the box hangs a full height above its foot, and SIGNALS' zone
         legend sits inside that band — measured at 1280x800, `Mitochondria`
         covered by 1,223 px², and the winning corner covered it just as fully
         as the other three.
         IT ONLY FIRES ON A LOSS. `clearTo` is Infinity unless the picked box
         still overlaps something, so frames measured at 0 px² take this branch
         never and keep the corner they were measured in. The stop is `floor`:
         better to sit on the legend than to climb onto the title.
         AND NOT WHILE THE VISITOR HAS IT. A spot they dragged it to, or dropped
         it on, is where they said to stand — that outranks a guess about what
         is under it. Home is the guide's own guess, and may be lifted. */
      if (!parked.current) {
        const clearTo = forbid.reduce(
          (top, f) => (overlap({ x: pick.x, y: pick.y - h, w, h }, f) > 0 ? Math.min(top, f.y - PAD) : top),
          Infinity,
        );
        if (Number.isFinite(clearTo)) pick.y = Math.max(h + floor, Math.min(pick.y, clearTo));
      }
      /* IN THE CHARACTER'S OWN COORDINATES — see the note above. The box's
         placement is the quadrant's decision; what springs is where the
         character stands, and the box follows it at the write below.
         THIS REPLACES THE API LANE'S `lastW` CORRECTION, which took the box's
         growth off its x in the frame it happened — the same fault, patched at
         one of the two sides it can appear on. Tracking the character covers
         both sides, the hushed box, and a bubble that merely re-wraps. */
      const target = { x: pick.x + charOffset, y: pick.y };
      if (!pos.current) pos.current = { ...target };
      if (held.current?.moved) {
        /* UNDER THE FINGER THERE IS NO SPRING. The character is exactly where it
           is held, and when it is let go it is already there — a lag here would
           read as the character resisting. */
        pos.current = { ...target };
        vel.current = { x: 0, y: 0 };
      } else if (fall.current) {
        /* LET GO: IT FALLS. Gravity, not the spring — the spring eases in, and a
           thing that eases onto the ground has no weight. `target.y` is the
           ground (the dropped spot, clamped to the stage like everything else),
           and the fall ends the frame it gets there, dead, with the landing
           speed handed to the body as a compression. */
        fall.current.vy += GRAVITY * dt;
        pos.current.x = target.x;
        pos.current.y = Math.min(target.y, pos.current.y + fall.current.vy * dt);
        vel.current = { x: 0, y: 0 };
        if (pos.current.y >= target.y) {
          thud.current.v = -Math.min(10, fall.current.vy / 26);
          fall.current = null;
        }
      } else {
        /* ONE PACE FOR EVERY TRIP — owner, 2026-09-07: *"bell's movement is
           pretty unnatural rn it mvoes fast here slower another teleports
           somewhere else. make this more conssistent"*.
           THE SPRING WAS THE INCONSISTENCY. A spring's speed is proportional to
           how far it has to go, so the same character crossed a stage at the
           cap and crept the last hundred pixels — three different paces in one
           journey, and a different one again for a short hop. Bounding it only
           put a lid on the fast half.
           SO IT WALKS INSTEAD: one acceleration, one top speed, and it starts
           braking exactly late enough to stop on the spot — v = sqrt(2·a·s) is
           the speed it can still stop from, so the profile is ramp, cruise,
           ramp, and a short trip is simply one that never reaches the cruise.
           Every journey now looks like the same character moving. */
        const dx = target.x - pos.current.x;
        const dy = target.y - pos.current.y;
        const gap = Math.hypot(dx, dy);
        if (gap < 0.6) {
          pos.current = { ...target };
          vel.current = { x: 0, y: 0 };
        } else {
          const speed = Math.hypot(vel.current.x, vel.current.y);
          const ceiling = Math.min(MAX_SPEED, Math.sqrt(2 * MAX_ACCEL * gap));
          const want = Math.min(ceiling, speed + MAX_ACCEL * dt);
          /* Aimed at the target every frame, so a target that moves under it —
             a beat re-aiming, a stage resizing — is followed rather than
             orbited. */
          const step = Math.min(gap, want * dt);
          pos.current.x += (dx / gap) * step;
          pos.current.y += (dy / gap) * step;
          vel.current = { x: (dx / gap) * want, y: (dy / gap) * want };
        }
      }
      /* The box is drawn where it has to be for the character to stand at
         `pos` — see the note on tracking the character. */
      el.style.transform = `translate3d(${pos.current.x - charOffset}px, ${pos.current.y}px, 0)`;

      /* THE HOP IS A FUNCTION OF SPEED, not a loop with a duration. That is what
         makes it read as the character's own doing rather than as an effect
         played at it: crossing the stage it takes long bounds, arriving it takes
         a short one and stops, and nothing has to know when the journey ends. */
      const speed = Math.hypot(vel.current.x, vel.current.y);
      const falling = fall.current !== null;

      /* THE WORDS WAIT FOR THE CHARACTER — see the header. A line that went
         away goes away now; a line shows the frame the character is standing on
         its spot; and between a spot being named and the character standing on
         it, the bubble hides for the trip — whether the line changed or not. */
      const want = aside.current ?? (pending.current || null);
      const close = Math.hypot(target.x - pos.current.x, target.y - pos.current.y) < ARRIVE;
      const standing = close && speed < MOVING && !held.current?.moved && !falling;
      const show = (going) => {
        if (goingRef.current !== going) {
          goingRef.current = going;
          setGoing(going);
        }
      };
      if (!want) {
        if (shownRef.current !== null && !holdLast.current) {
          shownRef.current = null;
          setShown(null);
        }
        show(false);
      } else if (standing) {
        /* ARRIVED WITH SOMETHING TO SAY — after a trip, or with a new line, or
           both. Said once per arrival so the walk can start the beat's clock. */
        if (moved.current || want !== shownRef.current) guideArrived();
        moved.current = false;
        if (want !== shownRef.current) {
          shownRef.current = want;
          setShown(want);
          /* The arrow belongs to Bell's own explanation, not to an answer the
             visitor asked for — see the note where it is drawn. */
          setFromAside(aside.current != null);
        }
        show(false);
      } else if (want !== shownRef.current) {
        /* ONLY A NEW SENTENCE WAITS FOR THE WALK — 2026-09-07. This also fired
           on `moved.current`, so a beat that moved the camera while the words
           were unchanged took the bubble away mid-sentence and gave it back with
           the NEXT one: measured on SIGNALS, a sentence cut after 1.0 s. That is
           the "irregular" the owner saw. A character may walk and talk; what it
           must not do is say a new thing before it arrives. */
        show(true);
      }
      const going = speed > MOVING;
      /* One bound per STRIDE while going (a half-sine of `bob` is one bound, so
         pi per stride); a slow breath while standing. */
      phase.current += (going ? (speed / STRIDE) * Math.PI : 1.5) * dt;
      const bob = Math.abs(Math.sin(phase.current));
      /* No hop while falling: a hop is the character's own doing, and a drop
         is done to it. It hangs long and straight until it lands. */
      const lift = falling ? 0 : going ? -bob * HOP : -Math.sin(phase.current) * 1.6;
      /* THE THUD, integrated every frame (it is zero at rest and costs nothing):
         a spring on the vertical scale, kicked negative by the landing, damped
         at half critical so it comes back through neutral once. Symplectic
         Euler — velocity first — which is stable at this omega for any dt the
         cap above allows. */
      const hit = thud.current;
      hit.v += (-THUD_W * THUD_W * hit.s - 2 * THUD_Z * THUD_W * hit.v) * dt;
      hit.s += hit.v * dt;
      /* SQUASH AND STRETCH, tied to the same phase so it is long in the air and
         wide on the ground — the one bit of cartoon grammar that makes a hop
         read as weight rather than as a sine wave. The thud multiplies in on
         top, so a landing mid-breath still reads as a landing. */
      const sy =
        (falling ? 1.06 : going ? 1 + (bob - 0.5) * 0.16 : 1 + Math.sin(phase.current * 2) * 0.018) *
        Math.max(0.72, 1 + hit.s);
      const sx = 1 / sy;
      /* IT FACES WHAT IT IS TALKING ABOUT — which is behind it, since the
         subject is on the near side. Leaning into travel on top of that, a few
         degrees, so a long crossing has some intent in it. Not while falling. */
      const face = wantRight ? -1 : 1;
      const lean = falling ? 0 : Math.max(-9, Math.min(9, -vel.current.x * 0.02)) * face;
      if (body.current) {
        body.current.style.transform =
          `translateY(${lift.toFixed(2)}px) rotate(${lean.toFixed(2)}deg) ` +
          `scale(${(sx * face).toFixed(3)}, ${sy.toFixed(3)})`;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    /* `avoid` and `clear` are read inside the loop, so they belong here — a
       floor that starts naming boxes after mount would otherwise be talking to
       a closure that never heard about them. `clear` is a NEW ARRAY every poll
       only when the numbers moved: `useAim` hands back the same object when
       nothing changed, and the floors build the list from those. */
  }, [anchor, visible, avoid, clear]);

  /* A LINE THAT ARRIVES AND IS NEVER TAKEN AWAY is the state the deep scales
     were in before the four-state machine: the pass's last sentence sat on the
     picture for the rest of the visit. The tour clears `line` when it ends and
     this reports that it has nothing left to say, so a scale can go quiet. */
  useEffect(() => {
    if (!line && onDone) onDone();
  }, [line, onDone]);

  /* NOT `|| !at` ANY MORE. That was the second half of the disappearing act:
     even with `visible` true, a beat whose anchor had not resolved unmounted the
     character. It stands at its home corner instead. */
  if (!visible) return null;

  /* A WAIT OR A FAILURE IS ALWAYS ANNOUNCED — the deep scales hand `announce`
     to their own live paragraph while a tour speaks, and that never carries
     either. (The API lane's block, see above.) */
  const spoken = announce || answering;

  return (
    <div
      ref={box}
      /* HUSHED IS HAVING NOTHING TO SAY — not being on the way to say it. On the
         first beat after mount `shown` is still null while the character
         crosses to its spot, and without the second clause it dimmed for the
         trip (seen on SIGNALS, 2026-09-06). */
      /* No side class here: the loop owns it, and the layout effect above puts
         it back after every render. */
      className={`guide${shown || going || answering ? "" : " guide--hushed"}${shown && said && !answering ? " guide--said" : ""}${going && !answering ? " guide--going" : ""}${answering ? " guide--answering" : ""}`}
      data-testid="guide"
      /* NOT `aria-hidden`. This is the explanation now, and hiding it would take
         the whole guided pass away from a screen reader — which is what the
         plate it replaces was allowed to do only because the pass's own line was
         a live region carrying the same words. `role="status"` and polite,
         because it is narration and may wait for whatever is being read. */
      /* ANNOUNCED HERE ONLY WHERE NOTHING ELSE ANNOUNCES IT. On the body scale
         the guide IS the pass, so it is the live region. On the three deep
         scales the pass already had one — `.fiber__spent`, which stays mounted
         and which a pile of browser cases watch — so there the guide is the
         visible half and that paragraph is the heard half. Two live regions
         carrying the same sentence is the sentence read twice. */
      role={spoken ? "status" : undefined}
      aria-live={spoken ? "polite" : undefined}
      aria-hidden={spoken ? undefined : "true"}
    >
      {/* THE BUBBLE FIRST IN THE DOM, so a reader hears the sentence before the
          decorative character. The image is `alt=""` for the same reason. The
          drawn order is set by `flex-direction` in the sheet, not by this. */}
      <div className="guide__bubble">
        {answering ? (
          /* The API lane's block, see above: the wait as the widget's three
             dots (§9: not a word), the failure as its own line. Keyed once so
             the pop plays when the wait begins, not on every store write. */
          <span className={`guide__say guide__say--${says.status === "error" ? "error" : "thinking"}`} key="asking">
            {says.status === "error" ? (
              says.text
            ) : (
              <span className="guide__dots" aria-label="Thinking">
                <span />
                <span />
                <span />
              </span>
            )}
          </span>
        ) : (
          <span className="guide__say" key={`${again}:${shown}`}>
            {name ? <b className="guide__of">{name}</b> : null}
            {typedOut(shown, count)}
          </span>
        )}
      </div>
      {/* ONE STEP ON, BY HAND, AND OUTSIDE THE WORDS — owner, 2026-09-07: *"the
          arrow button should be out of the text box"*, and *"the dialogue should
          not proceed unless the button is clicked thats the whole point"*. It
          was in the sentence's own box; it stands beside the bubble now, on the
          far side from the character, so nothing about it is inside what Bell
          is saying.
          IT OUTLIVES A SILENT BEAT. `useTour` stops at every beat and only this
          moves it on, so a beat with no words would strand the pass if the
          control lived in a bubble that `--hushed` hides. Out here it does not.
          NEVER ON A REPLY: a sentence the visitor asked for is not the pass's,
          and stepping the pass on from it would be a control that means
          something else — *"voluntary inqueires ... as it is now"*. */}
      {passing && pass?.next && !fromAside && (
        <button
          type="button"
          className="guide__next"
          data-testid="guide-next"
          aria-label="Next"
          title="Next"
          onClick={() => pass.next()}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M5.5 3.5 10.5 8l-5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {/* THE ONE THING HERE THAT TAKES THE POINTER — the box is
          `pointer-events: none` so the words never block the picture, and the
          sheet turns it back on for the character alone. Pointer-only by design,
          like the assistant's grip: a keyboard has nothing to gain from moving
          the courier, and the words it carries are already in the tree. */}
      <img
        ref={body}
        className="guide__body"
        src="/guide/guide.png"
        alt=""
        draggable="false"
        onPointerDown={pickUp}
        onPointerMove={carry}
        onPointerUp={putDown}
        onPointerCancel={putDown}
      />
    </div>
  );
}
