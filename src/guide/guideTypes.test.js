import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE SENTENCE IS TYPED, AND THE BOX DOES NOT MOVE WHILE IT IS.
 *
 * Owner, 2026-09-06: *"the text should appear in the text bubble letter by
 * letter, as if it is typed manually. this is aimed to increase legibility and
 * interactiveness"*.
 *
 * The easy way to type a sentence is to render its first n letters, and that is
 * the wrong way here: the bubble is `max-content` wide and the box is placed off
 * its own width, so a bubble growing letter by letter would re-wrap and walk the
 * character across the stage as it went. The whole sentence has to be in the box
 * from the first frame — the untyped part present in transparent ink — so the
 * width and the line breaks are final before the first letter shows, and the
 * letters fill the box in place. Present also means a screen reader gets the
 * sentence whole and once, instead of a hundred one-letter changes to a live
 * region.
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("the letters arrive at a typist's pace, and the bubble's life includes the typing", () => {
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /const TYPE_MS = \d+;/, "the pace of a letter is no longer a named number");
  /* Owner, 2026-09-07: *"text bubble dissappear 2 seconds faster"*, with the
     linger already down to a second. The second came off the double-count: the
     hold was typing + reading + linger, and the letters are READ AS THEY LAND,
     so charging a full reading time after the last letter charges twice for the
     same words. The reading clock runs from the first letter now. */
  assert.match(
    jsx,
    /readingMs\(shown\) \+ LINGER_MS/,
    "the bubble's hold is no longer the reading time plus the linger",
  );
  assert.ok(
    !/typingMs\(shown\) \+ readingMs\(shown\)/.test(jsx),
    "the typing is being charged on top of the reading again — the same words paid for twice",
  );
  assert.match(jsx, /prefers-reduced-motion/, "a reader who asked for less motion is typed at anyway");
});

test("reading outlasts typing, so the bubble can never fade mid-sentence", () => {
  /* The hold is the reading time alone, so the sentence has to finish arriving
     inside it. That holds while a character costs less to type than to read:
     typing is TYPE_MS each, reading is 1000 / WORDS_PER_SECOND per word, so the
     words of a sentence would have to average this many characters before the
     typing outran it. English runs five or six; the deep scales' terms push it
     up, never near this. A gate rather than a comment because raising TYPE_MS
     is exactly the sort of tuning that would silently start clipping. */
  const typeMs = Number(read("./Guide.jsx").match(/const TYPE_MS = (\d+);/)?.[1]);
  const wps = Number(read("../tour.js").match(/WORDS_PER_SECOND = ([\d.]+);/)?.[1]);
  assert.ok(Number.isFinite(typeMs) && Number.isFinite(wps), "TYPE_MS or WORDS_PER_SECOND could not be read");
  const breakEven = 1000 / (wps * typeMs);
  assert.ok(
    breakEven >= 9,
    `a sentence averaging ${breakEven.toFixed(1)} characters a word would be typed slower than it is read, ` +
      "and its last words would fade while still arriving; keep TYPE_MS low enough to leave that above nine",
  );
});

test("the whole sentence is in the box from the first frame, the untyped part in transparent ink", () => {
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /className="guide__untyped"/, "the untyped remainder is no longer rendered — the bubble will grow with its sentence and walk the character");
  const css = read("./guide.css");
  const m = css.match(/\n\.guide__untyped\s*\{([^}]*)\}/);
  assert.ok(m, "guide.css has no rule for `.guide__untyped`");
  assert.match(m[1], /color:\s*transparent/, "the untyped remainder is visible, or absent, instead of present and transparent");
  assert.doesNotMatch(m[1], /display:\s*none|visibility:\s*hidden/, "the untyped remainder leaves the layout (`display: none`) or the accessibility tree (`visibility: hidden`)");
});

test("the sentence is set a step heavier than body text, and a picked-out term heavier still", () => {
  /* Owner, 2026-09-07: *"bold the text within the textbox slightly"*. Slightly:
     a step above the page's 400, well short of the 600 the chrome uses for
     labels, and below `.guide__term`, or the one word a beat picks out stops
     standing out of its sentence. */
  const css = read("./guide.css");
  const say = css.match(/\n\.guide__say\s*\{([^}]*)\}/)?.[1] ?? "";
  const weight = Number(say.match(/font-weight:\s*(\d+)/)?.[1]);
  assert.ok(weight >= 500 && weight < 600, `the sentence's weight is ${weight || "unset"}; slightly bold is a step above 400 and under 600`);
  const term = Number(css.match(/\n\.guide__term\s*\{[^}]*font-weight:\s*(\d+)/)?.[1]);
  assert.ok(term > weight, `a picked-out term (${term}) is no heavier than the sentence around it (${weight})`);
});

test("the highlighter arrives with the letters, and costs the word no width", () => {
  /* Owner, 2026-09-07: *"when bell tries to emphasize a word during dialogue,
     the yellow underscore appears before the text is written. make it so that
     the yellow underscore appears simultaneously with the word highlighted"*.

     It did, and the cause is the design that keeps the bubble from re-wrapping:
     the WHOLE sentence is in the box from the first frame, the untyped part in
     transparent ink. The marker was a background on the `<b>`, which spans that
     remainder too — so the stripe was painted under letters that had not
     arrived. An inline background is only as wide as its own text, so it moves
     to the typed half and grows a letter at a time.

     THE PADDING STAYS ON THE `<b>`. It is width, and width that changed while
     typing would re-wrap the sentence — the one thing the transparent-ink
     design exists to prevent. Measured with `offsetWidth`, which the pop's
     transform cannot fool: the bubble held 280 px and the term 58 px for every
     frame of the typing. */
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /term \? <span className="guide__mark">\{seen\}<\/span> : seen/, "the marker no longer wraps the typed half alone");
  assert.match(jsx, /return term \? <b className="guide__term"/, "the emphasis element changed shape");

  const css = read("./guide.css");
  const rule = (sel) => css.match(new RegExp(`\\n\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? null;
  const term = rule(".guide__term");
  const mark = rule(".guide__mark");
  assert.ok(term && mark, "guide.css lost `.guide__term` or `.guide__mark`");
  assert.doesNotMatch(term, /background/, "the highlighter is back on the whole word, so it paints before the letters arrive");
  assert.match(mark, /background:\s*linear-gradient/, "the typed half carries no highlighter");
  assert.match(term, /padding:/, "the word's padding left the `<b>`; width that changes while typing re-wraps the sentence");
  assert.doesNotMatch(mark, /padding:|margin:/, "the marker took on width of its own, which grows as the word types and re-wraps the line");
});
