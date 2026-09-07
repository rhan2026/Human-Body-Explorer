import { useSyncExternalStore } from "react";

/**
 * WHAT BELL IS SAYING RIGHT NOW — the one answer, held outside React.
 *
 * Owner, 2026-09-06: *"integrate my character with the previous chatbot … where
 * the user can communicate with the character"*. The visitor types into the box
 * at the foot of every window (`AskBell.jsx`, mounted once in the Router) and
 * the reply arrives in Bell's own bubble (`guide/Guide.jsx`, mounted inside
 * whichever scene is up). The two share no parent, and putting the box inside
 * every scene would remount it — and cancel a reply in flight — on each scale
 * change. So this is `shell/uiState.js`'s shape exactly: module scope and
 * `useSyncExternalStore`, nothing persisted.
 *
 * ONE ANSWER, NOT A LOG. What is decided against is a message list: the
 * character answers, the previous answer is gone, the way a spoken reply is.
 * `bellSays.test.js` pins the absence.
 *
 * CONTRACT — `{ status, text, note }`, and since 2026-09-07 only the WAIT and
 * the FAILURE live here: the answer itself is handed to the character whole
 * through `guide/askBell.js`'s `bellSays` and typed like any line.
 *   idle       nothing asked; the bubble shows the line
 *   thinking   sent, nothing back yet — the three dots
 *   error      the error line, as the text; never fades, the next question
 *              clears it
 * Written by `bridge.js`; read by `Guide.jsx`. Derived points: `guide.css`
 * `.guide--answering`, `.guide__say--thinking`, `.guide__say--error`.
 */
export const IDLE = Object.freeze({ status: "idle", text: "", note: null });

let answer = IDLE;
const listeners = new Set();

export function getBellSays() {
  return answer;
}

export function setBellSays(next) {
  const value = typeof next === "function" ? next(answer) : next;
  if (value === answer) return;
  answer = Object.freeze({ ...value });
  for (const listener of listeners) listener();
}

export function subscribeBellSays(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBellSays() {
  return useSyncExternalStore(subscribeBellSays, getBellSays);
}
