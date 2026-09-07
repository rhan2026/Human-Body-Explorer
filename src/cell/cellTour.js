/**
 * The ENERGY floor's guided pass — a small experiment, not a lecture.
 *
 * The owner's one line for this floor (docs/20260905-fix/cell.md): *"Watch
 * where the energy goes, then test what actually drives the cell's stress
 * sensor."* BODY picks, FIBER watches, ENERGY TESTS. So the pass has the shape
 * of an experiment: resource flow (ATP spent, PCr recharging, ADP and AMP
 * piling up) → an expectation the visitor is allowed to form (the rising AMP
 * explains the sensor) → a second input they were not told about (the same
 * calcium from upstairs, through CaMKK2) → the invitation to turn that input
 * off and look. `energyTour` is the first three; `energyResult` is what the
 * guide says after the visitor has pressed the control.
 *
 * NO INSTANT IN THIS FILE IS TYPED. The page sweeps them off the loaded run
 * with `instantsOf` (energyBinding.js) and hands them in; this file only checks
 * they are finite and inside the run's own grid, and refuses to build a pass
 * otherwise — a storyboard that seeks to NaN holds the run at its first frame
 * while narrating events that never come, which is worse than no storyboard.
 * The one duration that is not an instant, the length of the set, is the
 * protocol's (`REPS × REP_SECONDS`, cellBinding.js): the shipped file carries
 * no rep fields of its own.
 *
 * THE SHOTS ARE THE GEOMETRY'S. Every camera takes the x, y and z of the
 * anchor it frames and only the distance back is this file's — so an anchor
 * moved in `cellChainGeometry.js` moves its shot with it. Three distances:
 * close for one population, pair for two neighbours, side for one half of the
 * room; the wide framing is `ENERGY_CAMERA` itself. And every shot is taken
 * from ONE DIRECTION, `ENERGY_VIEW_DIR` — the unit vector the room is seen
 * along — so a close-up is a dolly down that line toward its anchor, never a
 * swing to a different angle. Rule 4 of the owner's brief (2026-09-06): the
 * picture after the pass is the opening picture at the same angle. The room
 * went oblique (`ENERGY_CAMERA`, ~4° round, ~5° up) and the orchestrator's
 * warning was that a close-up taken square-on (+z) in an oblique room reads
 * fine mid-pass and SNAPS on the first frame after it — the return to
 * `ENERGY_CAMERA` is then a swing of ~18°, not a dolly. The result's verdict
 * beat keeps the direction too: it slides `ENERGY_CAMERA` and its target
 * sideways by the same offset. `cellTour.test.js` holds every beat within 1°.
 *
 * THE SENSOR BEAT ENDS ON `ampMax`, NOT ON `responseMax`. The contract wrote
 * "just before responseMax rises", and on the shipped file `responseMax` is the
 * LAST sample (pAMPK_fraction climbs monotonically to 13 s), so "just before it"
 * is the rest phase — ring nearly full, barely moving, AMP already falling. The
 * sentence is about an expectation the rising AMP invites, so the window is
 * walked back from AMP's own peak by the beat's playback: on the shipped file
 * that is about 2.3 → 6.2 s, over which the ring goes roughly 0.37 → 0.80 and
 * AMP rises to its highest. Measured 2026-09-05.
 */

import { FRAME_SLIP_MS, readingMs, TOGETHER } from "../tour.js";
import { REPS, REP_SECONDS } from "./cellBinding.js";
import { valuesOf } from "./cellChain.js";
import { ENERGY_CAMERA, ENERGY_VIEW_DIR } from "./cellChainGeometry.js";
import { repAt } from "./energyBinding.js";


/** The anchor ids the beats are about — `PARTS` in energyBinding.js. */
const FOCUS_IDS = ["atp", "pcr", "adp", "amp", "ca", "camkk2", "ampk"];
const INSTANT_IDS = ["onset", "pcrSteepest", "ampMax", "responseMax", "caPeakRep1", "still"];

/* How far back each shot sits from what it looks at, in world units. A framing
   decision, like the fibre pass's offsets: the scene is ≈ x ±1.7, y ±1.3 at fov
   38, a token is r ≈ 0.028 and a pool is a few tenths across, so 1.5 fills the
   frame with one population, 2.0 holds two neighbours, 3.2 holds one side of
   the room with its four pools (y −0.7 → +0.6) and a margin. */
const CLOSE_BACK = 1.5;
const PAIR_BACK = 2.0;
/* 3.2 → 2.8, AND THE SIDE SHOTS STAY INSIDE THE MEMBRANE. At 3.2 a fifth of
   each side frame was blank paper outside the cell (audit r2, 10-beat-3 and
   the verdict shot): the centroid of four pools sits near x ±1, and a frame
   that wide reaches past ±1.9. `side()` clamps its x so the frame edge lands
   at the wall instead. */
const SIDE_BACK = 2.8;
/** The scene's own half-width in x; a side shot's centre may not wander past it. */
/* 0.55 → 0.75, 2026-09-06: with the oblique dolly the side shot's frame is
   narrower in x than the square-on one was, and clamping the energy side's
   centroid to 0.55 put the PCr reserve — the set beat's subject — under the
   top-right corner, where the guide's bubble covered Pause and Go Home for the
   6.5 s of the set (final/10-beat3-set.png). At 0.75 the four pools sit in
   the frame's middle and the guide stands clear of the corner. */
const SIDE_X_MAX = 0.75;

/* The line's own fade-in: `.fiber__spent--tour` animates 260 ms (fiber.css) and
   `tourPace.test.js` subtracts it from every beat before asking whether the
   sentence could be read. The 2× slip is `tour.js`'s own advice — sized to
   clear the rule by a frame's slip rather than to sit on it. */
const FADE_MS = 260;
const AMP_LINE = "AMP is the cell's **low-fuel flag**: the more of it, the louder the sensor hears it.";
const CAMKK2_LINE = "CaMKK2 then switches AMPK on directly — so the message arrives **with the movement itself**.";
const NOTICE_LINE = "AMPK is the cell **noticing it worked hard**.";
const BUILD_LINE = "Once it is on, the cell starts building what it ran short of — **more mitochondria, more fuel uptake**.";
const dwell = (line, wallMs = 0) =>
  Math.ceil(Math.max(readingMs(line) + FADE_MS + 2 * FRAME_SLIP_MS, wallMs + FRAME_SLIP_MS));

const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

/** `{ id → at }` for every focus id, or null if any is missing or malformed. */
function anchorsOf(anchors) {
  const at = {};
  for (const id of FOCUS_IDS) {
    const a = (anchors ?? []).find((x) => x?.id === id)?.at;
    if (!vec3(a)) return null;
    at[id] = a;
  }
  return at;
}

/** The run's own first and last archived instants, from either run shape. */
function gridOf(bout) {
  const times = valuesOf(bout, "t");
  if (!Array.isArray(times) || times.length < 2) return null;
  const t0 = times[0];
  const tEnd = times[times.length - 1];
  return Number.isFinite(t0) && Number.isFinite(tEnd) && tEnd > t0 ? { t0, tEnd } : null;
}

/** The swept instants, or null if any is missing or outside the grid. */
function instantsIn(instants, { t0, tEnd }) {
  for (const id of INSTANT_IDS) {
    const v = instants?.[id];
    if (!Number.isFinite(v) || v < t0 || v > tEnd) return null;
  }
  return instants;
}

const centroid = (ats) => ats.reduce((c, a) => c.map((v, i) => v + a[i] / ats.length), [0, 0, 0]);
/** A point `w` of the way from `a` to `b` — a weighted centroid, so a pair
    shot can put its SUBJECT on a third and its partner on the other. */
const blend = (a, b, w) => a.map((v, i) => v + (b[i] - v) * w);
const lifted = (a, dy) => [a[0], a[1] + dy, a[2]];
/** A dolly along the floor's one perspective: the camera sits `back` from the
    target along `ENERGY_VIEW_DIR`, so the shot's angle is the wide framing's. */
const shot = (at, back) => ({ camera: at.map((v, i) => v + back * ENERGY_VIEW_DIR[i]), lookAt: [...at] });

/* PASS 6 (owner, 2026-09-06 night): "is the crop intentional and graphic, or
   just close?" Three shots are composed rather than centred:
     · the AMP → AMPK pair looks 70 % of the way to AMPK, 2.2 back, so the
       trimer stands on the right third with its arcs inside the top edge and
       AMP on the left third — the guide has the left half to enter from;
     · the calcium side looks between CaMKK2 and AMPK (55 % toward the sensor),
       2.6 back, so the sensor is lower right, AMPK upper left, and the stream
       from the lower-right wall is in frame from its door;
     · the AMPK close (the result's last beat) is 1.8 back and looks 0.07
       above the trimer, so the whole silhouette and both activity arcs sit
       inside the frame with headroom, instead of the arcs on the edge. */
const AMPK_PAIR_TOWARD = 0.7;
const AMPK_PAIR_BACK = 2.2;
const SENSOR_SIDE_TOWARD = 0.55;
const SENSOR_SIDE_BACK = 2.6;
const AMPK_CLOSE_BACK = 1.8;
const AMPK_CLOSE_LIFT = 0.07;

function shotsOf(at) {
  return {
    close: (id) => shot(at[id], CLOSE_BACK),
    closeAmpk: () => shot(lifted(at.ampk, AMPK_CLOSE_LIFT), AMPK_CLOSE_BACK),
    pair: (a, b) => shot(centroid([at[a], at[b]]), PAIR_BACK),
    pairAmpk: () => shot(blend(at.amp, at.ampk, AMPK_PAIR_TOWARD), AMPK_PAIR_BACK),
    sensorSide: () => shot(blend(at.ampk, at.camkk2, SENSOR_SIDE_TOWARD), SENSOR_SIDE_BACK),
    side: (...ids) => {
      const c = centroid(ids.map((id) => at[id]));
      c[0] = Math.max(-SIDE_X_MAX, Math.min(SIDE_X_MAX, c[0]));
      return shot(c, SIDE_BACK);
    },
    wide: { camera: [...ENERGY_CAMERA], lookAt: [0, 0, 0] },
  };
}

/** One beat. `focusAt` is the anchor itself, because a pair or side shot looks
    at a centroid and the beacon has to land on the thing the sentence names. */
const beat = (at, { focus, line = null, seek, speed, wallMs = 0, ms, ...framing }) => ({
  ms: ms ?? dwell(line, wallMs),
  line,
  ...framing,
  seek,
  speed,
  focus,
  focusAt: [...at[focus]],
});

/**
 * @param bout the loaded Normal run (`ampk_francis_soce_on`), either shape.
 * @param anchors `buildCellChainLevel().anchors`.
 * @param instants `instantsOf(bout, ca)`.
 * @param span `responseSpan(bout)` — the ring's full scale; only checked here.
 */
/**
 * @param arrival the instant the visitor came down at (the fibre's clock is
 *   this clock), or null. The opener holds it and the first two spends play in
 *   ITS repetition, so "rep 7 upstairs" is rep 7 here — doc §12. The set beat
 *   and everything after replay from the start, because they are about the
 *   whole set.
 */
export function energyTour(bout, anchors, instants, { span, arrival = null } = {}) {
  const at = anchorsOf(anchors);
  const grid = gridOf(bout);
  const inst = grid && instantsIn(instants, grid);
  if (!at || !grid || !inst || !(span > 0)) return [];

  const { t0, tEnd } = grid;
  const here = Number.isFinite(arrival) ? Math.min(Math.max(arrival, t0), tEnd) : t0;
  /* The burst of the arrival rep, if that rep has one; the run's first burst
     otherwise (a visitor who came down in the rest phase watches rep 1). */
  const burst = (Array.isArray(inst.onsets) ? inst.onsets[repAt(here, t0).rep] : null) ?? inst.onset;
  const { pair, side, wide, pairAmpk, sensorSide } = shotsOf(at);
  const setEnd = Math.min(tEnd, t0 + REPS * REP_SECONDS);
  const midSet = (t0 + setEnd) / 2;

  /* The sensor beat's window is derived from its own dwell — see the header. */
  const sensorLine =
    "**AMPK** is the sensor that reads that flag. So you might expect the rising AMP to explain most of the response.";
  const sensorSpeed = 0.5;
  const sensorMs = dwell(sensorLine);
  const sensorFrom = Math.max(t0, inst.ampMax - sensorSpeed * (sensorMs / 1000));

  return [
    /* Arrival: the ATP pool, held at the run's first sample — the visitor has
       just followed a token down from the fibre and the picture answers where
       it went before anything happens to it. */
    /* WIDE, NOT THE CLOSE-UP: the doc's arrival is the whole cytosol, and the
       cut to the ATP pool on the next beat is the "camera left" §14 asks for.
       Two beats on one frozen close-up read as a stuck picture (audit r2). */
    beat(at, {
      ...wide,
      seek: here,
      speed: 0,
      focus: "atp",
      /* AN ANSWER, NOT AN ECHO. The fibre leaves on "Every one of those pulls
         spent ATP. Follow that energy." and this beat used to say the same
         sentence eleven seconds later, on the other side of the door — an
         invitation repeated to somebody who has already accepted it (the
         orchestrator's read of the whole journey, 2026-09-05). The arrival
         line now says they arrived, and what this room is. */
      line: "This is the cell. It **pays for every contraction**.",
    }),
    /* Same shot, now playing from the first spend, slowly enough that a bead
       leaving a token is an event rather than a count. */
    /* THE PAIR, NOT THE CLOSE-UP — the products have to stay in frame. In the
       close shot the detached bead flew to a Pi cloud below the bottom edge and
       the converted token sank into an ADP pool that was also out of frame, so
       "each pull spends some" showed things leaving rather than becoming. */
    beat(at, {
      ...pair("atp", "adp"),
      seek: burst,
      speed: 0.25,
      focus: "atp",
      line: "**ATP** is the fuel used directly by contraction. Each one spends some.",
    }),
    /* Out to the pair, so a recharge is a short flight between two things on
       screen at once. */
    beat(at, {
      ...pair("atp", "pcr"),
      seek: burst,
      speed: 0.5,
      focus: "pcr",
      line: "But the cell has a fast backup. **PCr** can recharge ADP back into ATP.",
    }),
    /* The whole energy side at 1× through the whole set: the reserve thins
       while the ATP pool barely changes size. The beat is as long as the set,
       because that comparison IS the set. */
    beat(at, {
      ...side("atp", "pcr", "adp", "amp"),
      seek: t0,
      speed: 1.5, /* 1 until 2026-09-07 — owner: the opening ran long */
      focus: "pcr",
      line: "So during the set, **the reserve (PCr) drains faster** than ATP does.",
      wallMs: ((setEnd - t0) / 1.5) * 1000,
    }),
    /* Down to what accumulates, from the middle of the set where ADP has
       grown and AMP has started to. */
    beat(at, {
      ...pair("adp", "amp"),
      seek: midSet,
      speed: 0.5,
      focus: "amp",
      line: "Not every spent molecule gets rebuilt immediately. ADP rises, and a small amount becomes **AMP**.",
    }),
    /* WHAT AMP DOES — 2026-09-07, owner (pace 2, C1): *"what does AMP do?"*. Same shot. */
    beat(at, {
      ...pair("adp", "amp"),
      ms: dwell(AMP_LINE),
      holds: true,
      speed: 0,
      focus: "amp",
      line: AMP_LINE,
    }),
    /* The sensor, over the stretch that ends on AMP's peak — the ring climbing
       while AMP climbs is exactly the coincidence the sentence invites the
       visitor to read as cause. Nothing drawn is false; the test corrects it. */
    /* AMP AND THE SENSOR IN ONE FRAME: the line invites the visitor to read
       the rising AMP as the cause, so the AMP pool must be on screen while the
       ring climbs — the close-up held only the trimer (audit r2). */
    beat(at, {
      ...pairAmpk(),
      ms: sensorMs,
      seek: sensorFrom,
      speed: sensorSpeed,
      focus: "ampk",
      line: sensorLine,
    }),
    /* WHY THIS MATTERS FOR EXERCISE — 2026-09-07, owner (cell C2): *"이게 왜 운동이랑
       relevant한건지 모르겠어"*. Two short beats on the same shot rather than one
       long line (owner: *"문장이 너무 길어지면 안돼 … 두개의 메시지"*). Textbook
       mechanism, no number: AMPK on -> glucose uptake, fat oxidation, PGC-1α. */
    /* No `seek` on a held shot: a seek resets the room (beads and packets in
       flight vanish mid-shot — verifier, 2026-09-07); the clock simply stops. */
    beat(at, {
      ...pairAmpk(),
      ms: dwell(NOTICE_LINE),
      holds: true,
      speed: 0,
      focus: "ampk",
      line: NOTICE_LINE,
    }),
    beat(at, {
      ...pairAmpk(),
      ms: dwell(BUILD_LINE),
      holds: true,
      speed: 0,
      focus: "ampk",
      line: BUILD_LINE,
    }),
    /* Widen to the right and replay from t0: the first rep's pulse enters,
       the hinge opens, packets travel to AMPK, the ring starts. Long enough for
       rep 1's calcium peak to arrive at this speed. */
    beat(at, {
      ...sensorSide(),
      seek: t0,
      speed: 0.25,
      focus: "camkk2",
      /* A SECOND SWITCH — 2026-09-07, owner (pace 2, C3): *"다른 방식으로도 켜질 수 있다랑
         calcium이랑 CaMKK2 설명을 좀 잘해야될 듯"*. First the switch, then what it means. */
      line: "**A SECOND SWITCH** — AMPK can also be turned on before fuel runs low: the calcium signal of each contraction switches on **CaMKK2**.",
      wallMs: ((inst.caPeakRep1 - t0) / 0.25) * 1000,
    }),
    beat(at, {
      ...sensorSide(),
      ms: dwell(CAMKK2_LINE),
      holds: true,
      speed: 0,
      focus: "camkk2",
      line: CAMKK2_LINE,
    }),
    /* Wide, both inputs and the sensor in one frame, the run at 1×. The pass
       ends here and the page shows the controls.
       THIS IS THE FLOOR'S "HOW IT ALL WORKS TOGETHER" — the owner's state 3.
       The pass has no separate whole-run tail: the set beat above already ran
       the energy side end to end, and here the WHOLE picture runs at 1× with
       both inputs and the sensor in frame while the invitation stands; the
       visitor's test then replays the whole run with one path cut, which is
       the strongest together-beat this floor has and belongs to them, not to
       the storyboard. `part: TOGETHER` says so to `stepsOf`; `focus` stays on
       the path the invitation names. */
    beat(at, {
      ...wide,
      seek: t0,
      speed: 1,
      focus: "camkk2",
      part: TOGETHER,
      line: "Test it yourself. Turn off **the calcium path**.",
    }),
  ];
}

/**
 * What the guide says after the visitor switches to "Calcium path off". The
 * page has swapped the loaded bout for the knockout and re-seeded to t0.
 *
 * @param calciumShare the page's share of the Normal response that the
 *   knockout removes (0..1); `> 0.5` picks the calcium sentence.
 */
export function energyResult(bout, anchors, instants, { calciumShare } = {}) {
  const at = anchorsOf(anchors);
  const grid = gridOf(bout);
  const inst = grid && instantsIn(instants, grid);
  if (!at || !grid || !inst || !Number.isFinite(calciumShare)) return [];

  const { t0 } = grid;
  const { wide, closeAmpk } = shotsOf(at);
  const replaySpeed = 5; /* 2 until 2026-09-07 — owner: the lines after the toggle came too late (6.9 s of silent replay; ~2.8 s now) */
  const calcium = calciumShare > 0.5;

  return [
    /* The replay, silent, wide, at 2×, all the way to `still` so the verdict
       is spoken on the frame the replay arrives at rather than after a cut.
       The energy side does everything it did; the ring barely moves. */
    beat(at, {
      ...wide,
      seek: t0,
      speed: replaySpeed,
      focus: "ampk",
      wallMs: ((inst.still - t0) / replaySpeed) * 1000,
    }),
    /* Held on the last archived sample before the end — `runLoop.js` holds and
       cuts at tEnd, and a conclusion parked on tEnd turns into the start of
       the run a moment after it is read. */
    beat(at, {
      ...wide,
      seek: inst.still,
      speed: 0,
      focus: "ampk",
      line: "The energy changes are still there. The AMPK response **mostly disappears**.",
    }),
    /* The verdict, on the side that earned it. */
    /* WIDE, LEANING TOWARD THE ARM THAT EARNED IT: a conclusion compares the
       two arms, so both stay on screen (doc §14) — and a beat has to move
       something, so the wide shot slides a third of a unit toward the verdict's
       side rather than standing on the previous beat's frame. Camera and target
       slide TOGETHER, so the angle stays `ENERGY_VIEW_DIR`'s (rule 4). */
    beat(at, {
      camera: [ENERGY_CAMERA[0] + (calcium ? 0.35 : -0.35), ENERGY_CAMERA[1], ENERGY_CAMERA[2]],
      lookAt: [calcium ? 0.35 : -0.35, 0, 0],
      seek: inst.still,
      speed: 0,
      focus: calcium ? "ca" : "amp",
      line: calcium
        ? "**WHAT DRIVES IT** — In this run, calcium is doing most of the pushing."
        : "**WHAT DRIVES IT** — In this run, the energy state is doing most of the pushing.",
    }),
    /* AND WHY THAT MATTERS — 2026-09-07, owner (cell C5): *"전체적으로 이게 왜 중요한데?"*.
       Same shot, two short beats. */
    beat(at, {
      holds: true,
      camera: [ENERGY_CAMERA[0] + (calcium ? 0.35 : -0.35), ENERGY_CAMERA[1], ENERGY_CAMERA[2]],
      lookAt: [calcium ? 0.35 : -0.35, 0, 0],
      seek: inst.still,
      speed: 0,
      focus: calcium ? "ca" : "amp",
      line: calcium
        ? "Without the calcium path, the cell would only notice hard work **once it ran low on fuel**."
        : "With the calcium path off, only **running low on fuel** is left to notice hard work.",
    }),
    beat(at, {
      holds: true,
      camera: [ENERGY_CAMERA[0] + (calcium ? 0.35 : -0.35), ENERGY_CAMERA[1], ENERGY_CAMERA[2]],
      lookAt: [calcium ? 0.35 : -0.35, 0, 0],
      seek: inst.still,
      speed: 0,
      focus: calcium ? "ca" : "amp",
      line: calcium
        ? "With it, **every contraction itself is the message** — the signal to adapt arrives with the movement, not after it."
        : "The message that came **with each contraction** is gone — what is left is the energy state.",
    }),
    /* And the hand-off to SIGNALLING: close on the one sensor, before the page
       pulls back to show it as one node among many. */
    beat(at, {
      ...closeAmpk(),
      seek: inst.still,
      speed: 0,
      focus: "ampk",
      line: "AMPK is only one signal inside the cell. What happens when we look at **the whole network**?",
    }),
  ];
}

/* Root tests (`tourGrammar.test.js`, `tourPace.test.js`) import this name and
   call it `cellTour(bout, anchors)` against `cellGeometry.js`'s anchors: no
   instants, foreign ids — the guard returns `[]`. */
export const cellTour = energyTour;
