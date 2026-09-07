import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyStreamEvent,
  askAssistant,
  goWhereAsked,
  HISTORY_TURNS,
  INTERRUPTED,
  NO_RESPONSE,
  NOT_BEHIND_THIS_PAGE,
  settleFailure,
  settleStream,
  STOPPED,
  TAKEN_THERE,
  withQuestion,
} from "./askStream.js";

/**
 * THE ONE STREAMING CLIENT, extracted from `assistant/AssistantWidget.jsx` on
 * 2026-09-06 so the parked widget and Bell's box speak to /api/assistant
 * through the same code. Every case here is a bubble state the widget already
 * produced; what changed is that it is now a function a test can call.
 */

const live = () => ({ status: "thinking", text: "", note: null });
const patched = (start, events, navigate = () => {}) => {
  let m = start;
  const patch = (up) => {
    m = up(m);
  };
  for (const e of events) applyStreamEvent(e, patch, navigate);
  return m;
};

test("deltas stream, a whole text completes, a notice annotates, done settles", () => {
  assert.deepEqual(patched(live(), [{ delta: "Calcium " }, { delta: "switches it on." }]), {
    status: "streaming",
    text: "Calcium switches it on.",
    note: null,
  });
  assert.equal(patched(live(), [{ text: "The model returned no text." }]).status, "complete");
  assert.equal(patched(live(), [{ delta: "Half" }, { notice: "Cut short — ask for the rest." }]).note, "Cut short — ask for the rest.");
  assert.equal(patched(live(), [{ delta: "All of it." }, { done: true }]).status, "complete");
  // Done with nothing said and nowhere gone: still thinking, so the settle step decides.
  assert.equal(patched(live(), [{ done: true }]).status, "thinking");
});

test("an error keeps what already streamed and says so; with nothing streamed it is the whole answer", () => {
  assert.deepEqual(patched(live(), [{ delta: "AMPK is" }, { error: "Overloaded" }]), {
    status: "complete",
    text: "AMPK is",
    note: INTERRUPTED,
  });
  assert.deepEqual(patched(live(), [{ error: "Overloaded" }]), { status: "error", text: "Overloaded", note: null });
});

test("a navigate event goes through the app's hash grammar and marks the bubble as having moved", () => {
  const calls = [];
  const m = patched(live(), [{ navigate: { view: "fiber" } }, { done: true }], (input) => calls.push(input));
  assert.deepEqual(calls, [{ view: "fiber" }]);
  assert.equal(m.status, "complete");
  assert.equal(m.text, TAKEN_THERE);
});

test("goWhereAsked can only go where a typed URL could, and keeps what it was not told", () => {
  const location = { hash: "#bench_press" };
  goWhereAsked({ view: "fiber" }, location);
  assert.equal(location.hash, "#bench_press/fiber");
  goWhereAsked({ view: "kitchen" }, location);
  assert.equal(location.hash, "#bench_press", "an unknown view lands on the body, never on a scale we do not draw");
  goWhereAsked({ view: "signalling", exercise: "running" }, location);
  assert.equal(location.hash, "#running/signalling");
});

test("a stream that ended without done is settled honestly: kept, taken there, or asked again", () => {
  assert.deepEqual(settleStream({ status: "streaming", text: "Half an answer", note: null }), {
    status: "complete",
    text: "Half an answer",
    note: INTERRUPTED,
  });
  const noted = settleStream({ status: "streaming", text: "Half", note: "Cut short — ask for the rest." });
  assert.equal(noted.note, "Cut short — ask for the rest.", "a note the server wrote is not overwritten");
  assert.equal(settleStream({ status: "thinking", text: "", note: null, navigated: true }).text, TAKEN_THERE);
  assert.deepEqual(settleStream(live()), { status: "error", text: NO_RESPONSE, note: null });
  const done = { status: "complete", text: "All.", note: null };
  assert.equal(settleStream(done), done, "a settled bubble is left exactly as it is");
});

test("Stop keeps the partial answer and says Stopped; a network failure says what it could not reach", () => {
  assert.deepEqual(settleFailure({ status: "streaming", text: "Half", note: null }, new Error("x"), true), {
    status: "complete",
    text: "Half",
    note: STOPPED,
  });
  assert.deepEqual(settleFailure(live(), new Error("x"), true), { status: "error", text: STOPPED, note: null });
  assert.equal(settleFailure({ status: "streaming", text: "Half", note: null }, new Error("boom"), false).note, INTERRUPTED);
  assert.equal(settleFailure(live(), new Error("ECONNREFUSED"), false).text, "The assistant could not reach the API — ECONNREFUSED.");
});

test("a question joins the history, blank questions do not, and the history is the last twelve turns", () => {
  assert.equal(withQuestion([], "   "), null);
  assert.equal(withQuestion([], ""), null);
  assert.deepEqual(withQuestion([], "  What is AMPK?  "), [{ role: "user", text: "What is AMPK?" }]);
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` }));
  const next = withQuestion(many, "and this?");
  assert.equal(next.length, HISTORY_TURNS);
  assert.equal(HISTORY_TURNS, 12);
  assert.equal(next.at(-1).text, "and this?");
  // Error bubbles are interface state, not conversation — they stay out of what the model is shown.
  assert.deepEqual(withQuestion([{ role: "assistant", text: "Stopped.", status: "error" }], "again"), [{ role: "user", text: "again" }]);
});

/** A fetch that answers with NDJSON in chunks cut mid-line and mid-character. */
function ndjsonFetch(lines, { contentType = "application/x-ndjson", split = 7 } = {}) {
  const bytes = new TextEncoder().encode(lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return async (url, init) => {
    ndjsonFetch.last = { url, init };
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += split) controller.enqueue(bytes.subarray(i, i + split));
        controller.close();
      },
    });
    return new Response(body, { headers: { "content-type": contentType } });
  };
}

test("askAssistant posts the history with the screen's context and applies the stream it gets back", async () => {
  let m = live();
  const patch = (up) => {
    m = up(m);
  };
  const history = [{ role: "user", text: "What does calcium do?" }];
  await askAssistant(history, {
    patch,
    context: { currentView: "FIBER" },
    fetchImpl: ndjsonFetch([{ delta: "Calcium — " }, { delta: "café ☕ — switches it on." }, { done: true }]),
  });
  assert.deepEqual(m, { status: "complete", text: "Calcium — café ☕ — switches it on.", note: null });
  const { url, init } = ndjsonFetch.last;
  assert.equal(url, "/api/assistant");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(init.body), { messages: history, context: { currentView: "FIBER" } });
});

test("a page with no server behind it is told so, in the widget's own words", async () => {
  let m = live();
  await askAssistant([{ role: "user", text: "hi" }], {
    patch: (up) => {
      m = up(m);
    },
    context: {},
    fetchImpl: ndjsonFetch([], { contentType: "text/html" }),
  });
  assert.deepEqual(m, { status: "error", text: NOT_BEHIND_THIS_PAGE, note: null });
});

test("a stream that ends without done, an abort, and a thrown fetch all land as bubble states", async () => {
  let m = live();
  const patch = (up) => {
    m = up(m);
  };
  await askAssistant([{ role: "user", text: "hi" }], { patch, context: {}, fetchImpl: ndjsonFetch([{ delta: "Half" }]) });
  assert.deepEqual(m, { status: "complete", text: "Half", note: INTERRUPTED });

  m = live();
  const controller = new AbortController();
  controller.abort();
  await askAssistant([{ role: "user", text: "hi" }], {
    patch,
    context: {},
    signal: controller.signal,
    fetchImpl: async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    },
  });
  assert.deepEqual(m, { status: "error", text: STOPPED, note: null });

  m = live();
  await askAssistant([{ role: "user", text: "hi" }], {
    patch,
    context: {},
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.equal(m.status, "error");
  assert.match(m.text, /could not reach the API — ECONNREFUSED/);
});
