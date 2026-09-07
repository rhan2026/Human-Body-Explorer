import { useEffect, useRef } from "react";
import { BRIDGE, bridgeFor } from "./handoff.js";
import { nextScale } from "./scaleRoute.js";

/**
 * WHAT THIS RIDE IS ABOUT, derived rather than passed.
 *
 * `crossing.js` states that rides only ever go down, so the floor being left
 * identifies the seam on its own and neither call site has to remember to say
 * so. `handoff.js` owns the three bridges and why they are not interchangeable.
 */
const bridgeOf = (ride) => bridgeFor(ride?.from ?? "body", nextScale(ride?.from ?? "body"));

/**
 * The one fact the card carries, per seam.
 *
 * IT WAS ONE SENTENCE FOR ALL THREE, AND TWO OF THEM WERE FALSE. `SHOW_FIGURES`
 * has been off since 2026-08-30, so every descent in the app drew "Going inside
 * — down to one sarcomere." — including fibre → ENERGY and ENERGY → SIGNALS,
 * neither of which goes anywhere near a sarcomere. This is the second time this
 * card has taught the wrong noun; the note further down records the first,
 * where it promised "one fibre" over a picture of a sarcomere, and the fix then
 * was the right word for the one seam that existed. The seams became three and
 * the sentence stayed one.
 *
 * AND THE THIRD IS NOT AN ENTRY AT ALL. `docs/20260905-fix/signaling.md` §6:
 * "AMPK wasn't another 'level down.' It was one part of something much larger."
 * A card that says "going inside" over a camera pulling back contradicts the
 * picture it is drawn on, which is the one thing this beat cannot afford — the
 * multiscale move is the product's argument, not its decoration.
 *
 * Six to eight words each: the hold is 1770 ms and `tour.js` reads at 3.3 words
 * a second, which is the arithmetic the beat lengths above were recalibrated to.
 */

/**
 * The ride between two scales.
 *
 * The owner's ruling on 2026-08-16 is that the transition does not have to be
 * literal: a camera inside a pectoralis is fiction whichever way it is drawn, so
 * this is a cut, not a journey through tissue. Nothing here tries to fly through
 * a mesh — the muscle meshes are hollow shells and a camera pushed inside one
 * renders backfaces, which is a problem this deliberately does not have.
 *
 * What is not free is the content. Two things ride down and have to arrive
 * intact, because they are what makes this our descent rather than a stock zoom:
 * the muscle's name, and the span the rig measured on that muscle stated against
 * the sarcomere the fibre scale draws. Both are read (`descentFacts`), never
 * typed, and each carries the evidence type PRD §7 requires.
 *
 * It lives above both scenes rather than in either, because a dissolve needs
 * both ends of itself: main.jsx swaps MotionScene for DevFiberScene in the
 * middle of this, and anything held inside either component is unmounted halfway
 * through the thing it is describing.
 *
 * TWO WERE TRIED. A rush — the wash closing in around the muscle while the
 * camera dives at it — and a plain crossfade through the same wash. The rush is
 * what shipped: the crossfade is legible but says nothing about *where* you went,
 * and the whole point of the beat is that you went somewhere much smaller. The
 * crossfade did not go to waste; it is exactly what a viewer who asks for less
 * motion should get, so it is the `prefers-reduced-motion` path below rather
 * than a second implementation.
 *
 * The motion is Web Animations rather than CSS keyframes so the beat lengths
 * live in one place — a stylesheet copy of them is a second source that drifts
 * the first time the cut is retimed.
 */

/** Warm, and dark enough to read a card against. */
/* ── THE COVER IS PAPER NOW, NOT A BROWN FIELD — 2026-09-06 ──────────────────
 *
 * Owner, walking it and objecting for the third time: *"go inside transition이
 * 막 이상한 화면 뜨고 그러는데 그러지 말고 zoom in 하고 들어가는 느낌이야 화면이
 * 아예 바뀌는게 아니라 natural하게 들어가는거"*. The two earlier objections are
 * already quoted further down — *"페이지 넘어가는 느낌말고"* and *"i dont want
 * like an explanation and a blinking screen"* — and each time the answer was to
 * keep the dark field and cut a smaller hole in it. That was the wrong knob.
 *
 * WHAT MADE IT A SCREEN CHANGE WAS THE COLOUR, NOT THE COVERING. Every stage in
 * this app is paper, `SCENE.background` #faf8f5. A near-black brown over it is a
 * different SURFACE arriving, and no amount of aperture makes a different
 * surface read as travel. In the stage's own colour the same cover reads as the
 * picture whiting out while the zoom carries on through it — which is what a
 * camera pushing into something actually looks like.
 *
 * WHY IT STILL COVERS AT ALL is unchanged and is measured: the destination's
 * first frames are blank, and something has to be in front of that. What
 * changed is that it is no longer a page. */
const WASH = "#faf8f5";
/** The vignette's warm edge, a step off the paper rather than a colour on it. */
/* WAS `#efe7dc`, A WARM BAND BETWEEN THE HOLE AND THE PAPER. The owner keeps
   seeing it and keeps asking for it to go — *"또 살짝 그 오린지 transition이
   보이는데 이거 아예 빼라고 했는데"* — so the ring is the stage's own paper now
   and the descent has exactly one colour in it. The layer stays, because it is
   what closes on the LEAVING side and its motion is not the thing being
   removed; only its tint was. */
const EMBER = WASH;

/**
 * Cut lengths, in ms. A calibration knob judged by eye, not a constant.
 *
 * `out` is how long the body has before it is covered — long enough for the
 * camera to have visibly moved. `hold` is how long the card is readable. The
 * total sits just under cinematic.js's SETTLE_MS so the chrome comes back to a
 * settled picture instead of into the wash.
 *
 * STILL is the same beat with the spatial move taken out: nothing translates,
 * scales or dives, and the whole thing is shorter, because a viewer who asked
 * for less motion asked for less of it, not for a slower version.
 */
/* THE HOLD IS AS LONG AS ITS ONE FACT TAKES TO READ. Q14 R2, 2026-08-27: the
   card carried 23 words in 1740 ms — 7.0 s of reading at this project's own
   `WORDS_PER_SECOND = 3.3`, four times too fast. Cutting it to the one fact a
   viewer came down for left six words, which want 1820 ms, and the beat gave
   1740. The 100 ms goes on the HOLD, which is the still part; the two moving
   halves are unchanged and `descent.spec.js:793` still reads `out` as 620
   against `CROSSING_MS` 420.
   `STILL` needed more, not less. It is the same beat with the move taken out —
   1100 ms in total — so a viewer who has asked for less motion was getting the
   same words in two thirds of the time. The move is what was removed, not the
   reading. */
/* RECALIBRATED 2026-09-05, AND THE ARITHMETIC ABOVE HAD DRIFTED. The note says
   the card was cut to "one fact … six words, which want 1820 ms"; measured today
   at 1201x800 the card draws NINE — the fact, its unit, its evidence word and
   the destination's name — which want 2727 ms at the same 3.3 words a second,
   and the beat gave 1909. So the hold takes the difference, on both variants:
   the `STILL` one was 1960 and had the same shortfall, for the same reason its
   own note gives ("the move is what was removed, not the reading").
   THE TOTAL IS NOW LONGER THAN `SETTLE_MS`, WHICH THE OLD NOTE RELIED ON. It
   already was — 1920 against 1800 — so the sentence "the total sits just under
   cinematic.js's SETTLE_MS" had stopped being true before this change. Rather
   than restore a coincidence, `RIDE_MS` below is exported and the caller hands
   it to `beginCinematic`, so the chrome stays away for exactly as long as the
   ride runs instead of for a constant that has to be remembered. */
/* PLUS A FRAME'S SLIP, WHICH IS THE SAME 150 ms `tour.js` ADDS TO EVERY BEAT.
   Measured 2026-09-05 without it: 2725 ms against a want of 2727 — two
   milliseconds, and the two are the sampler's own end frames. A beat that is
   exactly its reading time is a beat that fails on rounding. */
/* THE HOLD WAS READING TIME FOR A CARD THAT IS GONE — 2026-09-06.
   1770 ms is `tour.js`'s reading rate applied to the card's six words, and the
   card was deleted in this pass. What is left for the hold to cover is the
   destination's mount, and that is a different and much smaller number: measured
   today at 1440x900 on this machine, the swap fires at `out` (620 ms) and the
   fibre scale reports itself alive at 856 — a gap of 236 ms — while the cover
   stayed up until 2934. Two full seconds of paper over a scene that was already
   drawing, which is the *"go inside 도 ㅈㄴ 이상해 개병신같아"* the owner is
   looking at: not a colour and not a caption, dead air.
   700 rather than 236 because this machine has a GPU and the number that
   mattered when this was written was 14.3 s on a software renderer. 700 leaves
   464 ms of margin here and still cuts the whole descent from 2890 ms to 1940.
   And `in` goes up rather than down: the aperture widening IS the camera
   continuing to move in, so it should be the longest beat of the three, not the
   shortest. The owner's rule for this whole area — *"it never means to add more
   stuff it means to rather find the optimal angle and just go in naturlly no
   fillers"* — and a hold is the purest filler there is. */
/** How many painted frames after the swap count as "the destination is drawing".
    Six is about a tenth of a second on a machine with nothing to do and as long
    as it takes on one that is building a scene — which is the point of counting
    frames rather than time. */
const READY_FRAMES = 6;

/* `out` 620 -> 1400 AND THE PICTURE IS WHAT ZOOMS — 2026-09-07, owner (4.3, second
   round): *"너무 빨라 … hover 3d 없어져 그다음에 천천히 그냥 그 자리로 줌인하다가 그대로
   … 지금 화면 그대로 멈추고 들어가는거야"*. The first cut drove the body's own
   camera into the muscle, and on the bench press that camera swung up over a
   lying body and arrived on a muscle that read as standing. The owner's design
   is simpler and stricter: the body is stopped on the press (4.2), the disc is
   gone (4.1), and the frame the visitor is looking at — that frame, unchanged —
   is enlarged slowly around the magnifier until the wash takes it. */
/* 1400 -> 1000 and 2.6x -> 4x on 2026-09-07, BODY 3rd round — owner: *"조금 더 줌인되고 전환 … 더 빠르게 … 1.0초에 4배"*. */
const MOVING = { out: 1000, hold: 700, in: 620 };
const STILL = { out: 160, hold: 900, in: 240 };

/** How long a ride lasts, so the chrome's absence can be told rather than guessed. */
export const RIDE_MS = (reduced) => {
  const b = reduced ? STILL : MOVING;
  return b.out + b.hold + b.in;
};

const LAYER = { position: "fixed", inset: 0, pointerEvents: "none" };

export default function Descent({ ride, onArrive, onDone }) {
  const box = useRef(null);
  const ring = useRef(null);
  /** The frame counter's handle and the ride's end, both rescheduled when the
      cover opens early. */
  const raf = useRef(0);
  const doneAt = useRef(0);
  const fill = useRef(null);

  const reduced = !!ride.reduced;
  const beat = reduced ? STILL : MOVING;
  const bridge = bridgeOf(ride);
  // Where the muscle was on the glass, if the pick knew. A gradient built from a
  // half-missing coordinate is a wash centred on the string "undefined", so the
  // middle of the window is the fallback rather than a partial answer.
  const [x, y] = ride.at?.every?.(Number.isFinite)
    ? ride.at
    : [window.innerWidth / 2, window.innerHeight / 2];

  useEffect(() => {
    const running = [];
    const play = (el, frames, delay, duration, easing) =>
      el && running.push(el.animate(frames, { delay, duration, easing, fill: "both" }));

    // The surroundings go first and the muscle is the last thing left, which is
    // the one part of this that has to read: you did not leave the body, you
    // left everything in it except the muscle you chose.
    /* THE WASH WAITS FOR THE ZOOM — 2026-09-07. It began at 0 and had taken the
       body by 385 ms (measured), leaving one small muscle on paper while the
       "zoom" happened to nothing. The owner's design is the whole frame, as it
       is, enlarged slowly; the wash is the last 45% of `out`, closing on the
       muscle that has by then grown to fill the middle of the picture. */
    /* THE WASH IS THE LAST 10% — owner, 2026-09-07: *"마지막 1초는 좋은데 한 6배는
       들어가고 씻김은 한 10%만"*. The two numbers to turn are the START (beat.out *
       0.9) and the LENGTH (beat.out * 0.1) here and on the fill below. */
    play(ring.current,
      [{ opacity: 0, transform: "scale(2.4)" }, { opacity: 1, transform: "scale(1)" }],
      beat.out * 0.9, beat.out * 0.1, "cubic-bezier(.32,0,.24,1)");
    /* 0.45/0.55 -> 0.6/0.4 of `out` on 2026-09-07: the zoom is the beat now and
       the wash is its last act. */
    play(fill.current, [{ opacity: 0 }, { opacity: 1 }], beat.out * 0.9, beat.out * 0.1, "ease-in");
    /* THE HALF THAT MAKES IT AN ENTRY — 2026-09-04.
       Owner: *"그 go inside면 줌하고 자연스럽게 넘어가(페이지 넘어가는 느낌말고
       약간 자연스럽게 진짜 들어가는 것처럼 들어가야돼)"*.
       Until now nothing on the LEAVING side moved. The ring closed and the fill
       covered, and `crossing.js`'s note — "what a viewer reads as 'going in' is
       the settling at the far end, not the leaving" — was written when the
       leaving side could not be animated without holding navigation back. It can
       be: this is a transform on a canvas that is already on screen, it holds
       nothing back, and it is the first half of one move whose second half is
       `crossing-down` growing out of the same point.
       ON THE COMPOSITOR, WHICH IS WHY IT SURVIVES. Measured 2026-09-04, the
       destination's first mount starves the main thread — 43 animation frames in
       2.6 s with the GPU on, 4 in 3.4 s without — so anything that needs script
       or layout during the swap does not draw at all. `transform` and `opacity`
       are the two properties that keep running while the main thread is busy,
       and that is the whole reason the push reads at all.
       NOT UNDER REDUCED MOTION: that viewer asked for the crossfade, and the
       whole point of `STILL` is that the move is what was removed. */
    /* `main.press` IS THE BODY AND ONLY THE BODY, so until now the two deep
       seams had no leaving half at all — the note above describes a push that
       one of the three descents was getting. The deep scales render
       `main.app`, so the selector asks for whichever floor is on screen rather
       than naming one.

       AND ONE OF THE THREE GOES THE OTHER WAY.
       `docs/20260905-fix/signaling.md` §6: "AMPK remains exactly where it is.
       Then: Camera begins pulling backward. AMPK becomes smaller." That is not
       this push with different numbers, it is its opposite — and the product's
       argument depends on the difference, because SIGNALS is not another level
       down. cell.md §16 says the same from the other side: "여기서는 더
       zoom-in하면 안 돼. 반대로 pull back하는 게 좋다."
       THE ORIGIN IS WHAT MAKES IT READ. Scaling DOWN about the pressed point
       holds that point still while everything else contracts toward it, which
       is exactly "AMPK stays where it is and becomes one of many". The same
       origin, the same one transform on the compositor — see the note above for
       why it has to be transform and opacity and nothing else.
       Easing changes with it: the push uses an ease-IN, because a dive
       accelerates away from you; a recession settles, so the pull-back borrows
       the ring's own ease-out. */
    const leaving = document.querySelector("main.press canvas, main.app canvas");
    if (leaving && !reduced) {
      leaving.style.transformOrigin = `${x}px ${y}px`;
      /* ENERGY -> SIGNALS pulled back and FIBER -> ENERGY dived; on 2026-09-07 the
         owner asked for one grammar (25: *"다른 것도 비슷하게"*). The sarcomere is a
         piece of the myofibril bars ENERGY draws behind its room, so pulling back
         from it is the same carried element the AMPK crossing has. */
      /* EVERY CROSSING DIVES — 2026-09-07, owner: *"fiber→cell도 들어가는 느낌이 좋아 그
         exercise가 들어가는 것처럼, energy→signalling도 … 지금은 뭔가 빠져"*. The
         pull-back (ENERGY → SIGNALS since 2026-09-05, FIBER → ENERGY for one day) read
         as leaving; going deeper should look like going in. SIGNALS keeps its AMPK
         carry-over — that is the seam in SignallingScale, not this animation. */
      const pullBack = bridge === BRIDGE.ampk; /* the owner asked the old ENERGY -> SIGNALS back the same day: "예전 transition이 훨 나은듯" — the dive stays for FIBER -> ENERGY */
      play(leaving,
        /* 2.1 -> 1.3 ON 2026-09-07 (4.3). The zoom is the body's own camera now
           (`MotionScene`'s dive stops on the muscle instead of 0.52 short of it);
           this scale only keeps the picture moving through the wash's last
           frames so the swap lands on a picture that never stopped. */
        [{ transform: "scale(1)" }, { transform: `scale(${pullBack ? 0.62 : 8})` }],
        0, beat.out,
        /* Slow in, then committing: most of the growth in the back half, so the
           first second reads as leaning closer and the last half-second as going
           through. */
        pullBack ? "cubic-bezier(.32,0,.24,1)" : "cubic-bezier(.55,0,.85,.35)");
    }

    /* THE CENTRING IS IN THE KEYFRAMES BECAUSE THE ANIMATION OWNS THE PROPERTY.
       Measured 2026-09-05 at three widths: the card overflowed the right edge of
       the window by 84 px at 1280 and by 172 px at 1024 and 760 — its own text
       cut off mid-word. `translateX(-50%)` is set inline below and it has never
       once applied during a moving descent, because these keyframes end on
       `transform: none` with `fill: "both"` and a running animation outranks the
       inline style it is composited over. So the card hung by its LEFT edge from
       a coordinate the clamp beside it computes for a CENTRE, and the two
       disagreed by exactly half a card.
       IT ONLY EVER SHOWED IN THE MOVING VARIANT, which is why it survived: the
       reduced path animates opacity alone, leaves the transform untouched, and
       is correctly centred — so the one a viewer almost never sees was the one
       that worked.
       Fixed by carrying the centring THROUGH the animation rather than under it.
       The 8 px lift is the same beat it always was; it now travels as the second
       half of one translate instead of as a transform that silently replaces
       another. */

    /* THE COVER OPENS, IT DOES NOT DISSOLVE — 2026-09-04.
       A crossfade says "a different picture is here now"; an aperture opening on
       the point you pressed says "you are through". The hole is a fixed 6 vmin
       of the fill's own gradient, so scaling the fill outward FROM that point
       widens the hole and pushes the dark off the edges at the same time — one
       transform, on the compositor, which is what survives the destination's
       mount (see the note on the push above).
       The fade stays and rides with it: at 4x the ring's wash still covers the
       corners, and cutting it there would leave a hard edge sliding off screen. */
    /* THE COVER OPENS WHEN THE DESTINATION IS DRAWING, NOT WHEN A CLOCK SAYS SO
       — 2026-09-06. Owner: *"the zoom in is still weird and awkward at every
       step"*.
       Measured at 1440x900, bench press into the fibre: the swap fires at 620 ms,
       the destination reports itself alive at 857 and its first plate stands at
       920 — and the cover stayed up until 1,987. For 1.1 seconds the only thing
       on screen was a hole in a sheet of paper over a picture that was already
       there. That gap is the awkwardness, and no amount of easing fixes a beat
       that is waiting for nothing.
       COUNTED IN FRAMES, NOT MILLISECONDS, and that is the whole idea. A machine
       busy building a scene does not produce frames; a machine that has finished
       does. So `READY_FRAMES` rendered frames after the swap means the browser
       has actually been painting, and the same number adapts by itself to a
       renderer that takes 240 ms and one that takes fourteen seconds — which is
       what the note below was protecting with a timer, and it can keep
       protecting it: `beat.hold` stays as the CEILING, so a destination that
       never paints still gets uncovered rather than hanging. */
    let opened = false;
    const openNow = (delay) => {
      if (opened) return;
      opened = true;
      if (!reduced) {
        for (const el of [fill.current, ring.current]) {
          if (!el) continue;
          el.style.transformOrigin = `${x}px ${y}px`;
          play(el, [{ transform: "scale(1)" }, { transform: "scale(4)" }],
            delay, beat.in, "cubic-bezier(.3,0,.2,1)");
        }
      }
      const outro = box.current?.animate([{ opacity: 1 }, { opacity: 0 }],
        { delay, duration: beat.in, easing: "ease-out", fill: "both" });
      if (outro) running.push(outro);
      /* The ride ends `beat.in` after the cover starts opening, whenever that
         was — the two numbers were one sum while the hold was fixed and have to
         travel together now. */
      clearTimeout(doneAt.current);
      doneAt.current = setTimeout(onDone, delay + beat.in);
    };

    // Both ends are timers, off one set of numbers, so they cannot disagree
    // about how long the beat is. The swap has to happen mid-beat — under an
    // opaque wash, because the destination needs its first frames before it is
    // uncovered — so one end was always a timer; `outro.finished` was tried for
    // the other and did not arrive within five seconds of when it was due.
    //
    // Measured afterwards, and it is not the promise's fault: the fibre scale's
    // first mount cost 14.3s in a single frame on this software renderer, and
    // both a timer and an animation are starved by it equally. Which is the
    // useful property — the ride ends on the same thread that builds what it is
    // covering, so it cannot uncover a scene that is not built yet. It runs
    // late by exactly as long as the destination is late.
    const arrive = setTimeout(() => {
      onArrive();
      /* Count from the swap, because that is when the destination begins to
         exist. `raf` is cancelled with everything else below. */
      let frames = 0;
      const tick = () => {
        frames += 1;
        if (frames >= READY_FRAMES) openNow(0);
        else raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, beat.out);
    /* THE CEILING, and it is the old behaviour exactly: if the frames never
       come, the cover opens on the hold it always opened on. */
    const ceiling = setTimeout(() => openNow(0), beat.out + beat.hold);

    return () => {
      clearTimeout(arrive);
      clearTimeout(ceiling);
      clearTimeout(doneAt.current);
      cancelAnimationFrame(raf.current);
      for (const a of running) a.cancel();
    };
    // Once, for the length of one ride. main.jsx keys a new ride to a new mount.
  }, []);

  return (
    <div ref={box} data-testid="descent" style={{ ...LAYER, zIndex: 40 }}>
      {!reduced && (
        <div
          ref={ring}
          data-testid="descent-ring"
          aria-hidden="true"
          style={{
            ...LAYER,
            transformOrigin: `${x}px ${y}px`,
            background: `radial-gradient(circle at ${x}px ${y}px, transparent 0 13vmin, ${EMBER} 31vmin, ${WASH} 58vmin)`,
          }}
        />
      )}
      {/* THE COVER KEEPS A HOLE — 2026-09-04.
          It was `background: WASH`, a flat field over the whole window, and at
          full opacity that is a page: screenshotted at 679 ms into a descent, a
          brown rectangle with a caption in the middle of it and nothing else on
          screen. The owner has now said twice what that reads as — *"페이지
          넘어가는 느낌말고"*, and before that *"i dont want like an explanation
          and a blinking screen"*.
          WHY IT HAS TO COVER AT ALL, so this is not undone by the next person:
          the swap happens under it, and the destination's first frames are blank
          — measured 2026-09-04, a mount that starves the main thread to 4 frames
          in 3.4 s on the software renderer. Something has to be in front of that.
          So it covers everything EXCEPT the muscle. The hole is small and it is
          on the point that was pressed, so the frame reads as being inside
          something and looking at what you came for, rather than as a slide
          between two screens. Same geometry as the ring above, tighter, which is
          also why the two do not disagree about where the muscle is. */}
      <div
        ref={fill}
        data-testid="descent-fill"
        aria-hidden="true"
        style={{
          ...LAYER,
          background: reduced
            ? WASH
            : `radial-gradient(circle at ${x}px ${y}px, transparent 0 6vmin, ${WASH} 15vmin)`,
        }}
      />

      {/* NO CARD — 2026-09-06. It stood under the hole and said two things, and
          the owner has now removed both by name. The heading was `ride.name`,
          the muscle you pressed: *"transition에 Muscle fiber / pectoralis major
          이딴 개 좋같은 칩 다 빼고 … 내가 100번 말한거 같은데 들어온 이상 어떤
          muscle인지는 진짜 ㅈ도 1도 상관이 없어"*. Under it was one sentence,
          "Going inside — down to one sarcomere", and the instruction for the
          whole transition was *"literally camera가 zoom in하면서 transition되는
          거라고 다 going inside mucle name이런거 대 빼라고"*.
          AND THE RULE UNDERNEATH IT, which is the one to keep: *"when i say
          transition is weird it never means to add more stuff it means to rather
          find the optimal angle and just go in naturlly no fillers"*. Every
          previous round here answered "the descent reads as a page" by adding
          something — a hole, a gradient, a ring, a shorter caption. The answer
          was to take the caption out. What is left is a cover with a hole over
          the point you pressed and the destination scaling in behind it, which
          is a camera moving rather than a slide changing.
          `Fact`, `facts`, `CARD_LINE` and the evidence badge went with it; the
          figures they guarded have been behind `SHOW_FIGURES = false` since
          2026-08-30 and drew nothing on any screen. */}
    </div>
  );
}

/**
 * One number, what it is a number of, and what kind of evidence it is (PRD §7).
 *
 * A fragment rather than a row, so the three land as cells of the card's own
 * grid and the columns line up.
 */
