import assert from "node:assert/strict";
import test from "node:test";

import { LEVELS } from "./fiberGeometry.js";

/**
 * A GLOW THAT BRIGHTENS WITH A QUANTITY MAY NOT SIT ON A COLOUR THAT DARKENS
 * WITH IT.
 *
 * This is the general form of a defect that has now been paid for twice, at two
 * scales, by two different people writing the same well-meant line.
 *
 * The cell scale first: `emissiveIntensity = demand / 2.0` on the flash beads.
 * Demand rose 4.05x from rest to bout and the beads' contrast against this
 * project's paper FELL 3.02 to 2.05 — 32% fainter at the moment the bout costs
 * the most. `cellGeometry.js` carries that note and moved to size and darkness.
 *
 * Then the fibre's terminal cisterna: colour lerping `reticulum` -> `calcium`
 * as the store fills, with the glow pinned to `calcium` and rising with the
 * same fraction. Filling therefore made the albedo DARKER and the light on it
 * BRIGHTER, and across the guided pass's own conclusion — 547.3 µM against
 * 448.3 — the two rings reached the screen ΔE 4.55 apart and could not be told
 * apart in a photograph. Without the glow, 7.55.
 *
 * WHY THE OTHER FIVE GLOWS IN THIS FILE ARE FINE, which is the part worth
 * writing down: every one of them lerps toward `tissuePeak` (#ff4a2b) from
 * something darker, so colour and glow brighten together and the two channels
 * add. The cisterna was the only one whose lerp ran the other way — toward a
 * colour DARKER than where it started. The rule is not "no emissive" and not
 * "one channel per fact". It is that the two channels have to agree about which
 * direction is more.
 *
 * WHAT THIS DOES NOT COVER. The body scale's effort ramp lives inside a React
 * frame loop (`MotionScene.jsx`) rather than in a buildable model, so it is not
 * reachable from here; it lerps `#8c5f5a` -> `#ff4a2b` with the glow on the
 * same peak colour, which is the safe direction, and `gate-legibility.spec.js`
 * photographs it. The cell scale has no store-driven emissive left to catch.
 */
const LUM = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/* Every numeric field the three levels read, with a low and a high. Written out
   rather than swept off an object so that a field ADDED to a level and not
   added here is a field this test silently stops covering — the list is the
   claim. */
const FIELDS = {
  activation: [0, 1],
  calcium: [0, 1],
  crossBridges: [0, 1],
  iBandHalf: [0.2, 0.9],
  length: [1.6, 2.6],
  overlap: [0, 1],
  stim: [0, 1],
  /* How far into the burst the tubule's flash is — added 2026-09-05 with the
     envelope it shapes. In this list because the list is the claim: a field a
     level reads and this file does not name is a field it silently stops
     covering, and the tubule now reads two. */
  stimPhase: [0, 1],
  storeFraction: [0, 1],
  girth: [0.9, 1.2],
};

const BASE = {
  activation: 0.5,
  calcium: 0.5,
  crossBridges: 0.5,
  iBandHalf: 0.5,
  length: 2.2,
  overlap: 0.5,
  stim: 0.5,
  stimPhase: 0.5,
  storeFraction: 0.5,
  girth: 1,
  /* NOT NUMERIC AND NOT SWEPT — these two say WHICH PICTURE is on screen rather
     than how much of something there is, so they have no low and high to raise
     between. They are true here so the phosphate field and the ATP molecule are
     drawn at all: a flag left false would take both out of every snapshot and
     this file would stop covering them without saying so. */
  showPhosphate: true,
  showAtp: true,
};

for (const level of Object.keys(LEVELS)) {
  test(`${level}: no glow brightens on a colour that is going dark`, () => {
    const model = LEVELS[level].build();

    const snapshot = () => {
      const out = [];
      model.group.traverse((o) => {
        if (!o.material || Array.isArray(o.material)) return;
        out.push({
          role: o.userData.role ?? o.name ?? "(untagged)",
          lum: LUM(o.material.color),
          glow: o.material.emissiveIntensity ?? 0,
        });
      });
      return out;
    };

    for (const [field, [low, high]] of Object.entries(FIELDS)) {
      model.update({ ...BASE, [field]: low }, 0);
      const at0 = snapshot();
      model.update({ ...BASE, [field]: high }, 0);
      const at1 = snapshot();

      for (let i = 0; i < at0.length; i += 1) {
        const a = at0[i];
        const z = at1[i];
        /* 1/255 of a channel — below this the two channels are not disagreeing,
           they are both standing still. */
        const EPS = 0.004;
        if (z.glow - a.glow <= EPS) continue;
        assert.ok(
          z.lum - a.lum > -EPS,
          `${level}/${z.role}: raising \`${field}\` from ${low} to ${high} brightens the glow ` +
            `${a.glow.toFixed(3)} -> ${z.glow.toFixed(3)} while darkening the colour under it ` +
            `${a.lum.toFixed(3)} -> ${z.lum.toFixed(3)}. The two halves of one signal are subtracting: ` +
            `the added light fills in exactly what the colour is taking away, and what reaches the ` +
            `screen is a fraction of either. See the cisterna measurement in fiberGeometry.js`,
        );
      }
    }

    model.dispose();
  });
}
