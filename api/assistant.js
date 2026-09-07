/**
 * The assistant's endpoint in production, and the reason this file exists.
 *
 * `vite.config.js` serves POST /api/assistant from `server/assistantMiddleware.js`
 * as dev/preview middleware. That middleware is a Vite server plugin: a static
 * build has no Vite server behind it, so on a deployed site the endpoint would
 * simply not be there and Bell would answer, honestly but uselessly, "no server
 * answers /api/assistant". This is the same handler mounted as a Vercel Node
 * Function so the deployed site has the endpoint the dev server has.
 *
 * ONE HANDLER, NOT A SECOND COPY. Everything — the prompt, the tools, the
 * NDJSON protocol, the origin and size checks, the abort on a closed
 * connection — stays in `server/`, which is imported by this file and by
 * `vite.config.js` and by nothing under `src/`. That is what keeps the API key
 * and the system prompt out of the browser bundle, and it is pinned by
 * `server/anatomyAssistantPrompt.test.js`. A hand-written copy of the handler
 * here would be a second prompt to keep in step, and it would drift.
 *
 * THE BODY IS THE ONE THING THAT NEEDS AN ADAPTER. The handler reads the
 * request by iterating the raw stream (`for await (const chunk of req)`), which
 * is what a Node server hands it. Vercel's Node runtime parses a JSON body
 * ahead of the function and leaves that stream consumed, so iterating it here
 * would yield nothing and every question would come back "malformed request".
 * `replayable` puts the parsed body back in front of the handler as a stream.
 * When the platform has NOT parsed it, the original request is passed straight
 * through and nothing is copied.
 *
 * The key is `ANTHROPIC_API_KEY` in the project's environment variables, read
 * here on the server. It has no VITE_ prefix and is never referenced from
 * `src/`, so no build can bundle it.
 */
import { Readable } from "node:stream";

import { createAssistantHandler } from "../server/assistantMiddleware.js";

const ENDPOINT = "/api/assistant";

const handler = createAssistantHandler({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Undefined falls through to the handler's own default model.
  model: process.env.ASSISTANT_MODEL || undefined,
});

/** The request as a stream the handler can read, whoever read it first. */
function replayable(req) {
  if (req.body === undefined || req.body === null) return req;
  const raw = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === "string"
      ? Buffer.from(req.body, "utf8")
      : Buffer.from(JSON.stringify(req.body), "utf8");
  const stream = Readable.from([raw]);
  stream.headers = req.headers;
  stream.method = req.method;
  /* Routing already decided this function answers; the handler's own path
     guard is given the path it is looking for rather than a URL that may
     arrive carrying a query string. */
  stream.url = ENDPOINT;
  return stream;
}

export default async function assistant(req, res) {
  const forwarded = replayable(req);
  forwarded.url = ENDPOINT;
  await handler(forwarded, res, () => {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "the assistant takes POST" }));
  });
}
