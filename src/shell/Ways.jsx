import { beginCrossing } from "../crossing.js";
import { useEffect, useState } from "react";
import { onTour, runningTour } from "../tourControl.js";
import { getMotion } from "../motion/registry.js";
import { hashForScale, prevScale, SCALE_LABEL, go as goRoute } from "../scaleRoute.js";

/**
 * The top-right corner: the ways out, on every scale.
 *
 * THE CORNER GRAMMAR THIS BELONGS TO. Top-left is what this is — the ☰ and the
 * application's name, and on the body the exercise switcher. Top-right is the
 * ride: where you go, and whether it is running — A4 landed on 2026-08-31 and
 * this file is it, so the pause below is the second half of that sentence
 * rather than a promise. The way IN is not here at all; it is in the picture,
 * beside the thing you would enter.
 *
 * A NAME, NOT A DIRECTION, which is the answer to the owner's "Go Up (better
 * word then up)". The better word is not a word:
 *
 *     fibre        ↑ Bench press        Go Home
 *     cell         ↑ The fibre          Go Home
 *     signalling   ↑ The cell           Go Home
 *     body         (no up — it is home) Go Home
 *
 * Three reasons, in weight order. It puts back the fact that died with the
 * footer: `descent-from` carried the exercise and the muscle, and without it
 * four different addresses drew one unnamed screen — the exercise's own label
 * is exactly what differs between `#bench_press/fiber` and `#push_up/fiber`.
 * A control that names where it goes cannot be misread as "close the app",
 * which "Go Out" can. And it matches the drawer copy it replaces ("← Back to
 * the fibre") instead of inventing a fifth vocabulary for the same move.
 *
 * ONE CONTROL WHEN BOTH WOULD GO TO THE SAME PLACE, at the owner's word. On
 * the body scale up IS home, so only Home draws.
 *
 * The label is read, never typed: `getMotion().label` for the exercise and
 * `SCALE_LABEL` for the three below it, both beside `SCALE_ORDER`, which
 * declares itself the only list of scales.
 */
/**
 * `tourPaused` / `onResumeTour` — the guided walk's own resume, in the transport's
 * slot rather than beside it.
 *
 * OWNER, 2026-09-06, walking the app: *"Resume tour 버튼 아예 삭제 아니 이건
 * pause버튼 처럼 오른쪽 위에 있어도 되지"* — and then, asked which:
 * *"pause / resume으로 합침"*. So it is one control, not two.
 *
 * THE TWO PAUSES ARE DIFFERENT THINGS AND THAT IS WHY THEY CAN SHARE A SLOT.
 * `playing` stops the CLOCK; `tourPaused` is a walk that a viewer interrupted
 * by touching the scene, which leaves the movement running. They cannot both be
 * the pressing question at once: while a walk is waiting to be resumed, that is
 * what the corner is for, and the clock's own pause is what the viewer already
 * has (they stopped the walk by reaching into the picture, not by stopping it).
 * When no walk is waiting, the slot is the transport again.
 * A SECOND BUTTON WAS THE OTHER ANSWER and it is worse in the corner the owner
 * put it in: two controls a row apart, both meaning "carry on", differing only
 * in what carries on.
 */
export default function Ways({
  state,
  playing = null,
  onPlaying = null,
  tourPaused = false,
  onResumeTour = null,
  belowCube = false,
}) {
  /* The running pass, if there is one — see the Skip button below. */
  const [tour, setTour] = useState(() => runningTour());
  useEffect(() => onTour(setTour), []);

  const scale = state?.scale ?? "body";
  const up = prevScale(scale);

  /* THE FLOOR NAMES ITSELF, AND THE BODY ALSO NAMES ITS EXERCISE.
     Below the body the floors name themselves: a viewer climbing out of ENERGY
     is going to FIBER, not to a push-up. Going up TO the body, both facts are
     wanted and they were fighting — the canon of 2026-09-05 requires the
     navigation to read `BODY`, and this control's own older argument is that
     "the exercise's own label is exactly what differs between
     `#bench_press/fiber` and `#push_up/fiber`". Neither has to give: the pair
     is the grammar `docs/20260905-fix/body.md` §4 asks the floor itself to
     wear, small floor name over large exercise name. `BODY` alone when the
     address names no exercise — the registry is asked rather than guessed, so
     an unknown id gets the floor's name instead of a slug. */
  const exerciseLabel = getMotion(state?.exercise)?.label ?? null;
  const upLabel =
    up === "body"
      ? exerciseLabel
        ? `${SCALE_LABEL.body} · ${exerciseLabel}`
        : SCALE_LABEL.body
      : SCALE_LABEL[up];

  /* `belowCube` — THE CORNER IS SHARED WITH THE VIEW CUBE ON THE FLOORS THAT
     DRAW ONE. Owner, 2026-09-06: *"그 front left cube항상 떠 있고 Pause Go
     Home버튼은 그 밑에"*. The cube lives inside the canvas (drei's
     `GizmoHelper`, `top-right`, margin 78) so it has no DOM box this can clear
     automatically; measured on the front door at 1280x800 it reaches y ≈ 115.
     A PROP RATHER THAN A BLANKET OFFSET, because the three deep floors draw no
     cube and pushing their transport down 112 px would leave a hole at the top
     of every one of them for furniture that is not there. The scene that draws
     the cube is the scene that knows. */
  const go = (to, direction) => {
    beginCrossing(direction);
    goRoute(to);
  };

  return (
    <div className={belowCube ? "ways ways--below-cube" : "ways"} data-testid="ways">
      {/* PAUSE FIRST, because it is the one a viewer reaches for while
          something is moving; the two below it are for when they are done.
          Canon A4: "그 상태 그대로 멈춘다" — this stops the clock where it is
          and changes nothing else, so the frame on screen is the frame you
          were looking at. It is drawn only where a scale hands us the state:
          the front door has no run to stop.

          THE GLYPH IS NOT A NAME, AND THE WORD BESIDE IT IS NOT DECORATION.
          Carried here from `director/Timeline.jsx` when that file was deleted
          on 2026-08-31, because this is the control the measurement is now
          about. Swept the accessible name of every control on five routes
          2026-08-27 — wrapping `<label>`, `for=`, `aria-labelledby` and all —
          and the strip's play button's name was the string `❚❚` on every scale
          that had one: the transport's primary control, and the first thing a
          viewer reaches for, announced to a screen reader as two box-drawing
          characters. The word is the ACTION: pressing it pauses. Keep it in
          the text node rather than in an `aria-label`, so the name a reader
          hears and the name a viewer sees cannot drift apart. */}
      {tourPaused && onResumeTour ? (
        /* THE WALK IS WAITING, so the corner offers the walk. Same class as the
           transport below it — it is the same slot wearing the other job, and a
           control that changes size or weight when its meaning changes reads as
           a different control appearing. */
        <button
          type="button"
          className="ways__go ways__pause"
          data-testid="resume-tour"
          onClick={onResumeTour}
        >
          <svg className="ways__icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
            <path d="M2.2 1.1 8.6 5 2.2 8.9Z" fill="currentColor" />
          </svg>
          Resume
        </button>
      ) : onPlaying && (
        <button
          type="button"
          className="ways__go ways__pause"
          data-testid="pause"
          aria-pressed={!playing}
          onClick={() => onPlaying(!playing)}
        >
          {/* THE GLYPHS WERE THE WEIGHT. `❚❚` is U+275A, HEAVY VERTICAL BAR, twice
              — the character is named for the thing the owner objected to
              ("pause 버튼이 너무 뚱뚱해"), and at 13 px a font draws it as two
              solid blocks that outweigh every letter beside them. `▶` is the
              same problem in a solid triangle. A glyph's weight belongs to
              whatever font happens to be installed; a stroke we draw is a
              number we chose.
              `aria-hidden`, because the accessible name is the word — the
              five-route sweep of 2026-08-27 found this control announcing
              itself as the bare string `❚❚`, and that is what the word fixed. */}
          <svg className="ways__icon" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
            {playing ? (
              <g fill="currentColor">
                <rect x="1.6" y="0.9" width="2.2" height="8.2" rx="0.6" />
                <rect x="6.2" y="0.9" width="2.2" height="8.2" rx="0.6" />
              </g>
            ) : (
              <path d="M2.2 1.1 8.6 5 2.2 8.9Z" fill="currentColor" />
            )}
          </svg>
          {playing ? "Pause" : "Play"}
        </button>
      )}
      {/* SKIP, AND IT IS THE ONLY WAY TO END A PASS — 2026-09-06. Owner:
          *"right buttons (pause go up go home만 보여) ← 여기에 skip을 더해"*, in
          the same breath as *"클릭을 해도 그냥 투어가 계속 진행돼"*.
          The two halves are one change. Touching the scene used to end the pass
          — `tour.js` listened for pointerdown, wheel and keydown and stopped —
          so turning the model to look at it and ending the explanation were the
          same gesture. Now the scene is yours while it plays, and ending it is a
          named button that says what it does.
          IT READS THE PASS THROUGH `tourControl.js` rather than through a prop:
          this component is mounted by each floor's page and the pass runs inside
          that floor's canvas, so a prop would mean editing three pages — two of
          which belong to lanes that are in them right now.
          IT SITS ABOVE THE WAY OUT, not below: while a pass is running, ending it
          is the more likely next move than leaving the floor, and the transport
          reads top to bottom. */}
      {tour && (
        <button
          type="button"
          className="ways__go"
          data-testid="skip-tour"
          onClick={() => tour.skip?.()}
        >
          Skip
        </button>
      )}
      {up && (
        <button
          type="button"
          className="ways__go"
          data-testid="go-up"
          onClick={() => go(hashForScale(state, up), "up")}
        >
          {/* THE ARROW IS A DECORATION AND MUST NOT BE PART OF THE NAME.
              Chrome folds a button's whole text into its accessible name, so
              `↑ Bench press` announces as an arrow followed by the label and an
              exact match for "Bench press" finds nothing — measured 2026-09-04,
              `getByRole("button", { name: "Push-up", exact: true })` returned 0
              while the control was on screen saying it. It is the same defect
              the footer chain had with `→`, which `gate-legibility` records: the
              same control named two different ways depending on where it sat.
              `aria-hidden` on the glyph leaves the name the label alone, and a
              voice command and a screen reader get the word a viewer reads. */}
          <span aria-hidden="true">↑ </span>
          {upLabel}
        </button>
      )}
      {/* HOME IS THE EXPLORER, and it is spelled empty rather than built: the
          front door is the router's fallthrough, not a scale. */}
      <button
        type="button"
        className="ways__go"
        data-testid="go-home"
        onClick={() => go("", "up")}
      >
        Go Home
      </button>
    </div>
  );
}
