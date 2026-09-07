import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * IT HOPS TO THE SPOT FIRST, AND SPEAKS WHEN IT GETS THERE — AND IT CAN BE
 * PICKED UP ANYWHERE, EVEN MID-SENTENCE.
 *
 * Owner, 2026-09-06: *"the character should be draggable in all windows. when it
 * has to move to a designated spot to explain, it should hop onto the spot and
 * the explaining should start when the character has arrived at the spot"*.
 *
 * Two things the first drag cut got wrong, both invisible to a browser case
 * because the walk still plays and the words still land:
 *
 *   1. A beat's anchor outranked the drop ABSOLUTELY, so during a beat the
 *      character did not follow the finger at all — `pos` was written from the
 *      anchor's target every frame while held. Now the drop outranks the anchor
 *      it was dropped under, and only a NEW anchor — the next spot it has to
 *      go to — clears it.
 *   2. The sentence changed the frame the beat did, while the character was
 *      still crossing the stage to it. Now the line waits in `pending` and the
 *      loop hands it to `shown` on arrival, with the bubble hidden (`--going`,
 *      not `--hushed`: it has something to say and is on its way to say it, so
 *      the character does not dim).
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("a new spot clears the drop; the same spot does not", () => {
  const jsx = read("./Guide.jsx");
  assert.doesNotMatch(jsx, /const put = anchor \? null : parked\.current;/, "the anchor outranks the drop absolutely again — the character will not follow the finger during a beat");
  assert.match(jsx, /parked\.current = null;/, "nothing clears a drop when the character is called to a new spot — it will never go");
  assert.match(jsx, /const RETRIP = \d+;/, "how far a spot must move to be a new one is no longer a named number");
  assert.match(
    jsx,
    /Math\.hypot\(was\.x - now\.x, was\.y - now\.y\) > RETRIP/,
    "a new spot is no longer told from a drifting one by distance — a beat re-aims its anchor every 50 ms, and a " +
      "muscle moving under a rep would blink the bubble and tear the character out of the visitor's hands",
  );
});

test("the sentence waits for the character, and the bubble is hidden on the way", () => {
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /const ARRIVE = \d+;/, "how close counts as arrived is no longer a named number");
  assert.match(jsx, /pending\.current/, "the line no longer waits — it changes the frame the beat does, with the character still crossing the stage");
  assert.match(jsx, /guide--going/, "the bubble is not hidden while the character travels — it will say the new line from the old spot");
  const css = read("./guide.css");
  const m = css.match(/\n\.guide--going \.guide__bubble\s*\{([^}]*)\}/);
  assert.ok(m, "guide.css has no rule for `.guide--going .guide__bubble`");
  assert.match(m[1], /opacity:\s*0/);
  const dim = css.match(/\n\.guide--going \.guide__body\s*\{([^}]*)\}/);
  assert.equal(dim, null, "the character dims while travelling — that is `--hushed`'s meaning (nothing to say), and this character has plenty");
});

test("the beat's clock starts when the character arrives, and a walk with no guide to arrive is not stalled", () => {
  /* Owner, 2026-09-06: *"the explaining should start when the character has
     arrived at the spot"*. The explaining includes its time: a beat's `ms` is
     how long a sentence STANDS, and until this it began the frame the beat did,
     with the character still on its way — watched on SIGNALS, the first sentence
     showed for 1.1 s of its beat. So the guide says when it has arrived
     (`arrived.js`, a window Event like `sayAgain.js`) and the walk's patience
     waits for that. With a floor: a guide that is not there to arrive — not
     mounted, or an anchor that never resolves — must not hold the walk forever. */
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /guideArrived\(\);/, "the guide no longer says when it has arrived — every beat's clock will start on the grace floor");
  const bus = read("./arrived.js");
  assert.match(bus, /export const GUIDE_ARRIVED = "hpe:guide-arrived";/);
  assert.match(bus, /dispatchEvent\(new Event\(GUIDE_ARRIVED\)\)/);
  const walk = read("./useWalk.js");
  assert.match(walk, /addEventListener\(GUIDE_ARRIVED,/, "the walk no longer listens for the arrival — its clock starts the frame the beat does again");
  assert.match(walk, /const ARRIVE_GRACE_MS = \d+;/, "the floor under the wait is no longer a named number");
  assert.match(walk, /if \(!arrived\) return undefined;/, "the beat's patience no longer waits for the arrival");
});

test("it travels — bounded speed, bounded acceleration, a stride — and the walk waits long enough for the longest crossing", () => {
  /* Owner, 2026-09-07: *"when bell moves around to its designated spot for
     explanation in the fibre and cell signaling and what not, it almost
     teleports. make this a bit slower and make movement more natural"*. A
     critically damped spring at omega 14 settles in a quarter of a second, and
     its first frame's acceleration is omega² times the whole distance — a jump.
     So the spring is slower, its acceleration is capped (it leans into a start
     instead of snapping), its speed is capped (a crossing is a journey with a
     middle), and the hop cadence is a STRIDE, so it bounds rather than glides.
     The walk's grace floor has to outlast the longest possible crossing at that
     speed, or the beat's clock starts before the character has arrived. */
  const jsx = read("./Guide.jsx");
  const num = (src, name) => Number(src.match(new RegExp(`const ${name} = ([\\d.]+);`))?.[1]);
  const W = num(jsx, "W"), speed = num(jsx, "MAX_SPEED"), accel = num(jsx, "MAX_ACCEL"), stride = num(jsx, "STRIDE");
  assert.ok(W > 0 && W <= 10, `the spring is back to omega ${W} — at 14 it settled in 235 ms, which is the teleport`);
  assert.ok(speed >= 300 && speed <= 900, `MAX_SPEED is ${speed} px/s; under 300 is a crawl, over 900 is the teleport again`);
  assert.ok(accel > 0 && accel <= 6000, `MAX_ACCEL is ${accel} px/s²; unbounded, the first frame of a long trip is a jump`);
  assert.ok(stride >= 60 && stride <= 240, `STRIDE is ${stride} px; a hop per stride is what makes travel read as the character's own`);
  assert.match(jsx, /speed \/ STRIDE/, "the hop cadence no longer follows the stride — it glides");
  const walk = read("./useWalk.js");
  const grace = num(walk, "ARRIVE_GRACE_MS");
  const longest = (1280 / speed) * 1000 + 1000;
  assert.ok(grace >= longest, `ARRIVE_GRACE_MS ${grace} is under the ${Math.round(longest)} ms a 1280 px crossing at ${speed} px/s plus a second's settle takes — the clock will start before the character arrives`);
});
