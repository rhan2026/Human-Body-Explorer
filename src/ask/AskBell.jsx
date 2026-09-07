import { useEffect, useRef, useState } from "react";
import { sayAgain } from "../guide/sayAgain.js";
import { askAssistant, HISTORY_TURNS, withQuestion } from "./askStream.js";
import { getBellSays, setBellSays } from "./bellSays.js";
import { isRepeatAsk } from "./repeatAsk.js";
import "./ask.css";

/**
 * PARKED, 2026-09-07 — NOT MOUNTED. The box that ships is `guide/AskBell.jsx`:
 * the owner, watching the other session, said *"lets make the visuals for the
 * user text box first. then the api and claude connection the other agent
 * will do it"*, and that box took the corner while this lane became the API
 * behind it (`AskBridge.jsx`). Kept with its sheet and its tests the way the
 * Anatomy Assistant is kept (§8: deletion is a procedure, and the owner's
 * verbatim ask below — white, bottom centre, "Ask Bell anything!" — is still
 * the only written spec of what a box here should look like). `ask.css`'s
 * `--ask-clear` lifts along the foot were reverted with the unmount; nothing
 * reads it.
 *
 * THE BOX THE VISITOR TALKS TO BELL THROUGH.
 *
 * Owner, 2026-09-06: *"integrate my character with the previous chatbot. i need
 * a regtangular box with round corners on the lower center of all windows where
 * the user can communicate with the character. its gonna be white in color with
 * no margins but divided from the background with shadows. inside before the
 * user types anything a light grey text wil be inside the box saying "Ask Bell
 * anything!""*
 *
 * WHAT IT IS NOT. Not the Anatomy Assistant back with a new coat: that widget
 * stays parked (`main.jsx`) and this borrows only its stream client
 * (`askStream.js`). There is no log — the answer is spoken by the character in
 * its own bubble (`guide/Guide.jsx` reads `bellSays.js`), and the box is an
 * input and one button. Enter sends; the button is Stop while a reply is in
 * flight, which aborts the fetch and cancels the model run server-side.
 *
 * MOUNTED ONCE, in the Router beside the scrim, where the assistant was: the
 * one place that outlives a scale change, so a question asked on BODY can be
 * answered on FIBER when the model moves the viewer there.
 *
 * The conversation lives here and nowhere else — the last twelve turns, the
 * widget's number — and starts empty on every visit.
 *
 * AND A LINE THAT ONLY ASKS FOR A REPEAT never leaves the page. Owner: *"if the
 * user requests to reshow the text through the text box feature … the same
 * content should reappear"* — `repeatAsk.js` tells a repeat from a question,
 * and `guide/sayAgain.js` is the seam the character listens on. No request,
 * no token spent, the input clears the same way.
 */
export default function AskBell() {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  // The in-flight request, for Stop and for unmount cleanup.
  const abortRef = useRef(null);
  const history = useRef([]);

  // A request left running when the box unmounts is cancelled.
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * The bubble answers the press before the network is touched: the dots
   * appear, the input clears, and the stream then fills the same bubble.
   */
  const send = async () => {
    if (isRepeatAsk(draft)) {
      sayAgain();
      setDraft("");
      return;
    }
    const turns = withQuestion(history.current, draft);
    if (!turns || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    history.current = turns;
    setBellSays({ status: "thinking", text: "", note: null });
    setDraft("");
    setBusy(true);
    try {
      await askAssistant(turns, { signal: controller.signal, patch: setBellSays });
    } finally {
      const said = getBellSays();
      if (said.status === "complete" && said.text) {
        history.current = [...turns, { role: "assistant", text: said.text }].slice(-HISTORY_TURNS);
      }
      abortRef.current = null;
      setBusy(false);
    }
  };

  return (
    <form
      className="ask-bell"
      data-testid="ask-bell"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {/* The placeholder is the accessible name — the owner's sentence, and the
          only words on the box. A separate label is text nobody asked for. */}
      <input
        className="ask-bell__input"
        data-testid="ask-bell-input"
        placeholder="Ask Bell anything!"
        value={draft}
        autoComplete="off"
        enterKeyHint="send"
        onChange={(event) => setDraft(event.target.value)}
      />
      {busy ? (
        <button
          type="button"
          className="ask-bell__send ask-bell__send--stop"
          data-testid="ask-bell-send"
          aria-label="Stop"
          onClick={() => abortRef.current?.abort()}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
          </svg>
        </button>
      ) : (
        <button type="submit" className="ask-bell__send" data-testid="ask-bell-send" aria-label="Send">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M2.5 8h10M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </form>
  );
}
