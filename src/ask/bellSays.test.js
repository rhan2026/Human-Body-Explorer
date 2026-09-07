import { test } from "node:test";
import assert from "node:assert/strict";
import { IDLE, getBellSays, setBellSays, subscribeBellSays } from "./bellSays.js";

/**
 * WHAT BELL IS SAYING RIGHT NOW — one answer, held outside React, for the same
 * reason `shell/uiState.js` holds the drawer flag there: the box that writes it
 * lives in the Router and the character that reads it lives inside whichever
 * scene is mounted, and the two share no parent. A context would drag the box
 * into every scene, which is the remount the Router mount exists to avoid.
 */

test("the store starts idle, and idle cannot be edited in place", () => {
  setBellSays(IDLE);
  assert.deepEqual(getBellSays(), { status: "idle", text: "", note: null });
  assert.ok(Object.isFrozen(IDLE));
  assert.ok(Object.isFrozen(getBellSays()));
});

test("a value replaces, an updater derives, and a listener hears each change once", () => {
  setBellSays(IDLE);
  let heard = 0;
  const off = subscribeBellSays(() => heard++);
  setBellSays({ status: "thinking", text: "", note: null });
  setBellSays((m) => ({ ...m, status: "streaming", text: m.text + "Calcium " }));
  setBellSays((m) => ({ ...m, text: m.text + "switches contraction on." }));
  assert.equal(heard, 3);
  assert.equal(getBellSays().status, "streaming");
  assert.equal(getBellSays().text, "Calcium switches contraction on.");
  // The same object again is not a change — nothing re-renders for nothing.
  const same = getBellSays();
  setBellSays(same);
  assert.equal(heard, 3);
  off();
  setBellSays(IDLE);
  assert.equal(heard, 3, "an unsubscribed listener is not called");
});

test("the store holds ONE answer — there is no log to scroll", () => {
  /* Decided 2026-09-06 and pinned as an absence: the visitor talks to the
     character and the character answers in its own bubble. A list of turns is
     the chat widget this replaces, and nothing here may grow one back. */
  assert.equal(typeof IDLE.text, "string");
  assert.ok(!("messages" in IDLE));
  assert.ok(!Array.isArray(IDLE.text));
});
