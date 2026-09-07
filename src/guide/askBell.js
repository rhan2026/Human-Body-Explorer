/**
 * THE TWO SEAMS BETWEEN BELL AND THE VISITOR'S QUESTION BOX.
 *
 * Owner, 2026-09-07: *"because the other agent is taking so much time lets make
 * the visuals for the user text box first. then the api and claude connection
 * the other agent will do it"*. This file is the whole contract between the two
 * halves, so the other lane can build against it without reading `AskBell.jsx`
 * or `Guide.jsx`:
 *
 *   askBell(text, context)  — the visitor pressed Ask. `text` is their words,
 *                             `context` is `getAssistantContext()`: what the
 *                             screen holds at that moment, the same object the
 *                             parked assistant posted. Listen on `window` for
 *                             `ASK_BELL`; `event.detail` is `{ text, context }`.
 *
 *   bellSays(text)          — the answer, one sentence, for Bell to say where it
 *                             stands: typed, timed, faded like any other line,
 *                             and superseded by the walk's next beat. `null`
 *                             clears it. Anything streamed should be handed
 *                             over whole; the bubble types it itself.
 *
 * Window Events, the shape `PASS_ENDED`, `SAY_AGAIN` and `GUIDE_ARRIVED` already
 * use: the composer lives in the shell and Bell is mounted by four scenes, and a
 * prop through all of them is a wire nobody wants to hold. `askBell.test.js`
 * holds both names.
 *
 * WHAT IS DELIBERATELY NOT HERE: a fetch, a prompt, a thinking state. A
 * composer that reaches a server itself would be the chatbot `ask.js` names as
 * this project's failure mode with a better interface; the API belongs behind
 * `ASK_BELL`, and until something answers there, the box says only what is
 * true — what was asked.
 */
export const ASK_BELL = "hpe:guide-ask";

export function askBell(text, context = null) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ASK_BELL, { detail: { text, context } }));
}

export const BELL_SAYS = "hpe:guide-says";

export function bellSays(text) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BELL_SAYS, { detail: text ?? null }));
}
