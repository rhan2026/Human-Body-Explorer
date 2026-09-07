/**
 * The gizmo: a name, its number, its evidence word, and a line to the thing it
 * is about. One overlay per scene rather than one <Html> per anchor.
 *
 * WHY ONE OVERLAY. `FiberLabels` — this component's predecessor, deleted once
 * every scale had moved off it — gave each anchor its own <Html>, and drei
 * transforms each one independently, which is exactly why seven callouts on the
 * sarcomere had to be hand-placed at four fixed heights to stop them colliding,
 * and why the cell scale's five landed off-canvas at 1024 px wide. Nothing could
 * see the others. Here every plate lives in one absolutely-positioned layer, so
 * the solver sees the whole constellation and can guarantee what no per-anchor
 * component can: no overlap, nothing off-screen, no plate covering a neighbour's
 * subject.
 *
 * WHY THE SIZES ARE MEASURED, NOT ESTIMATED. A plate's width is its text's
 * width, which depends on the font that loaded and the language it is in. They
 * are read at solve time, not in a layout effect: drei portals `<Html>`'s
 * children into the canvas's parent in its OWN layout effect, so a layout effect
 * here runs while every ref is still null. Measured once, keyed on the text, it
 * measured nothing and — because the text never changed afterwards — never tried
 * again. The layer stayed invisible with five correctly-sized plates in it.
 *
 * WHAT IT DOES NOT DO. It renders no provenance field and opens no panel.
 * `item.provenance` is carried opaquely and handed to `Evidence.jsx`'s badge as
 * `source` — that badge is a button and owns the reveal, its keyboard handling
 * and its dismissal. `gizmoContract.test.js` fails if this file reaches into the
 * record itself or grows a button of its own.
 */

import { SHOW_FIGURES, SHOW_SOURCES } from "../uiMode.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import EvidenceBadge from "../Evidence.jsx";
import { assertLabelled } from "./gizmoContract.js";
import { layoutGizmos } from "./gizmoLayout.js";
import "./gizmo.css";

/** Re-solve at most this often, and only once the camera has stopped. Between
 *  solves the plates travel with their anchors, so they stay attached without
 *  paying for a scan every frame. */
const RESOLVE_MS = 140;

/**
 * How still the scene has to be before the layout is allowed to change, in
 * pixels of anchor movement per frame.
 *
 * RE-SOLVING WHILE THE CAMERA MOVES IS A SNAP, and it was measured rather than
 * argued: dragging the cell scale, plate movement with the drag's own rigid
 * component divided out came to a median of 28.4 px and a maximum of 187.4 px.
 * Every one of those is a plate teleporting mid-gesture. The layout was stable
 * for identical input — the determinism test was right — but the input changes
 * every frame while a camera moves, and a different-but-correct solution is
 * still a jump to the eye.
 *
 * So the constellation freezes and travels with its anchors while anything is
 * moving, and re-solves when the scene settles. This is also the "legible
 * resting state while the camera moves" the lane was asked for, and it costs
 * nothing: a frozen layout runs no scan at all.
 */
const STILL_PX = 0.6;

const _v = new THREE.Vector3();

/**
 * How much of the stage's foot is spoken for by chrome drawn over it.
 *
 * Read off the element rather than passed in: where there is a strip, the layer
 * and the transport are siblings inside the same stage, so the one place that
 * knows its real height is the DOM, and it changes with wrapping and with which
 * screen this is. Only the body still mounts one — canon D3 took the strip off
 * all three deep scales on 2026-08-30 — and both readers below return 0 when
 * the query finds nothing, which is why nothing had to change here.
 */
/**
 * How much of the stage's head is spoken for by the one sentence on it.
 *
 * The mirror of `reservedBottom`, and it exists for the same reason on the
 * other side. Until 2026-08-26 the cell scale's caption hung off the transport
 * strip, so `reservedBottom` cleared it along with the strip — the comment
 * below still names the plate that caught: "ATP · ADP · AMP". Moving the
 * sentence to the top so all three scales say it in one place took it out of
 * that band and into one nothing was clearing, and `gate-legibility` reported
 * it at 320 px within the hour: the caption over "27 · 8 · 1" by 2074 px².
 *
 * Read off the DOM for the same reason as the foot: the sentence wraps, and how
 * many lines it wraps to is a fact only the browser has.
 */
function reservedTop(layer) {
  const stage = layer?.closest(".fiber__stage, .press__stage");
  if (!stage) return 0;
  /* A HEADLINE IS TOP CHROME, AND THE ONE SCALE THAT HAS ONE HAD TO SAY SO.
     The signalling scale took two standing lines on 2026-08-31 — the owner
     asked for them by name — and they sit over the top of the canvas. This
     function knew about a subtitle and a toolbar and not about them, so the
     placer treated that band as free: screenshotted at 1280x900, the headline
     landed across both input plates. Measured first because the sentence wraps,
     and how many lines it wraps to is a fact only the browser has. */
  const head = stage.querySelector(":scope > .scale-head");
  if (head) {
    const h = head.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    if (h.height && h.top - st.top < st.height / 2) {
      return Math.max(0, Math.round(h.bottom - st.top));
    }
  }
  const line = stage.querySelector(":scope > .fiber__spent");
  if (!line) return 0;
  const l = line.getBoundingClientRect();
  if (!l.height) return 0;
  /* THE SENTENCE MOVED HOUSE and this function kept clearing its old room.
     Design pass 2026-08-30: `.fiber__spent` became a subtitle at the stage's
     FOOT, and reading its bottom as "where the top chrome ends" told the
     placer the top 752 px of a 852 px stage were chrome — every label was
     clamped into one line under the subtitle, which is the disappearance the
     owner saw. The tap that caught it: top=760 against anchors at 351-452.
     A line in the lower half of the stage is bottom furniture (reservedBottom
     already counts it); only a line still hugging the top edge reserves here. */
  const s = stage.getBoundingClientRect();
  if (l.top - s.top > s.height / 2) {
    /* The subtitle is bottom furniture; the TOOLBAR may be the top chrome now
       (owner moved it top-left in the same pass), so reserve its band here. */
    const strip = stage.querySelector(":scope > .transport");
    if (strip) {
      const r = strip.getBoundingClientRect();
      if (r.height && r.top - s.top < s.height / 2)
        return Math.max(0, Math.round(r.bottom - s.top));
    }
    return 0;
  }
  return Math.max(0, Math.round(l.bottom - s.top));
}

function reservedBottom(layer) {
  /* `closest`, NOT `parentElement`. Measured 2026-08-26: the layer sits three
     wrapper divs inside the R3F canvas mount, so the parent is an unnamed div
     and the first version of this read 0 from it and changed nothing. The stage
     is the element the strip is a sibling of, and it is the one with a name. */
  const stage = layer?.closest(".fiber__stage, .press__stage");
  const strip = stage?.querySelector(":scope > .transport");
  if (!stage || !strip) return 0;
  const s = stage.getBoundingClientRect();
  /* THE SUBTITLE COUNTS AS CHROME TOO. Design pass 2026-08-30: the pass line
     moved to the stage's foot and the transport grew a second row for the
     scrubber, and the overlap gate came back red at every width — the solver
     still parked its bottom rank of plates in the strip both now occupy, so
     Z-disc and Titin were painted under the subtitle and over Tropomyosin.
     Found by bisect: the pre-design checkout measured clean, the working tree
     did not, and the only hands near the bottom band were these two. The
     sentence is a sibling of the transport, not a child, so the walk below
     never saw it. */
  const spent = stage.querySelector(":scope > .fiber__spent, :scope > * > .fiber__spent");
  /* THE STRIP'S CHILDREN CAN SIT ABOVE THE STRIP. The cell scale's causal
     caption is `position: absolute; bottom: 100%` inside it — deliberately, so
     it does not stretch the pill — which puts it OUTSIDE the strip's own box and
     straight back into the band this function is supposed to be clearing.
     Measured 2026-08-26: it landed on "ATP · ADP · AMP" after the first version
     of this had already cleared every plate off the strip itself. Taking the
     highest top of the strip and everything in it is what actually describes
     the chrome, and it costs one walk of a handful of nodes per solve. */
  /* THE STRIP LIVES TOP-LEFT NOW (owner, same pass) — a strip in the top half
     is reservedTop's business; counting it here would declare the whole stage
     chrome, which is the same bug reservedTop just had in mirror. */
  const stripRect = strip.getBoundingClientRect();
  if (stripRect.top - s.top < s.height / 2) {
    if (!spent) return 0;
    let t2 = spent.getBoundingClientRect().top;
    if (!spent.getBoundingClientRect().height) return 0;
    return Math.max(0, Math.round(s.bottom - t2));
  }
  let top = stripRect.top;
  for (const child of strip.querySelectorAll("*")) {
    const c = child.getBoundingClientRect();
    if (c.width > 0 && c.height > 0 && c.top < top) top = c.top;
  }
  if (spent) {
    const c = spent.getBoundingClientRect();
    if (c.width > 0 && c.height > 0 && c.top < top) top = c.top;
  }
  const r = { top, height: s.bottom - top };
  if (!r.height) return 0;
  /* The gap under the strip counts too — a plate tucked into it is a plate the
     strip's own shadow sits on. */
  return Math.max(0, Math.round(s.bottom - r.top));
}

/* THE CASCADE'S OWN TIMING, and the stylesheet reads the same two numbers
   through `--i`. One plate every `INTRO_STEP_MS`, and the last one needs
   `INTRO_SETTLE_MS` to finish arriving after its turn comes up. Declared here
   rather than in a scene because the introduction belongs to the plates: a
   scale that guessed its own length would say "the introduction is over" while
   a name was still fading in. */
const INTRO_STEP_MS = 260;
const INTRO_SETTLE_MS = 420;

export default function Gizmos({
  onPress = null,
  items = [],
  visible = true,
  focus = null,
  focusAt = null,
  /* NO `onIntro`, AND THAT ABSENCE IS THE FIX FOR A REAL DEFECT. This component
     used to report its cascade's start and end as `onIntro(true)` /
     `onIntro(false)`, and each of the three scenes forwarded the SAME callback
     it was itself calling with its four-state stage name — so one prop had two
     speakers with two vocabularies, and the page's `stage` was a boolean for
     part of every visit. Nothing failed: `"main"`, `true` and `false` are all
     just values, and the scales half-worked by luck. The cascade's length is
     still this component's own and still lives in the stylesheet; what is gone
     is the second way to say it. `data-intro` on the plate layer is what a test
     watches the cascade with, and `gizmoContract` pins this absence. */
  /** Where the words hang from — the anchor of the part the VISITOR pressed.
      Not `focusAt`; see the note in the frame loop. */
  sayAt = null,
  /** What counts as ARRIVING SOMEWHERE NEW, declared by the scene rather than
      inferred here. The cascade runs once per change of this. */
  introKey = "",
}) {
  const { camera, size, gl } = useThree();
  const plateRefs = useRef({});
  const layerRef = useRef(null);
  const spotRef = useRef(null);
  /* THE VEIL IS NOT IN THIS LAYER, and the first version's screenshot is why:
     drei's Html sits above the whole stage, so a wash rendered here dimmed the
     subtitle and the transport along with the drawing — the two things that
     must stay crisp while everything else recedes. It belongs between the
     canvas and the chrome, which is a place this component cannot reach with
     JSX, so it is appended to the canvas's own parent (the stage, already the
     positioned ancestor the plates depend on) and carries z-index 1: above the
     canvas, below the `z-index: 2` the subtitle and the toolbar share. */
  useEffect(() => {
    const host = gl.domElement?.parentElement;
    if (!host) return undefined;
    const el = document.createElement("div");
    el.className = "gizmo-veil";
    el.setAttribute("aria-hidden", "true");
    el.hidden = true;
    host.appendChild(el);
    spotRef.current = el;
    return () => {
      el.remove();
      spotRef.current = null;
    };
  }, [gl]);
  /* See `data-intro` on the layer below. Length is the cascade's own: one step
     per plate at the stylesheet's 260 ms, plus the 420 ms the last one takes to
     finish arriving. Keyed on the id list so a scene that swaps its whole set of
     parts — the fibre's level ladder does exactly that — introduces the new ones
     rather than showing them mid-cascade. */
  const [intro, setIntro] = useState(true);
  /* THE SCENE SAYS WHEN SOMEBODY HAS ARRIVED; THIS ONLY RUNS THE CASCADE.
     The first version keyed on the plate list itself, which looked like the
     same fact and is not: a demonstration FILTERS the plates down to its own
     subject, so `items` changed on every press and the names re-staggered every
     time a visitor touched anything. Measured in a browser, 2026-08-31 —
     `data-intro` came back "yes" in the middle of the store's demonstration.
     `count` is read at the moment the cascade starts, not watched, for the same
     reason: the duration belongs to the set that is arriving. */
  const count = useRef(0);
  count.current = items.length;
  /* AND IT RUNS ONCE PER KEY, INCLUDING THE EMPTY ONE. Every scale builds its
     plates from something it is still fetching, so the first render has no
     items and no key: this effect fired on mount, found nothing to cascade, and
     fired again ~100 ms later when the data landed. The names staggered twice —
     the second run over plates that were already up.
     Found by the cell lane while porting, in a shared file it did not touch.
     `seen` is the key the cascade last actually RAN for, so an empty first
     render is skipped rather than counted as an introduction. */
  const seen = useRef(null);
  /* AND IT WAITS FOR THE FIRST PLATE RATHER THAN GIVING UP ON IT. `count` is
     read at the moment the cascade starts, and on a narrow screen there is a
     window where it is zero: the phone fold draws only plates carrying a value,
     and a value arrives on the first reading tick. Keyed on `introKey` alone,
     the effect ran once against an empty set, took the early return, and never
     asked again — so `intro` stayed true for the whole visit.
     What that cost, measured at 320x640: `tourOn` is "the introduction is
     running", and the fibre's level ladder is drawn `!tourOn`. The three-rung
     ladder — the only way to the fascicle and the fibre — never appeared on a
     phone at all. The cell lane hit the same thing from the other side and
     worked around it in its own `introKey`; the defect is here. */
  useEffect(() => {
    if (!count.current || seen.current === introKey) return undefined;
    seen.current = introKey;
    setIntro(true);
    const done = setTimeout(() => {
      setIntro(false);
    }, count.current * INTRO_STEP_MS + INTRO_SETTLE_MS);
    return () => clearTimeout(done);
  }, [introKey, items.length > 0]);
  const svgRef = useRef(null);
  const solved = useRef({ at: null, ids: "", facing: "", layout: {}, anchors: {} });
  const moved = useRef(null);

  // §5 is checked as the items arrive, not when a reader happens to look. A
  // caller who forgets the evidence word finds out at the first render.
  /* AND WHILE A PASS NAMES A SUBJECT, THE SUBJECT IS THE CONSTELLATION. The
     first focus design dimmed the other plates to 0.15 and the owner looked at
     the frame: "그래도 잘 안보이는데" — at a close beat the solver clamps every
     almost-off-frame plate into a strip along the stage's edge, and a pile of
     ghost text is furniture whichever opacity it wears. Filtering HERE, at the
     pipeline's mouth, is what makes it clean: the solver never measures the
     others, the layer never draws them, and the stay-on-stage gate skips
     hidden work by design. Free exploration (no focus) is untouched. */
  const checked = useMemo(
    () => (focus ? items.filter((i) => i.id === focus) : items).map(assertLabelled),
    [items, focus],
  );
  const ids = checked.map((i) => i.id).join("|");

  /* Declared as a closure so the frame loop can run it BEFORE the layer guard
     — see the note at `useFrame`. Everything inside is unchanged except the
     say-point, which is new. */
  const writeVeilAndSayPoint = () => {
    /* THE REST OF THE PICTURE STEPS BACK WHILE ONE THING IS SPOKEN ABOUT.
         Owner, 2026-08-30: "하나에 집중해야되면 나머지는 조금 fade out in
         visualization이 될까?" — and they were right that it was missing. A
         focused beat filtered the PLATES down to one and rang a beacon, but the
         drawing itself stayed at full strength, so nothing actually pulled the
         eye: the subject was labelled, not looked at.
         A veil in the overlay rather than a change to any material. Every scale
         draws different geometry — instanced marks here, tubes there — and
         fading by material means tagging every mesh with the anchor it belongs
         to, in three scenes, plus instancing that has no per-instance opacity.
         A hole punched in a wash of the page's own colour is scale-agnostic, one
         element, and costs no draw call. It sits under the plates and under the
         ring, both of which stay at full strength inside the hole. */
      const spot = spotRef.current;
      if (spot) {
        if (focusAt) {
          _v.set(...focusAt).project(camera);
          // Behind the camera mirrors the point (see the note below); a veil
          // centred on a mirrored ghost is worse than no veil.
          const on = _v.z < 1;
          spot.hidden = !on;
          if (on) {
            spot.style.setProperty("--x", `${((_v.x + 1) / 2) * size.width}px`);
            spot.style.setProperty("--y", `${((1 - _v.y) / 2) * size.height}px`);
          }
        } else {
          spot.hidden = true;
        }
      }

      /* WHERE THE WORDS HANG FROM, AND IT IS NOT WHERE THE BEACON POINTS.
         `focusAt` above is what this BEAT is about; `sayAt` is the part the
         VISITOR PRESSED, and the two differ on purpose in exactly two beats in
         the repository — the fibre store's conclusion, whose sentence rules the
         store out, and the signalling trunk's answer, which lands on the
         outputs. In both the beacon walks away while the demonstration is still
         the pressed part's, so the words stay with the part and the light goes
         where the sentence points.

         Written on the STAGE rather than on the veil: the veil lives inside
         R3F's canvas wrapper and `.fiber__spent` is a sibling of that wrapper,
         so a custom property set on the veil never reaches the sentence. */
      const stage = spotRef.current?.closest(".fiber__stage, .press__stage") ?? null;
      if (!stage) return;
      if (!sayAt) {
        stage.style.removeProperty("--say-x");
        stage.style.removeProperty("--say-y");
        delete stage.dataset.saySide;
        return;
      }
      _v.set(...sayAt).project(camera);
      if (_v.z >= 1) return;                       // behind the camera is mirrored
      const sy = ((1 - _v.y) / 2) * size.height;
      stage.style.setProperty("--say-x", `${Math.round(((_v.x + 1) / 2) * size.width)}px`);
      stage.style.setProperty("--say-y", `${Math.round(sy)}px`);
      /* Flip above the anchor when the block would run off the foot: 120 is the
         gap below the ring, 104 the block's four reserved lines. */
      stage.dataset.saySide = sy + 120 + 104 > size.height ? "above" : "below";
  };

  useFrame(({ clock }) => {
    /* THE VEIL AND THE SAY-POINT OUTLIVE THE LAYER, so they are written before
       the guard below rather than after it. This component returns `null` when
       `checked.length === 0`, and two shipped states reach that: the fibre's
       closing store beat, which carries a `part` and no `focus`, and the
       signalling scale's narrow fold. With the veil written under the guard,
       `layerRef.current` went null and the hole froze wherever it last was —
       on the store's last beat it stayed lit ON THE STORE for the whole 6500 ms
       of the sentence that rules the store out. */
    writeVeilAndSayPoint();
    if (!visible || !layerRef.current) return;

    // A different set of gizmos is a different constellation, and its plates
    // are new DOM with no transform on them yet. Hide the layer until they are
    // placed, or a scale change flashes every plate at 0,0.
    if (ids !== solved.current.ids) {
      solved.current = { at: null, ids, layout: {}, anchors: {} };
      layerRef.current.dataset.placed = "no";
    }

    const now = clock.elapsedTime * 1000;
    const viewportNow = {
      w: size.width,
      h: Math.max(0, size.height - reservedBottom(layerRef.current)),
      top: reservedTop(layerRef.current),
    };
    const anchors = {};
    const front = [];
    for (const item of checked) {
      _v.set(...item.at).project(camera);
      anchors[item.id] = [((_v.x + 1) / 2) * size.width, ((1 - _v.y) / 2) * size.height];
      // BEHIND THE CAMERA IS NOT OFF-SCREEN, IT IS MIRRORED. `project` divides by
      // w, and w is negative behind the eye, so the point comes back with both
      // signs flipped — measured with the cell camera at z 3.95, a point at
      // z = 6 returns ndc (-0.44, -0.43), which is a perfectly plausible
      // position near the middle of the frame. A viewer dollying past an anchor
      // would get a plate somewhere believable, pointing at nothing. ndc.z > 1
      // is the tell, and it is the only one: x and y look fine.
      /* AND OFF THE SIDES IS ALSO NOT ON SCREEN. `ndc.z > 1` catches the anchor
         behind the eye and nothing else, which was enough while every camera in
         this app sat still. The guided passes push in — the cell scale to 1.8,
         where its myofibril anchor at y 1.02 and its nucleotide at y −0.68 leave
         the frame — and their plates stayed at the edge with a leader line
         pointing at something outside it. A callout for a thing a viewer cannot
         see is worse than no callout: it is a label on nothing.
         The margin is generous on purpose. A plate whose anchor is a little past
         the edge still points somewhere a viewer can infer, and popping it out
         the instant the anchor crosses would make the constellation flicker
         through a camera move. One frame's worth of slack, not none. */
      /* 1.25, AND IT WENT TO 1.1 AND CAME BACK. The design pass narrowed it to
         stop almost-off anchors clamping into the edge strip — and the overlap
         gate found plates painted over plates at every width: removing a plate
         removes the neighbour that used to push the others apart, and the
         solver re-packs the rest into collisions. The edge-strip pile the
         narrowing was for only mattered during a pass, and the pass now shows
         the focused plate alone, so the free-exploration margin goes back to
         the value the solver was balanced around. */
      const OFF_SCREEN = 1.25;
      if (_v.z <= 1 && Math.abs(_v.x) <= OFF_SCREEN && Math.abs(_v.y) <= OFF_SCREEN) front.push(item);
    }

    // Hide the ones facing away BEFORE anything measures, and unhide the rest —
    // `hidden` is `display: none`, which zeroes `offsetWidth`, so a plate hidden
    // last frame reads as unmounted this frame and the solve below refuses to
    // run. That deadlocks: it would never be placed, so it would never unhide.
    // How far the scene moved since the last frame, in anchor pixels.
    const last = moved.current;
    const still = last && checked.every((i) => {
      const a = last[i.id];
      return a && Math.hypot(anchors[i.id][0] - a[0], anchors[i.id][1] - a[1]) < STILL_PX;
    });
    moved.current = anchors;

    const facing = front.map((i) => i.id).join("|");
    const faces = new Set(front.map((i) => i.id));
    for (const item of checked) {
      const el = plateRefs.current[item.id];
      if (el) el.hidden = !faces.has(item.id);
    }

    /* BESIDE THE PART — the short path. Owner, design pass 2026-08-30: "line으로
       연결하는게 아니라 그냥 옆에 띄워줘". The solve-and-drift machinery below
       optimised label placement globally and paid in distance and tethers; it
       also turned out to own the frame (its per-frame clamp rewrote whatever a
       new layout computed, which is why an edited solve changed nothing on
       screen). This path replaces it wholesale: every frame, each visible
       plate sits just beside its anchor's projection, with a one-axis greedy
       nudge so two labels whose parts project together stack instead of
       painting over each other. Eight rects a frame; the solver below is
       unreachable and kept only for reference. */
    {
      const pad = 8;
      const top = viewportNow.top + pad;
      const floorY = viewportNow.h;
      const placed = [];
      for (const item of checked) {
        const el = plateRefs.current[item.id];
        if (!el) continue;
        /* A hidden plate keeps a CURRENT transform. It measured 0 wide while
           hidden, so use its last known box; without this, the frame after an
           unhide showed wherever the pre-redesign drift writer had left it —
           one label surfaced at y = -22 and the overlap gate photographed the
           stale frame. */
        const w = el.offsetWidth || el.getBoundingClientRect().width || 120;
        const h = el.offsetHeight || 22;
        const [ax, ay] = anchors[item.id];
        const x = Math.min(Math.max(ax + 14, pad), size.width - w - pad);
        const y = Math.min(Math.max(ay - h - 10, top), floorY - h - pad);
        if (el.hidden) {
          el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0px)`;
          continue;
        }
        placed.push({ el, x, y, w, h });
      }
      placed.sort((a, b) => a.y - b.y || a.x - b.x);
      /* Two passes: the upward fallback can land a label on a THIRD one the
         single top-down sweep has already passed (signalling at 320 px), and
         one more sweep settles it. Eight labels, so the cost is nothing. */
      for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < placed.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = placed[j], b = placed[i];
          const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (xo > 0 && yo > 0) {
            const down = a.y + a.h + 4;
            /* Down first; when the chrome band blocks the way down (signalling
               at 768 px left 338 px² standing), up instead. */
            b.y = down <= floorY - b.h - pad ? down : Math.max(top, a.y - b.h - 4);
          }
        }
      }
      /* LAST RESORT: FOLD, DON'T PAINT OVER. At 320 px the signalling scale's
         "two bouts enter here" and "reached by both" share one physical band
         and no push up or down clears them. Painting one over the other is the
         one collision this file has always refused; a folded label comes back
         the moment the camera gives it room. */
      for (let i = 0; i < placed.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = placed[j], b = placed[i];
          if (a.el.hidden || b.el.hidden) continue;
          const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          if (xo > 0 && yo > 0) b.el.hidden = true;
        }
      }
      for (const b of placed) b.el.style.transform = `translate3d(${Math.round(b.x)}px, ${Math.round(b.y)}px, 0px)`;
      /* Debug tap for the placement — three numbers per plate, readable from a
         probe. Cheap, and finding y=685 took three blind fixes without it. */
      if (typeof window !== "undefined")
        window.__gizmoPlace = { top, floorY, sample: placed.slice(0, 3).map((b) => ({ y: b.y, ay: anchors[checked.find((c) => plateRefs.current[c.id] === b.el)?.id]?.[1] })) };
      if (layerRef.current) layerRef.current.dataset.placed = "yes";
      return;
    }

    // Three reasons to solve, and the third is the ordinary one. A never-placed
    // constellation and a changed set of visible plates must be laid out
    // whatever the camera is doing — an unplaced plate is worse than a snap.
    const mustPlace = solved.current.at === null || facing !== solved.current.facing;
    if (mustPlace || (still && now - solved.current.at > RESOLVE_MS)) {
      const boxes = front.map((i) => {
        const el = plateRefs.current[i.id];
        return el && el.offsetWidth ? { id: i.id, anchor: anchors[i.id], w: el.offsetWidth, h: el.offsetHeight } : null;
      });
      // A plate with no box yet is a plate that has not mounted. Placing the
      // rest around a hole would put the constellation in a shape it loses on
      // the next solve, so nothing is placed until all of them can be.
      if (boxes.some((b) => b === null)) return;
      solved.current = {
        at: now,
        ids,
        facing,
        /* THE VIEWPORT STOPS WHERE THE CONTROLS START. The three scale screens
           lost their headers on 2026-08-26 and the transport — press, speed,
           scrub — moved onto the stage. The solver was never told, so it kept
           placing plates in a band that now has a control strip in it: measured
           at 320 px on the cell scale, "ATP · ADP · AMP" landed 765 px² under the
           0.25x chip and 467 px² under the play button, and `gate-legibility`
           called it, correctly, text painted over text.
           Reserving the strip's real height is the fix rather than a constant,
           because the strip wraps: at 320 px it is two rows on the press screen
           and one on the others, and a guessed inset is wrong on one of them the
           day either changes. `null` when there is no strip, in which case the
           stage is the whole of it, as it was. */
        /* BESIDE THE PART, NOT SOLVED AWAY FROM IT. Owner, design pass
           2026-08-30: "각 part labeling들이 scenario와 너무 겹쳐 … line으로
           연결하는게 아니라 그냥 옆에 띄워줘". The solver optimised for
           never-overlapping plates and paid for it with distance — labels
           parked in a bottom rank, tethered to their parts by leader lines a
           viewer has to trace. A museum label sits next to the specimen.
           Each plate now hangs just right of and above its anchor's projection,
           clamped to the stage and to the reserved chrome band. Two labels CAN
           now overlap when two parts project close together; the trade is
           deliberate and the owner's, and the passes already show one plate at
           a time where it matters most. `layoutGizmos` stays importable for
           the day a hybrid is wanted. */
        layout: (() => {
          const pad = 10;
          const placed = boxes.map((b) => {
            const x = Math.min(Math.max(b.anchor[0] + 14, pad), viewportNow.w - b.w - pad);
            const y = Math.min(
              Math.max(b.anchor[1] - b.h - 10, viewportNow.top + pad),
              viewportNow.h - b.h - pad,
            );
            return { id: b.id, x, y, w: b.w, h: b.h };
          });
          /* One-axis relief: keep x beside the part, nudge y only where two
             labels' spans cross. Greedy top-down — measured on the fibre's
             wide framing, the raw beside-placement stacked six pairs on the
             sarcomere's midline, and pushing each collider just below the one
             above it clears them while every label stays at its part's side. */
          placed.sort((a, b2) => a.y - b2.y || a.x - b2.x);
          for (let i = 0; i < placed.length; i++) {
            for (let j = 0; j < i; j++) {
              const a = placed[j], b2 = placed[i];
              const xOver = Math.min(a.x + a.w, b2.x + b2.w) - Math.max(a.x, b2.x);
              const yOver = Math.min(a.y + a.h, b2.y + b2.h) - Math.max(a.y, b2.y);
              if (xOver > 0 && yOver > 0) {
                b2.y = Math.min(a.y + a.h + 4, viewportNow.h - b2.h - pad);
              }
            }
          }
          return Object.fromEntries(placed.map((b) => [b.id, { x: b.x, y: b.y }]));
        })(),
        anchors,
        /* KEPT, BECAUSE THE DRIFT BELOW HAS TO OBEY THE SAME NUMBERS. Measured
           once per solve rather than per frame: `reservedBottom` walks the
           strip's children and this runs on every frame the scene draws. */
        bounds: viewportNow,
      };
      layerRef.current.dataset.placed = "yes";
      // The solve counter, on the DOM rather than on `window`. "The layout does
      // not change while the camera moves" is the claim this component makes and
      // the one it got wrong first; a gate cannot check it by watching pixels,
      // because plates legitimately move with their anchors the whole time. It
      // can check that this number does not go up.
      layerRef.current.dataset.solves = String((Number(layerRef.current.dataset.solves) || 0) + 1);
    }

    /* Between solves: translate by however far the anchor has moved since the
       solve. The constellation keeps its shape and stays welded to the geometry;
       the guarantees are re-established at the next solve.

       EXCEPT ONE, WHICH IS CLAMPED, because it is the only guarantee a viewer
       can be hurt by losing. `reservedBottom` exists to keep plates off the
       transport and the comment above records what it cost to get right — and
       the drift put them straight back. Measured 2026-08-27 at 320x640 on the
       cell scale: the strip's top is 216 and "ATP · ADP · AMP" reached 219–248,
       with its evidence badge **2 px from the 1× chip**; sampled over six
       seconds a plate got **46 px** into the band. The overlap gate cannot see
       it and is right not to — 2 px of clearance is not an overlap — and to a
       finger 2 px of clearance is the same as none.
       So a plate follows its anchor until the edge of the reserved band and then
       stops. The leader line uses the CLAMPED delta rather than the wanted one,
       so the line ends where the plate is rather than where it would have been:
       a plate that has stopped and a line that has not is two things coming
       apart, which is worse than either.

       AND SIDEWAYS TOO, WHICH THE FIRST VERSION OF THIS CLAMP DID NOT DO. It
       bounded Y because what it was catching was plates sliding into the
       transport's band, and the fibre's anchors move along X — a sarcomere
       shortens along its own long axis. Measured 2026-08-27 over 24 seconds of
       each pass: the terminal cisterna's plate reached **343 px outside the
       stage**, carrying "442 µM of 941" with it, and the cell's `bout` label
       reached 44. Signalling never left. A published number drawn over the panel
       or off the edge of the picture it belongs to is the same defect as one
       that never reached a pixel. */
    const lines = [];
    const bounds = solved.current.bounds ?? viewportNow;
    for (const item of checked) {
      const el = plateRefs.current[item.id];
      const p = solved.current.layout[item.id];
      if (!el || !p) continue;
      const was = solved.current.anchors[item.id];
      const now2 = anchors[item.id];
      const floor = Math.max(bounds.top, bounds.h - el.offsetHeight);
      const y = Math.min(Math.max(p.y + (now2[1] - was[1]), bounds.top), floor);
      const dy = y - p.y;
      const right = Math.max(0, bounds.w - el.offsetWidth);
      const x = Math.min(Math.max(p.x + (now2[0] - was[0]), 0), right);
      const dx = x - p.x;
      el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      if (p.line) {
        lines.push(`M${now2[0].toFixed(1)},${now2[1].toFixed(1)}L${(p.line.x2 + dx).toFixed(1)},${(p.line.y2 + dy).toFixed(1)}`);
      }
    }
    if (svgRef.current) svgRef.current.setAttribute("d", lines.join(" "));
  });

  if (!visible || checked.length === 0) return null;

  return (
    <Html
      fullscreen
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "none" }}
      /* PINNED TO THE CANVAS, NOT TO THE WORLD ORIGIN. `fullscreen` sizes this
         to the canvas but drei still TRANSLATES it by wherever the object it
         hangs off projects to, and this one hangs off [0,0,0]. As long as the
         camera never moved that was the centre of the screen and the overlay sat
         still; the guided passes move the camera, and measured 2026-08-26 on the
         cell scale the whole layer slid 254 px down the stage during a close
         beat while every plate stayed correctly placed INSIDE it.
         A constant here is drei's own escape hatch and it says the thing that is
         true: this layer is chrome over the canvas, not an object in the scene.
         THE CONSTANT IS THE CANVAS CENTRE, and [0, 0] was measured wrong before
         it was measured right: drei places a `fullscreen` layer about the point
         it is given, so an origin pinned to the corner slid the whole thing half
         a canvas — 808 px of drift and every plate outside. The centre is where
         the world origin used to project when the camera was looking at it,
         which is the case this was correct in all along.
         The plates' own positions come from `layoutGizmos`, in canvas pixels,
         which is why they were right the whole time. */
      calculatePosition={(_el, _camera, size) => [size.width / 2, size.height / 2]}
    >
      <div
        className="gizmo-layer"
        ref={layerRef}
        data-placed="no"
        /* CANON D5, AND IT RUNS ONCE. The names arrive one at a time, in place,
           which is the whole of "this is here" — `gizmo.css` carries why that is
           the entire introduction and why there is no second script of
           sentences. Cleared when the last one has landed so a plate that
           appears later (a value binding, a level switch) does not re-stagger a
           set the viewer has already met. */
        data-intro={intro ? "yes" : "no"}
        data-testid="gizmo-layer"
      >
        {/* The leader lines went with the solver-distance layout — a label
            beside its part needs no tether. The <path> stays mounted so the
            per-frame writer keeps a target; it simply has nothing visible to
            draw at this distance. */}
        <svg className="gizmo-layer__lines" aria-hidden="true" style={{ display: "none" }}>
          <path ref={svgRef} d="" />
        </svg>
        {checked.map((item, i) => (
          <Plate
            key={item.id}
            item={item}
            focus={focus}
            /* THE PLATE'S PLACE IN THE ORDER, for canon D5's arrival cascade —
               `gizmo.css` carries what it is for. Handed down as a custom
               property rather than read from `:nth-child`, because the solver
               reorders these and a stylesheet counting DOM children would
               stagger them in whatever order the layout happened to settle. */
            index={i}
            innerRef={(el) => {
              plateRefs.current[item.id] = el;
            }}
          onPress={onPress}
            />
        ))}
      </div>
    </Html>
  );
}

/**
 * One plate. The evidence word is `Evidence.jsx`'s badge, not a second one — two
 * definitions of what a badge looks like is how the fibre panel and the descent
 * would drift into disagreeing about the same claim.
 *
 * THE PLATE IS NOT A BUTTON, AND THAT IS THE SEAM. It was one for an afternoon,
 * wrapping the whole callout so a click could hand the item back through an
 * `onEngage` callback. Lane 4 then made the shared badge itself the button that
 * opens the record — which reaches all nineteen labelled numbers in the app at
 * once instead of only the ones a gizmo draws — so a plate-button would nest a
 * button inside a button and offer a second gesture for one question. The badge
 * is the affordance; this hands it `source` and stays out of the way.
 */
function Plate({ item, innerRef, focus = null, index = 0, onPress = null }) {
  /* WHILE A PASS NAMES A SUBJECT, the named plate comes forward and the rest
     step back — the design pass's answer to "i dont even know where the store
     is". Focus is an anchor id from the beat; no focus, no classes, and the
     plates read exactly as before. */
  const mode = focus ? (focus === item.id ? " gizmo--focus" : " gizmo--dim") : "";
  /* A PLATE IS THE PRESS SURFACE WHEN A FLOOR SAYS SO — 2026-09-07, FIBER pace 7.
     Opt-in per floor (`onPress`), so the layer stays inert everywhere else. */
  const press = onPress ? " gizmo--press" : "";
  return (
    <div
      ref={innerRef}
      className={`gizmo${mode}${press}`}
      style={{ "--i": index }}
      onClick={onPress ? () => onPress(item.id) : undefined}
      role={onPress ? "button" : undefined}
    >
      <span className={item.exact ? "gizmo__name gizmo__name--exact" : "gizmo__name"}>
        {item.swatch && <b className="gizmo__swatch" style={{ background: item.swatch }} />}
        {item.label}
      </span>
      {SHOW_FIGURES && item.value !== undefined && item.value !== null && item.value !== "" && (
        <span className="gizmo__value">
          {item.value}
          {item.unit && <span className="gizmo__unit"> {item.unit}</span>}
        </span>
      )}
      {/* `source` is passed straight through and never read here — the record is
          lane 4's to render, and `gizmoContract.test.js` fails if this file
          starts looking inside it. A caller with a quoted or hand-drawn number
          passes no record and the panel says so, rather than attributing our
          transcription to somebody's model. */}
      {SHOW_SOURCES && item.evidence && (
        <EvidenceBadge source={item.provenance} title={item.why}>
          {item.evidence}
        </EvidenceBadge>
      )}
    </div>
  );
}
