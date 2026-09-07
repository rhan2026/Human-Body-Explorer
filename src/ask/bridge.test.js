import { test } from "node:test";
import assert from "node:assert/strict";
import { attachAskBridge } from "./bridge.js";
import { ASK_BELL } from "../guide/askBell.js";
import { HISTORY_TURNS, NOT_BEHIND_THIS_PAGE } from "./askStream.js";
import { IDLE } from "./bellSays.js";

/**
 * THE API BEHIND THE BOX, driven with a fake window and a fake server so no
 * gate ever spends a token. Every case is one of the bridge's promises in
 * `bridge.js`'s header: repeat → sayAgain and nothing else; a question →
 * thinking, the stream, the whole sentence handed over and idle in the same
 * tick; a failure → the error state and the box told; a new question aborts
 * the old; navigate executed; the history rolling at twelve.
 */
function harness({ fetchImpl, repeat } = {}) {
  const win = new EventTarget();
  const calls = { sayAgain: 0, bellSays: [], says: [], navigate: [], fetch: [] };
  const fetcher = fetchImpl ?? (async () => ndjson([{ delta: "Calcium " }, { delta: "switches it on." }, { done: true }]));
  const detach = attachAskBridge({
    win,
    fetchImpl: async (url, init) => {
      calls.fetch.push({ url, init });
      return fetcher(url, init);
    },
    navigate: (input) => calls.navigate.push(input),
    sayAgain: () => calls.sayAgain++,
    bellSays: (t) => calls.bellSays.push(t),
    setSays: (s) => calls.says.push(typeof s === "function" ? s(calls.says.at(-1) ?? IDLE) : s),
    getSays: () => calls.says.at(-1) ?? IDLE,
    ...(repeat ? { repeat } : {}),
  });
  const ask = (text, context = { currentView: "BODY" }) => win.dispatchEvent(new CustomEvent(ASK_BELL, { detail: { text, context } }));
  return { win, calls, ask, detach };
}

function ndjson(lines, contentType = "application/x-ndjson") {
  const bytes = new TextEncoder().encode(lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    { headers: { "content-type": contentType } },
  );
}
const settle = () => new Promise((r) => setTimeout(r, 30));

test("a repeat goes to sayAgain and touches neither the server nor the store — unless the error line is up, which it puts away", async () => {
  const h = harness();
  h.ask("say that again");
  await settle();
  assert.equal(h.calls.sayAgain, 1);
  assert.equal(h.calls.fetch.length, 0);
  assert.deepEqual(h.calls.says, []);
  assert.deepEqual(h.calls.bellSays, []);
  h.detach();

  const failed = harness({ fetchImpl: async () => ndjson([], "text/html") });
  failed.ask("Why?");
  await settle();
  assert.equal(failed.calls.says.at(-1).status, "error");
  failed.ask("again");
  await settle();
  assert.deepEqual(failed.calls.says.at(-1), IDLE, "a repeat under the error line puts the error away so the last sentence can come back");
  assert.equal(failed.calls.sayAgain, 1);
  failed.detach();
});

test("a question: thinking, the stream with history and the event's context, the whole sentence handed over, idle in the same tick", async () => {
  const h = harness();
  h.ask("What does calcium do?", { currentView: "FIBER" });
  await settle();
  assert.deepEqual(h.calls.says[0], { status: "thinking", text: "", note: null });
  assert.equal(h.calls.fetch.length, 1);
  const body = JSON.parse(h.calls.fetch[0].init.body);
  assert.deepEqual(body.messages, [{ role: "user", text: "What does calcium do?" }]);
  assert.deepEqual(body.context, { currentView: "FIBER" });
  assert.deepEqual(h.calls.bellSays, ["Calcium switches it on."]);
  assert.deepEqual(h.calls.says.at(-1), IDLE);
  assert.ok(h.calls.says.every((s) => s.status !== "streaming" && s.status !== "complete"), "the store learns only the wait and the failure");
  // The next question carries the exchange.
  h.ask("And troponin?");
  await settle();
  const second = JSON.parse(h.calls.fetch[1].init.body).messages;
  assert.deepEqual(second.map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(second[1].text, "Calcium switches it on.");
  h.detach();
});

test("a note rides on the sentence; a failure is the error state and the box is told", async () => {
  const cut = harness({ fetchImpl: async () => ndjson([{ delta: "Half" }, { notice: "Cut short — ask for the rest." }, { done: true }]) });
  cut.ask("Why?");
  await settle();
  assert.deepEqual(cut.calls.bellSays, ["Half — Cut short — ask for the rest."]);
  cut.detach();

  const down = harness({ fetchImpl: async () => ndjson([], "text/html") });
  down.ask("Why?");
  await settle();
  assert.deepEqual(down.calls.bellSays, [], "a failure is never bellSays(null) — that erases the last sentence Bell said");
  assert.deepEqual(down.calls.says.at(-1), { status: "error", text: NOT_BEHIND_THIS_PAGE, note: null });
  down.detach();

  const thrown = harness({
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  thrown.ask("Why?");
  await settle();
  assert.equal(thrown.calls.says.at(-1).status, "error");
  assert.match(thrown.calls.says.at(-1).text, /could not reach the API — ECONNREFUSED/);
  thrown.detach();
});

test("a new question aborts the one in flight, and only the newer one answers", async () => {
  let resolveFirst;
  const h = harness({
    fetchImpl: (url, init) =>
      new Promise((resolve, reject) => {
        if (!resolveFirst) {
          resolveFirst = () => resolve(ndjson([{ delta: "old" }, { done: true }]));
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        } else resolve(ndjson([{ delta: "new" }, { done: true }]));
      }),
  });
  h.ask("first");
  await settle();
  h.ask("second");
  await settle();
  assert.equal(h.calls.fetch[0].init.signal.aborted, true, "the first request must be aborted");
  assert.deepEqual(h.calls.bellSays, ["new"]);
  h.detach();
});

test("a navigate event is executed through the client, and the history holds twelve turns", async () => {
  const h = harness({ fetchImpl: async () => ndjson([{ navigate: { view: "fiber" } }, { delta: "Look at the sarcomere." }, { done: true }]) });
  h.ask("take me to the fiber");
  await settle();
  assert.deepEqual(h.calls.navigate, [{ view: "fiber" }]);
  assert.deepEqual(h.calls.bellSays, ["Look at the sarcomere."]);
  for (let i = 0; i < 10; i++) {
    h.ask(`q${i}`);
    await settle();
  }
  const last = JSON.parse(h.calls.fetch.at(-1).init.body).messages;
  assert.ok(last.length <= HISTORY_TURNS, `history is ${last.length} turns`);
  h.detach();
});

test("detached, it no longer listens", async () => {
  const h = harness();
  h.detach();
  h.ask("anything?");
  await settle();
  assert.equal(h.calls.fetch.length, 0);
});
