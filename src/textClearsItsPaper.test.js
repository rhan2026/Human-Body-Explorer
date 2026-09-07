import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { SCENE } from "./anatomyStyle.js";

/**
 * THE ONE SENTENCE THAT SAYS THE PICTURE IS NOT ANSWERING THE QUESTION IS SET
 * IN THE FAINTEST TYPE ON THE PAGE.
 *
 * `#motion/push_up/left-brachioradialis/fiber@999s` asks for an instant the
 * archive does not have. All three lower scales handle it honestly — the clock
 * clamps into the grid and a `.note` says so, which is CLAUDE.md §5's "입력이
 * 시나리오 격자를 벗어나면 보이게 말한다" and the reason `CellReadout.jsx`
 * carries a paragraph about the consumer `outOfRange` never had.
 *
 * Measured 2026-08-27 at 1201x734 and at 390x780, all three scales: the notice
 * IS in the viewport, and it is 11px, `var(--muted)`, contrast **4.34:1**
 * against the canvas paper. WCAG AA wants 4.5 for text that size, and 11px at
 * weight 700 is still normal text by that rule — large starts at 18.66px, or
 * 14pt bold. So the sentence whose whole job is to be noticed was the least
 * noticeable thing on screen.
 *
 * FIXED AT THE TOKEN, NOT AT THE NOTICE. `--muted` is on 30 declarations —
 * the loader, the seam notice, the pick's secondary line, the role chips, the
 * `.meta` terms. Every one of them was under the floor for the same reason, so
 * darkening the one token is a smaller diff than rescuing the one paragraph and
 * fixes twenty-nine other things that were never measured.
 *
 * Three surfaces because the app has three: `--bg` behind the panel, `--panel`
 * behind the cards, and `SCENE.background` behind the 3D stage, which is where
 * the out-of-range notice actually sits. The strictest of the three is what the
 * token has to clear. `SCENE.backgroundDark` is not among them — it is declared
 * and no surface uses it.
 */
const AA_NORMAL = 4.5;
const SHEETS = [
  "./styles.css",
  "./press.css",
  "./fiber/fiber.css",
  "./cell/cell.css",
  "./signalling/signalling.css",
  /* The shared headline sheet, added when it moved out of `signalling.css` on
     2026-08-31. A sheet this list does not name is text nothing checks the
     contrast of, and this one carries the largest words on two scales. */
  "./scaleHead.css",
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const relLum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("the muted text token clears AA on every surface this app paints", async () => {
  /* Across every stylesheet, not just `styles.css` — the three arm colours are
     declared in `cell.css`, which the signalling scale imports. */
  const css = (await Promise.all(SHEETS.map((f) => readFile(new URL(f, import.meta.url), "utf8")))).join("\n");
  const tokenOf = (name) => {
    const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `--${name} is no longer a six-digit hex in any stylesheet, so this gate cannot read it`);
    return m[1];
  };

  const surfaces = [
    ["--bg", tokenOf("bg")],
    ["--panel", tokenOf("panel")],
    ["SCENE.background", SCENE.background],
  ];

  /* Every token a word is written in. `--line` is not among them — it is a
     border colour and borders are not text. */
  for (const token of ["text", "muted", "accent", "arm-control", "arm-resistance", "arm-endurance"]) {
    const value = tokenOf(token);
    for (const [name, surface] of surfaces) {
      const c = contrast(value, surface);
      assert.ok(
        c >= AA_NORMAL,
        `--${token} ${value} on ${name} ${surface} is ${c.toFixed(2)}:1, under AA's ${AA_NORMAL} for the ` +
          `11px this app writes most of its secondary text at. The out-of-range notice — the sentence that ` +
          `tells a viewer the picture is not showing the instant they asked for — is one of them`,
      );
    }
  }
});

/**
 * AND NO STYLESHEET MAY GO AROUND THE TOKENS.
 *
 * The four failures above were all literals, not tokens, which is why a gate on
 * the tokens alone would have caught none of them. This sweeps every `color:`
 * in every stylesheet.
 *
 * The exceptions are listed by value and each is a colour on a DARK surface,
 * where the same arithmetic run against a light paper is meaningless: `#ece8e3`
 * on `.press`'s `#17161a`, `#f7ece4` on the ride card's `rgba(24, 18, 16, .92)`,
 * and white on `--accent`. Listing them by value rather than skipping any
 * literal means a NEW light-surface colour cannot arrive unnoticed.
 */
test("no stylesheet writes text in a colour that misses the floor", async () => {
  const { readdir } = await import("node:fs/promises");
  const dir = new URL("./", import.meta.url);
  const files = [];
  const walk = async (at, prefix = "") => {
    for (const entry of await readdir(new URL(prefix, at), { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(at, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".css")) files.push(`${prefix}${entry.name}`);
    }
  };
  await walk(dir);
  assert.ok(files.length >= 4, `found ${files.length} stylesheets, which is fewer than this app has`);

  /* `#f7f4ef` joined 2026-08-30: the guided pass's subtitle, light text on the
     dark pill `rgba(38, 34, 29, .92)` in `fiber/fiber.css` — 12.9:1 on the
     surface it actually sits on. Same class of exception as the ride card. */
  /* `#b8b3ab` LEFT ON 2026-08-31 WITH THE PLATE IT SAT ON, and `#d9d4cb` took
     its place. The old note said it was the body's hint in the dark scheme,
     drawn on the `rgba(32, 30, 35, .86)` plate the same rule painted two lines
     above it. Canon D2ⓐ's ruling — *"문제는 색이 아니라 글이 상자에 담겨 떠
     있다는 것 자체였다"* — took the plates off both of the body's foot lines, so
     the words now sit on `.press`'s own `#17161a` with a halo in that colour
     instead. Still a dark surface, so still this class of exception; what
     changed is which dark surface, which is why the value changed with it.

     `#f7f4ef` joined 2026-08-30 as the guided pass's subtitle on a dark pill,
     and that pill is gone too — the value survives only if some other rule
     still uses it. Checked when this was edited; leave it listed until a sweep
     says otherwise, because an unused entry costs nothing and a missing one
     turns this gate red for a colour nobody changed. */
  /* `#faf8f5` JOINED 2026-09-05, AND ITS ARRIVAL IS THIS GATE WORKING. The note
     above says listing exceptions by VALUE rather than skipping literals means
     "a NEW light-surface colour cannot arrive unnoticed" — one did, and it was
     noticed. It is `.sig-chip.is-on`'s label in `signalling/signalling.css`,
     drawn on the `#403c36` that the same rule paints two lines above it: 11.6:1
     where it sits, and the 1.00:1 this reported is the arithmetic against a
     paper the chip covers. Same class as the ride card and the pass subtitle.
     IT IS ALSO `SCENE.background`, which is why the number came out exactly 1 —
     the chip's label is the paper's own colour, used as ink on top of the dark
     chip. That is the right choice for it and the reason this entry needs the
     surface named rather than just the value. */
  /* `#f7f8fa` JOINED THEM ON 2026-09-06: `.wayin__go`, the "Go inside →" label
     the owner asked to stand under the way-in disc *"항상 잘보이게 색깔을 잘
     선택해서"*. It carries its own opaque `#161c24` plate — `wayin.css` says why
     in the rule above it: the disc behind is a live render that brightens and
     darkens as the fibre contracts, so ink picked against one frame fails on the
     next. 16.9:1 on the plate it actually sits on; 1.00:1 against the paper this
     case assumes, which is the arithmetic being meaningless rather than failed. */
  const ON_DARK = new Set(["#ece8e3", "#f7ece4", "#f7f4ef", "#d9d4cb", "#faf8f5", "#f7f8fa", "#fff", "#ffffff"]);
  const surfaces = ["#ffffff", "#f7f8fa", SCENE.background];
  const offenders = [];
  for (const file of files) {
    const css = await readFile(new URL(file, dir), "utf8");
    for (const m of css.matchAll(/(?:^|[;{\s])color:\s*(#[0-9a-fA-F]{3,6})\s*;/gm)) {
      const value = m[1].toLowerCase();
      if (ON_DARK.has(value)) continue;
      const worst = Math.min(...surfaces.map((s) => contrast(value, s)));
      if (worst < AA_NORMAL) {
        offenders.push(`${file}:${css.slice(0, m.index).split("\n").length} ${value} at ${worst.toFixed(2)}:1`);
      }
    }
  }
  assert.deepEqual(offenders, [], `text written under AA on this app's own paper:\n  ${offenders.join("\n  ")}`);
});
