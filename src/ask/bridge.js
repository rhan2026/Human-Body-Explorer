import { getAssistantContext } from "../shell/assistantContext.js";
import { bellSays as tellBell, ASK_BELL } from "../guide/askBell.js";
import { sayAgain as askAgain } from "../guide/sayAgain.js";
import { askAssistant, HISTORY_TURNS, withQuestion } from "./askStream.js";
import { getBellSays, IDLE, setBellSays } from "./bellSays.js";
import { isRepeatAsk } from "./repeatAsk.js";

/**
 * THE API BEHIND THE QUESTION BOX.
 *
 * Owner, 2026-09-07, to the other session: *"lets make the visuals for the
 * user text box first. then the api and claude connection the other agent
 * will do it"*. The box is `guide/AskBell.jsx` and its two seams are
 * `guide/askBell.js`: `ASK_BELL` carries the visitor's words and what the
 * screen holds, `bellSays(text)` hands a sentence to the character to say
 * where it stands. This is what stands between the two.
 *
 * WHAT IT DOES WITH A LINE. A line that only asks for a repeat (`repeatAsk.js`)
 * goes to `sayAgain()` and nowhere else — no request, no token. Anything else
 * goes through the one stream client (`askStream.js`) with the rolling history
 * (the last twelve turns, held here and nowhere else) and the event's own
 * context, exactly as the parked widget posted it. While the model runs the
 * one store (`bellSays.js`) says `thinking`, so the character shows the dots;
 * the streamed text is gathered here and handed over WHOLE on `done` through
 * `bellSays` — the bubble types it itself, and that is the talking. Then the
 * store goes idle, in the same tick, so the dots and the sentence never show
 * at once. A `navigate` event is executed as the client always has. A failure
 * puts the store into `error` — the character's error line, never faded,
 * cleared by the next question — and the box reads that store to take what
 * was asked down; it is NOT told `bellSays(null)`, which would erase the last
 * sentence Bell said and leave "again" nothing to bring back (measured
 * 2026-09-07). A new question aborts the one in flight.
 *
 * A repeat asked while the error line is up also puts the error away: the
 * visitor wants the last sentence back, and the failure that blocked it is
 * not a reason to keep blocking it.
 *
 * `attach` takes its window and its collaborators as arguments so a test can
 * drive it with an EventTarget and a fake fetch; the component passes the real
 * ones.
 */
export function attachAskBridge({
  win = window,
  fetchImpl,
  context = null,
  navigate,
  sayAgain = askAgain,
  bellSays = tellBell,
  setSays = setBellSays,
  getSays = getBellSays,
  repeat = isRepeatAsk,
} = {}) {
  let history = [];
  let inFlight = null;

  const onAsk = async (event) => {
    const text = String(event?.detail?.text ?? "").trim();
    if (!text) return;
    if (repeat(text)) {
      if (getSays().status === "error") setSays(IDLE);
      /* A tick later, not now: the box dispatches ASK_BELL before it shows
         what was asked, and its own SAY_AGAIN listener clears that — so a
         repeat said synchronously would be cleared first and shown after.
         Measured 2026-09-07: the chip read "again" for its eight seconds. */
      setTimeout(sayAgain, 0);
      return;
    }
    const turns = withQuestion(history, text);
    if (!turns) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    history = turns;
    setSays({ status: "thinking", text: "", note: null });
    /* The live reply, gathered here: the store only ever learns the wait
       and the failure, the bubble types the words when they are whole. */
    let live = { status: "thinking", text: "", note: null };
    const patch = (up) => {
      live = up(live);
    };
    await askAssistant(turns, {
      patch,
      signal: controller.signal,
      context: event?.detail?.context ?? context ?? getAssistantContext(),
      fetchImpl,
      navigate,
    });
    if (inFlight !== controller) return; // superseded by a newer question
    inFlight = null;
    if (live.status === "complete") {
      const said = live.note ? `${live.text} — ${live.note}` : live.text;
      history = [...turns, { role: "assistant", text: live.text }].slice(-HISTORY_TURNS);
      bellSays(said);
      setSays(IDLE);
    } else {
      setSays({ status: "error", text: live.text || "Couldn't get a response. Try again.", note: null });
    }
  };

  win.addEventListener(ASK_BELL, onAsk);
  return () => {
    win.removeEventListener(ASK_BELL, onAsk);
    inFlight?.abort();
  };
}
