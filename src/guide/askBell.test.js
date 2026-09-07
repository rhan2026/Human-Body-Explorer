import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE QUESTION BOX IS BACK, AND IT IS BELL'S.
 *
 * Owner, 2026-09-07: *"because the other agent is taking so much time lets make
 * the visuals for the user text box first. then the api and claude connection
 * the other agent will do it"*. So this tree gets the box a visitor types into
 * and the two seams the other lane wires — and nothing that pretends to answer.
 *
 * What these gates hold, and why each would go unnoticed otherwise:
 *
 *   1. ONE composer, mounted once in the shell. Four scenes mounting their own
 *      is four text boxes, and the old assistant lived at the Router for the
 *      same reason. It asks the scale's own question through
 *      `assistantPlaceholder`, which main.jsx kept for exactly this.
 *   2. Two named seams, `askBell` and `bellSays`, and NO fetch: the API is the
 *      other lane's. A composer that reached a server itself would be the
 *      chatbot `ask.js` names as this project's failure mode.
 *   3. Typing to Bell, and picking Bell up, are not reaching for the scene —
 *      `INTERRUPTS` includes keydown and pointerdown, and without the exemption
 *      the first letter of a question ends the narration it is about.
 *   4. It sits in the dock's corner at the dock's layer, under the drawer.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("one composer, mounted once in the shell, asking the scale's own question", () => {
  const main = read("../main.jsx");
  assert.match(main, /import AskBell from "\.\/guide\/AskBell\.jsx";/, "the shell no longer mounts the composer");
  assert.match(
    main,
    /<AskBell[\s\S]{0,200}placeholder=\{assistantPlaceholder\(state, scale\)\}/,
    "the composer no longer asks the scale's own question — `assistantPlaceholder` is the only thing that knows what each scale should be asked",
  );
  for (const scene of ["../App.jsx", "../MotionScene.jsx", "../cell/CellScale.jsx", "../signalling/SignallingScale.jsx", "../fiber/MuscleFiberVisualization.jsx"]) {
    assert.doesNotMatch(read(scene), /<AskBell/, `${scene} mounts its own composer — four scenes, four text boxes`);
  }
});

test("asking and answering go through two named seams, and the composer reaches no server", () => {
  const bus = read("./askBell.js");
  assert.match(bus, /export const ASK_BELL = "hpe:guide-ask";/, "the ask event's name changed — the other lane listens for this string");
  assert.match(bus, /export function askBell\(/);
  assert.match(bus, /new CustomEvent\(ASK_BELL, \{ detail: \{ text, context \} \}\)/, "the ask no longer carries the words and what the screen holds");
  assert.match(bus, /export const BELL_SAYS = "hpe:guide-says";/, "the answer event's name changed — the other lane dispatches this string");
  assert.match(bus, /export function bellSays\(/);
  const jsx = read("./AskBell.jsx");
  assert.match(jsx, /askBell\(/, "send no longer asks");
  assert.match(jsx, /sayAgain\(\)/, "the composer lost its say-again — the owner's way back to the last sentence");
  assert.doesNotMatch(jsx, /fetch\(|\/api\//, "the composer talks to a server itself — the API is the other lane's, behind the seam");
  const guide = read("./Guide.jsx");
  assert.match(guide, /addEventListener\(BELL_SAYS,/, "the guide no longer listens for an answer to say");
});

test("typing to Bell, and picking Bell up, do not end the narration", () => {
  /* THE TOUR NO LONGER ENDS ON ANY INTERRUPT — main line, 2026-09-06 (owner: touching the
     scene must not end the pass), so it needs no exemption: the listener itself is gone. */
  assert.doesNotMatch(read("../tour.js"), /for \(const type of INTERRUPTS\) window\.addEventListener/, "the tour ends on interrupts again — typing to Bell would end the narration");
  for (const [p, name] of [["./useWalk.js", "the walk"]]) {
    assert.match(
      read(p),
      /closest\?\.\("\.ways, \.ask, \.guide__body(, \.guide__next)?"\)/,
      `${name}: a keydown in the composer, or a pointerdown on the character, ends the pass again`,
    );
  }
});

test("the composer holds the bottom-right corner, longer, at the dock's layer, and steps above the two floors' foot furniture", () => {
  /* Owner, 2026-09-07, in three moves: the dock's corner, then *"mvoe the text
     box to the center"*, then *"in fact i want the text box to be on the bottom
     right corner, where bell's default position is right now. also i want the
     box to be a bit longer. thus, bell's default would have to move somewhere
     else"*. So: right 18, 25rem (was 22), and Bell stands on top of it (its
     own gate below). The body's rep timeline and SIGNALS' time scrubber are
     bottom-centre furniture with fixed feet (30 px and 18 px up) whose right
     ends a right-anchored box reaches; on those two floors the box steps above
     them, and main.jsx says which floor it is on. */
  const css = read("./askBell.css");
  const ask = css.match(/\n\.ask\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(ask, /position:\s*fixed/);
  assert.match(ask, /right:\s*28px/, "the composer left the bottom-right corner, or lost the owner's 10 px in from it");
  assert.match(ask, /bottom:\s*28px/, "the composer lost the owner's 10 px up from the foot");
  assert.doesNotMatch(ask, /left:\s*(50%|18px)/, "the composer is anchored left again");
  assert.match(ask, /width:\s*30rem/, "the composer is no longer the longer box the owner asked for (25rem, then 30, growing left off its right edge)");
  assert.match(ask, /z-index:\s*35/, "the composer left the dock's layer (35) — at 50 or above it would float over the drawer's scrim");
  /* ONE PLACE ON EVERY FLOOR — owner, 2026-09-07: *"i want the user tex box to
     be in the identical locaiton for all windows"*. It used to have three
     heights, stepping over the body's rep timeline and SIGNALS' scrubber. The
     bars move now (below), so the three are one number. The two classes are
     kept, carrying the same value, because main.jsx still names the floor —
     this is what stops one of them quietly drifting off again. */
  const wide = css.slice(0, css.indexOf("@media (max-width: 640px)"));
  const bottomOf = (selector) => {
    const m = wide.match(new RegExp(`(?:^|\\n)[^{}]*\\${selector}[^{}]*\\{([^}]*)\\}`));
    assert.ok(m, `no wide-screen rule sets ${selector}`);
    const b = m[1].match(/bottom:\s*([\d.]+)px/);
    assert.ok(b, `${selector} does not set a bottom`);
    return Number(b[1]);
  };
  const plain = bottomOf(".ask");
  assert.equal(bottomOf(".ask--over-time"), plain, "the composer sits at a different height on the body's motion floor again");
  assert.equal(bottomOf(".ask--over-scrub"), plain, "the composer sits at a different height on SIGNALS again");
  const main = read("../main.jsx");
  assert.match(main, /over=\{scale === "signalling" \? "scrub" : scale === "body" && getMotion\(state\.exercise\) \? "time" : null\}/, "the shell no longer tells the composer which foot furniture it is standing over");
});

test("the two centred foot bars reserve the box's footprint, and the reserve covers it", () => {
  /* The other half of the owner's call: *"move the center motion progress bar to
     the left a bit so the text box is in the same location to otehr widows"*.
     A constant shift would be wrong at both ends — at 1920 there is room to
     spare, at 1100 there is not — so the bars centre in the stage LESS the
     box's footprint, and the footprint is one number in styles.css. */
  const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const reserve = Number(styles.match(/--ask-reserve:\s*([\d.]+)px/)?.[1]);
  assert.ok(Number.isFinite(reserve), "styles.css no longer declares --ask-reserve");
  assert.match(styles, /@media \(max-width: 640px\)[^}]*\{[^}]*--ask-reserve:\s*0px/s, "a phone still reserves a foot-right it does not have");

  /* One bar left: the body's rep timeline was deleted on the owner's word,
     2026-09-07, so the motion floor's foot is empty and only SIGNALS pays. */
  for (const [file, bar] of [["../scaleHead.css", ".scale-time"]]) {
    const css = readFileSync(new URL(file, import.meta.url), "utf8");
    const rule = css.match(new RegExp(`\\${bar}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    assert.match(
      rule,
      /left:\s*calc\(50% - var\(--ask-reserve\) \/ 2\)/,
      `${bar} is centred on the stage again, so it runs under the question box`,
    );
  }

  /* And the reserve has to actually cover the box: its width, its inset, and a
     gap. A wider box with an unchanged reserve is a collision. */
  const ask = readFileSync(new URL("./askBell.css", import.meta.url), "utf8");
  const wide = ask.slice(0, ask.indexOf("@media (max-width: 640px)"));
  const width = Number(wide.match(/width:\s*([\d.]+)rem/)?.[1]) * 16;
  const inset = Number(wide.match(/right:\s*([\d.]+)px/)?.[1]);
  assert.ok(Number.isFinite(width) && Number.isFinite(inset));
  assert.ok(
    reserve >= width + inset + 8,
    `--ask-reserve is ${reserve}px but the box needs ${width + inset}px plus a gap; the bars will run under it`,
  );
});

test("Bell's home is on top of its question box, read per frame", () => {
  /* The box took Bell's corner, so Bell stands on the box: its feet a little
     above the box's top, whatever that is this frame — the box steps above two
     floors' furniture and folds to a pill on a phone. Read like the `avoid`
     dodge, not computed once, and the floor's own minimum still holds under it
     (a phone stacks controls along its foot). */
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /const ON_BOX = \d+;/, "the air between Bell's feet and the box is no longer a named number");
  assert.match(jsx, /document\.querySelector\("\.ask"\)\?\.getBoundingClientRect\(\)/, "Bell no longer reads where its box is — it will stand on it, or in the corner the box now holds");
  assert.match(jsx, /Math\.max\(floorY, /, "the floor's own minimum no longer holds under the box's height — on a phone Bell stands in the controls again");

  /* Owner, 2026-09-07: *"move bells default position to the center of the text
     box, same y coordinates"*. Centred on the box, and by the DROP's
     convention — x is the character's own left edge — because the anchor's
     convention would put Bell a REACH to one side of the point instead of on
     it, and which side that is flips with the room left on the stage. */
  assert.match(
    jsx,
    /askBox\.left \+ askBox\.width \/ 2 - r\.left - cw \/ 2/,
    "Bell's home is no longer the centre of its question box, less half of itself",
  );
  assert.match(
    jsx,
    /const put = parked\.current \?\? \(anchor \? null : home\);/,
    "home no longer rides in the drop's slot — read as an anchor it becomes a thing to stand BESIDE, and Bell steps off the box's centre by a reach",
  );
});
