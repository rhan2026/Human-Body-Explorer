import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import { anatomyMaterial, sheathMaterial, PALETTE } from "./anatomyStyle.js";

/**
 * TWO MECHANISMS MAY NOT BE ONE RIVET.
 *
 * The sarcomere draws three different things as small warm knobs on filaments:
 * the myosin head that catches actin, the tropomyosin strand lying in the actin
 * groove, and the troponin that senses calcium and lets go of it. Measured
 * 2026-08-26, `crossBridge` was ΔRGB 16 from `troponin` and 27 from
 * `tropomyosin` — close enough that at the eleven pixels these are drawn at,
 * three mechanisms read as one repeated part.
 *
 * The block's own value order says which family each belongs to: lightest to
 * darkest is thin, thick, structural. A head is part of the THICK filament, so
 * it sits near myosin, and the two thin-filament regulators sit above it. This
 * asserts the separation rather than the colours — a repaint that keeps the
 * order and the distance passes, one that lets two mechanisms converge does not.
 */
test("the mechanisms drawn as knobs on a filament stay told apart", () => {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dist = (a, b) => rgb(a).reduce((s, v, i) => s + Math.abs(v - rgb(b)[i]), 0);
  const lum = (hex) => {
    const [r, g, b] = rgb(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  for (const [a, b] of [
    ["crossBridge", "troponin"],
    ["crossBridge", "tropomyosin"],
  ]) {
    assert.ok(
      dist(PALETTE[a], PALETTE[b]) >= 30,
      `${a} and ${b} are ΔRGB ${dist(PALETTE[a], PALETTE[b])} apart — at the size these are drawn, two ` +
        `different mechanisms become one repeated part`,
    );
  }

  /* And the head stays on its own filament's side of the value order. */
  assert.ok(
    Math.abs(lum(PALETTE.crossBridge) - lum(PALETTE.myosin)) <
      Math.abs(lum(PALETTE.crossBridge) - lum(PALETTE.troponin)),
    "the myosin head is closer in value to the thin filament's regulators than to the thick filament it is part of",
  );
});

/**
 * A DOUBLE-SIDED SURFACE THAT DOES NOT WRITE DEPTH BLENDS WITH ITS OWN FAR WALL.
 *
 * `depthWrite` falls out of `opacity > 0.5`, so a surface at exactly 0.5 stops
 * writing depth. Combine that with `DoubleSide` and every pixel carries up to
 * four fragments of the same skin, composited in triangle-index order rather
 * than in depth order — and where the count or the order changes, the surface
 * steps.
 *
 * Measured 2026-08-26 on the fibre triad, held at the cisterna beat so both
 * frames sit at the same instant (`time` 0.65, `storeFraction` 0.668) and the
 * material is the only difference:
 * `.claude/shots/q2/fiber-tt-doubleside-before.png` against
 * `fiber-tt-frontside-after.png`.
 *
 * 10,091 pixels change, and every one of them is inside the T-tubule's own
 * footprint or something it covers. On those pixels the surface goes from
 * R−B +98.2 to +75.2: the far wall was compositing under the near one, so a
 * membrane written at opacity 0.5 was reaching the screen at roughly 0.75.
 * The number in the file and the number on the glass were different numbers.
 *
 * It also tiled, because two coats of the same skin are laid down in triangle
 * order rather than in depth order and the count changes across the surface —
 * `.claude/shots/q2/fiber-triad-after.png` steps L 95.5 → 126.9 in two pixels
 * at x=357, down the middle of a tube with no edge there.
 *
 * FrontSide rather than an explicit `depthWrite`, because there is nothing
 * inside a T-tubule that this scene draws — the far wall was never carrying
 * anything, and culling it makes 0.5 mean 0.5.
 *
 * The rule this pins is not "no DoubleSide" and not "no transparency". It is
 * that the combination has to be a DECISION. `sheathMaterial` asks for it by
 * name and says why — *"double sided so the far wall of the tube still shades"*
 * — and a wrapper you are meant to look through wants exactly that. What is
 * banned is INHERITING it from an opacity number, which is how the T-tubule got
 * it without anyone choosing it.
 */
test("a double-sided skin cannot pick up depthWrite:false from its opacity by accident", () => {
  assert.throws(
    () => anatomyMaterial({ colour: PALETTE.sarcolemma, opacity: 0.5, side: THREE.DoubleSide }),
    /depthWrite/,
    "0.5 is not > 0.5, so this silently becomes a skin blending against its own far wall",
  );
  assert.throws(
    () => anatomyMaterial({ colour: PALETTE.sarcolemma, opacity: 0.2, side: THREE.DoubleSide }),
    /depthWrite/,
  );

  /* Asking for it by name is a decision, and the sheaths are built on it. */
  assert.equal(
    anatomyMaterial({ colour: PALETTE.sarcolemma, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
      .depthWrite,
    false,
  );
  assert.equal(sheathMaterial({ colour: PALETTE.sarcolemma }).side, THREE.DoubleSide);
  assert.equal(sheathMaterial({ colour: PALETTE.sarcolemma }).depthWrite, false);

  /* And single-sided translucency is untouched — there is no far wall to blend. */
  assert.equal(anatomyMaterial({ colour: PALETTE.sarcolemma, opacity: 0.5 }).depthWrite, false);
  /* As is a double-sided surface opaque enough to write depth on its own. */
  assert.equal(
    anatomyMaterial({ colour: PALETTE.reticulum, opacity: 0.85, side: THREE.DoubleSide }).depthWrite,
    true,
  );
});
