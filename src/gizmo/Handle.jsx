import { useRef, useState } from "react";
import { Html } from "@react-three/drei";


/**
 * A part you can press, standing on the part — and as of 2026-09-06 it draws
 * nothing at all.
 *
 * CANON D2ⓐ: *"조작기가 먼저 → 방문자가 뭔가를 하고 → 결과가 그림에서 보이고 →
 * 글은 그 뒤에 짧게"*. This is the 조작기. Before it existed the fibre offered a
 * visitor two chips and a toggle in a drawer, the cell two switches, and the
 * signalling nothing at all — while a forty-second pass narrated at them, and
 * any press stopped it. Teaching and touching pushed each other away.
 *
 * ONE PER PART THE STORYBOARD IS ABOUT. `stepsOf` cuts a storyboard by `focus`,
 * so the set of handles is the set of parts the pass already had something to
 * say about — there is no part you can press with nothing behind it, and no
 * part with an explanation nobody can reach.
 *
 * WHAT THIS FILE USED TO BE, AND WHY THE REST OF IT IS GONE. It drew a mark: a
 * dark ring, a depth-ignoring ghost of the ring, a paper halo behind it and a
 * filled centre, in `#3a352e` standing and `#b4530a` open, with a per-frame
 * chrome solver (`handleChrome.js`) fading all four by apparent size. Read the
 * git history and it is one long argument about how that mark should look —
 * differ in KIND from the way-in, then in thickness, then in ink weight, then
 * darker at the owner's word on 2026-09-05, then hollow on 2026-09-06. Five
 * rounds of tuning on a piece of chrome sitting on top of the drawing, and the
 * verdict at the end of them was *"이 orange accent on parts 개 ㅈ같아 … 그리고
 * black rings도 개 ㅈ같아 (everywhere)"*.
 *
 * SO THE DRAWING SAYS IT INSTEAD, which is what the same message asked for:
 * *"3d element를 highlight 하던지 처음에 설명할 때랑 눌렀을 때 나머지를 다른
 * 색으로 하던지"*. The part under the pointer or under the pass keeps its
 * colour and every other part washes toward the stage's paper. That belongs to
 * the floor, because only the floor knows what its parts are — see
 * `FiberScene`'s `subject` effect. `handleChrome.js` and its test went with the
 * rings; this was their only caller.
 *
 * WHAT IS LEFT IS THE HALF THAT COULD NOT MOVE: a real, focusable, 44 px button
 * standing at the part's own anchor, so the part is reachable by pointer, by
 * keyboard, and by the `handle-<id>` selector every gate and every hover
 * delegate in the app already uses.
 *
 * `radius` and `hollow` are still accepted and now ignored. Two floors pass
 * them; taking a prop off a shared component is a separate change from taking
 * away what it drew, and doing both in one edit is how a merge goes wrong.
 */
export default function Handle({ at, id, label, open = false, seen = false, onOpen, radius = 0.15, hollow = false }) {
  /* HOVER AND FOCUS ARE THE SAME STATE, and it lives in React rather than in
     CSS because the mark is WebGL: a stylesheet cannot reach it. The pointer
     handlers sit on the button itself and not on the wrapper `WayIn` uses —
     the wrapper is `pointer-events: none` and the button is the only thing in
     here that is not, and this control has no panel to keep open while a
     pointer travels to it. */
  const [lit, setLit] = useState(false);

  const group = useRef(null);

  /* NO FRAME LOOP LEFT. This ran `handleChrome` once per handle per frame to
     write four opacities that no longer have anything to write to; with the
     rings gone the whole file's per-frame cost is zero and `handleChrome.js`
     went with them (grepped: this was its only caller outside its own test). */

  return (
    <group position={at} ref={group}>
      {/* NOTHING IS DRAWN HERE ANY MORE — 2026-09-06.
          What stood in this group was a dark ring, a depth-ignoring ghost copy
          of it, a paper halo behind it and a filled centre, all in `#3a352e`
          standing and `#b4530a` open. The owner, on both at once: *"이 orange
          accent on parts 개 ㅈ같아 … 그리고 black rings도 개 ㅈ같아
          (everywhere)"*.

          THE MARK WAS NEVER THE PROBLEM WITH THE MARK. Read back, this file's
          own history is one long argument about how a ring should look: it
          differed in KIND from the way-in's rings, then in thickness, then in
          ink weight, then it got darker at the owner's word on 2026-09-05, then
          the filled centre came off on 2026-09-06 — and each time the answer was
          another adjustment to a piece of chrome sitting on top of the drawing.
          A mark that needs five rounds of tuning is a mark the picture did not
          need.

          WHAT REPLACES IT is the thing the owner asked for in the same message:
          *"3d element를 highlight 하던지 처음에 설명할 때랑 눌렀을 때 나머지를
          다른 색으로 하던지"*. Selection is now said by the geometry — the part
          under the pointer or under the pass keeps its colour and every other
          part washes toward the stage's paper. That lives with the floor,
          because only the floor knows what its parts are: `FiberScene`'s
          `subject` effect. This component keeps the one thing that cannot live
          there — a real, focusable, 44 px button standing at the part's own
          anchor, so the part is reachable by pointer, by keyboard and by the
          `handle-<id>` selector every gate uses.

          `radius` and `hollow` are still taken and still ignored, deliberately:
          two floors pass them and removing a prop from a shared component is a
          separate change from removing what it drew. */}

      <Html center zIndexRange={[28, 18]} style={{ pointerEvents: "none" }}>
        <div className="handle">
          <button
            type="button"
            className={open ? "handle__target handle__target--open" : "handle__target"}
            data-testid={`handle-${id}`}
            data-open={open ? "yes" : "no"}
            /* THE NAME IS THE PART'S OWN, off the same anchor the plate reads,
               so a screen reader and the plate never disagree about what this
               ring is on. "Show" rather than "select": pressing it runs a
               demonstration, and a control that says what it does is the one
               thing §9 lets us write. */
            aria-label={`Show ${label}`}
            aria-pressed={open}
            onPointerEnter={() => setLit(true)}
            onPointerLeave={() => setLit(false)}
            onFocus={() => setLit(true)}
            onBlur={() => setLit(false)}
            onClick={() => onOpen?.(id)}
          />
        </div>
      </Html>
    </group>
  );
}
