import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * TWO MUSCLE GROUPS MAY NOT BE ONE COLOUR.
 *
 * `anatomyStyle.js` states what this palette is for, in its own words: *"Identity
 * — App.jsx paints each muscle by its group, from the saturated categorical
 * palette in muscle-map.json … Hue answers 'which muscle is this'."*
 *
 * Two pairs answered it identically. Measured 2026-08-27 off the shipped
 * mapping:
 *
 *   chest #e8776b  vs quadriceps #e8836b   ΔRGB **12** — the green channel only
 *   arms  #c86fb8  vs glutes     #c86fa8   ΔRGB **16** — the blue channel only
 *
 * They are the shape of a copied line with one digit changed. On the group rail
 * they are sixteen 10 px dots in one list, two pairs of which are the same dot;
 * on the body they paint whole regions.
 *
 * 30 is this project's own floor, from `anatomyStyle.test.js` on the filament
 * knobs — *"at the eleven pixels these are drawn at, three mechanisms become one
 * repeated part"* — and a group chip's dot is that size. Distance is summed per
 * channel for the same reason it is there: it is the cheap measure that catches
 * a near-duplicate, which is the failure that actually happens.
 */
test("no two muscle groups are painted the same colour", async () => {
  const map = JSON.parse(await readFile(new URL("../public/mapping/muscle-map.json", import.meta.url), "utf8"));
  const groups = Object.entries(map.groups ?? {});
  assert.ok(groups.length >= 12, `only ${groups.length} groups in the mapping — this test is watching too few`);

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const near = [];
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const [aKey, a] = groups[i];
      const [zKey, z] = groups[j];
      if (!a.color || !z.color) continue;
      const d = rgb(a.color).reduce((s, v, k) => s + Math.abs(v - rgb(z.color)[k]), 0);
      if (d < 30) near.push(`${aKey} ${a.color} and ${zKey} ${z.color} are ΔRGB ${d} apart`);
    }
  }
  assert.deepEqual(
    near,
    [],
    "this palette exists so that hue answers \"which muscle is this\", and these pairs answer it the same " +
      `way:\n  ${near.join("\n  ")}`,
  );
});

/** The two copies have to agree, or the app ships one and the pipeline keeps the other. */
test("the shipped mapping is the pipeline's mapping", async () => {
  const shipped = await readFile(new URL("../public/mapping/muscle-map.json", import.meta.url), "utf8");
  const source = await readFile(new URL("../../anatomy-mesh-set/mapping/muscle-map.json", import.meta.url), "utf8");
  assert.equal(
    shipped,
    source,
    "`public/mapping/muscle-map.json` and `anatomy-mesh-set/mapping/muscle-map.json` have drifted, so the " +
      "app is painting from one file and the pipeline from another",
  );
});
