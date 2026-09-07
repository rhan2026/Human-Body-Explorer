/**
 * Camera presets, deliberately stored apart from the joint data.
 *
 * A movement is a fact about a body; where you stand to watch it is not. Keeping
 * them in one object also means a framing can be retuned from screenshots
 * without touching a single joint angle, which is most of what visual debugging
 * actually turns out to be.
 *
 * `position` and `target` are world metres. The rig is Y-up with the floor at
 * y = 0 and the model facing +Z.
 */

export const CAMERAS = {
  /** The push-up's framing, unchanged — it is the reference. */
  /* AIMED AT THE BODY, NOT NEAR IT — 2026-09-06. Owner: *"다 benchpress의
     기준으로 줌 앵글 맞추고"* … *"비슷하게"*.
     WHAT MAKES THE BENCH THE REFERENCE IS MEASURABLE, and it is not its numbers:
     its target sits on the body's own centre. Read off `__rigDebug()`'s joints
     in the browser, the bench's body centres at [0.14, 0.51, 0.37] and its
     target is [0, 0.55, 0.35] — the same point. The other framings aim near
     their subject rather than at it, and every complaint about them is that
     offset seen from the front:
       pull-up   centre y 1.38, aimed at 1.89 — half a metre high, which is the
                 empty top quarter of the frame the owner saw. It was aiming at
                 the BAR.
       swimming  centre y 0.66, aimed at 0.86, and centre z 0.81 against 0.75 —
                 the subject rides low and left of the middle.
       lunge     centre z 0.11, aimed at 0.30 — pushed to one side.
     So each target moves onto its own body's centre. Distance, height and fov
     are untouched: the complaint was where the frame is pointed, not how close
     it stands, and changing both at once would leave neither measured. */
  /* ── FITTED TO THE FRONT DOOR, 2026-09-06 ────────────────────────────────
   *
   * Owner: *"모든 애들을 idle이랑 비슷하게 맞추자"* … *"앵글은 다 달라야되는데
   * zoom in 정도와 발의 위치 서 있는데들은 idle과 비슷하게"*. So three axes, and
   * only two of them are shared:
   *
   *   ANGLE   each movement's own. Not unified — a lunge seen from the running
   *           camera says nothing about a lunge.
   *   ZOOM    all six match the explorer's.
   *   FEET    a movement whose feet are on the floor puts them where the
   *           explorer puts them, which is a target height rather than a
   *           position.
   *
   * WHAT "MATCH THE EXPLORER'S ZOOM" IS AS A NUMBER. The front door has no
   * preset — `<Bounds fit>` computes it — so it was read back from the running
   * app: camera [0, 0.909, 3.636] on target [0, 0.860, 0.101] at fov 32, which
   * is 3.54 away. Apparent size is `d · tan(fov/2)`, and the explorer's is
   * **1.016**. Every preset below is placed at whatever distance gives that at
   * its own fov, along its own direction. Two of the six were already there —
   * the bench at 2.98 and the gait at 3.48 — which is why those two never drew
   * a complaint.
   *
   * MEASURED COMPLAINTS, ALL THE SAME QUANTITY:
   *   pull-up   4.20 against 2.95 — *"너무 zoom out"*
   *   push-up   2.47 against 2.95 — *"너무 zoom in"*
   *   lunge     3.67 against 3.13, and aimed at 0.63 while the explorer aims at
   *             0.86 — *"너무 위로 가 있다"* is that 0.23 seen from the front
   *   swimming  3.19 against 2.95
   */
  press_side: {
    position: [2.209, 1.315, 2.422],
    target: [0, 0.3, 0.75],
    fov: 38,
    note: "Three-quarter from the side, low enough to read the elbow angle.",
  },

  /**
   * Hanging: tall and narrow, so the whole travel stays in frame.
   *
   * The body spans y 0.34 to the bar at 2.28 — nearly two metres — which is the
   * tallest thing the viewer has to hold.
   *
   * IT DID NOT HOLD IT, AND THE FIGURE WAS OUT OF FRAME AT THE TOP OF EVERY
   * REPETITION — 2026-09-05. `motion.spec.js` has graded this one pose since the
   * framing pass ("chin over bar — the framing defect") and it read
   * y [-0.13, 1.27]: 27% of the viewport height of pull-up, above the top edge,
   * on the exercise the whole route is named for.
   *
   * MEASURED ACROSS THE WHOLE REPETITION AND NOT AT THE ONE GRADED POSE, because
   * a target chosen to fit the top can push the hang out of the bottom. Nine
   * samples, t = 0 to 4: y ran -0.45 at the hang to 1.27 at the top, an excursion
   * of 1.72 against a viewport of 2.00. So the shot was never too tight — it was
   * off centre by 0.41, and the fix is where the camera looks, not how much of
   * the room it takes in.
   *
   * THE TARGET GOES UP AND THE CAMERA GOES BACK. Up by 0.41 NDC, which is 0.53 m
   * at this distance, so the excursion centres. Back by a tenth, so the margin
   * either end is a tenth of the frame rather than the four hundredths that
   * centring alone would have left — a rig that gains a hand's width in a
   * re-export should not put this back out of frame.
   *
   * THE OLD NOTE SAID THE LOW TARGET LIFTED THE BODY AWAY FROM "THE CONTROL DOCK
   * ALONG THE BOTTOM EDGE". The pills went with the owner's *"다 없에 그냥 다"*
   * and `descent.spec.js` records that removal; the reason outlived the thing.
   */
  hang_front: {
    /* BODY 3rd round, 2026-09-07 — owner: *"pull up 10% zoom out"* again: offset x1.10 on top of yesterday's x1.10. */
    /* ITEM 6, 2026-09-07 — owner: *"pull up 10% zoom out"*. The offset from the target x1.10; aim unchanged. */
    /* 2.95 -> 3.25 ON 2026-09-06, the owner's *"pull up은 한 10%만 zoom out하고
       결과 보자"*. The offset from the target is scaled, not the position, so the
       ANGLE is untouched — only the distance moves. This leaves the apparent-size
       standard the other five are fitted to (d·tan(fov/2) = 1.016); the owner is
       overriding it for this framing and that is the whole change. */
    position: [1.749, 2.119, 3.451],
    target: [0.000, 1.380, 0.010],
    fov: 38,
    note: "Front three-quarter. Must hold the bar and the feet at once.",
  },

  /** Supine on a bench: from the side and slightly above the bar path. */
  bench_side: {
    position: [2.35, 1.35, 2.0],
    target: [0, 0.55, 0.35],
    fov: 38,
    note: "Side, above the bar path, so the descent reads as vertical travel.",
  },

  /** Split stance: three-quarter, because a lunge is not a planar movement. */
  stance_three_quarter: {
    /* ITEM 7, 2026-09-07 — owner: *"lunge 한 10% 위로 올려 10% zoom out"*. The FIGURE goes up: before this the feet sat on the timeline strip (measured 1280x800, feet at y 715 of 800), so "위로" here is the body in the frame, which means the aim goes DOWN by 0.170 (10% of a standing body). Offset x1.10. Running's "위로" was the other way — its head touched the top edge — and each is what the picture asked for. */
    /* 3.13 -> 3.44 ON 2026-09-06, the owner's *"lunge은 한 10%만 zoom out하고
       결과 보자"*. Offset scaled, angle untouched — same treatment as the pull-up. */
    position: [2.306, 1.200, 3.088],
    /* AND CENTRED WHILE I WAS HERE. Measured after the pull-back at 1440x900:
       the lunge spanned x 430 to 740, centre 585, against a frame centre of 720 —
       135 px left. Not asked for in those words, but it is the same axis the
       owner has now called out on two other movements ("swimming은 또 너무
       오른쪽으로 가 있어", and the running framing before it), so leaving one
       subject visibly off-centre would just be the next message. Target slides
       0.336 world units along this camera's own screen-right (0.733, 0, -0.680) —
       135 px at distance 3.442 and fov 36 — and the camera carries the same
       offset, so the 10 % pull-back and the angle are untouched. */
    target: [-0.246, 0.690, 0.338],
    fov: 36,
    note: "Three-quarter front. Shows both knees and the rear heel lifting.",
  },

  /** Gait: near-side, level with the hips, far enough back for a full stride. */
  gait_side: {
    /* BODY 3rd round, 2026-09-07 — owner: *"running 앞몸이 보이게 조금 더 돌려 … 앞몸30% 옆몸 70%"*. Azimuth 32.0 -> 42.0 deg from the side (front is +Z); same radius, same height. */
    /* BODY 3rd round, 2026-09-07 — owner: *"running은 몸을 10% 위로 … 10% 줌아웃"*. The FIGURE up, as on the lunge: the aim down 0.170 (10% of a standing body); offset x1.10 on top of yesterday's. */
    /* ITEM 5, 2026-09-07 — owner: *"running 조금 더 앞면이 보이게하고 한 5% 위로 올려 5% zoom out"*. Azimuth 24.0 -> 32.0 deg (front is +Z), radius x1.05, target and eye up 0.085 (5% of a standing body). */
    /* 10 deg -> 24 deg OFF PURE SIDE, 2026-09-06, AND THE LAST MOVE WENT THE
       WRONG WAY. The owner asked twice for the same thing — *"완전 앞도 아니고
       완전 옆도 아니고 살짝 왼쪽 옆"*, then *"running 살짝 앞도 조금 보이는 옆"* —
       and I read the first as "this angle is ambiguous, commit to one" and took
       17.6 deg DOWN to 10, which is where the front stops being visible at all.
       They were describing the destination, not the fault: a side view with a
       little of the front in it. So it goes the other way, past where it started.
       The radius from the target (3.311) and the height (0.24 above it) are
       unchanged, so the framing size and the eye level are exactly as they were —
       only the swing around the runner moves. The runner faces screen-left, which
       is +Z here, so a larger azimuth is the front coming into view. */
    position: [2.842, 1.039, 2.559],
    target: [0.000, 0.775, 0.000],
    fov: 34,
    note: "Side-on. Fore-aft excursion is the thing to see, so minimise yaw.",
  },

  /**
   * Swimming: three-quarter from above the surface, looking down the body.
   *
   * Shallower than it wants to be. Directly abeam hides the roll, but far above
   * puts the waterline plane across the whole frame and it reads as a wall
   * rather than a surface.
   */
  swim_three_quarter: {
    /* MOVED 75 PX LEFT ON SCREEN, 2026-09-06: *"swimming은 또 너무 오른쪽으로 가
       있어 find the balance"*. Measured at 1440x900 — the swimmer spanned x 500
       to 1090, centre 795, against a frame centre of 720.
       The AIM moves, not the angle: the target slides along the camera's own
       screen-right axis (0.580, 0, -0.814) by 0.169 world units, which is 75 px
       at this distance (2.950) and lens (fov 38, so 2.031 world units over 900
       px). The camera carries the same offset, so distance, elevation and swing
       are untouched and only the centring changes. Last pass overshot the other
       way by moving the target's z alone; this is the axis the screen actually
       uses. */
    position: [2.326, 1.674, 2.814],
    target: [0.008, 0.90, 1.162],
    fov: 38,
    note: "Above and to the side: body roll is invisible from directly abeam.",
  },
};

export const DEFAULT_CAMERA = "press_side";

export function cameraFor(name) {
  return CAMERAS[name] ?? CAMERAS[DEFAULT_CAMERA];
}
