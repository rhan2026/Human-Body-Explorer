import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { SHOW_GROUPS, SHOW_MUSCLE, showGroups, showMuscle } from "../shell/showGroups.js";

/** THE SEAM FROM THE MODEL'S TOOL CALL TO THE BODY'S GROUP SELECTION. */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the seam's name is the one both sides use, and it carries the groups that are WORKED", () => {
  assert.equal(SHOW_GROUPS, "hpe:show-groups");
  const sent = [];
  const target = { dispatchEvent: (e) => sent.push(e) };
  const realWindow = globalThis.window;
  globalThis.window = target;
  try {
    showGroups(["chest", "core"]);
    showGroups([]);
    showGroups(null);
    showGroups([""]);
  } finally {
    if (realWindow === undefined) delete globalThis.window;
    else globalThis.window = realWindow;
  }
  assert.equal(sent.length, 1, "an empty or absent group list should dispatch nothing — it would mean 'switch everything off'");
  assert.equal(sent[0].type, SHOW_GROUPS);
  assert.deepEqual(sent[0].detail, { groups: ["chest", "core"] });
});

test("the client executes a show event, and the front door is what listens", () => {
  const stream = read("./askStream.js");
  assert.match(stream, /event\.show && typeof event\.show === "object"/, "the NDJSON `show` event is no longer executed");
  assert.match(stream, /show\(event\.show\.groups\)/);
  assert.match(stream, /import \{ showGroups, showMuscle \} from "\.\.\/shell\/showGroups\.js";/);

  const app = read("../App.jsx");
  assert.match(app, /window\.addEventListener\(SHOW_GROUPS, show\)/, "the idle model no longer listens for it");
  assert.match(
    app,
    /const known = asked\.filter\(\(g\) => keys\.includes\(g\)\);/,
    "unknown group keys are no longer dropped before they reach the model's state",
  );
  assert.match(app, /if \(!known\.length\) return;/, "a call naming nothing real would blank the body");
  assert.match(
    app,
    /setGroupSel\(known\.length === keys\.length \? null : new Set\(known\)\)/,
    "showing every group no longer resets to the All state the chips produce",
  );
  assert.match(app, /highlightedMuscles:/, "the context no longer reports what the body is showing, so Bell cannot see the state it set");
});

test("one muscle is its own seam, carrying the label the search matches on", () => {
  assert.equal(SHOW_MUSCLE, "hpe:show-muscle");
  const sent = [];
  const realWindow = globalThis.window;
  globalThis.window = { dispatchEvent: (e) => sent.push(e) };
  try {
    showMuscle({ key: "pectoralis_major", label: "Pectoralis major" });
    showMuscle({ key: "x", label: "   " });
    showMuscle({ key: "x" });
    showMuscle(null);
  } finally {
    if (realWindow === undefined) delete globalThis.window;
    else globalThis.window = realWindow;
  }
  assert.equal(sent.length, 1, "a muscle with no label should dispatch nothing — the search would match everything");
  assert.deepEqual(sent[0].detail, { key: "pectoralis_major", label: "Pectoralis major" });
});

test("both floors single a muscle out, and each does it with its own search", () => {
  /* Owner, 2026-09-07: *"... on motion or idle ..."*, so both listen. Each
     drives its SEARCH rather than a new hiding rule, which is what makes the
     idle body hide the rest and the moving body wash it out instead — the two
     floors already disagree about that on purpose. */
  const stream = read("./askStream.js");
  assert.match(stream, /if \(event\.show\.muscle\) single\(event\.show\.muscle\);/, "the client no longer routes a single muscle");
  assert.match(stream, /import \{ showGroups, showMuscle \} from "\.\.\/shell\/showGroups\.js";/);

  for (const [file, floor] of [["../App.jsx", "the idle body"], ["../MotionScene.jsx", "the motion floor"]]) {
    const src = read(file);
    assert.match(src, /window\.addEventListener\(SHOW_MUSCLE, single\)/, `${floor} no longer singles a muscle out`);
    const handler = src.slice(src.indexOf("const single = (event)"), src.indexOf("window.addEventListener(SHOW_MUSCLE"));
    assert.match(handler, /setQuery\(label\)/, `${floor} no longer drives its search with the muscle's label`);
    assert.match(
      handler,
      /setGroupSel\(null\)/,
      `${floor} leaves the group chips as they were — a muscle in a switched-off group would be singled out and then hidden by its own group`,
    );
    assert.match(handler, /if \(!label\) return;/, `${floor} would accept an empty label, which matches every muscle`);
  }

  /* And the reverse: a group call has to clear a search left from a muscle
     call, or the two filters AND and one muscle stands where a movement was
     asked for. */
  const app = read("../App.jsx");
  const groupHandler = app.slice(app.indexOf("const show = (event)"), app.indexOf("window.addEventListener(SHOW_GROUPS"));
  assert.match(groupHandler, /setQuery\(""\)/, "showing groups no longer clears a stale single-muscle search");
});
