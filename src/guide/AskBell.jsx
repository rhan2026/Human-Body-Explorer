import { useEffect, useRef, useState } from "react";

import { getAssistantContext } from "../shell/assistantContext.js";
import { useBellSays } from "../ask/bellSays.js";
import { askBell, BELL_SAYS } from "./askBell.js";
import { SAY_AGAIN, sayAgain } from "./sayAgain.js";
import "./askBell.css";

/**
 * THE QUESTION BOX, AS BELL'S.
 *
 * Owner, 2026-09-07: *"lets make the visuals for the user text box first. then
 * the api and claude connection the other agent will do it"*. The Anatomy
 * Assistant's panel was unmounted on 2026-09-02 (*"질문 입력창도 일단 없에"*) and
 * the character took its corner. This is the input coming back as the
 * character's: one line to type into, and the answer is a sentence Bell says
 * where it stands — not a log, not a panel. The two seams are in `askBell.js`.
 *
 * WHERE IT SITS: the bottom-right corner, which was Bell's. Three moves in one
 * afternoon, each the owner's on seeing the last: the dock's corner (bottom-
 * left, because the centre had furniture), then *"mvoe the text box to the
 * center"*, then *"in fact i want the text box to be on the bottom right
 * corner, where bell's default position is right now. also i want the box to
 * be a bit longer. thus, bell's default would have to move somewhere else"*.
 * So: bottom-right, 25rem, and Bell now stands ON the box — `Guide.jsx` reads
 * this box's top every frame for its home. On the body's motion floor and on
 * SIGNALS the box steps above the timeline and the scrubber, whose right ends
 * a box this long reaches (`over`, from main.jsx, which knows the floor); Bell
 * rides up with it.
 *
 * TWO STATES. Open, it is the field with its two buttons; closed, a pill that
 * says what it is. Wide screens start open, because the owner asked to see the
 * text box; a phone starts closed, because its foot is where every deep floor
 * stacks its controls and a 44 px field across it at rest is furniture nobody
 * asked for. Escape on an empty field closes it; the character on the left
 * opens and closes it. Focus is taken only when the VISITOR opens it — a field
 * that grabs focus on mount steals the first keystroke from the page.
 *
 * WHAT HAPPENS ON ASK, TODAY: the words go out through `askBell`, the field
 * clears, and what was asked is shown above the box for a few seconds — that
 * much is true. No thinking dots: nothing is thinking yet, and a screen that
 * says otherwise is lying (CLAUDE.md §9). When the other lane answers through
 * `bellSays`, the sentence appears in Bell's bubble; the pending state, if one
 * is wanted, is theirs to add beside the request that makes it true.
 *
 * SAY THAT AGAIN is the owner's ask from 2026-09-06 — the bubble goes after its
 * reading time, and *"if the user requests to reshow the text through the text
 * box feature ... the same content should reappear"*. One press, `sayAgain()`.
 */

/** The dock's own breakpoint: below it the control pill spans the foot. */
const PHONE = "(max-width: 640px)";
/** How long what was asked stays on screen, in ms, when nothing answers it. */
const ASKED_MS = 8000;

const Again = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M13 8a5 5 0 1 1-1.6-3.66" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M13.2 2.8v3.4H9.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Send = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2.5 8h10.5M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function AskBell({ placeholder = "Ask Bell…", over = null }) {
  const [open, setOpen] = useState(() => !(window.matchMedia?.(PHONE).matches ?? false));
  const [draft, setDraft] = useState("");
  const [asked, setAsked] = useState(null);
  const input = useRef(null);
  // Only a visitor's own opening takes focus — see the header.
  const openedByHand = useRef(false);

  useEffect(() => {
    if (open && openedByHand.current) input.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!asked) return undefined;
    const gone = setTimeout(() => setAsked(null), ASKED_MS);
    return () => clearTimeout(gone);
  }, [asked]);

  /* AND IT COMES DOWN THE MOMENT SOMETHING ANSWERS — the API lane, 2026-09-07:
     a sentence through `bellSays` and a repeat both end the wait, so what was
     asked never stands beside the answer to it. A FAILURE ends it too, read
     off the lane's own store rather than sent as `bellSays(null)`: that null
     would also erase the last sentence Bell said, and "again" after an error
     brought nothing back (measured). */
  useEffect(() => {
    const answered = () => setAsked(null);
    window.addEventListener(BELL_SAYS, answered);
    window.addEventListener(SAY_AGAIN, answered);
    return () => {
      window.removeEventListener(BELL_SAYS, answered);
      window.removeEventListener(SAY_AGAIN, answered);
    };
  }, []);
  const says = useBellSays();
  useEffect(() => {
    if (says.status === "error") setAsked(null);
  }, [says.status]);

  const ask = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    askBell(text, getAssistantContext());
    setAsked(text);
    setDraft("");
  };

  /* What is already standing at the bottom centre of this floor, if anything:
     "time" (the body's rep timeline) or "scrub" (SIGNALS' scrubber). */
  const side = over === "time" ? " ask--over-time" : over === "scrub" ? " ask--over-scrub" : "";

  if (!open) {
    return (
      <button
        type="button"
        className={`ask ask--closed${side}`}
        data-testid="ask-bell"
        onClick={() => {
          openedByHand.current = true;
          setOpen(true);
        }}
      >
        <img className="ask__bell" src="/guide/guide.png" alt="" draggable="false" />
        <span className="ask__label">Ask Bell</span>
      </button>
    );
  }

  return (
    <form
      className={`ask${side}`}
      data-testid="ask-bell"
      onSubmit={ask}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !draft) setOpen(false);
      }}
    >
      {asked && (
        <div className="ask__asked" data-testid="ask-bell-asked">
          <span>{asked}</span>
          <button type="button" className="ask__dismiss" aria-label="Dismiss" onClick={() => setAsked(null)}>
            ×
          </button>
        </div>
      )}
      <button type="button" className="ask__fold" aria-label="Put the question box away" onClick={() => setOpen(false)}>
        <img className="ask__bell" src="/guide/guide.png" alt="" draggable="false" />
      </button>
      {/* The placeholder is the accessible name — a separate aria-label is
          hidden words every scale's budget pays for (the parked assistant's
          rule, kept). */}
      <input ref={input} className="ask__input" placeholder={placeholder} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" className="ask__btn" aria-label="Say that again" title="Say that again" onClick={() => sayAgain()}>
        <Again />
      </button>
      <button type="submit" className="ask__btn ask__send" aria-label="Ask" disabled={!draft.trim()}>
        <Send />
      </button>
    </form>
  );
}
