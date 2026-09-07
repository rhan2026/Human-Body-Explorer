import { test } from "node:test";
import assert from "node:assert/strict";
import { ANATOMY_ASSISTANT_SYSTEM_PROMPT } from "./anatomyAssistantPrompt.js";
import {
  createAssistantHandler,
  DEFAULT_MAX_TOKENS,
  DETAILED_MAX_TOKENS,
  MODEL,
  NOT_CONNECTED,
  outputBudget,
  shapeMessages,
  sseEvents,
} from "./assistantMiddleware.js";

function request({ method = "POST", url = "/api/assistant", headers = {}, body = "" } = {}) {
  const buf = Buffer.from(body);
  return {
    method,
    url,
    headers: { host: "127.0.0.1:5175", "content-type": "application/json", ...headers },
    async *[Symbol.asyncIterator]() {
      // Two chunks, so the size cap is measured across chunks, not per chunk.
      const half = Math.ceil(buf.length / 2);
      yield buf.subarray(0, half);
      yield buf.subarray(half);
    },
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    chunks: [],
    ended: false,
    headersSent: false,
    closeHandlers: [],
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    on(name, cb) {
      if (name === "close") this.closeHandlers.push(cb);
    },
    write(s) {
      this.headersSent = true;
      this.chunks.push(String(s));
    },
    end(s) {
      if (s) this.write(s);
      this.ended = true;
      this.writableEnded = true;
    },
    get body() {
      return this.chunks.join("");
    },
    get lines() {
      return this.body.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    },
  };
}

async function run(handler, req) {
  const res = response();
  let nexted = false;
  await handler(req, res, () => {
    nexted = true;
  });
  // `json` only parses when the reply was a single JSON body; a streamed
  // NDJSON reply is read through res.lines instead.
  let json = null;
  try {
    json = res.body ? JSON.parse(res.body) : null;
  } catch {
    /* a multi-line stream; use res.lines */
  }
  return { res, nexted, json };
}

/** An upstream Messages API stream: ok response whose body speaks SSE. */
function sse(events) {
  const text = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  return {
    ok: true,
    status: 200,
    body: {
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(text);
      },
    },
  };
}

const delta = (text) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
const stop = (reason) => ({ type: "message_delta", delta: { stop_reason: reason }, usage: {} });
const question = (context, messages = [{ role: "user", text: "What does this muscle do?" }]) =>
  JSON.stringify({ messages, context });

test("anything but POST /api/assistant passes through", async () => {
  const handler = createAssistantHandler({ apiKey: "k", fetchImpl: () => assert.fail("must not call upstream") });
  assert.equal((await run(handler, request({ url: "/index.html", method: "GET" }))).nexted, true);
  assert.equal((await run(handler, request({ url: "/api/assistant", method: "GET" }))).nexted, true);
  assert.equal((await run(handler, request({ url: "/api/other" }))).nexted, true);
});

test("only the page may ask: JSON content type, and an Origin that is this host", async () => {
  const handler = createAssistantHandler({ apiKey: "k", fetchImpl: () => assert.fail("must not call upstream") });
  const plain = await run(handler, request({ headers: { "content-type": "text/plain" }, body: question({}) }));
  assert.equal(plain.res.statusCode, 415);
  const foreign = await run(handler, request({ headers: { origin: "https://evil.example" }, body: question({}) }));
  assert.equal(foreign.res.statusCode, 403);
  const own = createAssistantHandler({ apiKey: "k", fetchImpl: async () => sse([delta("hi"), stop("end_turn")]) });
  const same = await run(own, request({ headers: { origin: "http://127.0.0.1:5175" }, body: question({}) }));
  assert.equal(same.res.statusCode, 200);
  assert.deepEqual(same.res.lines, [{ delta: "hi" }, { done: true }]);
});

test("a malformed or oversized body is refused before any key is spent", async () => {
  const handler = createAssistantHandler({ apiKey: "k", fetchImpl: () => assert.fail("must not call upstream") });
  assert.equal((await run(handler, request({ body: "{not json" }))).res.statusCode, 400);
  const big = await run(handler, request({ body: question({ selectedMuscle: "x".repeat(70_000) }) }));
  assert.equal(big.res.statusCode, 413);
  const empty = await run(handler, request({ body: question({}, [{ role: "assistant", text: "welcome" }]) }));
  assert.equal(empty.res.statusCode, 400, "a conversation with no user turn has no question");
});

test("with no key the answer says so as one plain JSON body, and upstream is never called", async () => {
  const handler = createAssistantHandler({ apiKey: undefined, fetchImpl: () => assert.fail("must not call upstream") });
  const r = await run(handler, request({ body: question({ currentView: "BODY" }) }));
  assert.equal(r.res.statusCode, 200);
  assert.equal(r.res.headers["content-type"], "application/json");
  assert.equal(r.json.text, NOT_CONNECTED);
});

test("the upstream request streams, carries the stable prompt + context + shaped history, and no thinking", async () => {
  let sent = null;
  const handler = createAssistantHandler({
    apiKey: "secret",
    fetchImpl: async (url, init) => {
      sent = { url, init };
      return sse([delta("The pectoralis major"), delta(" adducts the arm."), stop("end_turn")]);
    },
  });
  const messages = [
    { role: "assistant", text: "Pick an exercise in the menu and the muscles it works light up on the body." },
    { role: "user", text: "Why is this highlighted?" },
    { role: "assistant", text: "Because it is a primary mover." },
    { role: "user", text: "And this one?" },
  ];
  const r = await run(handler, request({ body: question({ currentView: "SHOW_MOTION", selectedExercise: "Bench press", selectedMuscle: null }, messages) }));
  assert.equal(r.res.headers["content-type"], "application/x-ndjson");
  assert.deepEqual(r.res.lines, [{ delta: "The pectoralis major" }, { delta: " adducts the arm." }, { done: true }]);
  assert.equal(sent.url, "https://api.anthropic.com/v1/messages");
  assert.equal(sent.init.headers["x-api-key"], "secret");
  const payload = JSON.parse(sent.init.body);
  assert.equal(payload.model, MODEL);
  assert.equal(payload.stream, true);
  assert.equal(payload.max_tokens, DEFAULT_MAX_TOKENS);
  assert.deepEqual(payload.thinking, { type: "disabled" }, "thinking tokens would eat the answer's max_tokens");
  assert.equal(payload.system[0].text, ANATOMY_ASSISTANT_SYSTEM_PROMPT);
  assert.deepEqual(payload.system[0].cache_control, { type: "ephemeral" });
  assert.equal(payload.system[1].text, "APPLICATION CONTEXT\nCurrent view: SHOW_MOTION\nSelected exercise: Bench press\nSelected muscle: None");
  assert.deepEqual(payload.messages, [
    { role: "user", content: "Why is this highlighted?" },
    { role: "assistant", content: "Because it is a primary mover." },
    { role: "user", content: "And this one?" },
  ]);
});

test("the output budget follows intent: small by default, larger only for an explicit ask for depth", () => {
  assert.equal(outputBudget([{ role: "user", content: "What is AMPK?" }]), DEFAULT_MAX_TOKENS);
  assert.equal(outputBudget([{ role: "user", content: "Explain muscle contraction step by step in detail." }]), DETAILED_MAX_TOKENS);
  assert.equal(outputBudget([{ role: "user", content: "walk me through the whole mechanism" }]), DETAILED_MAX_TOKENS);
  assert.equal(
    outputBudget([
      { role: "user", content: "explain in detail" },
      { role: "assistant", content: "…" },
      { role: "user", content: "thanks — and what is mTOR?" },
    ]),
    DEFAULT_MAX_TOKENS,
    "the budget follows the LAST question, not an earlier one",
  );
});

test("refusal, empty and cut-short streams are said in the stream's own words", async () => {
  const refused = createAssistantHandler({ apiKey: "k", fetchImpl: async () => sse([stop("refusal")]) });
  assert.deepEqual((await run(refused, request({ body: question({}) }))).res.lines, [
    { delta: "The assistant declined to answer that one." },
    { done: true },
  ]);
  const emptyStream = createAssistantHandler({ apiKey: "k", fetchImpl: async () => sse([stop("end_turn")]) });
  assert.deepEqual((await run(emptyStream, request({ body: question({}) }))).res.lines, [
    { text: "The model returned no text." },
    { done: true },
  ]);
  const cut = createAssistantHandler({ apiKey: "k", fetchImpl: async () => sse([delta("Half an answer"), stop("max_tokens")]) });
  assert.deepEqual((await run(cut, request({ body: question({}) }))).res.lines, [
    { delta: "Half an answer" },
    { notice: "Cut short — ask for the rest." },
    { done: true },
  ]);
});

test("an upstream error event keeps the text that already streamed", async () => {
  const mid = createAssistantHandler({
    apiKey: "k",
    fetchImpl: async () => sse([delta("AMPK is"), { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]),
  });
  assert.deepEqual((await run(mid, request({ body: question({}) }))).res.lines, [
    { delta: "AMPK is" },
    { notice: "Response interrupted." },
    { done: true },
  ]);
  const early = createAssistantHandler({
    apiKey: "k",
    fetchImpl: async () => sse([{ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]),
  });
  assert.deepEqual((await run(early, request({ body: question({}) }))).res.lines, [
    { text: "Couldn't get a response. Try again." },
    { done: true },
  ]);
});

test("API and network failures before any stream land as one plain JSON body", async () => {
  const apiError = createAssistantHandler({
    apiKey: "k",
    fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "rate limited" } }) }),
  });
  assert.equal((await run(apiError, request({ body: question({}) }))).json.text, "The assistant hit an API error — rate limited.");
  const down = createAssistantHandler({ apiKey: "k", fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  assert.equal((await run(down, request({ body: question({}) }))).json.text, "The assistant could not reach the API — ECONNREFUSED.");
});

test("a browser that leaves mid-stream aborts the model run", async () => {
  let captured = null;
  let closeRes = null;
  const handler = createAssistantHandler({
    apiKey: "k",
    fetchImpl: async (_url, init) => {
      captured = init.signal;
      return {
        ok: true,
        status: 200,
        body: {
          async *[Symbol.asyncIterator]() {
            yield Buffer.from(`event: e\ndata: ${JSON.stringify(delta("first"))}\n\n`);
            closeRes();
            yield Buffer.from(`event: e\ndata: ${JSON.stringify(delta("second"))}\n\n`);
          },
        },
      };
    },
  });
  const res = response();
  closeRes = () => res.closeHandlers.forEach((cb) => cb());
  await handler(request({ body: question({}) }), res, () => {});
  assert.ok(captured instanceof AbortSignal);
  assert.equal(captured.aborted, true, "the client closing must abort the upstream request");
});

test("SSE frames survive multi-byte characters split across network chunks", async () => {
  const frame = `event: content_block_delta\ndata: ${JSON.stringify(delta("café ☕ done"))}\n\n`;
  const bytes = Buffer.from(frame);
  // Split inside the multi-byte é.
  const splitAt = frame.indexOf("é") + 1;
  const body = {
    async *[Symbol.asyncIterator]() {
      yield bytes.subarray(0, splitAt);
      yield bytes.subarray(splitAt);
    },
  };
  const events = [];
  for await (const e of sseEvents(body)) events.push(e);
  assert.equal(events.length, 1);
  assert.equal(events[0].delta.text, "café ☕ done");
});

test("a navigate call pauses the model; the tool result goes back and the explanation streams on round two", async () => {
  const calls = [];
  const handler = createAssistantHandler({
    apiKey: "k",
    fetchImpl: async (_url, init) => {
      const payload = JSON.parse(init.body);
      calls.push(payload);
      if (calls.length === 1) {
        if (payload.tools?.[0]?.name !== "navigate") throw new Error("navigate tool not declared");
        return sse([
          { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "navigate" } },
          { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"view":"sign' } },
          { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: 'alling","exercise":"running"}' } },
          { type: "content_block_stop", index: 0 },
          stop("tool_use"),
        ]);
      }
      return sse([delta("You're on the signalling network — watch the endurance line."), stop("end_turn")]);
    },
  });
  const r = await run(handler, request({ body: question({ currentView: "BODY" }) }));
  assert.deepEqual(r.res.lines, [
    { navigate: { view: "signalling", exercise: "running" } },
    { delta: "You're on the signalling network — watch the endurance line." },
    { done: true },
  ]);
  assert.equal(calls.length, 2, "the tool result must be returned and the turn continued");
  const second = calls[1].messages;
  assert.equal(second.at(-2).role, "assistant");
  assert.deepEqual(second.at(-2).content.at(-1), { type: "tool_use", id: "t1", name: "navigate", input: { view: "signalling", exercise: "running" } });
  assert.equal(second.at(-1).role, "user");
  assert.equal(second.at(-1).content[0].type, "tool_result");
  assert.equal(second.at(-1).content[0].tool_use_id, "t1");
});

test("the loop stops at two rounds: a second tool call is forwarded but not continued", async () => {
  let calls = 0;
  const toolStream = () =>
    sse([
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: `t${calls}`, name: "navigate" } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"view":"fiber"}' } },
      { type: "content_block_stop", index: 0 },
      stop("tool_use"),
    ]);
  const handler = createAssistantHandler({
    apiKey: "k",
    fetchImpl: async () => {
      calls++;
      return toolStream();
    },
  });
  const r = await run(handler, request({ body: question({}) }));
  assert.equal(calls, 2);
  assert.deepEqual(r.res.lines, [{ navigate: { view: "fiber" } }, { navigate: { view: "fiber" } }, { done: true }]);
});

test("the model is a config choice: an override reaches the API request unchanged", async () => {
  let sent = null;
  const handler = createAssistantHandler({
    apiKey: "k",
    model: "claude-haiku-4-5",
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body);
      return sse([delta("hi"), stop("end_turn")]);
    },
  });
  await run(handler, request({ body: question({}) }));
  assert.equal(sent.model, "claude-haiku-4-5");
});

test("history is the last twelve turns and never opens on an assistant line", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "user" : "assistant", text: `t${i}` }));
  const shaped = shapeMessages(many);
  assert.ok(shaped.length <= 12);
  assert.equal(shaped[0].role, "user");
  assert.equal(shaped.at(-1).content, "t29");
  assert.deepEqual(shapeMessages([{ role: "system", text: "x" }, { role: "user", text: " " }, { role: "user" }]), []);
});
