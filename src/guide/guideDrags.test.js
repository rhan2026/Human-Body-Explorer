import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

/**
 * THE CHARACTER CAN BE PICKED UP, AND ITS WORDS RIDE ABOVE IT ON ITS OWN MARGIN.
 *
 * Owner, 2026-09-06: *"make a new text bubble that has the same margin width as
 * the character. also, i want to make the character dragable"*.
 *
 * Two things the sheet used to say that this reverses, and both are the kind of
 * regression a browser case cannot see — the walk still plays and the words are
 * still in the DOM either way:
 *
 *   1. `.guide { pointer-events: none }` with nothing turning it back on for the
 *      body. The character could not be touched, so nothing could drag it.
 *   2. The bubble was the 768×512 drawing at a fixed size, laid out BESIDE the
 *      character (`flex-direction: row`), so its edge could never share the
 *      character's margin — it ended 17.5rem away from it, and the sentence had
 *      to fit the drawing instead of the drawing fitting the sentence.
 *
 * Gates on the source, in the shape `guideStays.test.js` set: a handler and a
 * few declarations are what changed, and a regex reads those. The pixels are
 * measured in a browser and kept in `.claude/shots/` (CLAUDE.md §4).
 */
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

/** The first top-level rule for exactly this selector — the sheet's media
    blocks repeat selectors further down, and the top one is the one that
    decides. */
function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `guide.css has no rule for \`${selector}\``);
  return m[1];
}

test("the character takes the pointer, and only the character", () => {
  const jsx = read("./Guide.jsx");
  const img = jsx.slice(jsx.indexOf("<img"), jsx.indexOf("/>", jsx.indexOf("<img")));
  for (const handler of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel"]) {
    assert.match(img, new RegExp(handler), `the body <img> no longer binds ${handler}; nothing can drag it`);
  }
  assert.match(
    jsx,
    /setPointerCapture\(/,
    "the drag no longer captures the pointer — a fast drag will slip off the character, and the events " +
      "will reach the canvas and orbit the model",
  );
  assert.match(
    jsx,
    /parked\.current/,
    "a dragged position no longer outranks the home corner — the spring will walk the character straight back",
  );

  const css = read("./guide.css");
  const body = rule(css, ".guide__body");
  assert.match(body, /pointer-events:\s*auto/, "`.guide__body` inherits `pointer-events: none` from `.guide` again");
  assert.match(body, /touch-action:\s*none/, "a touch drag will scroll the page out from under the character");
  assert.match(body, /cursor:\s*grab/, "nothing tells a pointer the character can be picked up");
  const box = rule(css, ".guide");
  assert.match(box, /pointer-events:\s*none/, "the box itself took the pointer back — the bubble now blocks clicks on the picture");
});

test("let go, it drops and lands with a thud — gravity and a squash, not the spring", () => {
  /* Owner, 2026-09-06: *"when i drag and release, i want the character to
     descend slightly and stop with a 'thud, as if a heavy object has been
     dropped onto the ground"*. The spring the box travels on is critically
     damped and EASES onto its target; a thing that eases onto the ground has no
     weight. So a release is not a spring target but a fall under gravity, and
     the landing is a compression of the body spent through a spring of its
     own. Both are constants a reader can find. */
  const jsx = read("./Guide.jsx");
  assert.match(jsx, /const DROP = \d+;/, "the drop distance is no longer a named number");
  assert.match(jsx, /const GRAVITY = \d+;/, "the fall is no longer under a named gravity");
  assert.match(jsx, /fall\.current\.vy \+= GRAVITY \* dt/, "the fall no longer accelerates — it is a slide, or the spring");
  assert.match(jsx, /thud\.current/, "nothing takes the hit on landing — it stops dead with no weight in it");
});

test("the bubble stands beside the character and its tail stops at the frame", () => {
  /* Owner, 2026-09-06, on the stacked cut: *"the text bubble kind of overlapps
     with the top part of the character. lets place the textbubble to the sides,
     and thus the pointed parts should be adjusted"*. So: a row, the tail
     sideways, and the gap between the halves exactly the tail's reach — so the
     tip ends at the character's frame and nothing of the bubble is ever on it. */
  const css = read("./guide.css");
  const box = rule(css, ".guide");
  assert.match(box, /--guide-tail-reach:\s*[\d.]+px/, "the tail's reach is no longer declared where the gap can read it");
  assert.match(box, /gap:\s*var\(--guide-tail-reach\)/, "the gap between bubble and character is no longer the tail's reach — the tip is on the character, or in the air");
  assert.doesNotMatch(box, /flex-direction:\s*column/, "the bubble is stacked over the character again — the owner saw the tail on its head");
  assert.match(rule(css, ".guide--right"), /row-reverse/, "standing right of its subject, the character no longer takes the near edge");
  assert.match(rule(css, ".guide--left"), /flex-direction:\s*row;/, "standing left of its subject, the character no longer takes the near edge");
  assert.doesNotMatch(rule(css, ".guide__bubble"), /margin-bottom:\s*-/, "the bubble is pulled into the character's frame again");
  /* The pointed part points sideways: the two inked sides are top+right toward
     a character on the right, left+bottom toward one on the left. */
  const tailL = rule(css, ".guide--left .guide__say::after");
  assert.match(tailL, /border-top:/); assert.match(tailL, /border-right:/);
  assert.match(tailL, /right:\s*calc\(-1 \*/, "the tail no longer hangs off the bubble's right side");
  const tailR = rule(css, ".guide--right .guide__say::after");
  assert.match(tailR, /border-left:/); assert.match(tailR, /border-bottom:/);
  assert.match(tailR, /left:\s*calc\(-1 \*/, "the tail no longer hangs off the bubble's left side");
});

test("the bubble fits the sentence, not the other way round", () => {
  const css = read("./guide.css");
  const bubble = rule(css, ".guide__bubble");
  assert.doesNotMatch(bubble, /url\(/, "the bubble is a bitmap again, and a bitmap cannot share a margin with the character");
  assert.doesNotMatch(bubble, /(^|\s)height:/, "the bubble has a fixed height again — a sentence longer than it is clipped, invisibly");
  assert.match(bubble, /max-width:/, "with no ceiling on width a long beat runs across the whole stage");
});

test("a side change costs no frame, and a dragged character is what stays on the picture", () => {
  /* Owner, 2026-09-07: *"the character is facing issues when dragged the icon
     oscillates like crazy"*. Two faults, both measured on a drag across the
     stage, and neither visible to any other check here — the drag worked, the
     character ended up where it was put, and only a per-frame trace showed it.

     ONE: the side class came from React state and the box's transform from the
     animation loop, so a flip landed in two different paints — 290 px of
     character, one frame, every time the decision changed, and every frame for
     a pointer resting on the boundary. The loop writes the class itself now,
     beside the transform, from the same decision; the layout effect puts it
     back after a render, because React sets className wholesale and would drop
     it.

     TWO: the clamp kept the whole BOX on the stage. Carried toward an edge, the
     bubble ran out of room and the clamp pushed the box back — sliding the
     character out from under the pointer by 288 px until the side flipped and
     snapped it home. When the character is the point, the character is what is
     kept on; the bubble's room is the side decision's job. */
  const jsx = read("./Guide.jsx");

  assert.doesNotMatch(jsx, /guide guide--\$\{side\}/, "the side is back in the JSX className, so React and the loop write it in different frames again");
  assert.doesNotMatch(jsx, /setSide\(/, "the side is React state again");
  assert.match(jsx, /const sideRef = useRef\("right"\);/, "the loop no longer owns the side");
  assert.match(
    jsx,
    /el\.classList\.toggle\("guide--right", wantRight\);/,
    "the loop no longer writes the side class beside the transform",
  );
  /* The re-apply has to run after EVERY commit — a dependency array here is the
     bug coming back the moment a sentence changes. */
  const reapply = jsx.slice(jsx.indexOf("useLayoutEffect(() => {"), jsx.indexOf("const sideRef") + 400);
  /* NO DEPENDENCY ARRAY: it has to run after EVERY commit, because React sets
     className wholesale and any render would otherwise drop the side class.
     It also re-writes the transform, so the box follows the character in the
     paint where the bubble's width changed rather than a frame later. */
  const from = jsx.indexOf("const sideRef = useRef");
  const closes = jsx.indexOf("\n  });", from);
  const withDeps = jsx.indexOf("\n  }, [", from);
  assert.ok(closes !== -1, "the class re-apply is gone");
  assert.ok(
    withDeps === -1 || closes < withDeps,
    "the class re-apply grew a dependency array, so a render can drop the side class",
  );
  assert.match(
    jsx.slice(from, closes),
    /pos\.current\.x - body\.current\.offsetLeft/,
    "a render that changes the bubble's width still moves the character for one paint",
  );

  assert.match(jsx, /const charOffset = body\.current\?\.offsetLeft \?\? 0;/, "the character's place inside the box is inferred again instead of measured");
  assert.match(jsx, /const lo = put \? PAD - charOffset : PAD;/, "a dragged character is not what the clamp keeps on the stage");
  assert.match(jsx, /const hi = put \? r\.width - PAD - cw - charOffset : r\.width - w - PAD;/);
  assert.match(
    jsx,
    /stayingSide\.score <= bestSide\.score \+ HOLD_CORNER/,
    "the side has no hysteresis, so a character parked where the two scores are close chatters on its own spring",
  );
});
