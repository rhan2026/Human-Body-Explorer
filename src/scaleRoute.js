/**
 * The hash is the serialization of the scale state, not a switch that picks a
 * component (spec §3). Grammar, entire:
 *
 *   #                        explorer
 *   #<exercise>              body scale
 *   #<exercise>/<scale>      that scale
 *   #/<scale>                that scale, no exercise named
 *
 * Two segments. The address says WHERE the viewer is and nothing else.
 *
 * WHAT LEFT, 2026-08-30, and why it is not coming back.
 *
 * It used to carry a muscle slug and an instant: `#motion/bench_press/
 * pectoralis-major/fiber@5.2s`. Both were write-only. `resolveMeshName` — the
 * function that turned a slug back into a mesh — had no caller anywhere outside
 * this file's own tests, and `main.jsx` does not contain the word `muscle`, so
 * reloading a muscle URL never reselected the muscle. The three scales below
 * say the same thing in their own comments, each having found it separately:
 *
 *   cell         "the exercise, the muscle and the instant were parsed,
 *                round-tripped, unit tested and dropped on the floor: every
 *                hash from `#motion/push_up/cell` to `#motion/bench_press/
 *                right-gluteus-maximus/cell@11.9s` drew the same 1,024,000
 *                pixels" (CellScale.jsx:447), over "a well-mixed model that has
 *                no muscle in it at all"
 *   signalling   "the muscle selects nothing, because the Fowler model is one
 *                cell's network with no anatomy in it" (SignallingScale.jsx:576)
 *   fibre        "the muscle and the instant travel in the hash but nothing
 *                here reads them yet" (DevFiberScene.jsx:11)
 *
 * The instant was worse than unread. `crossing.js`'s `arrivedFromInside()`
 * exists for one purpose — to ignore the `@t` this app itself wrote into every
 * descent — and crossing.js:66 records the bill: the fibre's 25.8 s guided pass
 * and its four camera stops "were unreachable by anyone using the app — only by
 * a hand-typed URL with no `@t`, which is the shape the app never produces".
 * Removing the number is what makes the pass reachable. Nothing was added to
 * turn it on.
 *
 * A `t` also could not mean what a reader would take it to mean. There are
 * three clocks behind the four scales, not one:
 *
 *   body         `motion.duration` — ONE loop of a hand-authored movement.
 *                Bench press 4.4 s, and `wrap()` folds the clock into it.
 *   fiber, cell  12.96 s — the Francis protocol, TEN repetitions of 0.65 s
 *                then 6.5 s of recovery (soce_on.json `protocol`).
 *   signalling   2,640 s — the Fowler network's 44 minutes.
 *
 * So a descent at 3.9 s of a bench press landed at 3.9 s of a ten-repetition
 * protocol — inside the right bout, a different repetition, and nothing
 * calibrates the hand-authored loop against the published one. The scale a
 * viewer arrives on states the length of the run it is standing in, which is
 * how the change of clock is seen rather than claimed. It was `Timeline.jsx`'s
 * strip that said it; the reading left on 2026-08-25 ("i dont want timeframs
 * anywhere") and the file on 2026-08-31.
 * THE PANELS THIS SENTENCE HANDED THE FACT TO ARE GONE TOO — the right-hand
 * column came off all three deep scales on 2026-08-30 and no scale renders one
 * now. What is left saying it is `SignallingReadout.jsx` ("The archive covers 0
 * to N s") and the words on the cell/signalling cut. The fibre and the cell
 * state the length of the run they are standing in nowhere, which is the
 * paragraph above going unanswered rather than answered.
 *
 * CONTRACT — the two halves are deliberately NOT inverses.
 *
 * `parse` is tolerant and `serialize` is strict, because a URL somebody kept is
 * the one address we do not control: every screenshot, doc and shared link in
 * this repository spells the old grammar. So parse accepts a leading `motion/`
 * segment, a muscle slug, an `@t` and any trailing junk, and throws all of it
 * away; serialize emits only `#<exercise>/<scale>`. An old link keeps its
 * exercise and its scale and loses what was never read.
 *
 * `serializeHash(parseHash(h)) === h` therefore holds only for hashes serialize
 * can emit, which is what `scaleRoute.test.js` pins. Legal state is
 * `{ exercise, scale }`. Anything derivable from those two is the caller's.
 *
 * The exercise sits in a fixed position because an unknown exercise has to
 * survive the trip; the scale is identified by content, which is what lets it
 * be omitted rather than left as an empty slot.
 *
 * `level` (fascicle | fiber | sarcomere) is deliberately NOT here — the three
 * levels are not a continuous descent (fiber/fiberGeometry.js:15-18).
 */
import { canonicalExerciseId } from "./motion/registry.js";

/**
 * The closed set of scales, in the order the descent takes them. Parse
 * identifies a segment by it; serialize refuses anything else.
 *
 * CONTRACT — this array is the only list of scales in the app. A scale is added
 * here and nowhere else: `SCALE_ORDER`, `trailSteps` and the round-trip tests
 * all read it. Derived point: the scene switch in `main.jsx`, which must gain a
 * branch for anything appended.
 * `trailSteps` FED THE FOOTER CHAIN AND FEEDS NOTHING NOW. Canon D4 deleted the
 * footers on 2026-08-30 and `ScaleTrail.jsx`, its one reader, lost its last
 * importer on 2026-08-31. Both are kept and both are held by
 * `scaleRoute.test.js`; neither reaches a pixel, so a scale appended here draws
 * in no chain until something renders one again.
 */
export const SCALE_ORDER = ["body", "fiber", "cell", "signalling"];

/**
 * What a floor is called ON SCREEN. The canonical four, 2026-09-05.
 *
 * Owner, this day, naming them as a set: *"User-facing floor navigation must
 * be: BODY FIBER ENERGY SIGNALS ... Old user-facing: CELL SIGNALLING should no
 * longer be the primary floor names."* `docs/20260905-fix/cell.md` carries the
 * argument for the one that actually changes meaning rather than spelling:
 * *"A muscle fiber is already a cell, so presenting 'Cell' as a deeper
 * anatomical level is misleading. ... The navigation label should therefore be
 * ENERGY, while the screen can be titled Cellular Energy."*
 *
 * SO THE KEYS ARE NOT THE LABELS ANY MORE, and that is the point. `cell` and
 * `signalling` stay as ids everywhere — the hash, `SCALE_ORDER`, the folders,
 * the scenario files — because renaming those buys nothing and costs every
 * shared link in this repository. The same instruction says so: *"Internal
 * file/folder names do NOT need wholesale renaming if doing so creates
 * unnecessary risk."* What a visitor reads and what the code calls a thing are
 * now deliberately two vocabularies, and this table is the only crossing.
 *
 * CONTRACT — this is the only place a floor's user-facing name is written.
 * Derived points: `Ways.jsx` (every way up), `trailSteps` below, and any
 * heading a floor draws for itself. A fifth spelling somewhere else is a fifth
 * chance for the navigation and the screen to disagree, which is exactly how
 * "The cell" and "CELL" and "Cell Signalling" came to be three different
 * answers to one question.
 *
 * `Ways.jsx` names the place a control goes to rather than the direction it
 * goes in — "↑ FIBER", not "Go Up". A control that names its destination
 * cannot be read as "close the app".
 *
 * THE BODY KEEPS ITS EXERCISE and gains the floor name rather than losing it.
 * Four addresses were drawing one unnamed screen, and the exercise's own label
 * is exactly what differs between `#bench_press/fiber` and `#push_up/fiber` —
 * so the way up from the fibre reads `BODY · Bench press`, which is the same
 * pairing `docs/20260905-fix/body.md` §4 asks the floor itself to wear (small
 * BODY over a large exercise name). The exercise half is read off the motion
 * registry and never typed; `Ways.jsx` assembles the two.
 */
export const SCALE_LABEL = Object.freeze({
  body: "BODY",
  fiber: "FIBER",
  cell: "ENERGY",
  signalling: "SIGNALS",
});

/**
 * The screen's own subtitle, where the canonical name is not the whole truth.
 *
 * ENERGY is a floor about a cell's energy economy and SIGNALS is about that
 * same cell's network, and both facts are worth keeping under a name that no
 * longer says "cell". The owner's instruction keeps them explicitly: *"Screen
 * subtitles may still use: Cellular Energy, Cell Signalling."* Absent for the
 * two floors whose name already says what they are.
 */
export const SCALE_SUBTITLE = Object.freeze({
  cell: "Cellular Energy",
  signalling: "Cell Signalling",
});

/** The scale one step further in, or null at the bottom. */
export function nextScale(scale) {
  const i = SCALE_ORDER.indexOf(scale);
  return i >= 0 && i < SCALE_ORDER.length - 1 ? SCALE_ORDER[i + 1] : null;
}

/** The scale one step out, or null at the top. */
export function prevScale(scale) {
  const i = SCALE_ORDER.indexOf(scale);
  return i > 0 ? SCALE_ORDER[i - 1] : null;
}
const SCALES = new Set(SCALE_ORDER);

/**
 * The footer chain: every scale, and which one the viewer is on.
 *
 * MUSCLE IS NOT IN IT, and since 2026-08-30 it is not a selection either. It
 * used to be fixed text on three screens drawn as a peer of the scales — but a
 * muscle is not one (it is not in `SCALES`, and no scene is chosen by it).
 *
 * An unknown scale — or the explorer, which is no scale at all — marks nothing
 * rather than guessing the first step.
 */
/* THE LABEL IS READ, NOT BUILT FROM THE ID. This was `id.toUpperCase()`, which
   is a second way of naming a floor and it produced the two names the canon of
   2026-09-05 retired: `cell` came out `CELL` and `signalling` came out
   `SIGNALLING`. An id that spells its own label works right up until the label
   and the id stop being the same word, and that is the day it happened. */
export function trailSteps(scale) {
  return SCALE_ORDER.map((id) => ({ scale: id, label: SCALE_LABEL[id], here: id === scale }));
}

/**
 * The hash for taking `state` to another scale — the one thing every way-down
 * and way-up control in the app does, and the ride does it too.
 *
 * IT IS NOW `serializeHash` WITH A SCALE SWAPPED IN, and it is kept anyway. It
 * used to hold the one asymmetry in the grammar: `t` survived the body/fibre/
 * cell boundaries and was dropped across the signalling cut, because 6.11 s of
 * a 13 s run and 6.11 s of 44 minutes read as one continuous timeline and are a
 * cut. That number is gone, so the asymmetry is gone with it.
 *
 * What is left is the single door, so the day a scale change has to carry or
 * drop something again it is one edit and not several. Who goes through it, as
 * of 2026-08-31: `shell/Ways.jsx` (every way up and Go Home), `wayin/WayIn.jsx`
 * (every way down) and `App.jsx` (the front door's routes). The three this
 * paragraph used to name are all gone from that list — `director/ride.js` was
 * deleted with the film on 2026-08-30, `ScaleTrail.jsx` still calls it but has
 * no importer, and `DevFiberScene.jsx`'s import was dead residue, removed
 * today.
 */
/* THE ADDRESS IS A PATH, NOT A HASH — 2026-09-07, owner 26: *"does idle have to be
   http://localhost:5310/# … couldnt we remove the hashtag?"* and, offered routing:
   *"라우팅 말고 그냥 애초에 #를 빼"*. So `/`, `/bench_press`, `/bench_press/fiber`.
   `parseHash`/`serializeHash` keep their `#` grammar (every gate and every old
   link still reads); these two are the only places that touch the bar:
   `currentRoute()` reads it — a `#` address still counts, once, on arrival —
   and `go()` writes it as a path and tells the app. A static host has to serve
   index.html for every path, which the `#` used to make unnecessary. */
export function currentRoute() {
  const { pathname, hash } = window.location;
  return hash && hash !== "#" ? hash : `#${pathname.replace(/^\//, "")}`;
}
export const pathOf = (route) => `/${String(route ?? "#").replace(/^#/, "")}`;
export function go(route, { replace = false } = {}) {
  const path = pathOf(route);
  if (window.location.pathname + window.location.hash !== path) {
    window.history[replace ? "replaceState" : "pushState"](null, "", path);
  }
  window.dispatchEvent(new Event("routechange"));
}
export function onRoute(fn) {
  for (const e of ["routechange", "popstate", "hashchange"]) window.addEventListener(e, fn);
  return () => {
    for (const e of ["routechange", "popstate", "hashchange"]) window.removeEventListener(e, fn);
  };
}

export function hashForScale(state, scale) {
  return serializeHash({ ...state, scale });
}

/**
 * TOLERANT. Reads the exercise and the scale out of anything, old or new, and
 * throws away the rest rather than failing on it.
 *
 * The segments are walked instead of indexed because the old grammar put a
 * muscle between the exercise and the scale and the new one does not, so
 * position no longer identifies the scale — content does. `@t` is split off and
 * discarded here rather than parsed, which is the whole of what "the instant
 * left the grammar" means at this end.
 */
export function parseHash(hash) {
  /* DECODED FIRST, AND IT NEVER WAS. `#motion/push%20up` — a space, url-encoded,
     which is what a browser writes when somebody types or pastes one — parsed to
     the exercise `push_20up`, because `%20` reached `canonicalExerciseId` as
     literal text and its normaliser turned the `%` into a separator.
     IT WAS INVISIBLE UNTIL 2026-09-04 BECAUSE A FALLBACK CAUGHT IT. An id that
     resolved to nothing used to land on `push_up`, so this exact case reached the
     right movement by accident and `motion-ui.spec.js` passed while asserting it.
     The moment an unknown exercise started going to idle at the owner's word, the
     rescue stopped and the bug it was hiding surfaced.
     `decodeURIComponent` THROWS on a malformed escape — `%zz`, a lone `%` — and a
     bad address must not take the page down, so a failure keeps the raw text and
     lets the normaliser reject it the way it rejects any other junk. */
  let raw = String(hash ?? "").replace(/^#/, "");
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* left as typed */
  }
  const segments = raw.split("/");
  // Segment 0 is the exercise — unless it is the retired `motion/` prefix, in
  // which case the exercise is the one after it. Both spellings, one path.
  const [head, ...rest] = segments[0] === "motion" ? segments.slice(1) : segments;
  const state = { exercise: canonicalExerciseId(head) || null, scale: "body" };
  for (const segment of rest) {
    // An old address spells the scale as `fiber@1.4s`; a new one as `fiber`.
    const token = segment.split("@")[0];
    if (SCALES.has(token)) {
      state.scale = token;
      break;
    }
    // Anything else is an old muscle slug, a `level`, or junk. Ignored, never
    // absorbed: a segment we cannot name must not become a scale we then draw.
  }
  return state;
}

/**
 * STRICT. Emits the two-segment grammar and nothing else, whatever it is handed
 * — a `t` or a `muscle` left in a caller's state object is dropped here rather
 * than at each call site, so a forgotten field cannot put an instant back in
 * the address bar. `scaleRoute.test.js` pins that as an absence test.
 */
export function serializeHash(state) {
  const { exercise = null, scale = "body" } = state ?? {};
  if (!SCALES.has(scale)) throw new Error(`unknown scale: ${scale}`);
  const id = exercise ? canonicalExerciseId(exercise) : "";
  if (!id && scale === "body") return "#";
  return scale === "body" ? `#${id}` : `#${id}/${scale}`;
}
