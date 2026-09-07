import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE TAIL'S MOUTH LANDS ON STRAIGHT EDGE, AT BOTH SIZES.
 *
 * Owner, 2026-09-07: *"the tail of bell's text bubble often appears
 * disconnected with the rest of the text bubble"*. It was, and the reason is
 * arithmetic rather than taste. The tail is a square turned 45°, so the two
 * corners that touch the bubble — its MOUTH — are a full diagonal apart, and
 * the bubble's outline is only straight between its rounded corners. When the
 * mouth is taller than that straight run, the tail's inked edges meet a curve
 * that has already turned away and the outline reads as broken. Measured at 6x
 * before the fix: a one-line bubble was 41.8 px tall with a 14 px radius —
 * 13.8 px of straight edge for a 22.6 px mouth — and a phone's was 8.8 px of
 * straight edge for a 17 px mouth, which is why it was "often" and not always.
 *
 * `guide.css` now declares five numbers per size and derives every offset from
 * them. This is the one relation between them. It is a gate rather than a
 * comment because the failure is invisible to every other check here: the
 * sentence still renders, the walk still plays, and only a screenshot at 6x
 * shows the seam.
 */
const css = readFileSync(new URL("./guide.css", import.meta.url), "utf8");

/** Every `.guide { … }` block that declares the tail's numbers: the base one
    and the phone one. `.guide--left`, `.guide__say` and the reduced-motion
    block do not match — the first two by their next character, the last by
    not carrying a single one of these. */
function sizes() {
  const out = [];
  for (const m of css.matchAll(/\n[ \t]*\.guide\s*\{([^}]*)\}/g)) {
    if (!m[1].includes("--guide-tail-box")) continue;
    const read = (name) => {
      const hit = m[1].match(new RegExp(`--${name}:\\s*([\\d.]+)px`));
      assert.ok(hit, `a .guide block declares --guide-tail-box but not --${name}`);
      return Number(hit[1]);
    };
    out.push({
      box: read("guide-tail-box"),
      reach: read("guide-tail-reach"),
      up: read("guide-tail-up"),
      radius: read("guide-radius"),
      min: read("guide-say-min"),
    });
  }
  return out;
}

test("both sizes declare the tail's five numbers", () => {
  assert.equal(sizes().length, 2, "guide.css no longer declares the tail's numbers at exactly two sizes (wide and phone)");
});

test("the reach is the rotated square's half-diagonal, so the gap is the tip's own length", () => {
  /* `gap` on `.guide` is `--guide-tail-reach`: the space between bubble and
     character IS how far the tip sticks out, which is what makes the tip stop
     at the character's frame. If the reach stops being the half-diagonal, the
     tip either pokes into the character or ends in the air beside it. */
  for (const s of sizes()) {
    const half = s.box * Math.SQRT1_2;
    assert.ok(
      Math.abs(s.reach - half) <= 0.15,
      `a ${s.box}px tail reaches ${half.toFixed(2)}px, but --guide-tail-reach says ${s.reach}px`,
    );
  }
});

test("the mouth fits inside the bubble's straight edge, with room to spare", () => {
  /* radius + reach ≤ up ≤ min-height − radius − reach, and not by a hair: a
     font that renders a pixel taller or shorter must not put the tail back on
     the curve. */
  const SLACK = 2;
  for (const s of sizes()) {
    const low = s.radius + s.reach;
    const high = s.min - s.radius - s.reach;
    assert.ok(
      s.up >= low + SLACK,
      `the tail's lower corner is ${(s.up - low).toFixed(1)}px from the bottom curve (need ${SLACK}); ` +
        `raise --guide-tail-up above ${(low + SLACK).toFixed(1)}px, or cut the radius or the box`,
    );
    assert.ok(
      s.up <= high - SLACK,
      `the tail's upper corner is ${(high - s.up).toFixed(1)}px from the top curve (need ${SLACK}); ` +
        `lower --guide-tail-up below ${(high - SLACK).toFixed(1)}px, or make the bubble taller ` +
        `(--guide-say-min and the padding that fills it), or cut the radius or the box`,
    );
  }
});

test("a one-line bubble is really as tall as the arithmetic assumes", () => {
  /* `--guide-say-min` is the floor the inequality above is computed against,
     and `min-height` is what makes the box obey it. Without that declaration
     the numbers would be a story about a bubble the browser never draws. */
  const say = css.match(/\n\.guide__say\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(say, /min-height:\s*var\(--guide-say-min\)/, "the bubble lost the floor its tail geometry is computed against");
  assert.match(say, /border-radius:\s*var\(--guide-radius\)/, "the bubble's radius is a number of its own again — the tail's arithmetic cannot see it");
});

test("the tail's offsets are derived, not typed twice", () => {
  /* The phone block restates the five numbers only. An offset written out as a
     literal there is the drift this whole file exists to stop. */
  const tail = css.match(/\n\.guide__say::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(tail, /bottom:\s*calc\(var\(--guide-tail-up\)/);
  assert.match(tail, /width:\s*var\(--guide-tail-box\)/);
  const phone = css.slice(css.indexOf("@media (max-width: 560px)"));
  assert.doesNotMatch(phone, /\.guide__say::after\s*\{/, "the phone block writes the tail's offsets out again instead of restating the five numbers");
  assert.doesNotMatch(phone, /transform-origin/, "the phone block pins the pop's origin again — it follows from --guide-tail-up");
});
