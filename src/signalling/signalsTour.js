import { layoutOf } from "./heroGeometry.js";
import { HERO_NODES } from "./heroNetwork.js";
import { SIGNALLING_CAMERA, STANDING, restFor } from "./signallingGeometry.js";

/**
 * The SIGNALS pass — eleven beats, about thirty seconds, and every one of them
 * moves something.
 *
 * ── WHY THIS FILE REPLACES TWO OTHERS ───────────────────────────────────────
 *
 * `signallingTour.js` narrated a census picture of five compartment shelves that
 * this scale stopped drawing on 2026-08-31; `SignallingScale.jsx` stands it down
 * with `const beats = useMemo(() => [], [])` and says so. `heroWalk.js` then
 * filled the silence with twenty press-shaped beats and no camera, no seek and
 * nothing touched in the run — deliberately, because the pass it replaced had
 * been screenshotted doing visible damage.
 *
 * The SIGNALS brief refuses both ends of that. Its rule 9 is that *"every guided
 * beat must cause a clock seek, signal movement, focus change, camera move,
 * comparison reveal, output state, or equivalent visible action"*, rule 10 is
 * *"no speech-only network lecture"*, and rule 11 is that the whole thing stay
 * synchronised with the run. A walk that moves nothing fails all three. So the
 * camera and the clock come back, and what made the old pass dangerous does not:
 * it is not a queue of demonstrations played at a viewer, it is one continuous
 * run of the experiment with a sentence over each stretch of it.
 *
 * ── HOW SYNCHRONISATION IS GUARANTEED RATHER THAN TUNED ─────────────────────
 *
 * The old pass set a SPEED per beat and hoped the run and the words ended
 * together. They did not: `docs/20260905-fix/signaling.md` measured the result —
 * *"narration runs for roughly two minutes while the underlying 45-second replay
 * can loop several times, so the words and animation fall out of sync"*.
 *
 * Every beat here carries `at` instead: the fraction of the run the clock should
 * have REACHED when the beat ends. The scene eases the clock from the previous
 * beat's `at` to this one's over the beat's own duration. Sync is then a property
 * of the data rather than of the frame rate — a slow machine draws fewer frames
 * of the same interval, and the last beat lands on the last sample on every
 * machine. `at` never decreases, so the run cannot loop underneath the words.
 *
 * ── WHERE THE BEATS LAND, AND THEY ARE MEASURED ─────────────────────────────
 *
 * Read off the two shipped archives (44.9 min, 64 samples), first sample to
 * last, with the time each series passes the midpoint of its own travel:
 *
 *              resistance            endurance
 *   integrin   0 -> 1.000  at 0.2m   flat at 0
 *   B_AR       flat at 0             0 -> 0.989  at 7.0m
 *   ROS        flat at 0             0 -> 0.989  at 7.0m
 *   RhoA       0.434 -> 0.958 8.0m   0.434 -> 0.822  7.0m
 *   JNK        0.510 -> 0.968 9.0m   0.510 -> 0.935  15.0m
 *   AMPK       0.079 -> 0.067 35.0m  0.079 -> 0.180  34.0m
 *   PGC_1a     0.711 -> 0.894 23.0m  0.711 -> 0.893  25.0m
 *   Mito_Bio   0.357 -> 0.387 32.0m  0.357 -> 0.385  33.0m
 *
 * So the doors beat runs 0 to 6 minutes because that is the window in which the
 * two doors genuinely behave differently — integrin snaps open inside twelve
 * seconds and the endurance pair are 0.45 of the way up by 6 (half-way at 7).
 * The convergence beat runs 8 to 18 minutes because that is where JNK climbs
 * under BOTH arms — half-way at 9 under lifting and 15 under running (pass 3;
 * it was 14 to 20, which missed lifting's climb altogether). The AMPK beat
 * runs to 36 because AMPK's own separation is not finished before 35. Nothing
 * here is a round number chosen for the storyboard; each is the interval during
 * which the sentence over it is true.
 *
 * ── AND ONE THING THE PASS MAY NOT DO ───────────────────────────────────────
 *
 * It may not hide an arm. `show` is `"both"` on every beat and the field exists
 * only so a beat CANNOT quietly become single-armed without saying so in the
 * data — the brief's rule 1 is the floor's whole premise. The viewer's own
 * exercise decides the wording of one clause and nothing else (brief §18: *"your
 * selected exercise belongs to this side of the comparison"*, not *"this is a
 * bench-press-specific molecular simulation"*).
 */

/* `at` is built per call now — see `signalsTour`: the layout is the stage's. */

/* THE STANDING FRAME, and every beat is a departure from it that comes back.
   Copied rather than imported from `signallingGeometry.js` because that file's
   `SIGNALLING_CAMERA` belongs to the census scene it was measured for; this is
   the hero drawing's own, and tying them would make one scale's framing a
   constraint on the other's. */
/* ONE FRAMING, IMPORTED — it was a second copy of the same triple, and two
   copies of a camera drift apart the first time one is re-fitted. The floor's
   standing shot is `signallingGeometry.SIGNALLING_CAMERA`; this is that. */
export const SIGNALS_CAMERA = SIGNALLING_CAMERA;
/* THE WIDE SHOT IS THE FLOOR'S RESTING SHOT, exactly — `STANDING`, camera and
   aim both — so the pass opens from and closes onto the frame the viewer is
   handed, with no ease between. Tonight's rule. */

/**
 * A camera stop, placed as a DISTANCE from what it is looking at.
 *
 * WHY NOT TYPED TRIPLES, WHICH IS WHAT THE FIRST CUT USED. Eleven positions
 * written by eye against the node coordinates, then photographed at 1280x800:
 * the pass stood about 1.6 units out on beats framed for about 3, and the doors
 * beat came back with two forms filling the frame and the network gone. The
 * mistake is structural rather than arithmetic — a triple says where the camera
 * IS, and what a framing is actually about is how far it stands from its
 * subject, so every stop had to be re-derived by hand against a standing frame
 * that none of them referenced.
 *
 * `SIGNALS_CAMERA` is 4.20 from the origin. This places every other stop along
 * the same view direction at a stated FRACTION of that, so "closer" is one
 * number in the storyboard rather than three that have to be trusted. `swing`
 * turns the approach off that axis where a beat wants a different angle on the
 * same thing — Q4's rule that a camera move has to buy something.
 */
const DIST = Math.hypot(...SIGNALS_CAMERA);
const VIEW = SIGNALS_CAMERA.map((v) => v / DIST);
/*
 * AND THE SECOND THING A SCREENSHOT TAUGHT: MOVE THE LOOKAT LESS THAN YOU THINK.
 *
 * The first cut framed each beat on the ROW it was about — the doors beat looked
 * at y 0.34, the outcome beat at y -0.84 — on the reasoning that a beat should
 * centre its subject. Photographed at 1280x800 that crops the network in half:
 * the drawing spans y -0.95 to 0.65 and the camera's own frame is barely taller
 * than that, so shifting the look point by a third of the drawing pushes a third
 * of it off the glass. On a floor whose subject is a ROUTE from top to bottom,
 * a beat that cannot show both ends of the route has lost the thing it is about.
 *
 * So the look points now stay near the drawing's own centre and the emphasis is
 * carried by distance and by what is MOVING — the streams light the part of the
 * network the sentence is about, which is a stronger pointer than a crop. Only
 * the two genuine close-ups leave the whole picture: `meet` on JNK and `ampk` on
 * AMPK, at about two thirds of the standing distance, where losing the far rows
 * is the point rather than an accident.
 */
const from = (look, dist, swing = 0) => {
  /* THE SWING IS IN THE GROUND PLANE, so a beat can come at its subject from
     more to the left or more to the right and never from under or over it. The
     anchors' contract wants world x mapping to screen x monotonically, and a
     roll or a steep pitch is what would break it. */
  const c = Math.cos(swing);
  const sn = Math.sin(swing);
  const dir = [VIEW[0] * c + VIEW[2] * sn, VIEW[1], VIEW[2] * c - VIEW[0] * sn];
  return [look[0] + dir[0] * dist, look[1] + dir[1] * dist, look[2] + dir[2] * dist];
};

/**
 * How close the arrival beat starts to AMPK.
 *
 * THE BRIEF'S SEAM, AND THIS IS OUR HALF OF IT. *"AMPK is initially the visual
 * anchor, the camera/network reveals outward around it."* The orchestrator owns
 * the transition itself; what this floor owes is a first frame that AMPK fills,
 * so that whatever hands us the viewer, the object they were just looking at is
 * the object they are still looking at. 1.05 away from a form of radius 0.195
 * puts it at roughly a fifth of the frame height — recognisably the same thing,
 * not yet a network.
 */
/* 0.33 UNTIL THE ARRIVAL FRAME WAS PHOTOGRAPHED. At a third of the standing
   distance the camera sits inside the background crowd: `heroGeometry.js`
   spreads those 108 motes from the membrane's leading edge back to the far wall
   deliberately, so that near ones cross the thirteen and the layer reads as
   depth. That is right at the standing distance and wrong at a third of it —
   motes a hand's width from the lens draw as pale balls around the one object
   the beat exists to show. 0.40 keeps AMPK filling the frame and puts the near
   crowd back behind it. */
/* (`AMPK_CLOSE` is built per call — the stage's own AMPK and pull.) */
/** Half-way from the resting aim to the meeting node — where the 6 % push looks. */
/* (`MEET_LOOK` is built per call from the stage's own rest aim — see below.) */

/**
 * @typedef {object} SignalsBeat
 * @property {string} id       stable
 * @property {number} ms       how long it holds
 * @property {?string} line    one sentence, present tense, or null for a beat the picture carries alone
 * @property {number} at       fraction of the run the clock reaches by the END of this beat
 * @property {string} show     always "both" — see the header
 * @property {?string} focus   a `HERO_NODES` id the guide stands beside, or null for the whole picture
 * @property {number[]} camera where the camera sits
 * @property {number[]} lookAt what it points at
 */

/**
 * Build the pass.
 *
 * @param descendedArm `"resistance" | "endurance" | null` — the arm the exercise
 *   upstairs maps to. Chooses ONE clause's wording. Never hides anything.
 * @returns {SignalsBeat[]}
 */
/**
 * @param descendedArm which side the pass calls "yours", or null
 * @param opts.pull   how far the floor's resting shot is pulled back on a narrow
 *                    window — `signallingGeometry.pullFor` (CONTRACT_FLOOR /
 *                    aspect below the floor, else 1). The two wide beats take it so
 *                    the pass opens from and closes onto the frame the viewer is
 *                    actually handed; measured 2026-09-06 at 390x844, without it
 *                    the pass ended at the desktop distance and the outer nodes
 *                    sat cut at the window's edges.
 */
/* TWELVE BEATS -> NINE ON 2026-09-07 — owner, SIGNALS 23: *"왜 55초야 간소화할 수 있지
   않아? 결국 하는 액션이 비슷하던데"*, and the rule under it: *"각 층에서 하는건 각
   층에서 일어나는 일을 보여주는거지 위에 층이랑은 상관이 없는거야 … timeline이나 rep
   count이런건"*. Gone: `clock` ("Upstairs, single repetitions…" — the floor
   above), `send` (folded into `doors`), `compare` (folded into `land`, which
   keeps the ending's arcs). */
export function signalsTour(descendedArm = null, { pull = 1, narrow = false } = {}) {
  /* THE STAGE'S OWN LAYOUT AND REST — pass 4: a phone lays the network out
     narrow and tall and aims a little higher, so the nodes the beats look at
     and the frame the pass hands back are THAT stage's. */
  const REST = restFor(narrow);
  const WIDE_CAMERA = [REST.camera[0], REST.camera[1], REST.camera[2] * pull];
  const WIDE_AIM = REST.lookAt;
  const L = layoutOf(narrow);
  const at = new Map(HERO_NODES.map((n) => [n.id, L.at(n)]));
  /* THE TYPED LOOK POINTS AND DISTANCES ARE THE DESKTOP'S. On a narrow stage
     the grid is half as wide and a quarter taller and the rest stands `pull`
     further back, so a look point scales with the grid and a stop's distance
     with the pull — otherwise (reviewed) the doors beat cut integrin at ndc
     −1.05 and the down beat cut both inputs on a phone. Desktop: 1, 1, 1. */
  const wide = layoutOf(false);
  const sx = L.colHalf / wide.colHalf;
  const sy = L.rowGap / wide.rowGap;
  const look = ([x, y, z]) => [x * sx, y * sy, z];
  const stop = (p, f, swing = 0) => from(p, DIST * pull * f, swing);
  const AMPK_CLOSE = from(at.get("AMPK"), DIST * pull * 0.40, -0.22);
  const MEET_LOOK = WIDE_AIM.map((v, i) => v + (at.get("JNK")[i] - v) * 0.5);
  /* WHICH SIDE OF THE COMPARISON THE VISITOR'S OWN EXERCISE IS ON, and that is
     the whole of what their choice buys on this floor. Brief §18: *"your
     selected exercise belongs to this side of the comparison"*, explicitly not
     *"this is a bench-press-specific molecular simulation"*. Naming the tint
     rather than the exercise is what keeps it on the right side of that line —
     it points at a colour already on screen instead of promising a run the
     archive does not hold. */
  const yourTint = descendedArm === "endurance" ? "cool" : "warm";
  const yourArm = descendedArm === "endurance" ? "endurance" : "resistance";

  return [
    {
      id: "arrive",
      /* THE ONLY BEAT WITH NO PREDECESSOR, so it holds longest: a viewer arriving
         here has just had the picture change under them and needs a moment to
         recognise what did NOT change. */
      ms: 3200,
      line: "AMPK was **one relay** inside something much larger.",
      at: 0,
      show: "both",
      focus: "AMPK",
      camera: AMPK_CLOSE,
      lookAt: at.get("AMPK"),
    },
    {
      id: "reveal",
      /* A BEAT WITH NO SENTENCE, AND THAT IS THE POINT OF IT.
         The brief's rule 10 forbids a *"speech-only network lecture"*; it does
         not forbid silence, and this is the opposite failure mode. The camera
         eases from AMPK's shoulder out to the standing frame and the whole
         network resolves around the object the viewer was already looking at —
         the brief's §6, *"no cut"*, and the one moment on this floor that is
         worth more without a caption over it.
         IT ALSO PAYS FOR THE PASS. `tourPace.test.js` requires every line's
         reading time inside its own beat at 3.3 words a second, and eleven
         sentences at that rate do not fit in thirty seconds. A wordless beat
         needs no reading time, so the reveal costs 1.4 s instead of 3.4 and the
         sentences that remain each get their full measure. */
      ms: 1400,
      line: null,
      at: 0,
      show: "both",
      focus: null,
      camera: WIDE_CAMERA,
      lookAt: WIDE_AIM,
    },
    {
      id: "blind",
      ms: 3200,
      line: "A cell never sees your exercise. **Only signals**.",
      at: 0,
      show: "both",
      focus: null,
      camera: stop(look([0, 0.10, 0.06]), 0.97, -0.12),
      lookAt: look([0, 0.10, 0.06]),
    },
    {
      id: "doors",
      ms: 3800,
      /* 0 -> 6 min. integrin is fully open by 0.2 min and the endurance pair take
         7. Over this one beat a viewer sees one door snap and two others climb,
         which is the difference happening rather than the difference described —
         and it is why this beat can afford the shortest line on the floor. */
      /* No exercise chosen -> no "yours": the arm would be invented (verifier, 2026-09-07). */
      line: descendedArm ? `Both workouts, one cell — yours is **${yourArm}**, which runs **${yourTint}**.` : "Both workouts, one cell — **resistance** runs warm, **endurance** cool.",
      /* PASS 3: 8 -> 6 min, so the next two beats can open their windows
         earlier — see `meet`. The resistance door is open by 0.2 min; the
         endurance doors are 0.45 of their rise by 6. */
      at: 6 / 44.9,
      show: "both",
      focus: null,
      camera: stop(look([0.04, 0.08, 0.10]), 0.94, -0.16), /* 0.22 / 0.88 until the standing shot was lifted (S1) — Protein_Synthesis then sat on the bottom edge */
      lookAt: look([0.04, 0.08, 0.10]),
    },
    {
      id: "doors-grow",
      holds: true, /* same shot as `doors`: the second of two messages */
      /* WHAT EACH ONE BUILDS — 2026-09-07, owner (signalling S2): *"explain how endurance
         and resistance … grows what"*. Same shot, second message. */
      ms: 5600,
      /* WHAT EACH DOES ON THIS FLOOR — the verifier (2026-09-07) caught the first
         wording, "endurance builds mitochondria; resistance builds muscle": the
         archive's own last samples put both arms at almost the same outcomes, and
         the pass ends on exactly that. So the line names the DOORS this floor
         draws — integrin for the pull, β-AR and ROS for running — not a split the
         picture contradicts. */
      line: "**Resistance** pulls on the cell's frame; **endurance** sends adrenaline and reactive oxygen. Different doors.",
      at: 6 / 44.9,
      show: "both",
      focus: null,
      camera: stop(look([0.04, 0.08, 0.10]), 0.94, -0.16), /* 0.22 / 0.88 until the standing shot was lifted (S1) — Protein_Synthesis then sat on the bottom edge */
      lookAt: look([0.04, 0.08, 0.10]),
    },
    {
      id: "split",
      ms: 2600,
      /* 6 -> 8 min. RhoA is resistance's route and AMPK is endurance's, and they
         are the two ends of the same row — so one framing holds both and the
         split is the picture rather than a claim about it. */
      line: "Then they run down **different sides**.",
      at: 8 / 44.9,
      show: "both",
      focus: null,
      camera: stop(look([0, -0.04, 0.08]), 0.90, 0.18),
      lookAt: look([0, -0.04, 0.08]),
    },
    {
      id: "meet",
      /* THE SIGNATURE — owner, pass 3 §10: *"When resistance and endurance reach
         a shared relay: warm pulse ────●→, cool pulse ←●────, they arrive, the
         node reacts, then the outgoing signal leaves. Camera may push in 5 to
         8 % — not a big cinematic move. That should be the visual signature of
         SIGNALS."* So this beat runs the clock across the window in which JNK
         is actually climbing under BOTH arms — the archive puts it half-way up
         at about 9 min under lifting and 15 under running, so 8 -> 18 min —
         holds a little longer than the beats around it, and pushes the camera
         6 % toward a point half-way between the picture's centre and JNK
         rather than cutting to a close-up. `signalsTour.test.js` holds the push
         to 5–8 % and the window to both arms' half-way marks. */
      ms: 3400,
      line: "**ROUTES CONVERGE** — But the routes meet again, here.",
      at: 18 / 44.9,
      show: "both",
      focus: "JNK",
      camera: from(MEET_LOOK, DIST * pull * 0.94, -0.06),
      lookAt: MEET_LOOK,
    },
    {
      id: "ampk",
      ms: 3200,
      /* 20 -> 36 min. AMPK's own separation is not finished before 35, so a beat
         that stopped earlier would put the sentence over an unfinished picture.
         This is the seam back to the floor above, and the brief's rule 5. */
      line: "AMPK again. The one relay they **disagree** about.",
      at: 36 / 44.9,
      show: "both",
      focus: "AMPK",
      camera: from(at.get("AMPK"), DIST * pull * 0.66, 0.24),
      lookAt: at.get("AMPK"),
    },
    {
      id: "down",
      /* THE SECOND WORDLESS BEAT, AND IT IS A TRAVEL RATHER THAN A REVEAL.
         The brief's line here is *"now follow both signals all the way to the
         outputs"*, and a camera that actually travels down the network says it
         without spending 2.8 s of reading time on an instruction to watch. It
         also carries the run from 36 minutes to 43. (Checked against the
         archive 2026-09-06: S6, protein synthesis and cell growth cross their
         half-way marks at 27–30 min and are about three quarters up by 36, so
         this window is the last fifth of their rise, not their main climb —
         the descent passes over them as they finish, which is still the
         moment before the ending the next sentence is about.)
         AN EARLIER CUT LOST THIS BEAT ENTIRELY. Rewriting the array to fit the
         pace rule dropped it silently, and the outcome row went from being
         arrived at to being cut to. Kept wordless because that is what it can
         afford and what it is better as. */
      ms: 2200,
      line: null,
      at: 43 / 44.9,
      show: "both",
      focus: null,
      /* THE TRAVEL KEEPS THE WHOLE ROUTE ON THE GLASS. This stop and `land`
         looked at −0.34 and −0.50 from 0.92 and 0.96 of the distance, and
         photographed 2026-09-06 that put the input chevrons' rings at ndc 1.01
         and 1.16 on desktop, 0.98 and 1.08 on a phone — the route's own
         start cut off under a sentence about routes. Looking a third as far
         down from the full distance keeps every ring under 0.90 on both
         stages and still drops the outcomes to the lower third (their rings
         at about −0.5). `signalsTour.test.js` holds every wide beat inside
         0.95 on both stages. */
      camera: stop(look([0, -0.20, -0.10]), 1.00, -0.08),
      lookAt: look([0, -0.20, -0.10]),
    },
    /* WHAT THE OUTCOMES ARE, AND WHICH ROUTE REACHES THEM — 2026-09-07, owner (signalling
       마지막): *"resistance가 protein synthesis로 가고 endurance가 어디로 가고 어디는 겹치고 …
       outcome에 대한 설명이 부족"*. The archive's own hero edges: Resistance → integrin →
       RhoA → JNK → S6 → Protein_Synthesis / Cell_Growth; Endurance → B_AR (→ AMPK →
       PGC_1a → mitochondria) and → ROS → JNK. Two held messages on the tableau, both arms
       drawn (the floor's rule), then the ending both share. */
    {
      id: "route-lift",
      holds: true,
      ms: 6600,
      /* WHAT IT BECOMES, NOT THE STATIONS — owner, 2026-09-07: *"뭐가 되는지 … this is why
         muscles are built"*, and *"endurance resistance로 설명해"*. The route's endpoints in
         the archive, and the textbook meaning of each outcome (the pick card says the
         same of Protein_Synthesis). */
      line: "**Resistance** ends on the left and the middle — **protein** and **growth**. That is how a muscle gets bigger.",
      at: 0.995, /* a hair short of the end: the ending's arcs belong to `land`, and with them up the guide had nowhere left but the title */
      show: "both", /* both arms stay drawn (the floor's rule); the words name the route */
      focus: null,
      camera: WIDE_CAMERA,
      lookAt: WIDE_AIM,
    },
    {
      id: "route-run",
      holds: true,
      ms: 6400,
      line: "**Endurance** ends on the right — **mitochondria**. That is how a muscle gains stamina.",
      at: 0.995, /* a hair short of the end: the ending's arcs belong to `land`, and with them up the guide had nowhere left but the title */
      show: "both",
      focus: null,
      camera: WIDE_CAMERA,
      lookAt: WIDE_AIM,
    },
    {
      id: "land",
      holds: true, /* the third message on the tableau */
      ms: 5600, /* + the old compare beat's 2900: the ending's arcs land inside this one now */
      /* 36 -> the last sample, and the clock stops on it. `at: 1` rather than a
         value short of it, because the finding is about where the run ENDS and a
         beat parked one sample early would be showing a different claim.
         WHAT THIS SENTENCE MAY NOT SAY. Measured off the archives: protein
         synthesis ends 0.545 against 0.531, mitochondrial biogenesis 0.387
         against 0.385. That is close and it is NOT identical, and the pair of
         bars under each outcome shows the gap at its real size. "Almost the
         same" is the honest phrase; "the same" would be ours, not theirs. */
      line: "Different routes. **Almost the same ending** — compare the route, not just the result.",
      at: 1,
      show: "both",
      focus: null,
      /* THE TABLEAU — owner, fifth brief §6: *"이 shot만큼은 전체 journey를 한
         화면에 보여주는 tableau여야 해. INPUTS → ROUTES → CONVERGENCE / DIFFERENCE
         → OUTCOMES 전부 보여야 함"*, and *"camera 5~8% 정도 더 멀리, target을 조금
         위로"*. 0.96 → 1.03 is 7 % further; the aim comes up from −0.50 to −0.26.
         Measured: the chevron TIPS (not just the rings) sit at ndc 0.87 desktop
         / 0.82 phone, the outcome rings at about −0.49 on both. */
      camera: WIDE_CAMERA, /* the standing frame — where a viewer is left to explore from */
      lookAt: WIDE_AIM,
    },
  ];
}

/**
 * ── THE ORCHESTRATOR'S ENTRY CONTRACT ───────────────────────────────────────
 *
 * The brief: *"the orchestrator will own the seam. Your floor must support an
 * arrival in which AMPK is initially the visual anchor and the camera/network
 * reveals outward around it. Expose whatever entry hook/state is needed, but do
 * not edit ENERGY itself."*
 *
 * THE ANCHOR IS NOT OPTIONAL AND IS NOT A HOOK. Beat 0 of this pass is AMPK at
 * about a third of the standing distance, and beat 1 is the pull-back — so any
 * arrival that plays the pass gets the seam, whether or not the caller knows it
 * exists. That is deliberate: a seam that only works when the floor above
 * remembers to ask for it is a seam that breaks the first time somebody links
 * straight here. `signalsTour.test.js` holds both ends of it.
 *
 * WHAT IS ACTUALLY A HOOK is the one thing this floor cannot decide for itself:
 * whether the viewer should be shown the pass at all. `state.entry` on the route:
 *
 *   undefined | "descend"   play the pass. The default, and what a viewer
 *                           arriving from ENERGY gets — the reveal is the seam.
 *   "cold"                  skip it and hand over the explorer directly. For a
 *                           shared link naming an instant, or a return visit,
 *                           where a 32-second pass is in the way of the thing
 *                           the link was sent to show.
 *
 * NOTHING ELSE IS READ, and adding to this list is a change to the route
 * grammar, which `scaleRoute.js` owns and this lane does not.
 */
export const playsOnArrival = (entry) => entry !== "cold";

/** How long the whole pass runs, in wall milliseconds. */
export const signalsTourMs = (beats) => beats.reduce((s, b) => s + b.ms, 0);
