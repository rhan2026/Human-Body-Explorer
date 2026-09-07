import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

/**
 * THE LEGEND HAS TO MIRROR THE SCREEN IT IS ON, AND IT IS EASY TO TIE IT TO THE
 * WRONG ONE.
 *
 * `styles.css` says *"Swatch opacity mirrors the viewport encoding so the legend
 * explains itself"*, and this file exists because that sentence does not name
 * WHICH viewport. There are two, they use the same three role names, and their
 * numbers are nearly identical:
 *
 *   App.jsx        ROLE_STYLE  opacity 1 / 0.55 / 0.25   — the explorer, where
 *                                                          the legend renders
 *   MotionScene    ROLE_DRIVE  drive   1 / 0.55 / 0.3    — the motion route's
 *                                                          glow
 *
 * UPDATE 2026-09-05: the motion route DOES have a legend now — `.press__legend`,
 * on the stage — and it is not this one. It draws from that floor's own
 * `ROLE_OPACITY` (0.85 / 0.7 / 0.58, pinned in `guide/firstWalk.test.js`) and
 * takes each dot's alpha straight from that constant, so it cannot drift.
 * The body drawer's copy of THIS legend was removed the same day: it was
 * mirroring the explorer's ladder using the motion scene's three words, on a
 * screen whose ladder is neither. What is asserted below is unchanged and still
 * aimed at `App.jsx`, where this legend actually renders.
 *
 * A design round on 2026-08-27 matched the comment against the motion scene,
 * measured the legend brightening 122.3 -> 178.8 -> 216.5 against a body whose
 * luminance moves 110.2 -> 107.5 -> 106.0 the other way, concluded the legend
 * explained a channel the picture does not use, and repainted the swatches to
 * `lerp(REST_COLOUR, PEAK_COLOUR, ROLE_DRIVE)`. Every number in that reading was
 * right and the conclusion was wrong: the legend is in `App.jsx`'s panel, the
 * explorer really does fade whole muscles by `ROLE_STYLE.opacity`, and the
 * repaint put the legend at odds with the only screen that shows it. Reverted.
 *
 * So the assertion is the tie the comment claims, aimed at the file the legend
 * lives beside — and the second test is the guard rail that would have stopped
 * the wrong fix: the two tables are ALLOWED to differ, and if they ever agree by
 * accident this file stops being able to tell which one is being mirrored.
 */
const SRC = new URL("./", import.meta.url);
const ROLES = ["primary", "secondary", "stabilizer"];

const tableOf = (source, name, key) => {
  const block = source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `${name} is no longer a literal object, so this gate cannot read it`);
  const out = {};
  for (const role of ROLES) {
    const line = block[1].match(new RegExp(`${role}:[^\\n]*?${key}:\\s*([0-9.]+)`));
    assert.ok(line, `${name}.${role} carries no ${key}`);
    out[role] = Number(line[1]);
  }
  return out;
};

test("the legend's swatches fade the way the screen the legend is on fades", async () => {
  /* THE LEGEND MOVED TO THE SCREEN ITS ENCODING IS ON — 2026-09-01.
     It lived on the front door because the front door used to pick an exercise
     and paint roles. Since Rex's unification that page is Idle: every muscle at
     one weight, the group chips the only highlight, no roles at all. The
     three-tier ramp is on the MOTION window now — `Body` paints a primary mover
     at 0.55 and everything else at 0.12 — so the key belongs there, and a key
     on a screen with nothing to key is worse than none.
     `ROLE_STYLE` still lives in `App.jsx` and is exported to it, so the labels
     and the opacities remain one fact. This reads both files: the table where it
     is defined, and the markup wherever it is drawn. */
  const app = await readFile(new URL("App.jsx", SRC), "utf8");
  const motion = await readFile(new URL("MotionScene.jsx", SRC), "utf8");
  const css = await readFile(new URL("styles.css", SRC), "utf8");
  const walk = await readFile(new URL("guide/firstWalk.js", SRC), "utf8");

  /* RE-AIMED 2026-09-05, AND THE OLD AIM WAS THE BUG.
     This asserted that the body's key was drawn at `ROLE_STYLE`'s opacities —
     App.jsx's EXPLORER ramp, 1 / 0.55 / 0.25 — while the body scale draws
     `ROLE_OPACITY`, 0.85 / 0.7 / 0.58. So the gate was actively holding the key
     on this screen to another screen's numbers, which is the exact failure its
     own header warns about one paragraph up ("the legend is on that screen and
     is explaining a different number from it"). The swatch markup it looked for
     lived only in the motion drawer and is gone with it; `styles.css` keeps
     `.swatch--*` for the explorer, which is where that ladder belongs.
     WHAT REPLACES IT IS STRONGER, not looser. The old shape was two tables that
     had to be kept equal by hand. The stage key reads its alphas straight out of
     the constant the meshes are drawn from, so there is one table and it cannot
     drift — and that is what is asserted: the key exists, and it is built from
     `ROLE_OPACITY` rather than from numbers of its own. */
  /* THE KEY IS GONE FROM THE BODY AND THE PASS SAYS IT INSTEAD — 2026-09-06.
     `fbeb046` took `.press__legend` off the stage while working the owner's
     walk-through list, and this case went red asking for it back. It was right
     that the three weights would otherwise be something to infer; it was wrong
     that a standing key is the only way to stop that.
     `firstWalk.js` beat 3 says it in words, on arrival, every arrival now:
     "The colors tell you which muscle groups you're looking at. The brightness
     tells you what job they are doing." That is the owner's rule for this whole
     app — a thing is explained by being seen or by the tour saying it, never by
     a paragraph parked in a corner — and a three-row key in the corner of a
     screen whose subject is a body is exactly the furniture they have spent this
     pass removing.
     SO THIS INVERTS, and keeps the half that still matters. If a key ever comes
     back it may not carry opacities of its own: the failure this whole file was
     written for is two tables kept equal by hand, and that failure is waiting
     whether the key is on screen today or not. */
  assert.equal(
    /className="press__legend"/.test(motion),
    false,
    "the role key is back on the body scale. That is not forbidden — but it must read ROLE_OPACITY " +
      "(see the case below) and it must not repeat what the walk's third beat already says",
  );
  assert.ok(
    /The brightness tells you what job they are doing/.test(walk.replace(/\*\*/g, "")),
    "the walk stopped saying what brightness means, and the key that used to say it is gone too — " +
      "so the three weights are something to infer again, which is what this file exists to prevent",
  );
  assert.equal(
    /style=\{\{ opacity: [0-9.]/.test(motion),
    false,
    "something on the body scale draws a role weight from a typed number instead of ROLE_OPACITY",
  );

  /* The explorer's own ladder still has to agree with itself where it renders. */
  const style = tableOf(app, "ROLE_STYLE", "opacity");
  for (const role of ROLES) {
    const rule = css.match(new RegExp(`\\.swatch--${role}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `.swatch--${role} is gone from styles.css and the explorer's legend has lost a tier`);
    const opacity = Number(rule[1].match(/opacity:\s*([0-9.]+)/)?.[1]);
    assert.equal(
      opacity,
      style[role],
      `.swatch--${role} is drawn at opacity ${opacity} while App.jsx fades that role's muscles to ` +
        `${style[role]}`,
    );
  }
});

test("the two role tables stay distinguishable, so the legend cannot be tied to the wrong one", async () => {
  const app = await readFile(new URL("App.jsx", SRC), "utf8");
  const scene = await readFile(new URL("MotionScene.jsx", SRC), "utf8");
  const style = tableOf(app, "ROLE_STYLE", "opacity");
  const drive = Object.fromEntries(
    scene
      .match(/const ROLE_DRIVE = \{([^}]*)\}/)[1]
      .split(",")
      .map((pair) => pair.split(":").map((s) => s.trim()))
      .filter(([k]) => k)
      .map(([k, v]) => [k, Number(v)]),
  );
  assert.deepEqual(Object.keys(drive).sort(), ROLES.slice().sort());

  /* They are two encodings on two screens and they are allowed to differ; what
     they may not do is become the same three numbers, because then the comment
     in `styles.css` stops naming anything and the next reader has no way to
     tell which screen the legend is a legend for. */
  assert.notDeepEqual(
    ROLES.map((r) => style[r]),
    ROLES.map((r) => drive[r]),
    "ROLE_STYLE and ROLE_DRIVE now carry the same three numbers. They belong to different screens with " +
      "different channels — opacity in the explorer, a colour ramp in the motion scene — and while they " +
      "coincide, nothing in this repository says which one the legend explains",
  );
});
