import { getAssistantContext } from "../shell/assistantContext.js";
import { parseHash, serializeHash, currentRoute, go } from "../scaleRoute.js";
import { showGroups, showMuscle } from "../shell/showGroups.js";

/**
 * THE ONE STREAMING CLIENT for POST /api/assistant.
 *
 * EXTRACTED from `assistant/AssistantWidget.jsx` on 2026-09-06 rather than
 * copied: the widget is parked (see `main.jsx`) and Bell's box (`AskBell.jsx`)
 * asks the same server the same way, so there is one reader of the NDJSON
 * protocol `server/assistantMiddleware.js` writes, one place the "not
 * connected" / "Stopped." / "Response interrupted." lines live, and one
 * `navigate` executor. The widget imports from here and its behaviour is
 * unchanged; every function below is a bubble state it already produced.
 *
 * The protocol, one JSON object per line:
 *   {"delta":"…"}     a piece of the answer, append it
 *   {"text":"…"}      a complete non-streamed reply (no key, an API error, a mock)
 *   {"notice":"…"}    a small status line under the answer
 *   {"error":"…"}     the stream failed; keep what arrived
 *   {"navigate":{…}}  the model moved the viewer; done through the hash grammar
 *   {"show":{groups}}  the model changed which muscle groups the body shows
 *   {"show":{muscle}}  the model singled one muscle out, {key,label}
 *   {"done":true}     finished
 *
 * `patch(up)` is the caller's own state write — the widget patches the last
 * message of its log, the box patches the one answer in `bellSays.js` — so
 * this file knows nothing about React.
 */

export const HISTORY_TURNS = 12;
export const NOT_BEHIND_THIS_PAGE = "The assistant is not connected behind this page — no server answers /api/assistant.";
export const INTERRUPTED = "Response interrupted.";
export const STOPPED = "Stopped.";
export const NO_RESPONSE = "Couldn't get a response. Try again.";
export const TAKEN_THERE = "Taken there.";
export const couldNotReach = (message) => `The assistant could not reach the API — ${message}.`;

/**
 * The history with a new question on it, or null when there is no question.
 * Error bubbles are interface state, not conversation — they stay out of what
 * the model is shown — and the last twelve turns are what the server keeps
 * anyway (`shapeMessages`), so nothing older is carried.
 */
export function withQuestion(history, asked) {
  const text = String(asked ?? "").trim();
  if (!text) return null;
  return [...history.filter((m) => m.status !== "error"), { role: "user", text }].slice(-HISTORY_TURNS);
}

/**
 * A navigate event, executed through the app's own hash grammar: the model
 * can only go where a typed URL could, and whatever it does not name keeps
 * the viewer's current exercise and muscle. The Router does the rest — the
 * box and the widget both survive every scale change by construction.
 */
export function goWhereAsked(input, location = null) {
  /* The app's address is a path (no `#`, 2026-09-07): with no `location` this reads
     `currentRoute()` and moves through `go()`; a caller that hands a location
     object (the tests) is read and written through its `hash`, the grammar both
     share. */
  const current = parseHash(location ? location.hash : currentRoute());
  const view = String(input.view ?? "");
  const scale = ["fiber", "cell", "signalling"].includes(view) ? view : "body";
  const route = serializeHash({
    exercise: input.exercise ?? current.exercise ?? null,
    muscle: input.muscle ?? current.muscle ?? null,
    scale,
    t: null,
  });
  if (location) location.hash = route;
  else go(route);
}

/** One streamed NDJSON event applied to the live bubble. */
export function applyStreamEvent(event, patch, navigate = goWhereAsked, show = showGroups, single = showMuscle) {
  if (event.navigate && typeof event.navigate === "object") {
    navigate(event.navigate);
    patch((m) => ({ ...m, navigated: true }));
  } else if (event.show && typeof event.show === "object") {
    /* The model changed what the body shows. `navigated` on the message is the
       flag that lets a wordless turn still complete (see `done` below), and
       acting on the picture is the same kind of thing as moving to it. */
    if (event.show.muscle) single(event.show.muscle);
    else show(event.show.groups);
    patch((m) => ({ ...m, navigated: true }));
  } else if (typeof event.delta === "string") {
    patch((m) => ({ ...m, status: "streaming", text: m.text + event.delta }));
  } else if (typeof event.text === "string") {
    // A complete non-streamed reply: no key, an API error, or a test mock.
    patch((m) => ({ ...m, status: "complete", text: event.text }));
  } else if (typeof event.error === "string") {
    patch((m) => (m.text ? { ...m, status: "complete", note: INTERRUPTED } : { ...m, status: "error", text: event.error }));
  } else if (typeof event.notice === "string") {
    patch((m) => ({ ...m, note: event.notice }));
  } else if (event.done) {
    patch((m) => (m.text || m.navigated ? { ...m, status: "complete", text: m.text || TAKEN_THERE } : m));
  }
}

/** A stream that ended without saying done: keep what arrived, say so. */
export function settleStream(m) {
  if (m.status === "complete" || m.status === "error") return m;
  if (m.text) return { ...m, status: "complete", note: m.note ?? INTERRUPTED };
  if (m.navigated) return { ...m, status: "complete", text: TAKEN_THERE };
  return { ...m, status: "error", text: NO_RESPONSE };
}

/** Stopped on purpose keeps the partial answer, marked; a failure says what it could not reach. */
export function settleFailure(m, error, aborted) {
  if (aborted) return m.text ? { ...m, status: "complete", note: STOPPED } : { ...m, status: "error", text: STOPPED };
  return m.text
    ? { ...m, status: "complete", note: INTERRUPTED }
    : { ...m, status: "error", text: couldNotReach(error?.message ?? String(error)) };
}

/**
 * NDJSON, decoded as a byte stream: a UTF-8 character or a JSON line may span
 * network chunks, so lines are cut only on newlines and the decoder keeps its
 * state between reads.
 */
export async function readNdjson(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = pending.indexOf("\n")) !== -1) {
      const lineText = pending.slice(0, cut).trim();
      pending = pending.slice(cut + 1);
      if (lineText) onEvent(JSON.parse(lineText));
    }
  }
  if (pending.trim()) onEvent(JSON.parse(pending.trim()));
}

/**
 * Ask, and patch the live bubble until the answer is settled. The caller has
 * already put the bubble into "thinking" and owns Stop (`signal`) and its own
 * busy flag; this resolves once the bubble is complete or error, never throws.
 * `context` is read at the moment of Send — what the screen holds right now.
 */
export async function askAssistant(
  history,
  { patch, signal, context = getAssistantContext(), fetchImpl = (...args) => globalThis.fetch(...args), navigate = goWhereAsked },
) {
  try {
    const res = await fetchImpl("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history, context }),
      signal,
    });
    // A static host answers a POST with its 404 page, not JSON: that is
    // "no server here", and it is said as such rather than parsed.
    if (!(res.headers.get("content-type") ?? "").includes("json")) {
      patch((m) => ({ ...m, status: "error", text: NOT_BEHIND_THIS_PAGE }));
      return;
    }
    await readNdjson(res.body, (event) => applyStreamEvent(event, patch, navigate));
    patch(settleStream);
  } catch (e) {
    const aborted = Boolean(signal?.aborted);
    patch((m) => settleFailure(m, e, aborted));
  }
}
