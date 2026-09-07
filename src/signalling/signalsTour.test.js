import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { readingMs, FRAME_SLIP_MS, WORDS_PER_SECOND } from "../tour.js";
import { HERO_IDS, HERO_NODES } from "./heroNetwork.js";
import { signalsTour, signalsTourMs, SIGNALS_CAMERA } from "./signalsTour.js";

/**
 * The SIGNALS pass's contract, which is mostly the brief's non-negotiables.
 *
 * WHY THESE AND NOT OTHERS. Each case below is a rule that can be broken by a
 * one-line edit while the app still looks correct in a screenshot — which is the
 * only kind of rule worth a gate here. A camera in the wrong place is visible in
 * a single frame and does not need a test; a pass that has quietly gone
 * single-armed, or whose clock walks backwards between two beats, photographs
 * exactly like one that has not.
 */

const ARMS = [null, "resistance", "endurance"];
const FADE_MS = 260; // `.fiber__spent--tour`'s entry animation, fiber.css.

test("both workouts are drawn on every beat, whichever exercise sent the viewer here", () => {
  /* THE FLOOR'S FIRST NON-NEGOTIABLE, and the one the old scene failed. A beat
     may name an arm — the field exists — and none of them may, because a pass
     that isolates one workout is a pass about one workout. */
  for (const arm of ARMS) {
    for (const beat of signalsTour(arm)) {
      assert.equal(beat.show, "both", `beat ${beat.id} under ${arm} draws ${beat.show}`);
      assert.equal(beat.arm, undefined, `beat ${beat.id} pins an arm, which hides the other`);
    }
  }
});

test("the clock only ever moves forward, and it ends on the last sample", () => {
  /* RULE 11 — *"do not let narration run across multiple unsynchronized loops"*.
     `at` is a fraction of the run and the scene eases between consecutive
     values, so a pair that decreases is a run playing backwards under its own
     sentence, and a last beat short of 1 is a conclusion about an ending the
     viewer was never shown. */
  for (const arm of ARMS) {
    const beats = signalsTour(arm);
    let prev = -Infinity;
    for (const beat of beats) {
      assert.ok(
        Number.isFinite(beat.at) && beat.at >= 0 && beat.at <= 1,
        `beat ${beat.id} asks for ${beat.at} of the run`,
      );
      assert.ok(beat.at >= prev, `beat ${beat.id} winds the run back from ${prev} to ${beat.at}`);
      prev = beat.at;
    }
    assert.equal(beats[0].at, 0, "the pass does not start at the start of the run");
    assert.equal(beats.at(-1).at, 1, "the pass ends somewhere short of the last sample");
  }
});

test("every beat does something a viewer can see", () => {
  /* RULE 9, AS A GATE. A beat qualifies by moving the clock, moving the camera,
     or changing what is focused. A beat that only changes the sentence is the
     speech-only lecture rule 10 refuses, and it is the failure mode the walk
     this pass replaced had on all twenty of its beats. */
  for (const arm of ARMS) {
    const beats = signalsTour(arm);
    beats.forEach((beat, i) => {
      const before = beats[i - 1] ?? null;
      const moved =
        !before ||
        beat.at !== before.at ||
        beat.focus !== before.focus ||
        beat.camera.some((v, k) => Math.abs(v - before.camera[k]) > 1e-6) ||
        beat.lookAt.some((v, k) => Math.abs(v - before.lookAt[k]) > 1e-6);
      /* `holds`: a second message on the same shot — owner 2026-09-07: *"그 shot에서 시간을 더 보내고 두개의 메시지를"*. */
      if (beat.holds) return;
      assert.ok(moved, `beat ${beat.id} changes the words and nothing else`);
    });
  }
});

test("every beat that speaks gives its sentence time to be read", () => {
  /* THE SAME RULE `tourPace.test.js` holds the other three scales to, applied
     here so this pass cannot be shortened toward the brief's 30 seconds by
     making a line unreadable. A beat with no line needs no time and is how the
     pass affords eleven sentences in half a minute. */
  for (const arm of ARMS) {
    for (const beat of signalsTour(arm)) {
      if (!beat.line) continue;
      const have = beat.ms - FADE_MS - FRAME_SLIP_MS;
      assert.ok(
        have >= readingMs(beat.line),
        `beat ${beat.id} shows "${beat.line}" for ${(have / 1000).toFixed(2)} s and needs ` +
          `${(readingMs(beat.line) / 1000).toFixed(2)} s at ${WORDS_PER_SECOND} words a second`,
      );
    }
  }
});

test("the pass is short enough to sit through (48 s since 2026-09-07: the outcomes explained)", () => {
  /* THE BRIEF ASKS FOR 25 TO 30 SECONDS and this ships at about 32, which is the
     shortest the pace rule above allows for these eleven sentences. The ceiling
     here is the number that matters: what it forbids is the two-minute drift
     back toward a lecture, which is what the 128.7 s walk this replaced was and
     what every narration on this project has grown into when nothing counted. */
  for (const arm of ARMS) {
    const ms = signalsTourMs(signalsTour(arm));
    assert.ok(ms <= 48_000, `the pass runs ${(ms / 1000).toFixed(1)} s`);
    assert.ok(ms >= 20_000, `the pass runs ${(ms / 1000).toFixed(1)} s, too fast to follow`);
  }
});

test("every beat the pass focuses is a part this scale actually draws", () => {
  /* THE DEFECT THAT STOOD THE OLD PASS DOWN, AS A GATE. `signallingTour.js`
     focused `doors`, `trunk`, `nucleus` and `outputs` — anchors of a census
     picture this scale stopped drawing on 2026-08-31 — and running it against
     the thirteen drove the camera at a band that was not there. Nothing catches
     that except asking the roster. */
  for (const arm of ARMS) {
    for (const beat of signalsTour(arm)) {
      if (beat.focus === null) continue;
      assert.ok(
        HERO_IDS.includes(beat.focus),
        `beat ${beat.id} stands beside ${beat.focus}, which this scene does not draw`,
      );
    }
  }
});

test("the pass begins on AMPK and gives the picture back at the end", () => {
  /* RULE 5 AND THE SEAM. The floor above ends on AMPK, so the first frame here
     has to be AMPK close enough to be recognised as the same object; and the
     last frame has to be the standing view, because a pass that ends in a
     close-up has taken the scene away from the viewer it was about to hand it
     to. */
  for (const arm of ARMS) {
    const beats = signalsTour(arm);
    const first = beats[0];
    assert.equal(first.focus, "AMPK", "the pass does not arrive on AMPK");
    const near = Math.hypot(
      first.camera[0] - first.lookAt[0],
      first.camera[1] - first.lookAt[1],
      first.camera[2] - first.lookAt[2],
    );
    const wide = Math.hypot(...SIGNALS_CAMERA);
    assert.ok(near < wide * 0.45, `the arrival stands ${near.toFixed(2)} out, which is not a close-up`);
    assert.deepEqual(
      [beats.at(-1).camera, beats.at(-1).lookAt],
      [STANDING.camera, STANDING.lookAt],
      "the pass ends somewhere other than the standing frame",
    );
  }
});

test("the viewer's exercise changes a word and never the picture", () => {
  /* BRIEF §18. Arriving from a bench press and arriving from a run must produce
     the same drawing — same beats, same clock, same cameras — and differ only in
     which side the pass calls the viewer's. The moment that stops being true,
     the floor is quietly back to being about one workout. */
  const r = signalsTour("resistance");
  const e = signalsTour("endurance");
  assert.equal(r.length, e.length);
  r.forEach((beat, i) => {
    assert.equal(beat.id, e[i].id);
    assert.equal(beat.at, e[i].at, `beat ${beat.id} runs a different clock for the two arms`);
    assert.deepEqual(beat.camera, e[i].camera, `beat ${beat.id} is framed differently`);
    assert.equal(beat.focus, e[i].focus);
  });
  const differ = r.filter((b, i) => b.line !== e[i].line);
  assert.equal(differ.length, 1, `${differ.length} lines change with the exercise, not 1`);
});

/* ---- the 2026-09-06 brief: a camera for a network ------------------------ */

import { ORBIT_LIMITS, SIGNALLING_CAMERA, STANDING, STANDING_NARROW, NARROW_PULL } from "./signallingGeometry.js";
import * as THREE from "three";
import { buildHeroLevel, layoutOf } from "./heroGeometry.js";

/** Spherical angles of a camera about what it looks at, the way OrbitControls measures them. */
const anglesOf = (camera, lookAt) => {
  const [dx, dy, dz] = camera.map((v, i) => v - lookAt[i]);
  return { azimuth: Math.atan2(dx, dz), polar: Math.atan2(Math.hypot(dx, dz), dy) };
};

test("the standing shot is a faint three-quarter, and the tour's one wide framing is that same shot", () => {
  /* Owner §10: *"기본 3/4 angle 아주 약하게"*. Off the axis, so the three planes
     read as depth, and not far off it, so the topology reads as a diagram. */
  const { azimuth, polar } = anglesOf(SIGNALLING_CAMERA, [0, 0, 0]);
  const deg = (r) => (r * 180) / Math.PI;
  /* > 5 until 2026-09-07 — owner (S1): the 5.5° read as a tilt; "아주 약하게" is 2° now. */
  assert.ok(deg(azimuth) >= 1.5 && deg(azimuth) <= 18, `standing azimuth is ${deg(azimuth).toFixed(1)}°`);
  const elevation = 90 - deg(polar);
  assert.ok(elevation > 3 && elevation <= 12, `standing elevation is ${elevation.toFixed(1)}°`);
  /* One framing, not two copies of a triple that can drift apart: the pass's
     wide shot IS the floor's standing shot. */
  assert.deepEqual(SIGNALS_CAMERA, SIGNALLING_CAMERA, "the pass and the floor stand in different places");
});

test("every framing the pass uses sits inside the orbit the viewer is allowed, so the hand-back never snaps", () => {
  /* Rule from tonight: the tour ends on the angle it left and the resting shot
     is that same picture. `OrbitControls` clamps to these limits the frame it
     is re-enabled, so a beat outside them would be a visible jump at the
     hand-back — the exact moment the two shots are supposed to be one. */
  const inside = (camera, lookAt, what) => {
    const { azimuth, polar } = anglesOf(camera, lookAt);
    assert.ok(
      azimuth >= ORBIT_LIMITS.minAzimuthAngle && azimuth <= ORBIT_LIMITS.maxAzimuthAngle,
      `${what}: azimuth ${azimuth.toFixed(3)} is outside ${ORBIT_LIMITS.minAzimuthAngle.toFixed(3)}..${ORBIT_LIMITS.maxAzimuthAngle.toFixed(3)}`,
    );
    assert.ok(
      polar >= ORBIT_LIMITS.minPolarAngle && polar <= ORBIT_LIMITS.maxPolarAngle,
      `${what}: polar ${polar.toFixed(3)} is outside ${ORBIT_LIMITS.minPolarAngle.toFixed(3)}..${ORBIT_LIMITS.maxPolarAngle.toFixed(3)}`,
    );
  };
  inside(SIGNALLING_CAMERA, [0, 0, 0], "the standing shot");
  inside(STANDING.camera, STANDING.lookAt, "the resting shot");
  for (const arm of ARMS) {
    for (const beat of signalsTour(arm)) inside(beat.camera, beat.lookAt, `beat ${beat.id}`);
  }
  /* And the orbit is a LIMIT: a viewer may turn the network, not walk round
     it. Under a quarter turn either way, and never from above or below. */
  const az = ORBIT_LIMITS.maxAzimuthAngle - ORBIT_LIMITS.minAzimuthAngle;
  const po = ORBIT_LIMITS.maxPolarAngle - ORBIT_LIMITS.minPolarAngle;
  assert.ok(az > 0.4 && az <= Math.PI / 2, `azimuth range ${az.toFixed(3)} rad`);
  assert.ok(po > 0.3 && po <= Math.PI / 2, `polar range ${po.toFixed(3)} rad`);
  assert.ok(ORBIT_LIMITS.minPolarAngle > 0.6 && ORBIT_LIMITS.maxPolarAngle < Math.PI - 0.6, "the viewer can get over or under the network");
});

test("on a narrow window the pass opens and closes on the pulled-back resting shot", () => {
  /* `standing` in SignallingScale.jsx steps the camera back by 0.99/aspect on a
     phone; a pass that ended at the desktop distance handed the viewer a frame
     with the outer nodes cut (measured 2026-09-06 at 390x844). The wide beats
     take the same pull; nothing else in the pass moves. */
  const flat = signalsTour("resistance");
  const pulled = signalsTour("resistance", { pull: 2 });
  assert.deepEqual(pulled.at(-1).camera, [STANDING.camera[0], STANDING.camera[1], STANDING.camera[2] * 2]);
  assert.deepEqual(pulled.at(-1).lookAt, STANDING.lookAt);
  /* Pass 4: the close-up scales with the pull too — on a narrow stage the rest
     stands further back and the AMPK stop keeps its share of that distance. */
  const near = (b) => Math.hypot(...b.camera.map((v, i) => v - b.lookAt[i]));
  assert.ok(Math.abs(near(pulled[0]) / near(flat[0]) - 2) < 1e-9, "the arrival close-up does not scale with the pull");
});

import { readFile } from "node:fs/promises";
import { SCENARIOS } from "./signallingBinding.js";

test("the convergence beat is the signature: a 5–8 % push toward the meeting node, over the window where both routes actually arrive", async () => {
  /* Owner, pass 3 §10: *"When resistance and endurance reach a shared relay …
     they arrive, the node reacts, then the outgoing signal leaves. Camera may
     push in 5 to 8 % — not a big cinematic move."* The relay is JNK
     (`heroNetwork.js`). The push is measured against the resting distance; the
     window is measured against the archive: the beat's clock span has to
     contain the instant JNK is half-way up under BOTH arms, or the viewer is
     shown the meeting before or after it happens. */
  const archive = async (id) => JSON.parse(await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"));
  const midMinute = (file) => { const v = file.series.JNK; const lo = v[0]; const hi = Math.max(...v); const i = v.findIndex((x) => x >= lo + (hi - lo) / 2); return file.series.t[i]; };
  const [res, end] = await Promise.all([archive(SCENARIOS.resistance), archive(SCENARIOS.endurance)]);
  const tEnd = res.series.t.at(-1);
  const wide = Math.hypot(...STANDING.camera.map((v, i) => v - STANDING.lookAt[i]));
  for (const arm of ARMS) {
    const beats = signalsTour(arm);
    const k = beats.findIndex((b) => b.focus === "JNK");
    assert.ok(k > 0, "no beat is focused on the meeting node");
    const meet = beats[k];
    const before = beats[k - 1];
    const dist = Math.hypot(...meet.camera.map((v, i) => v - meet.lookAt[i]));
    assert.ok(dist >= wide * 0.90 && dist <= wide * 0.96, `the meet beat stands at ${(dist / wide).toFixed(3)} of the resting distance; the owner asked for a 5–8 % push`);
    for (const [name, file] of [["resistance", res], ["endurance", end]]) {
      const mid = midMinute(file) / tEnd;
      assert.ok(before.at < mid && meet.at >= mid, `under ${name} JNK is half-way up at ${(mid * tEnd).toFixed(1)} min, outside the meet beat's window ${(before.at * tEnd).toFixed(1)}–${(meet.at * tEnd).toFixed(1)} min`);
    }
  }
});

test("on a phone the pass plays on the narrow grid: it looks at that grid's AMPK, hands back the phone's own rest — and every wide beat keeps every node in frame on both stages", () => {
  /* Pass 4 P0 §11 reaches the tour too — reviewed: with desktop look points and
     distances on the narrow grid, the doors beat cut integrin at ndc −1.05 and
     the down beat cut both inputs at 390x844. */
  const beats = signalsTour("resistance", { pull: NARROW_PULL, narrow: true });
  const L = layoutOf(true);
  assert.deepEqual(beats[0].lookAt, L.at(HERO_NODES.find((n) => n.id === "AMPK")), "the arrival does not look at the narrow grid's AMPK");
  assert.deepEqual(beats.at(-1).camera, [STANDING_NARROW.camera[0], STANDING_NARROW.camera[1], STANDING_NARROW.camera[2] * NARROW_PULL]);
  assert.deepEqual(beats.at(-1).lookAt, STANDING_NARROW.lookAt);
  /* EVERY WIDE BEAT KEEPS EVERY NODE IN FRAME, WITH A MARGIN, ON BOTH STAGES.
     The two outcome beats used to be excused ("the inputs leave the top by
     design"); photographed 2026-09-06 that was the input chevrons cut at the
     top edge — ring at ndc 1.16 on desktop, 1.08 on the phone — under a
     sentence about ROUTES. Close-ups (a focus) crop by design and are skipped. */
  const MARGIN = 0.95;
  for (const [label, narrow, pull, w, h] of [["phone", true, NARROW_PULL, 390, 844], ["desktop", false, 1, 1280, 800]]) {
    const staged = signalsTour("resistance", { pull, narrow });
    const model = buildHeroLevel({ types: {}, names: {} }, null, [], { narrow });
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 100);
    for (const beat of staged) {
      if (beat.focus !== null) continue;
      camera.position.set(...beat.camera);
      camera.lookAt(...beat.lookAt);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      for (const a of model.anchors) {
        const ndc = new THREE.Vector3(...a.ringAt).project(camera);
        assert.ok(Math.abs(ndc.x) <= MARGIN && Math.abs(ndc.y) <= MARGIN, `beat ${beat.id} puts ${a.id} at (${ndc.x.toFixed(2)}, ${ndc.y.toFixed(2)}) on the ${label}`);
      }
    }
    model.dispose();
  }
});

/**
 * AND THE TWO WORDLESS BEATS ARE ACTUALLY WORDLESS.
 *
 * Owner, 2026-09-06: *"현재 reveal과 down은 의도적으로 무언인데 직전 말풍선이
 * 그대로 남아 있어 … 그러면 visitor에게는 silent beat가 아니라 이전 문장을
 * 읽으면서 카메라가 계속 움직이는 beat가 돼"*.
 *
 * THREE THINGS HELD THE SENTENCE UP AND ALL THREE HAD A REASON.
 *   1. `onTourLine` swallowed `null` — canon D2ⓐ, a sentence a viewer EARNED by
 *      pressing must outlive the demonstration that produced it. True for a
 *      press, wrong for a beat.
 *   2. `guideLine` fell through to the opener, which is usually the sentence
 *      beat 0 just said. `useOpenerStanding` alone cannot help: the reveal lands
 *      INSIDE the opener's own reading time.
 *   3. `Guide` fell back to its resting prompt, which is the right answer when a
 *      pass has ended and the wrong one while it is running.
 *
 * Measured after, 1280x800: hushed 5.0-6.3 s and 26.8-29.1 s, which is the
 * 1.4 s and 2.2 s this storyboard buys for the camera. This gate is on the
 * source because the failure was three files agreeing.
 */
test("a wordless beat clears the sentence instead of leaving the last one up", () => {
  const src = readFileSync(new URL("./SignallingScale.jsx", import.meta.url), "utf8");
  assert.match(
    src,
    /if \(line !== null\) \{[\s\S]{0,200}\} else if \(stage === "tour"\) \{[\s\S]{0,120}setTourLine\(null\)/,
    "SignallingScale swallows a beat's null again — the silent beats keep the previous sentence",
  );
  assert.match(
    src,
    /const opener = openerUp && !spoke \? openerSaid : null;/,
    "the opening sentence is standing past the beat that speaks again",
  );
  const guide = readFileSync(new URL("../guide/Guide.jsx", import.meta.url), "utf8");
  assert.match(
    guide,
    /const said = hush \? null : line \?\? \(passing \? null : resting\);/,
    "the guide falls back to its resting prompt during a running pass again",
  );
  const silent = signalsTour("resistance", { pull: 1, narrow: false }).filter((b) => b.line == null);
  assert.equal(silent.length, 2, "the storyboard no longer has exactly two wordless beats");
});

/**
 * THE ARRIVAL IS THREE STAGES, AND THE FIRST TWO ARE BARE.
 *
 * Owner, 2026-09-06: *"1. 한번 쭉 보여주고 (main) 이 때는 toggle이고 뭐고 없어 그냥
 * left header + right pause skip / 2. 그다음 guided tour / 3. now main again with
 * all the toggles"*. Asked how long the first should be: *"너무 길어 signalling
 * timeline없애고 훨씬 빨리 하게 해"*. Asked what Skip does in it: *"tour건너 뛰고 그
 * 단계의 마지막 main으로 가는거야"*.
 *
 * Measured 1280x800 after (at 12 s; the owner then said five): 0.1–12.2 s Skip
 * only, no chips, no axis, no bubble; 12.2 s the pass; 45.2 s the chips return. Skip at 2.5 s lands in stage three
 * at once and the pass does not start behind it 14 s later.
 */
test("the plain lap is a lap, bare, and its Skip lands in the stage with the toggles", () => {
  const page = readFileSync(new URL("./SignallingScale.jsx", import.meta.url), "utf8");
  assert.match(page, /const INTRO_S = 5;/, "the opening lap's length is no longer named");
  assert.match(
    page,
    /beats\.length \? INTRO_S \* 1000 : SILENT_MS/,
    "the opening lap no longer lasts INTRO_S when there is a pass to follow it",
  );
  assert.match(
    page,
    /stage === "silent" \? runSeconds \/ RUN_SECONDS_PER_SECOND \/ INTRO_S : 1/,
    "the opening lap no longer runs at its own rate — either the pass got re-timed or the lap is 44.9 s again",
  );
  assert.match(page, /arms && stage === "main" && \(/, "the arm chips are drawn before the picture is the visitor's");
  assert.doesNotMatch(page, /data-testid="signalling-time"/, "the 0-45 minute axis is back");
  assert.match(page, /holdTour\(\{ id: "intro", skip: \(\) => setSkipIntro/, "Skip during the opening lap no longer exists");
  assert.match(page, /if \(skipIntro\) setStage\("main"\);/, "Skip during the opening lap no longer lands in main");
});
