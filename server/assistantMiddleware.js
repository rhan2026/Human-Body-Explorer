/**
 * The Anatomy Assistant's one endpoint, POST /api/assistant, served by the
 * Vite dev and preview servers so the API key NEVER reaches the browser: it
 * lives in .env.local (gitignored, no VITE_ prefix, so Vite cannot bundle
 * it) and every question from the widget is proxied here, server-side. A
 * static production deploy has no server and therefore no key — the widget
 * says so instead of failing silently, and a real backend for it is a
 * deliberate later step.
 *
 * STREAMED, both hops. Upstream is the Messages API with `stream: true`
 * (raw fetch — this repo installs no Anthropic SDK; the SSE frames are
 * parsed here), and the browser gets NDJSON — one JSON object per line —
 * over a chunked response:
 *   {"delta":"…"}   a piece of the answer, append it
 *   {"notice":"…"}  a small status line for the bubble (cut short, interrupted)
 *   {"done":true}   the answer is finished
 *   {"text":"…"}    a complete non-streamed reply (no key, API error) —
 *                   also exactly what the older widget and every test mock
 *                   sends, so both sides stay compatible with a plain body.
 * A closed browser connection aborts the upstream request, so Stop in the
 * widget stops the model spend too.
 *
 * Only the page may ask. The request must say application/json (a simple
 * text/plain POST from any site in the same browser used to get through,
 * measured 2026-08-30) and, when a browser names its Origin, that origin
 * must be this host. Testable without a server: assistantMiddleware.test.js
 * drives the handler with a fake request and a fake fetch; no gate ever
 * spends a token.
 */

import { readFileSync } from "node:fs";

import { buildSystem } from "./anatomyAssistantPrompt.js";

export const MODEL = "claude-sonnet-5";
export const NOT_CONNECTED = "The assistant is not connected on this machine — no API key is configured.";
const ENDPOINT = "/api/assistant";
const MAX_BODY_BYTES = 64 * 1024;
const HISTORY_TURNS = 12;

/**
 * The output budget, by intent: a chat answer is a few sentences, so the
 * ceiling is small — the RESPONSE LENGTH POLICY in the prompt does the
 * shaping, this is the backstop. An explicit ask for depth gets room.
 * Thinking stays off: on this model an omitted `thinking` runs adaptive
 * thinking whose tokens count against max_tokens — measured 2026-08-31,
 * an 80-word answer came back stop_reason max_tokens with 600 to spend.
 */
export const DEFAULT_MAX_TOKENS = 300;
export const DETAILED_MAX_TOKENS = 1000;
const DETAIL_ASK = /\b(in detail|detailed|deeply|in depth|full (explanation|mechanism)|walk me through|step[ -]by[ -]step|explain exactly)\b/i;
const THINKING = { type: "disabled" };

/**
 * THE GROUP KEYS, READ FROM THE MANIFEST THE APP ITSELF DRAWS FROM rather than
 * typed out here. `public/mapping/muscle-map.json` is committed and is what
 * `App.jsx` colours and hides by; a copy of its sixteen keys in this file would
 * be a second definition of the same list, and the two would drift the first
 * time the mesh set gains a group. `assistantMiddleware.test.js` holds them
 * equal.
 *
 * An unreadable manifest yields an empty list, and the tool is then not offered
 * at all — a schema with an empty enum is a tool the model cannot call
 * correctly, and silently dropping the capability is better than advertising a
 * broken one.
 */
const MUSCLE_MAP = (() => {
  try {
    return JSON.parse(readFileSync(new URL("../public/mapping/muscle-map.json", import.meta.url), "utf8"));
  } catch {
    return null;
  }
})();

export const MUSCLE_GROUPS = Object.keys(MUSCLE_MAP?.groups ?? {});

/**
 * The 53 muscles the roster names, as `{ key, label }`. The key is the model's
 * vocabulary — stable, enumerable, and the same string the app's own data uses;
 * the label is what the scene's SEARCH matches on, and it travels with the key
 * so no scene has to look it up.
 */
export const MUSCLES = (Array.isArray(MUSCLE_MAP?.muscles) ? MUSCLE_MAP.muscles : [])
  .filter((m) => m?.key && m?.label)
  .map((m) => ({ key: m.key, label: m.label }));

/**
 * The second tool: showing a set of muscle groups on the body model.
 *
 * Owner, 2026-09-07: *"when i ask bell about excercises not on the list, it
 * identifies what muscles are used but cannot highlight them on the idle
 * model"*. The app ships six exercises, so a deadlift has no scenario and
 * `navigate` has nothing to point at — but the body scale's group selection is
 * live, and driving it is the owner's own mechanism: *"unselect the irrelevant
 * muscles groups instead of highlighting the requested muscles directly"*.
 *
 * The description says that out loud, because it changes how the model must
 * call it: naming a group KEEPS it and every group left unnamed goes off, so a
 * forgotten group is a claim that it does no work.
 */
export const SHOW_MUSCLES_TOOL = {
  name: "show_muscles",
  description:
    "Show a movement's muscles on the body model. It works by SWITCHING OFF every group you do not name, leaving the ones you name standing — so name every group the movement genuinely works, including the ones holding the body still, and pass every group to put the whole body back. Only the body view has the model; navigate there first if the viewer is elsewhere. Use this for any movement, including the ones this app ships no scenario for.",
  input_schema: {
    type: "object",
    properties: {
      groups: {
        type: "array",
        minItems: 1,
        items: { type: "string", enum: MUSCLE_GROUPS },
        description: "the muscle groups the movement works; everything else is switched off",
      },
    },
    required: ["groups"],
    additionalProperties: false,
  },
};

/** The groups of a `show_muscles` call that this app can actually draw. */
export function groupsAsked(input) {
  const asked = Array.isArray(input?.groups) ? input.groups : [];
  return asked.filter((g) => MUSCLE_GROUPS.includes(g));
}

/**
 * The muscle of a `show_muscle` call, as `{ key, label }`, or null if the model
 * named one this roster does not have. The label goes with it because the
 * scenes single a muscle out with their own SEARCH, which matches on the label.
 */
export function muscleAsked(input) {
  return MUSCLES.find((m) => m.key === input?.muscle) ?? null;
}

/**
 * The third tool: singling ONE muscle out.
 *
 * Owner, 2026-09-07: *"when a user requests highlight just 'this' muscle on
 * motion or idle, unselect every other muscle"*. `show_muscles` works a group
 * at a time, which is the wrong grain for "this one" — a visitor who has picked
 * the pectoralis major and asks to see just it would get the whole chest.
 *
 * It drives each floor's SEARCH, the app's other highlighting control, so each
 * floor does what it already does with it: the idle model hides everything
 * else, and the motion floor washes it out rather than hiding it, because a
 * moving body with holes in it reads as broken. Both are "unselected".
 */
export const SHOW_MUSCLE_TOOL = {
  name: "show_muscle",
  description:
    "Single ONE muscle out on the body, leaving every other muscle unselected — hidden on the idle body, washed out on a moving one. Use it when the visitor asks to see just one muscle, including \"just this one\" about the muscle already selected in your context. Works on the idle body and on a motion window alike; it also turns every muscle group back on, so the one you name cannot be hidden by a group that was switched off.",
  input_schema: {
    type: "object",
    properties: {
      muscle: { type: "string", enum: MUSCLES.map((m) => m.key), description: "the muscle's key from the roster" },
    },
    required: ["muscle"],
    additionalProperties: false,
  },
};

/**
 * The first tool the assistant held: moving the viewer. The widget executes
 * it through the app's own hash grammar (scaleRoute.js), so the model can
 * only go where a typed URL could. Exercise ids are the closed set the app
 * ships; the muscle slug is whatever the context already carries.
 */
export const NAVIGATE_TOOL = {
  name: "navigate",
  description:
    "Move the viewer to a view of this app. Views: body (the anatomy explorer), motion (the animated exercise), fiber (the muscle fiber), cell (the cell's energy), signalling (the signalling network). Optionally pin the exercise and/or the selected muscle slug.",
  input_schema: {
    type: "object",
    properties: {
      view: { type: "string", enum: ["body", "motion", "fiber", "cell", "signalling"] },
      exercise: { type: "string", enum: ["bench_press", "push_up", "pull_up", "lunge", "running", "swimming_freestyle"] },
      muscle: { type: "string", description: "the muscle slug from the application context, if one is selected" },
    },
    required: ["view"],
    additionalProperties: false,
  },
};

/** What the model is offered. Declared below the tools because it names them;
    each show tool goes only if its enum is real. */
export const TOOLS = [
  NAVIGATE_TOOL,
  ...(MUSCLE_GROUPS.length ? [SHOW_MUSCLES_TOOL] : []),
  ...(MUSCLES.length ? [SHOW_MUSCLE_TOOL] : []),
];

export function outputBudget(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return DETAIL_ASK.test(lastUser?.content ?? "") ? DETAILED_MAX_TOKENS : DEFAULT_MAX_TOKENS;
}

function sameOrigin(origin, host) {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * The conversation as the API takes it: the last turns, user and assistant
 * only, and never opening on an assistant line — the widget's welcome
 * sentence is the app's, not a model turn.
 */
export function shapeMessages(messages) {
  const turns = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.text }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

/**
 * The Messages API's SSE frames as parsed objects. Frames end on a blank
 * line; a frame's data lines are joined; the decoder is streaming, so a
 * multi-byte character split across network chunks decodes correctly.
 */
export async function* sseEvents(body) {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const chunk of body) {
    buffered += decoder.decode(chunk, { stream: true });
    let cut;
    while ((cut = buffered.indexOf("\n\n")) !== -1) {
      const frame = buffered.slice(0, cut);
      buffered = buffered.slice(cut + 2);
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("");
      if (!data) continue;
      try {
        yield JSON.parse(data);
      } catch {
        /* a malformed frame is skipped, never fatal */
      }
    }
  }
}

export function createAssistantHandler({ apiKey, fetchImpl = globalThis.fetch, model = MODEL } = {}) {
  return async function assistantHandler(req, res, next) {
    if (req.url !== ENDPOINT || req.method !== "POST") return next();

    res.setHeader("content-type", "application/json");
    const reply = (status, payload) => {
      res.statusCode = status;
      res.end(JSON.stringify(payload));
    };

    if (!/^application\/json\b/i.test(String(req.headers["content-type"] ?? ""))) {
      return reply(415, { error: "the assistant takes application/json" });
    }
    if (req.headers.origin && !sameOrigin(req.headers.origin, req.headers.host)) {
      return reply(403, { error: "cross-origin request refused" });
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) return reply(413, { error: "request too large" });
      chunks.push(chunk);
    }

    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return reply(400, { error: "malformed request" });
    }

    if (!apiKey) return reply(200, { text: NOT_CONNECTED });

    const messages = shapeMessages(body?.messages);
    if (!messages.length) return reply(400, { error: "no question in the request" });

    // The browser going away (Stop, a closed tab) cancels the model run.
    const upstreamAbort = new AbortController();
    res.on?.("close", () => {
      if (!res.writableEnded) upstreamAbort.abort();
    });

    try {
      res.setHeader("cache-control", "no-store");
      const line = (obj) => res.write(`${JSON.stringify(obj)}\n`);

      /**
       * The agent loop, two rounds at most. A model that calls navigate
       * STOPS THERE and waits for the tool result — measured 2026-08-31,
       * round one came back stop_reason tool_use with no text at all — so
       * the result goes back ("done") and the explanation streams on the
       * second round. One continuation only: a second tool call is still
       * forwarded, but nothing loops further.
       */
      let turn = [...messages];
      let wroteText = false;
      // Whether the model DID something this turn — navigated or changed what
      // the body shows. A turn that only acts is not "no text".
      let acted = false;
      for (let round = 0; round < 2; round++) {
        const upstream = await fetchImpl("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: outputBudget(messages),
            thinking: THINKING,
            stream: true,
            tools: TOOLS,
            system: buildSystem(body?.context),
            messages: turn,
          }),
          signal: upstreamAbort.signal,
        });
        if (!upstream.ok) {
          const data = await upstream.json().catch(() => ({}));
          if (!res.headersSent) return reply(200, { text: `The assistant hit an API error — ${data?.error?.message ?? upstream.status}.` });
          line({ notice: "Response interrupted." });
          break;
        }
        if (!res.headersSent) res.setHeader("content-type", "application/x-ndjson");

        let stopReason = null;
        let errored = false;
        const blocks = [];
        // Tool input arrives as input_json_delta fragments, gathered per
        // block index and forwarded as ONE {navigate} event at block close.
        const toolBlocks = new Map();
        let roundText = "";
        for await (const event of sseEvents(upstream.body)) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            wroteText = true;
            roundText += event.delta.text;
            line({ delta: event.delta.text });
          } else if (event.type === "content_block_start" && event.content_block?.type === "tool_use" && TOOLS.some((t) => t.name === event.content_block.name)) {
            toolBlocks.set(event.index, { id: event.content_block.id, name: event.content_block.name, json: "" });
          } else if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta" && toolBlocks.has(event.index)) {
            toolBlocks.get(event.index).json += event.delta.partial_json;
          } else if (event.type === "content_block_stop" && toolBlocks.has(event.index)) {
            const block = toolBlocks.get(event.index);
            toolBlocks.delete(event.index);
            try {
              const input = JSON.parse(block.json || "{}");
              if (block.name === "navigate" && input.view) {
                acted = true;
                line({ navigate: input });
                blocks.push({ type: "tool_use", id: block.id, name: block.name, input });
              } else if (block.name === "show_muscles") {
                // Only groups this app can draw. A call naming none of them
                // shows nothing rather than emptying the body.
                const groups = groupsAsked(input);
                if (groups.length) {
                  acted = true;
                  line({ show: { groups } });
                  blocks.push({ type: "tool_use", id: block.id, name: block.name, input: { groups } });
                }
              } else if (block.name === "show_muscle") {
                // The label travels with the key: the scenes single a muscle
                // out with their search, which matches on the label.
                const muscle = muscleAsked(input);
                if (muscle) {
                  acted = true;
                  line({ show: { muscle } });
                  blocks.push({ type: "tool_use", id: block.id, name: block.name, input: { muscle: muscle.key } });
                }
              }
            } catch {
              /* a malformed tool call does nothing */
            }
          } else if (event.type === "message_delta" && event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason;
          } else if (event.type === "error") {
            errored = true;
            line(wroteText ? { notice: "Response interrupted." } : { text: "Couldn't get a response. Try again." });
            break;
          }
        }
        if (errored) break;
        if (stopReason === "tool_use" && round === 0 && blocks.length) {
          turn = [
            ...turn,
            { role: "assistant", content: [...(roundText ? [{ type: "text", text: roundText }] : []), ...blocks] },
            {
              role: "user",
              content: blocks.map((b) => ({
                type: "tool_result",
                tool_use_id: b.id,
                content:
                  b.name === "show_muscles"
                    ? "Done — the body now shows only those groups; every other group is switched off."
                    : b.name === "show_muscle"
                      ? "Done — that muscle is the only one selected now; every other muscle is unselected."
                      : "Done — the viewer is looking at that view now.",
              })),
            },
          ];
          continue;
        }
        if (stopReason === "refusal" && !wroteText) line({ delta: "The assistant declined to answer that one." });
        else if (!wroteText && !acted) line({ text: "The model returned no text." });
        if (stopReason === "max_tokens") line({ notice: "Cut short — ask for the rest." });
        break;
      }
      line({ done: true });
      res.end();
    } catch (e) {
      if (upstreamAbort.signal.aborted) {
        // The browser already left; there is nobody to write to.
        try {
          res.end();
        } catch {
          /* the socket is gone, which is the point */
        }
        return;
      }
      if (!res.headersSent) return reply(200, { text: `The assistant could not reach the API — ${e.message}.` });
      try {
        res.write(`${JSON.stringify({ notice: "Response interrupted." })}\n`);
        res.write(`${JSON.stringify({ done: true })}\n`);
        res.end();
      } catch {
        /* mid-stream teardown; the widget's normalization covers it */
      }
    }
  };
}

/** The Vite plugin: the same handler on the dev server and on `vite preview`.
 *  `model` comes from ASSISTANT_MODEL in .env.local when set — a config
 *  choice, not a code edit — and defaults to MODEL. */
export function anatomyAssistant(apiKey, model) {
  const handler = createAssistantHandler({ apiKey, model: model || MODEL });
  return {
    name: "anatomy-assistant",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
