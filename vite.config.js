import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { anatomyAssistant } from "./server/assistantMiddleware.js";

/**
 * Assets are served from public/ in both dev and production.
 *
 * An earlier version served them through a configureServer middleware pointing
 * at ../anatomy-mesh-set. That works in dev and silently ships nothing in a
 * production build, which would have deployed an app with no 3D models.
 * public/ is committed, so this repository builds and deploys on its own; the
 * mesh-set pipeline that produces those files lives in the development repository.
 */

/**
 * The assistant's endpoint lives in server/ — the middleware in
 * assistantMiddleware.js, the system prompt in anatomyAssistantPrompt.js —
 * and is mounted here on the dev and preview servers. Nothing under src/
 * imports server/, which is what keeps the key and the prompt out of the
 * bundle (pinned by server/anatomyAssistantPrompt.test.js).
 *
 * RESTORED 2026-09-06. `main` had been carrying an inline copy of this plugin —
 * non-streaming, one hard-coded model, no tests — while the real one (NDJSON
 * streaming, prompt caching, the `navigate` tool, `ASSISTANT_MODEL` honoured)
 * sat only in the tag `backup/ui-shared-shell-2026-09-06`, with the widget in
 * `src/assistant/` already speaking the streaming protocol the inline copy did
 * not. Two handlers for one endpoint is how the client and the server drift
 * apart without a test going red; the inline one is gone.
 */

/**
 * One dev port per checkout, from a file this config does not track.
 *
 * Five worktrees run beside the main checkout, one agent each, and they all
 * run `npm run dev`. A port written into this file would be the same number in
 * every one of them, and vite's default behaviour on a taken port is to slide
 * quietly to the next free one — so two lanes would end up sharing a server
 * without either noticing, which is the failure this exists to prevent. Two
 * lanes screenshotting each other's app is a whole afternoon of unreproducible
 * findings.
 *
 * `.dev-port` is gitignored, so each checkout carries its own number and the
 * tracked config stays identical everywhere and never conflicts on merge.
 * `strictPort` turns a collision into a refusal instead of a silent move.
 */
const portFile = fileURLToPath(new URL("./.dev-port", import.meta.url));
const DEV_PORT =
  Number(process.env.PORT) ||
  (existsSync(portFile) ? Number(readFileSync(portFile, "utf8").trim()) : 0) ||
  5175;

export default defineConfig(({ mode }) => {
  /* Empty prefix on purpose: ANTHROPIC_API_KEY must be readable HERE and must
     NOT carry the VITE_ prefix, which would bundle it into client code. It
     comes from `.env.local`, which git does not carry. */
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), anatomyAssistant(env.ANTHROPIC_API_KEY, env.ASSISTANT_MODEL)],
    server: {
      host: "127.0.0.1",
      port: DEV_PORT,
      strictPort: true,
      headers: {
        // Rebuilt GLBs reuse their URL; without this the browser serves stale geometry.
        "cache-control": "no-store",
      },
    },
    build: {
      // GLBs are already meshopt-compressed; the 500 KB warning is just noise here.
      chunkSizeWarningLimit: 1500,
    },
  };
});
