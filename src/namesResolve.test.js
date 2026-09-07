import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * A HELPER FROM ANOTHER MODULE, CALLED WITHOUT BEING IMPORTED.
 *
 * WHY THIS EXISTS, 2026-09-03. `MotionScene.jsx` called `centreOf(mesh, out)` in
 * `nameAnchor`. `centreOf` is exported by `PickTrack.jsx` and `MotionScene` never
 * imported it, so every muscle-name re-aim — 20 Hz, the whole time the body scale
 * is on screen — threw `ReferenceError: centreOf is not defined`. It shipped.
 *
 * NOTHING COULD HAVE CAUGHT IT. `vite build` bundles modules and does not resolve
 * free identifiers, so the build was green. No node test mounts the scene. The
 * browser cases that do never had `pageerror` wired to a failure. It was found by
 * clicking through the app with the console attached.
 *
 * THIS IS THE FOURTH TIME THIS SHAPE HAS SHIPPED. The other three were
 * temporal-dead-zone reads — `motion`, `beaconId`, `turned` — each a blank page
 * under a green build. Same root cause: a name that is not resolved until the
 * line runs.
 *
 * WHAT IT CHECKS, and it is deliberately narrow so it does not need a parser: for
 * every source file, take the names that OTHER modules in this tree export, find
 * the ones this file calls as bare functions, and require that it imports or
 * declares them. That catches the whole class it is named for and stays quiet
 * about everything else.
 */
const SRC = new URL("./", import.meta.url).pathname;

function sources(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...sources(full));
    else if (/\.(js|jsx)$/.test(e.name) && !e.name.includes(".test.")) out.push(full);
  }
  return out;
}

/** Comments and string/template literals go first: this repo's prose names functions. */
const code = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");

test("a helper from another module is imported before it is called", () => {
  const files = sources(SRC);
  assert.ok(files.length > 40, `only ${files.length} sources walked — the crawl is not reaching them`);

  /* Every name this tree exports, and where from. */
  const exported = new Map();
  for (const f of files) {
    for (const m of code(readFileSync(f, "utf8")).matchAll(
      /export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g,
    )) {
      if (!exported.has(m[1])) exported.set(m[1], []);
      exported.get(m[1]).push(f);
    }
  }

  const problems = [];
  for (const f of files) {
    const body = code(readFileSync(f, "utf8"));
    /* What this file already has a name for: anything imported, declared,
       destructured, or taken as a parameter. Cheap and over-generous on purpose —
       a false NEGATIVE is a missed bug, a false POSITIVE is a broken gate, and
       this repo has to trust its gates. */
    const known = new Set();
    for (const m of body.matchAll(/(?:^|\n)\s*import\s+([^;]+?)\s+from/g))
      for (const n of m[1].replace(/[{}]/g, " ").split(",")) {
        const t = n.trim().split(/\s+as\s+/).pop().trim();
        if (t) known.add(t);
      }
    for (const m of body.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) known.add(m[1]);
    for (const m of body.matchAll(/[({,[]\s*([A-Za-z_$][\w$]*)\s*[,)\]}=:]/g)) known.add(m[1]);

    for (const [name, from] of exported) {
      if (from.includes(f) || known.has(name)) continue;
      /* Called as a bare function, not as `x.name(` — a property access resolves
         at runtime against an object and is somebody else's problem.
         AND NOT A METHOD DEFINITION, which the first cut got wrong and which is
         why this reads every occurrence instead of asking `.test()`. Shorthand
         method syntax — `render() {`, `effortAt(t) {` — looks exactly like a call
         to a regex that only sees the name and the paren. Both were reported as
         crashes on the first run and both were fine. A gate that cries wolf is
         worse than no gate, because the next real one gets waved through. */
      const calls = [...body.matchAll(new RegExp(`(^|[^\\w$.])${name}\\s*\\(([^()]*)\\)\\s*(.?)`, "g"))];
      const real = calls.filter((m) => m[3] !== "{");
      if (real.length) {
        problems.push(`${f.slice(SRC.length)} calls ${name}() — exported by ${from[0].slice(SRC.length)}, imported here by nobody`);
      }
    }
  }
  assert.deepEqual(
    problems,
    [],
    "a free identifier is called that this file never imports. `vite build` will not catch this — it " +
      "bundles modules without resolving names — and the page throws the first time the line runs:\n  " +
      problems.join("\n  "),
  );
});
