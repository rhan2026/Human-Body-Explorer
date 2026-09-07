import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/**
 * THE BOX THAT SHIPS IS THE PEER'S, AND OURS IS PARKED — 2026-09-07.
 *
 * Owner, to the other session: *"lets make the visuals for the user text box
 * first. then the api and claude connection the other agent will do it"*. So
 * `guide/AskBell.jsx` is mounted in the shell and this lane is the API behind
 * its two seams (`ask/bridge.js`). `ask/AskBell.jsx` and `ask.css` stay, the
 * way the Anatomy Assistant stays: unmounted, with their sheet's pins below
 * kept as the record of the owner's verbatim ask for a box here (*"white … no
 * margins but divided from the background with shadows … "Ask Bell
 * anything!""*), which is still the only written spec of one.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const rules = (css, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = [...strip(css).matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);
  assert.ok(found.length, `no rule for \`${selector}\``);
  return found;
};
const rule = (css, selector) => rules(css, selector)[0];

const css = read("./ask.css");
const jsx = read("./AskBell.jsx");
const main = strip(read("../main.jsx"));

test("the shell mounts the peer's box and not ours, and still not the parked widget", () => {
  assert.match(main, /import AskBell from "\.\/guide\/AskBell\.jsx"/);
  assert.match(main, /<AskBell[\s\S]{0,300}placeholder=\{assistantPlaceholder\(state, scale\)\}/);
  assert.doesNotMatch(main, /from "\.\/ask\/AskBell\.jsx"/, "our box is parked — the owner chose the other session's");
  assert.doesNotMatch(main, /<AssistantWidget/);
  assert.doesNotMatch(main, /^\s*import AssistantWidget/m);
  assert.match(jsx, /PARKED, 2026-09-07 — NOT MOUNTED/, "the parked box must say so at its head, as the widget does");
  /* And the API behind their box is one import and one line. */
  assert.match(main, /import AskBridge from "\.\/ask\/AskBridge\.jsx"/);
  assert.equal((main.match(/<AskBridge \/>/g) ?? []).length, 1);
});

test("the foot furniture is back where it was: nothing reads the parked sheet's clearance", () => {
  /* Our box lifted the body timeline, the run axis, ENERGY's controls, the
     pick pill, the loading line and the dock by `--ask-clear`; the peer's box
     steps above furniture itself (`.ask--over-*`), so every lift is reverted. */
  for (const sheet of ["../press.css", "../scaleHead.css", "../styles.css", "../cell/cell.css"]) {
    assert.doesNotMatch(read(sheet), /--ask-clear/, `${sheet} still reads the parked box's clearance`);
  }
});

test("the parked sheet still says what the owner asked for: fixed, centred, white, borderless, a shadow, round corners", () => {
  const box = rule(css, ".ask-bell");
  assert.match(box, /position:\s*fixed/);
  assert.match(box, /left:\s*50%/);
  assert.match(box, /background:\s*var\(--bg\)/);
  assert.match(box, /(^|[;\s])border:\s*0\s*;/);
  assert.match(box, /box-shadow:\s*0 10px 30px rgba\(22,\s*28,\s*36,\s*\.14\)/);
  assert.match(box, /border-radius:\s*14px/);
  assert.doesNotMatch(box, /border-radius:\s*999px/);
  assert.ok(jsx.includes('placeholder="Ask Bell anything!"'), "the owner's string, exactly");
});

test("there is no chat log: no list of turns is rendered anywhere under src/ask", () => {
  /* Decided 2026-09-06 and unchanged by the change of box: the answer is
     spoken by the character. No log, no panel. Pinned as an absence. */
  for (const file of ["./AskBell.jsx", "./AskBridge.jsx", "./bridge.js"].filter((f) => existsSync(new URL(f, import.meta.url)))) {
    const live = strip(read(file));
    assert.doesNotMatch(live, /messages\.map|history\.map|\.map\(\s*\(?\s*(message|turn|m)\b/, `${file} renders a list of turns`);
    assert.doesNotMatch(live, /__log|__msg|role="log"/, `${file} names a log`);
    assert.doesNotMatch(live, /<(p|ul|ol|li)\b/, `${file} renders paragraphs or lists`);
  }
  assert.doesNotMatch(strip(css), /__log|__msg/);
});
