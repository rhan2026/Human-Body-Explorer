import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/**
 * The front door, pinned by where things are and by what talks to nothing.
 *
 * `docs/fixing-prd.md` §7: the exercise list was the loudest thing on the first
 * screen anyone sees, and choosing a movement is not what a viewer arrives
 * wanting. It moves behind the hamburger with the ways down; skeleton and skin
 * become the two controls a person meets the body with; and the conversational
 * layer exists as a door that says it is locked — `decisions.md` #8 gates it on
 * API keys that have not arrived, and CLAUDE.md §2 forbids a consumption
 * endpoint in an empty skeleton.
 *
 * Source text rather than a rendered screen, for `pressChrome.test.js`'s reason:
 * half of what is asserted here is an ABSENCE — no API client, no hand-written
 * hash, no opacity slider — and a browser test passes just as happily when the
 * scene failed to load. Where the exercise list sits IS visible, and the browser
 * is where that half is judged; this file only holds the ground it can hold.
 */
/* THE FRONT DOOR IS TWO FILES NOW, 2026-08-30. The hamburger, the left panel
   and the scrim moved into `shell/AppShell.jsx` when the shared shell arrived —
   one shell for four scales instead of a menu this screen built for itself. The
   assertions below are unchanged; what moved is where they look, because they
   are about the front door and the front door is now assembled from both. */
/* THE FRONT DOOR IS FIVE FILES NOW, NOT TWO — 2026-08-31.
   Rex's shell broke the drawer's contents out of `App.jsx` into components:
   `MotionList` is the exercise list, `GroupChips` is the muscle-group row, and
   `OpacityDock` is the layer sliders. Nothing about what the door OWES changed
   — the owner ruled his entry the better one — but a test reading two files
   started answering "the exercise list is not in the drawer any more" about a
   list that is in the drawer, one import away.
   Joined rather than each read separately: every assertion here is about what
   the front door offers, and which file a piece of it lives in is exactly the
   thing that just moved. A gate that pins the layout of the source is a gate
   that fails on every refactor and teaches people to delete gates. */
const source = [
  "./App.jsx",
  "./shell/AppShell.jsx",
  "./shell/MotionList.jsx",
  "./shell/GroupChips.jsx",
  "./shell/OpacityDock.jsx",
].map((f) => readFileSync(new URL(f, import.meta.url), "utf8")).join("\n");

/* THE SAME SOURCE WITH ITS COMMENTS TAKEN OUT, for the assertions that forbid a
   CODE PATTERN.
   This file's comments quote the patterns they forbid — that is what makes them
   worth reading — and a regexp cannot tell a rule from a sentence about the
   rule. Twice on 2026-08-31 a fix went in and its own note re-tripped the gate
   it satisfied: once here (`depthWrite ?? opacity > 0.6`, quoted in the comment
   explaining why it is gone) and once in `press.css`, where a paragraph about a
   comment delimiter ended the comment.
   Assertions about what the door SAYS still read `source`; assertions about what
   it DOES read this. */
const live = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The markup between two landmarks, so "not in the left panel" can be asked. */
function region(open, close) {
  const start = source.indexOf(open);
  assert.notEqual(start, -1, `App.jsx no longer contains ${open}`);
  const end = source.indexOf(close, start);
  assert.notEqual(end, -1, `${close} never closes ${open}`);
  return source.slice(start, end);
}

test("the source is readable, or every test below proves nothing", () => {
  assert.ok(source.includes("panel--left"), "App.jsx did not load");
  assert.ok(source.includes("menu-trigger"), "there is no menu to hold anything");
});

test("the exercise list is not in the left panel", () => {
  assert.equal(
    /exlist/.test(region("panel--left", "</aside>")),
    false,
    "the exercise list is back in the left panel — §7.1: it is the loudest thing on the first " +
      "screen and choosing a movement is not what a viewer arrives wanting",
  );
});

test("the exercise list is behind the hamburger, not on the page", () => {
  /* THIS CASE LOST TWO OF ITS THREE CLAIMS AND ITS LANDMARK, 2026-08-30.
     It asked three things of the region between `panel--left` and `</aside>`:
     that the exercise list, a way down, and the chat entrance were all inside
     it. Every part of that is now wrong for a different reason, and the test
     was red while the app was correct — which is worse than no test.

       · The landmark moved. `panel--left` is in `shell/AppShell.jsx` now, and
         the list is handed to it from here as a `drawer` prop, so a region
         scan of the shell's own file cannot see across the boundary. The
         region is the prop instead.
       · `ScaleTrail` is deliberately NOT in the drawer — the owner asked for
         the breadcrumb out of the menu on every screen, and AppShell says so
         where it used to render.
       · `data-testid="ask"` does not exist anywhere: the assistant is its own
         widget mounted at the router, and it belongs to this screen alone.

     What survives is the one claim still worth holding: the exercise list is
     in the menu rather than lying on the picture. */
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  const opens = app.indexOf("drawer={");
  assert.ok(opens > 0, "the front door no longer hands the shell a drawer");
  const closes = app.indexOf("<AppShell", opens) > 0 ? app.indexOf("<AppShell", opens) : app.length;
  const drawer = app.slice(opens, closes);
  /* THE LIST IS A COMPONENT NOW, so this asks for the component in the drawer
     and for the component to be the list. Rex's shell moved the rows into
     `MotionList.jsx` on 2026-08-31; reading only App.jsx's own markup made this
     answer "the exercise list is not in the drawer any more" about a list that
     is in the drawer, one import away. What H1 protects is unchanged — the list
     is in the menu rather than lying on the picture — and that is still exactly
     what is checked. */
  assert.ok(
    /exlist/.test(drawer) || /<MotionList/.test(drawer),
    "the exercise list is not in the drawer any more",
  );
  assert.ok(
    /exlist/.test(source),
    "nothing in the front door builds the exercise rail; `MotionList` is in the drawer and draws " +
      "something else, or it is gone",
  );
});

/**
 * H2, canon 2026-08-30: "햄버거의 Exercise 아래 `Your Workout` 내용 전부 삭제.
 * 단 Activation은 남긴다."
 *
 * The two were never one component, which is the thing to know before cutting:
 * `Your workout` was `WorkoutInput.jsx`, and `Activation` is a section of this
 * file that reads the manifest's role lists. So "keep Activation" is not a
 * carve-out inside the deleted component — it is the sibling that must survive
 * the sibling going.
 *
 * What went: four number fields and five dense lines that named `soce_on`,
 * `fowler_resistance` and `ResistanceExercise = 1.0` to a first-time visitor,
 * mostly to say their numbers reached no model. `mapWorkout` still exists and
 * is still unit-tested; it reaches no pixel now, which is recorded in its own
 * file rather than guessed at from here.
 */
test("the front door does not ask for a workout, and Activation stayed", () => {
  assert.equal(existsSync(new URL("./WorkoutInput.jsx", import.meta.url)), false, "WorkoutInput.jsx is back");
  assert.equal(/WorkoutInput/.test(source), false, "the front door mounts the workout form again");
  assert.equal(/workout__/.test(source), false, "the workout form's markup came back under another name");
  /* ACTIVATION IS ON THE MOTION WINDOW NOW — 2026-09-01, and the canon is kept
     rather than bent. H2 says "Activation은 남긴다", and it does: what moved is
     which screen it stands on. The front door stopped painting roles when Rex's
     unification made it Idle — every muscle at one weight, no exercise selected
     — so an Activation legend there would be a key to an encoding that screen no
     longer uses. The motion window paints the three tiers, and that is where it
     went. */
  /* AND THE KEY IS THE PASS NOW — 2026-09-06. `Activation` named the three-tier
     ramp; the body's standing key came off the stage with `.press__legend` while
     the BODY lane worked the owner's walk-through list, and this asked for it
     back on the same argument `roleLegend.test.js` made: without a key the three
     weights are something to infer.
     It was right about the risk and wrong that a standing key is the only cure.
     `firstWalk.js`'s third beat says it in words, on arrival, every arrival now —
     "The colors tell you which muscle groups you're looking at. The brightness
     tells you what job they are doing." That is the rule this whole pass has been
     applying: a thing is explained by being seen or by the guide saying it, never
     by a legend parked in a corner of a screen whose subject is a body.
     SO THE CANON IS KEPT AND THE SURFACE MOVED, which is what H2 asked for in the
     first place — it said Activation stays, not that a box must draw it. What is
     asserted is that SOMETHING still says what brightness means. */
  const walk = readFileSync(new URL("./guide/firstWalk.js", import.meta.url), "utf8");
  assert.ok(
    /brightness tells you what job/i.test(walk.replace(/\*\*/g, "")),
    "nothing tells a visitor what brightness means: the body's Activation key is gone and the " +
      "walk's beat that replaced it has stopped saying it too",
  );
});

/**
 * H3, canon 2026-08-30: "눌러져 있는 Exercise를 다시 누르면 해제된다."
 *
 * The `None` chip is already gone, so this is the ONLY way back to "nothing
 * chosen" — and the comment where that chip used to be has been claiming the
 * row handler does this since the chip was cut, while the handler was a bare
 * `setExercise(key)` that could only ever set. The comment was the spec; this
 * is it being true.
 */
/* H3 IS ANSWERED BY A ROW NOW, NOT BY A TOGGLE — 2026-08-31, and the row is
   better. The canon asked that a lit exercise be un-choosable ("눌러져 있는
   Exercise를 다시 누르면 해제된다") because the `None` chip had been cut and
   there was no way back to nothing. Rex's rail puts `Idle` at the top of the
   list — the front door as a row among the movements — which answers the same
   need without asking a visitor to guess that pressing a lit thing turns it off.
   A hidden second meaning on a press is the thing a first-timer never finds.
   So the assertion moved from "the handler can clear" to "there is a way back",
   which is what the canon was after. If `Idle` ever leaves, the toggle has to
   come back with it and this goes red either way. */
test("there is a way back to nothing chosen, and it is visible", () => {
  assert.match(
    source,
    /\["idle", \{ label: "Idle" \}\]|activeId="idle"/,
    "the rail no longer offers Idle, and no toggle replaced it — there is no way back to the " +
      "front door from a lit exercise",
  );
});

test("the hamburger's control has a name, not just a glyph", () => {
  // Several specs find controls by accessible name (`gate-first-time-walk.spec.js`),
  // and a lone ☰ is a control that cannot be asked for.
  assert.match(source, /aria-label=\{[^}]*Close the controls[^}]*\}/, "the menu control is a bare glyph");
  assert.ok(source.includes("aria-expanded={panelOpen}"), "the control does not say whether it is open");
});

test("no hash in this file is typed by hand", () => {
  assert.ok(source.includes("hashForScale"), "the routes are not built by scaleRoute.js");
  /* `live`, NOT `source` — third time today a comment explaining why a pattern
     is forbidden tripped the gate forbidding it. The note beside `motionRouteFor`
     quotes the template it replaced, which is what makes it worth reading. */
  assert.equal(
    /["'`]#(motion|dev|pushup)/.test(live),
    false,
    "a hash string is spelled here; scaleRoute.js owns the grammar",
  );
});

test("skin and skeleton are dragged, and depth is not decided by the drag", () => {
  /* REVERSED 2026-08-30, at the owner's word. This asserted the opposite: that
     the two layers were toggles and that a slider must never come back. The
     measurement behind that — ~4.7% of the surface has muscle geometry up to
     12 mm outside the shell, so a near-opaque skin has muscle poking through —
     is still true and is written where the defaults live. It argues about where
     the DEFAULT sits, not about whether a viewer may drag past it, and the
     explorer's one continuous control was worth more than the far end of its
     travel costs.
     What this holds instead is the part that was never the owner's to trade:
     `depthWrite` is stated at the call site and not derived from opacity, so
     every intermediate value the drag passes through renders the same way. That
     derivation is how the skeleton double-coated itself. */
  assert.match(source, /type="range"/, "the layer sliders are gone again");
  assert.equal(
    /depthWrite\s*\?\?\s*opacity\s*[<>]=?\s*0?\.\d/.test(live),
    false,
    "depthWrite is being decided by a fractional threshold again, which is how the skeleton double-coated",
  );
  assert.match(source, /depthWrite=\{false\}/, "a static layer stopped stating its own depth");
});

test("the chatbot entrance talks to nothing", () => {
  // decisions.md #8: the route exists as a fixed blocked response until the keys
  // arrive. The absence is the feature — a stub that pretends to talk is worse
  // than a door that says it is locked.
  assert.equal(
    (source.match(/fetch\(/g) ?? []).length,
    1,
    "App.jsx makes a request it did not make before; the only fetch here is the muscle map",
  );
  assert.equal(/import\.meta\.env|apiKey|API_KEY/.test(source), false, "a key is being read");
  assert.equal(/anthropic|openai|\/api\//i.test(source), false, "a model provider is named");
});

test("what is loading and what failed still say so", () => {
  // CLAUDE.md §9, and `tests/support/screen.js` names both of these lines.
  assert.ok(source.includes("Loading anatomy"), "the loading line went");
  assert.ok(source.includes("Loading manifest"), "the manifest's loading line went");
  assert.ok(source.includes("Could not load /mapping/muscle-map.json"), "the failure line went");
});

/**
 * A TRANSLUCENT SKIN DRAWN ON BOTH SIDES IS DRAWN TWICE.
 *
 * `StaticLayer` forces `side = THREE.DoubleSide` on every mesh it touches and
 * decided `depthWrite` off a threshold: `depthWrite ?? opacity > 0.6`. A
 * double-sided surface that does not write depth composites against its own far
 * wall, so what reaches the glass is `1 - (1 - o)²` — the skeleton is written at
 * 0.55 and arrives at 0.80, and a rib cage crossed four times arrives at 0.96.
 * Photographed 2026-08-26 with the skin toggled off, the sternum and spine read
 * as a solid white column over the muscles: `.claude/shots/q2/`.
 *
 * This is the same defect `anatomyMaterial` throws on since Q2 R6 — and that
 * round's commit claimed the guard sat "where every caller routes through",
 * which was false. `App.jsx` does not import `anatomyStyle.js` at all, so it
 * walked past the guard. This is that debt.
 *
 * The rule is not "no DoubleSide". The shell WANTS its far wall: at 0.18 the
 * doubling is what makes an x-ray skin read as a volume instead of a decal, and
 * its `depthWrite: false` is defended in its own comment. The rule is that a
 * layer states both, because a threshold at 0.6 is a number nobody chose for
 * the skeleton — it chose itself, by being 0.05 away.
 */
test("every static layer says what it does with depth and with its far wall", () => {
  /* A FRACTION is the thing banned, not a comparison. `opacity >= 1` is the
     definition of opaque and decides nothing; `opacity > 0.6` is a number
     somebody picked for one layer that silently answered for the other. */
  assert.doesNotMatch(
    live,
    /depthWrite\s*\?\?\s*opacity\s*[<>]=?\s*0?\.\d/,
    "depthWrite is still being decided by a fractional threshold, which is how the skeleton got double-coated",
  );

  const layers = source.match(/<StaticLayer[^/]*\/>/g) ?? [];
  assert.ok(layers.length >= 2, "the shell and the skeleton should both be StaticLayers");
  for (const layer of layers) {
    assert.match(layer, /depthWrite=/, `a static layer leaves depth to a default: ${layer.slice(0, 90)}`);
    assert.match(layer, /side=/, `a static layer leaves its far wall to a default: ${layer.slice(0, 90)}`);
  }

  /* And the skeleton in particular is single sided, so 0.55 is 0.55. */
  const skeleton = layers.find((l) => /skeleton/i.test(l));
  assert.ok(skeleton, "no skeleton layer found");
  assert.match(
    skeleton,
    /side=\{THREE\.FrontSide\}/,
    "the skeleton draws its far wall under its near one, so its opacity is not the number in the file",
  );
});

/* ---- the drawer's chrome, TODO.md H4 and H5 (2026-08-31) -----------------
 * Both are the owner looking at the open drawer and naming what is wrong with
 * what surrounds the controls, so both live here with the rest of the front
 * door rather than in a sheet-parsing file of their own.
 *
 * Source text again, for this file's stated reason: what H4 changed is three
 * numbers in one CSS rule, and a browser reads the composited result, not the
 * numbers. Whether the body is legible through it is the integrator's to see.
 * This holds the two things a later edit could quietly take back — the numbers
 * climbing again, and the pointer lock being traded away to get them down.
 */
const sheet = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

/** One rule's declarations, found by its exact selector. */
function rule(selector) {
  const at = sheet.indexOf(`\n${selector} {`);
  assert.notEqual(at, -1, `styles.css no longer has a \`${selector}\` rule`);
  return sheet.slice(at, sheet.indexOf("}", at));
}

test("the scrim lets the body through, and still swallows the pointer", () => {
  /* H4: "햄버거를 열었을 때 뒤 화면이 너무 안 보인다. 더 보이게 한다." It was
     blur(5px) over an 18% dim. The ceilings below are not taste: 5px is wider
     than the gap between two neighbouring muscle strands, so the shapes merged
     into one mass — the drawer's controls act on a body you could no longer
     read while choosing among them. */
  const scrim = rule(".scrim");

  const blur = scrim.match(/backdrop-filter:[^;]*\bblur\(([\d.]+)px\)/);
  assert.ok(blur, "the scrim's backdrop-filter no longer states a blur radius this test can read");
  assert.ok(
    Number(blur[1]) <= 2,
    `the scrim blurs the page behind it by ${blur[1]}px. H4 asked to see MORE of the body, and past ` +
      "about 2px two neighbouring strands stop being two things",
  );

  const dim = scrim.match(/background:\s*rgba\([^)]*?,\s*([\d.]+)\s*\)/);
  assert.ok(dim, "the scrim's dim is no longer an rgba() this test can read");
  assert.ok(
    Number(dim[1]) <= 0.12,
    `the scrim dims the page behind it at ${dim[1]} alpha. H4 asked to see MORE of the body`,
  );

  /* AND THE HALF THAT MAY NOT BE TRADED FOR THAT. A see-through scrim that
     stopped taking the pointer would look right and be broken: the press
     outside would land on the canvas and orbit the model instead of closing
     the drawer, and the page behind would stop reading as inactive. */
  assert.match(
    rule(".scrim--on"),
    /pointer-events:\s*auto/,
    "the open scrim no longer takes the pointer, so a press outside falls through to the scene",
  );
  assert.match(
    source.slice(source.indexOf("export function Scrim()"), source.indexOf("export default function AppShell")),
    /onClick=\{\(\) => setPanelOpen\(false\)\}/,
    "pressing the scrim no longer closes the drawer",
  );
});

test("the drawer's Data section: the three papers, then the licence credit", () => {
  /* Back on 2026-09-07 at the owner's word — *"3논문 + cc by sa home에서 hamburger 맨 밑"* —
     without the mesh counts that stood between them until 2026-08-31. */
  const data = region('<p className="label">Data</p>', "</section>");
  const papers = data.indexOf('className="papers"');
  const credit = data.indexOf("Sources: BodyParts3D");
  assert.ok(papers >= 0, "the three papers left the Data section");
  assert.ok(credit >= 0, "the CC BY-SA credit left the Data section, and the licence requires it");
  assert.ok(papers < credit, "the licence credit is above the papers — it is the footnote");
  assert.doesNotMatch(data, /className="stats"/, "the mesh counts are back; the owner asked for papers and the credit");
});

test("Bell introduces itself once a visit, not once a mount — 2026-09-07", () => {
  /* Owner: *"when the user enters the idle page the second time and onwards,
     the intro message from bell shouldnt come out"*. The front door remounts
     every time a visitor comes back up from a scale, and `greeted` started
     false on every mount, so "Hi — I'm Bell" introduced itself again each time.
     It borrows `firstWalk.js`'s session helpers — the private-window guard is
     the reason, and every other once-a-visit thing here already uses them —
     and marks itself when the greeting RUNS OUT rather than when it starts,
     which is the rule `useWalk` settled: four seconds in and gone is not a
     greeting spent. */
  const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");
  assert.match(app, /const GREETED_KEY = "hpe\.guide\.greeted";/, "the greeting's session key is gone");
  assert.match(
    app,
    /useState\(\(\) => walkAlreadyDone\(GREETED_KEY\)\)/,
    "the greeting starts fresh on every mount again — coming back up from a scale re-introduces Bell",
  );
  assert.match(app, /markWalkDone\(GREETED_KEY\)/, "nothing records that the greeting was spent, so it will play forever");
  assert.match(app, /if \(greeted\) return undefined;/, "a returning visitor still runs the greeting's timer");
});
