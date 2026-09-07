import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The body scale's chrome, pinned by what is NOT in it.
 *
 * Until 2026-08-25 there was a bar across the top and it read `Bench press ·
 * 31 SEGMENTS · 201 BONES · 467 MUSCLE MESHES`. Nothing fired those numbers —
 * `docs/clock-and-events.md` marks them GAP — and they counted the files on disk
 * rather than anything happening in the movement, which is text nobody asked for
 * (CLAUDE.md §9, `docs/fixing-prd.md` §8.1). The counts went first; the bar
 * itself went on 2026-08-25 with the owner's "Header 제거", and the third case
 * below is the inversion of the one that used to assert what the bar contained.
 * Its subject did not survive, so what is pinned is its absence.
 *
 * THE SECOND CASE WAS RE-AIMED ON 2026-08-31, not weakened. It used to require
 * `{motion.label}` on the switcher, because when the bar went the movement's
 * name went onto the control that changes the movement. Canon B4 takes it off
 * again — "왼쪽 위는 그냥 `Change Exercise`" — on the grounds that a visitor
 * watching a push-up already asked for a push-up. So the case now pins the rule
 * that replaced it: the control says what it DOES, and the fact it stopped
 * printing is still somewhere a viewer can reach.
 *
 * Source text rather than a rendered screen because the rule is an absence, and
 * an absence is what a browser test is worst at: it passes just as happily when
 * the scene failed to load. `scaleRoute.test.js`'s "no scene draws the chain as
 * fixed text" reads the JSX the same way and for the same reason.
 */
const source = readFileSync(new URL("./MotionScene.jsx", import.meta.url), "utf8");

test("the source is readable, or the cases below prove nothing", () => {
  // `press__stage` and not `press__bar`: the canary has to be something the
  // screen still has, and the bar is the thing these cases are about.
  assert.ok(source.includes("press__stage"), "MotionScene.jsx did not load");
});

test("no inventory of the asset, and the switcher says what it does", () => {
  assert.equal(
    /rig\.counts/.test(source),
    false,
    "the rig's segment/bone/mesh counts are back on screen — nothing fires them and a " +
      "viewer could count them",
  );
  /* CANON B4, AND THE CONTROL IS A LIST NOW — 2026-09-01.
     B4's point is that the top-left control says what PRESSING it does rather
     than naming the asset ("Human body" was the label; "Change Exercise" was the
     fix). Rex's unification replaced that one button with the rail: `MotionList`
     in the drawer, every movement a row and `Idle` at the top, and the row you
     are standing on lit. That answers B4 better than the button did — a control
     that names the action is one step from a list that shows the outcomes, and
     the owner ruled this entry the better one.
     So the assertion follows the control. What may not come back is the thing B4
     actually banned, which is the line above: a top-left label naming the asset
     instead of the action. */
  const rail = readFileSync(new URL("./shell/MotionList.jsx", import.meta.url), "utf8");
  assert.ok(
    (/className="press__pick"/.test(source) && source.includes("Change Exercise")) ||
      (/<MotionList/.test(source) && /exercise-row-/.test(rail)),
    "there is no way to change the exercise from the motion window — neither the old top-left " +
      "control nor the rail that replaced it",
  );
  assert.equal(
    /"Human body"|>Human body</.test(source),
    false,
    "the top-left control names the asset again instead of what pressing it does — canon B4",
  );
  assert.equal(
    /press__picknow/.test(source),
    false,
    "the movement's name is back on the switcher — canon B4 took it off, because the body " +
      "on the stage answers 'which exercise' better than a word on a button",
  );
  /* AND THE FACT IT STOPPED PRINTING IS NOT LOST WITH IT — asked of the rail,
     which is where the list went. B4 took the movement's name off the switcher
     because the body on the stage answers "which exercise" better than a word on
     a button, and moved the marker onto the open list's active row.
     Rex's rail carries the same marker under different names: the row gets
     `exlist__row--on` and `data-active`, and it is driven by `activeId` rather
     than by a class this file used to spell. What has to be true is that
     SOMETHING in the list says which row you are standing on. */
  assert.ok(
    /press__railitem--on/.test(source) ||
      /exlist__row--on/.test(rail) ||
      /data-active=/.test(rail),
    "nothing marks which exercise is playing: the open list's active row is where that fact " +
      "went when the switcher stopped printing it",
  );
  assert.ok(
    /aria-label",\s*\n?\s*`Three-dimensional scene of the body performing \$\{motion\.label/.test(
      source,
    ),
    "the canvas stopped naming the movement it is drawing — that sentence is the only one a " +
      "screen reader gets, since the hover label is aria-hidden",
  );
});

/**
 * WHERE THE MUSCLE NAME IS ALLOWED TO BE — canon B1/H1, RE-AIMED FOR B8 ON
 * 2026-08-31. It has now been wrong in two opposite directions and this case
 * has to keep both wrongs out, not just the one it was written for.
 *
 * ROUND ONE: the label followed the pointer, which meant it was drawn inside
 * the muscle it named — the cursor is on the mesh, and a pectoralis at this
 * framing is hundreds of pixels across, so no fixed offset gets the plate off
 * it. That half of the case is UNCHANGED and is the reason the code shapes
 * below are still forbidden.
 *
 * ROUND TWO: the fix was to file the name at the foot of the top-left column,
 * where it could not land on anything. It could not, and it was also a table of
 * contents down the left edge of a picture — the owner, looking at it: *"didnt
 * i say that this is a canvas not a table."* So "it is in the column" stopped
 * being the rule, and this case would have gone on enforcing it forever.
 *
 * WHAT IS PINNED NOW is the quantity that makes round three different from
 * round one, because it is the only thing that is: the plate is lifted by the
 * MUSCLE'S OWN half-height, boxed from the mesh, rather than by a number
 * somebody typed. A pointer cannot know that quantity, which is why round one
 * could not have been rescued by tuning its offset. If a future edit replaces
 * the box with a constant, the plate is back on top of a pectoralis and no
 * build and no screenshot at one framing would say so.
 *
 * Source text rather than a rendered screen for the reason the file's header
 * gives: half of what is asserted here is an ABSENCE, and a browser test passes
 * an absence just as happily when the scene failed to load.
 */
test("the muscle name is anchored to its muscle in the scene, not to the pointer and not to an edge", () => {
  assert.equal(
    // Code shapes, not the bare words: the comments above the deleted lines
    // still NAME them (CLAUDE.md §8 wants the wrong path written down), and an
    // absence test that trips over its own tombstone teaches the next reader to
    // delete the explanation.
    /onHoverAt\s*[=?(]|placeName\s*[(=]/.test(source),
    false,
    "the label is being positioned per pointer move again — that is what put it on top of the " +
      "muscle it names",
  );
  const plate = source.slice(source.indexOf("function nameAnchor("), source.indexOf("function MotionScene"));
  assert.ok(
    plate.length > 0,
    "`nameAnchor` is gone or moved below `MotionScene`. It is the SEAM — the one function that " +
      "decides where the name sits — and this case reads it by name",
  );
  assert.ok(
    /<Html[\s\S]{0,400}className="press__name"/.test(plate),
    "the muscle name is no longer drawn inside a drei `<Html>`; anywhere outside the scene graph " +
      "means something other than the muscle is deciding where it sits",
  );
  assert.ok(
    /function nameAnchor\([\s\S]{0,400}setFromObject\([\s\S]{0,200}getSize\([\s\S]{0,60}\.y \/ 2/.test(plate),
    "the lift stopped being the muscle's own half-height. A typed offset is exactly what made the " +
      "pointer tooltip land on the pectoralis it named — the mesh's box is the only thing that " +
      "knows how far up is far enough for THIS muscle",
  );
  /* THE WELD IS ONE HALF NOW, BECAUSE THE OTHER HALF'S PROBLEM IS GONE.
     This asked for two things: `down.current` inside the plate, and
     `if (e.buttons) return;` in the scene's pointer-MOVE handler. The second was
     guarding a hover: an orbit sweeps the cursor across the body, and unguarded
     one turn walked the name through six muscles it was not about.
     On 2026-08-31 the name stopped following a hover at all. Rex's branch has no
     hover handler — his input is a pick, `onPointerDown` — and the merge kept
     his input with this plate's rendering, which also closes the gap B8's own
     report left open ("a finger still has no hover, so on a phone muscles light
     and go unnamed"). A name that only changes on a deliberate press cannot be
     walked through six muscles by a drag, so there is no move to guard.
     `down.current` STAYS and is still checked: an orbit still turns the body
     under a named muscle, and without it the anchor re-aims mid-turn instead of
     riding it. */
  assert.ok(
    /down\.current/.test(plate),
    "the weld is gone from the plate. An orbit turns the body under the muscle a viewer picked: " +
      "without freezing the anchor while a pointer is down, the plate re-aims through the turn " +
      "instead of riding it",
  );
  assert.ok(
    !/onPointerMove/.test(source) || /if \(e\.buttons\) return;/.test(source),
    "the scene raycasts on pointer MOVE again. If the name is ever driven by a hover the weld's " +
      "second half comes back with it — an unguarded drag walks the name through six muscles",
  );
  const css = readFileSync(new URL("./press.css", import.meta.url), "utf8");
  // Its OWN block, not everything up to the next `.press__name*` selector: the
  // tick is `.press__name::after` and is legitimately `position: absolute`.
  const at = css.indexOf(".press__name {");
  const rule = css.slice(at, css.indexOf("\n}", at));
  assert.ok(at > 0 && rule.length > 0, "the .press__name rule moved — this case reads it by name");
  assert.equal(
    /position:\s*(fixed|absolute)/.test(rule),
    false,
    "the muscle name is positioned by the stylesheet again. drei writes the wrapper's transform " +
      "from the scene graph every frame; a position here is a second opinion about a number this " +
      "file cannot see",
  );
});

/**
 * AND IT DOES NOT LOOK GENERATED — 2026-08-31, the owner on the drawing that
 * this replaced: *"muscle tooltip 아직도 너무 못생겼고 AI 티 나고."*
 *
 * That is a judgement about a look, and a look cannot be asserted. What CAN be
 * asserted is the five specific defaults it was made of, because they are the
 * ones that come back: a big corner radius, a translucent WHITE fill, a
 * `backdrop-filter` blur, a drop shadow, and an accent-coloured left border.
 * Stacked, they are the shape a component library hands you when nobody has
 * decided anything, and every one of them is a thing an editor adds back
 * without noticing — none would fail a build and none is visible in a
 * screenshot somebody remembered to take.
 *
 * CLAUDE.md §3: *"만들지 않기로 한 것은 부재 테스트로 고정."* This is that,
 * for a decision that is otherwise recorded only in a comment.
 *
 * The positive half is one line: the ground has to be the scene's own paper,
 * because that is what makes it read as written ON the drawing rather than as
 * a card floating over it, and it is the same choice `gizmo.css` made.
 */
test("the muscle name is drawn, not defaulted", () => {
  const css = readFileSync(new URL("./press.css", import.meta.url), "utf8");
  const at = css.indexOf(".press__name {");
  const rule = css.slice(at, css.indexOf("\n}", at));
  assert.ok(at > 0 && rule.length > 0, "the .press__name rule moved — this case reads it by name");

  /* THE CORNER AND THE LIFT ARE THE OWNER'S NOW — 2026-09-06, walking the app:
     *"muscle위 hover할때 이 tag디자인적으로 개선이 안되었어"*. Square-with-a-rule
     was this file's own decision and it lost to the person the screen is for, so
     the plate joins `.ways__go` / `.press__card` / `.shell-pick`: a hairline, a
     9 px corner, a soft lift. Recorded rather than deleted, because the argument
     it replaces was right about everything except who decides.
     WHAT DID NOT MOVE, and the three below still hold it: no blur, no white
     ground, no accent left border. Those were never asked for, and the first cut
     of the redraw reached for white anyway — caught here, which is what an
     absence test is for. */
  const radius = rule.match(/border-radius:\s*([\d.]+)(?:px)?\s*;/);
  assert.ok(
    radius && Number(radius[1]) > 0,
    "the plate went square again — the owner asked for the rounded surface every other pressable " +
      "thing in this app uses, and a decision recorded in a comment is how the last one got reverted",
  );
  assert.equal(
    /backdrop-filter/.test(rule),
    false,
    "the blur is back. It was doing legibility work the paper ground does better, and a " +
      "`backdrop-filter` over a 3D canvas is a full-frame composite every frame the pointer moves",
  );
  /* The shadow came with the corner, same ask, same sentence. What it may not
     become is a card: the ground below is still the stage's paper. */
  assert.equal(
    /border-left:\s*\d+px\s+solid/.test(rule),
    false,
    "the accent-coloured left border is back — the single most generated-looking mark on the old plate",
  );
  assert.equal(
    /background:[^;]*(255,\s*255,\s*255|#fff)/i.test(rule),
    false,
    "the ground is translucent white again. On warm paper a white card announces itself as a " +
      "different material, which is exactly what it should not be",
  );
  assert.ok(
    /background:[^;]*#faf8f5/.test(rule),
    "the ground is no longer the scene's own paper (#faf8f5, `SCENE.background`). That is what " +
      "makes this read as a label written ON the drawing, and it is the choice `gizmo.css` made " +
      "for the same reason",
  );
});

/**
 * THE SPRING'S NUMBERS, WHICH NOBODY CAN SEE ARE WRONG.
 *
 * The plate's anchor is re-aimed at 20 Hz and drawn at 60, so between aimings a
 * critically damped follower carries it. Three numbers decide whether that is a
 * plate settling onto a muscle or a plate wobbling on one: the stiffness, the
 * damping ratio, and the clamp on the frame delta.
 *
 * THE FORMULA IS NOT WHAT THIS GUARDS. A sign error in `v += -2wv + w^2(t - p)`
 * is visible in the first second anybody watches the screen. What is NOT
 * visible is a later edit that raises the stiffness to make the plate "snappier"
 * or loosens the dt clamp to "support 30 fps": both leave a scene that looks
 * fine on the machine it was changed on and rings on a slower one, and neither
 * fails a build.
 *
 * Semi-implicit Euler on a damped oscillator: the velocity's per-step factor is
 * `1 - 2*zeta*w*h`, which must stay positive or the velocity flips sign every
 * step, and `w*h` must stay well under 2 or the scheme oscillates whatever the
 * damping ratio says. Both are checked against the numbers actually in the file
 * rather than against the numbers the comment claims.
 */
test("the name's spring is still critically damped and still stable at the frame time it clamps to", () => {
  const w = Number(source.match(/const NAME_W = ([\d.]+);/)?.[1]);
  assert.ok(Number.isFinite(w), "`NAME_W` is no longer a literal — this case reads the shipped number, not the comment");
  const h = Number(source.match(/Math\.min\(delta, ([\d.]+)\)/)?.[1]);
  assert.ok(Number.isFinite(h), "the frame delta is no longer clamped by a literal, so the spring's worst-case step is unknown");

  assert.ok(
    1 - 2 * w * h > 0,
    `the velocity's decay factor is ${(1 - 2 * w * h).toFixed(3)}. Negative means the velocity flips sign ` +
      `every step on a slow frame: the plate rings around the muscle instead of settling on it. ` +
      `Either lower NAME_W (${w}) or tighten the dt clamp (${h}s)`,
  );
  assert.ok(
    w * h < 1,
    `w*h is ${(w * h).toFixed(2)}; semi-implicit Euler wants this comfortably under 2 and this app ` +
      `wants it under 1, because a label that overshoots the muscle it names points at the wrong muscle`,
  );
  /* 4.7/w is the 1% settle time of a critically damped step. Held to a window
     rather than a value: under ~120 ms the plate snaps and reintroduces the
     jitter the spring exists to remove; over ~400 ms it visibly trails the
     muscle during a repetition, which is the complaint the pointer version
     also drew. */
  const settleMs = (4.7 / w) * 1000;
  assert.ok(
    settleMs > 120 && settleMs < 400,
    `the plate settles in ${settleMs.toFixed(0)} ms, outside the 120-400 ms window: under it the ` +
      `spring is doing nothing the 20 Hz anchor was not already doing, over it the words trail the muscle`,
  );
});

/**
 * AND THE BODY SAYS NOTHING IN WORDS — 2026-08-31.
 *
 * The owner settled what each scale shows: a scale a visitor is TOUCHING is
 * *"아무런 텍스트 없이"* — the full animation, the way down, and pressable
 * parts. Explanation belongs to a guided pass, and the body has no pass, so
 * the body is that state and only that state. Looking at it: *"Body에서 설명
 * 텍스트가 뭔지 모르겠어."*
 *
 * Two things went, in one breath, and both are pinned here because both were
 * added in good faith by earlier rounds and would be re-added the same way:
 * T19's teaching line (*"Each repetition sends a command down… go inside to see
 * how."*) and the phase readout (`Lockout`, `Pull · propulsive`).
 *
 * THE MUSCLE'S NAME IS NOT PROSE AND IS NOT COVERED. It is an answer to a
 * pointer — it exists only while a visitor is asking — which is the *"each
 * elements clickable"* half of the same sentence, not the *"아무런 텍스트"*
 * half.
 *
 * WHAT MUST STILL SPEAK is CLAUDE.md §9's list, and it is a short one: loading,
 * progress and error. The last case in this file holds those, and it is
 * deliberately not merged into this one — a future cut that reads "the body
 * shows no text" as licence to delete `Loading rig…` has to trip something.
 */
/**
 * THE PROSE STAYS OUT AND THE PHASE COMES BACK — 2026-08-31, the owner's call
 * when Rex's branch raised the question: *"넣는데 간지나게 넣는거지"*.
 *
 * This case used to forbid three things at once and they were not one thing.
 * The teaching sentence is still forbidden, for the reason it always was. What
 * changed is the readout, and what it may now be is narrow enough to gate:
 *
 *   · NO PER-PHASE COLOUR TABLE. `press__dot--eccentric` and its two siblings
 *     were three tints against eighteen phase names across six movements —
 *     eleven fell through to grey, and running and swimming were grey six times
 *     out of six. A key that cannot cover its own vocabulary says unlike things
 *     are alike. The readout carries the phase's WORD and an arc for where in
 *     one repetition the body is, which is `t / duration` and needs no table.
 *   · NO PER-FRAME RENDER. The old objection to `onPhase` was never the callback
 *     — it was that its consumer re-rendered the whole scene ten times a second
 *     to draw a word. `onPhase` writes to a ref now and the readout reads a
 *     100 ms sample of it, which is the throttle the fibre panel already uses.
 *     So the assertion moved from the callback to the thing that was expensive.
 */
test("the body scale carries no explanatory prose, and its phase readout stays cheap and uncoloured", () => {
  assert.equal(
    /Each repetition sends a command down/.test(source),
    false,
    "T19's teaching line is back on the body. What it said is now said by things that are not " +
      "words: the emissive ramp is 'the bright muscles are answering', the pointer cursor and the " +
      "name are 'pick one', and `WayIn`'s ring is 'go inside' — it IS the way in, which beats a " +
      "sentence about one",
  );
  assert.equal(
    /className="press__hint"/.test(source),
    false,
    "the foot of the body scale is printing prose again",
  );
  const css = readFileSync(new URL("./press.css", import.meta.url), "utf8");
  assert.equal(
    /press__dot--/.test(css),
    false,
    "a per-phase colour table is back in press.css. Three tints against eighteen phase names is " +
      "how the last one lied: eleven names fell to grey and two whole movements were grey " +
      "throughout. If the readout ever needs colour it needs a tint for every phase the six " +
      "movements emit, and a gate that counts them",
  );
  const live = source.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(
    /setHud\(\{ \.\.\.hudRef\.current \}\)/.test(live) && /setInterval/.test(live),
    true,
    "the phase readout is no longer sampled on an interval off a ref. The objection to the old " +
      "one was never `onPhase` itself — it was a 10 Hz `setState` inside the frame loop redrawing " +
      "the scene to print a word",
  );
  assert.equal(
    /onPhase\?\.\([\s\S]{0,80}setState/.test(live),
    false,
    "`onPhase` is writing through React state again instead of into a ref",
  );
});

test("there is no bar across the top of the stage", () => {
  // 2026-08-25, "Header 제거". The four things in it are all still on this
  // screen — the name on the switcher, the phase and the clock floating on the
  // picture, the descent beside the way back — so this is not a deletion of
  // function, it is the strip of height the body gets back.
  assert.equal(
    /press__bar/.test(source),
    false,
    "the top bar is back on the body scale; its four contents belong on the switcher, on the " +
      "stage and beside Go Back",
  );
  assert.equal(
    /<header/.test(source),
    false,
    "a header element is back on the body scale — a bar above the stage is a bar above the stage " +
      "whatever it is called",
  );
});

test("what is loading and what failed still say so", () => {
  // CLAUDE.md §9: progress and error copy is never what a cut removes. Both of
  // these sit inches from the lines that went, so this is the guard on both cuts.
  assert.ok(source.includes("Loading rig…"), "the loading line went with the header");
  assert.ok(source.includes("Could not load /mapping/rig.json"), "the failure line went with the header");
});
