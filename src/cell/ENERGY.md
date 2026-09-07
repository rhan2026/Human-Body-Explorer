# ENERGY floor — build contract (2026-09-05)

The former CELL floor becomes **ENERGY**. Design intent, verbatim from the
owner: `docs/20260905-fix/cell.md` (read it first; this file only pins the
seams between modules so they can be built in parallel).

**Worktree for every edit (2026-09-06):** `/Users/seanpark/Documents/Tutoring/Kids/motion-within/.claude/worktrees/energy/human-performance-explorer`
(branch `wt/energy`). Edit **only** `src/cell/*`. The main checkout at
`/Users/seanpark/Documents/Tutoring/Kids/motion-within/human-performance-explorer` is a
different tree — never touch it. Never open a browser, never run playwright,
never run a test suite. Allowed: `node --test src/cell/<one file>`, `node -e`,
`npx vite build` (once, at the end, if you are the integrator).

Internal file/folder names stay `src/cell/*` (orchestrator's rule). Only what a
visitor reads says ENERGY / "Cellular Energy".

## One-paragraph role

ENERGY = TEST. "What is being spent, how is ATP buffered, and what actually
pushes AMPK in this scenario?" A living resource economy — pools, particles,
transfers, a depleting reserve, accumulation, one sensor with a response ring,
and a user-controlled intervention (turn the calcium path off). It must NOT look
like a node-link diagram (that is SIGNALS' language).

## The data, measured from the shipped JSON (`public/scenarios/*.json`)

Four runs on one 13 s clock, 501 samples, ids in `cellChain.js` `CHAIN_RUNS`:

| run | pAMPK_fraction | ATP mM | PCr mM | ADP mM | AMP mM |
|---|---|---|---|---|---|
| `ampk_francis_soce_on` (Normal) | 0.8910 → 0.9984 | 7.557 → min 6.025 | 1.271 → min 0.534 | 1.268 → max 2.458 | 0.096 → max 0.444 |
| `ampk_francis_soce_on_camkk2_ko` (Calcium path off) | 0.8910 → **0.8934** | identical | identical | identical | identical |
| `ampk_francis_rest_control` | 0.8910 → 0.9984 | demand flat | | | |

- `CaMKK_active_fraction` 0 → 0.9996 in BOTH Normal and KO: the authors' KO
  zeroes the coupling constant kCaMKK, so CaMKK2 still binds calcium; what is
  cut is its route INTO AMPK. Draw it that way: CaMKK2 responds in both
  conditions; the CaMKK2→AMPK signal travels only when coupled.
- The energy route moves AMPK by 0.0000 (rest control == Normal). The
  visitor's expectation ("AMP explains it") is theirs; nothing drawn is false.
- Calcium comes from the FIBER's own archive `public/scenarios/soce_on.json`:
  `Ca_myo_total` (µM) 0.10 → peaks 29.4, ten pulses on the same 0–13 s clock,
  796 samples. It is the input that drove the coupled bout — literal
  continuity, not a stand-in. Identical in both conditions.
- Protocol: 10 reps × 0.65 s (`REP_SECONDS`, `REPS` in `cellBinding.js`),
  exercise 0–6.5 s, rest 6.5–13 s (`grid.tEnd`).
- `pAMPK_activity` is 0.0010 → 0.0011: not drawn separately (rule 6: ONE AMPK).

## Modules and their APIs

### `energyBinding.js` (new, pure) — data → drawing quantities
Uses `valuesOf(run, name)` from `./cellChain.js` (handles both run shapes).

```js
export const POOL = 90;                  // conserved nucleotide pool, in tokens
export function quantumOf(bout)          // (ATP+ADP+AMP at the run's first sample) / POOL — read, never typed
export const POOL = 90;
export const CA_QUANTUM_uM = 1;          // 1 particle per µM → peak ≈ 29
export const CONDITIONS = { normal: {...}, calciumOff: {...} }  // labels + run ids (see RUNS below)
export const PARTS = [ // ids are the anchor ids the geometry, tour and hover cards share
  { id: "atp",    name: "ATP",    line: "Fuel used directly by contraction." },
  { id: "pcr",    name: "PCr",    line: "A rapid reserve that helps restore ATP." },
  { id: "adp",    name: "ADP",    line: "What remains after ATP loses one phosphate." },
  { id: "amp",    name: "AMP",    line: "A low-abundance nucleotide that rises during energy stress." },
  { id: "ca",     name: "Ca²⁺",   line: "The same calcium that lifted the cover upstairs." },
  { id: "camkk2", name: "CaMKK2", line: "A calcium-sensitive regulator." },
  { id: "ampk",   name: "AMPK",   line: "A cellular energy and stress sensor." },
  { id: "pi",     name: "Pi",     line: "Phosphate set free as ATP and PCr are spent." },  // ours (conservation) — the line is the disclosure
];
/** Everything the picture needs at one instant. `prev` = the previous frame's
    result (or null) so conversions between frames become events. */
export function frameAt({ bout, ca, span, coupled, t, prev }) → {
  t,
  atp, adp, amp,            // integers, atp+adp+amp === POOL
  pcr,                      // integer tokens (round(PCr/QUANTUM))
  freePi,                   // P0 − (3atp+2adp+amp+pcr), clamped ≥ 0 — OURS, phosphate conservation over the drawn species
  ca,                       // integer visible particles: round(Ca_myo_total(t)/CA_QUANTUM_uM)
  camkk,                    // CaMKK_active_fraction(t), 0..1
  ampkLevel,                // pAMPK_fraction(t), absolute
  response,                 // (pAMPK(t) − pAMPK(t0)) / span, 0..1 — the RING
  responseNormal,           // the same for the Normal run (passed as `normal`), drawn faint behind the live arc while the path is off; null without it
  demand,                   // (ATP_hydrolysis_total(t) − its t0 value) / the run's peak rise, 0..1 — zero between reps
  coupled,                  // boolean, the condition
  events: { hydrolysis, recharge, ak },  // ≥0 integers: −Δatp, −Δpcr, +Δamp vs prev (0 when prev null or t went backwards)
}
/** max over the NORMAL run of (pAMPK − pAMPK[0]); the ring's full scale. Never typed. */
export function responseSpan(normalBout) → number
/** Rep index 0..9 containing t (rest phase → 9), and the loop bounds for the "one repetition" view. */
export function repAt(t, t0) → { rep, from, to }
/** Instants the tour needs, swept from the run, never typed. */
export function instantsOf(bout, ca) → { onset, pcrSteepest, ampMax, responseMax, caPeakRep1, still }
```
`still` = last archived sample before `tEnd` (the clock holds/cuts at tEnd,
see `runLoop.js`). Sampling: nearest-left index on the run's own `t`.

### `cellBinding.js` (trim, keep the name)
Keep `REP_SECONDS`, `REPS`, `RUNS` reduced to two conditions:
`RUNS.normal = { bout: "ampk_francis_soce_on", label: "Normal" }`,
`RUNS.calciumOff = { bout: "ampk_francis_soce_on_camkk2_ko", label: "Calcium path off" }`.
Delete the LKB1 entry, `SWITCHED`, `DRAWN`, bead constants, `molecules`,
`coincident`, `drawnAt` (nothing else imports them once the page is rewritten —
grep before deleting). `cellChain.js` stays untouched (`valuesOf` is imported by
the fibre and signalling walks; `armStrength` is used for the closing line).

### `cellChainGeometry.js` (REWRITE — the ENERGY level; the file name is a cross-floor contract)
```js
export const ENERGY_CAMERA = [0, 0.15, 4.2];       // wide, lookAt [0,0,0], fov 38
export const WAY_IN_AT = [...];                     // beside AMPK, offset right, never on it
export function chainLift(at) { return at; }        // kept for callers; identity is fine
export function buildCellChainLevel() → { group, anchors, update(frame), reset(), dispose(), hit }
// reset() clears everything mid-flight (beads, calcium, packets); the page calls it on every seek.
// hit holds spheres for the hoverable parts only (PARTS ids incl. pi; not the demand disc).
```
- `anchors`: `[{ id, label, at:[x,y,z] }]` for every `PARTS` id plus `"demand"`.
  `at` is the world position of the thing itself (guide, beacon and camera use it).
- `update(frame)` takes `frameAt`'s result; `update(null)` draws the resting
  picture (t0: 76/13/1 tokens, PCr 13, Ca 0, ring 0) — the fibre's seam builds
  this level for its coin and passes no dressing, so `null` must look like arrival.
- `hit`: invisible hit meshes (`userData.part = id`) so the page can hover/click.
- Layout (world units; scene ≈ x ±1.7, y ±1.3), wide left/right composition:
  - ENERGY SIDE (left): ATP pool at (−1.2, +0.55); PCr reserve at (−0.35, +0.6),
    adjacent to ATP so a recharge is a short flight; ADP pool at (−1.2, −0.15);
    AMP at (−1.15, −0.7); free Pi drifting near ADP.
  - CALCIUM SIDE (right): Ca entry top-right (1.35, 1.1) — "from upstairs" —
    particles travel to CaMKK2 at (1.1, 0.2).
  - AMPK at centre-bottom (0.3, −0.45) with its activity ring.
  - "ATP demand from contraction" pulse origin top-centre (0, 1.2).
- Forms (fibre quality: intentional geometry, `anatomyMaterial`, sphere segments ≥ 24/16, env map via the page's `AnatomyEnvironment`; no shadow rig — there is no ground):
  - Nucleotide token = adenosine body (small capsule) + phosphate beads in a row
    (r ≈ 0.028, dull neutral) — ONE instanced population of 90 tokens with state
    3/2/1 beads. A conversion re-states a token (ATP→ADP: one bead detaches and
    flies to the Pi cloud; PCr→ADP: a bead flies from a PCr token onto an ADP;
    2ADP→ATP+AMP: a bead flies between two ADP tokens). Tokens glide (~0.6 s)
    to the pool they now belong to. Counts come from `frame`; which token
    converts is a drawing choice (seeded, nearest).
  - PCr token = creatine body (a different shape from adenosine) + 1 bead.
    Tight cluster; a spent one keeps a faint bead-less shell so depletion is
    visible as the cluster thinning.
  - Free Pi = bead cloud, count `freePi`, slow drift.
  - Ca²⁺ = small spheres (r ≈ 0.02), `calciumMaterial()` from `anatomyStyle.js`
    — the FIBER's blue, `PALETTE.calcium` `#5b7f96`. `ca` visible particles
    spawned at the entry, travelling toward CaMKK2 over ~0.5 s, fading.
  - CaMKK2 = two lobes hinged; `camkk` opens the hinge (0 → 60°, eased over
    ~170 ms) and lerps its colour toward calcium blue. A calcium particle
    LANDING is the event: the lobes flash and swell for ~200 ms, and — only
    when `coupled` — one glow packet per landing (≥120 ms apart) travels
    CaMKK2 → AMPK. Nothing travels between reps or in rest (doc §5). When not
    coupled: the route is a faint dashed line with a small ✕ near CaMKK2.
  - AMPK = trimer (three nestled spheres, sizes 0.17/0.12/0.10) + an activity
    ring: an arc (`RingGeometry`, thetaLength = response·2π) r ≈ 0.32 in the
    bout colour `#ff8a5c`, emissive, over a faint full-ring track. `ampkLevel`
    → subtle emissive on the trimer only.
  - Demand = soft expanding translucent disc at top-centre scaled by `demand`.
- NO rocking; motion is flights, pulses, the ring, the hinge and a very slow
  idle drift (±0.01) so the pools feel alive. No colour-only encoding.
- Salvage from the current file what makes the "room": the translucent cell
  body/shell (`shellGeometry`, `PROFILE`, `rim`) and the z-scattered motes.
  Delete `cellForms.js` when nothing imports it (grep first).
- `cellGeometry.js`: keep the file for foreign tests; change only
  `export const CELL_CAMERA` to `export { ENERGY_CAMERA as CELL_CAMERA } from "./cellChainGeometry.js"`
  (the fibre's seam imports `CELL_CAMERA` for the coin). No import cycle:
  `cellChainGeometry.js` must not import `cellGeometry.js`.

### `cellTour.js` (REWRITE) — the guided tour, for `useTour` in `../tour.js`
```js
export function energyTour(bout, anchors, ca, { span }) → beats
export function energyResult(bout, anchors, { calciumShare }) → beats   // after the visitor's test
export const cellTour = energyTour;   // root tests import this name; under foreign anchors it returns []
```
Beat shape (see `tour.js`): `{ ms, line, camera:[x,y,z], lookAt:[x,y,z], seek, speed, focus, focusAt }`.
`ms ≥ readingMs(line) + FRAME_SLIP_MS` (import both from `../tour.js`).
Every beat changes camera AND (seek or speed) AND focus. Instants from
`instantsOf`, never typed. Guard: return `[]` if any anchor/instant is missing.

The seven beats (wording may improve; keep resource flow → expectation → test):
0. "You followed it in. This is the cell that paid for every pull." — close on ATP, seek t0, speed 0.
1. "ATP is the fuel used directly by contraction. Each pull spends some." — same shot, seek `onset`, speed 0.25 (hydrolysis flights visible).
2. "But the cell has a fast backup. PCr can recharge ADP back into ATP." — ATP+PCr shot, seek `onset`, speed 0.5. Then a second beat, wide-left at speed 1 for ~6 s: "So during the set, the reserve drains faster than ATP does."
3. "Not every spent molecule gets rebuilt immediately. ADP rises, and a small amount becomes AMP." — ADP/AMP shot, seek mid-set, speed 0.5.
4. "AMPK is a sensor that responds to the cell's energy state. So you might expect the rising AMP to explain most of the response." — AMPK close, seek just before `responseMax` rise, speed 0.5.
5. "But there is another input. The same calcium signal that helped the fibre contract also activates CaMKK2." — camera widens to the right, seek t0, speed 0.25 (rep-1 pulse enters, hinge opens, packets travel, ring rises).
6. "Test it yourself. Turn off the calcium path." — `ENERGY_CAMERA`, seek t0, speed 1. LAST beat: the tour ends here and the controls appear.

`energyResult` (played when the visitor switches to Calcium path off): wide,
seek t0, speed 2, no line (the set replays, ring barely moves) → hold at
`still`: "The energy changes are still there. The AMPK response mostly
disappears." → "In this run, calcium is doing most of the pushing." (choose
the sentence by `calciumShare > 0.5`; the other branch says the energy state
is) → AMPK close: "AMPK is only one signal inside the cell. What happens when
we look at the whole network?"

### `CellScale.jsx` (REWRITE) — page + scene. Default export `CellScale({ state })`.
Cross-floor source tests read this file: it must contain the literals
`buildCellChainLevel(`, `to: "signalling"` followed by `build: () => buildHeroLevel(`
(the seam object as today), and `<WayIn`.
- Loads `RUNS[cond].bout`, `CHAIN_RUNS.rest`, `CHAIN_RUNS.noCalciumArm`
  (→ `armStrength` for the closing line), and `"soce_on"` (calcium). Keep the
  loading / error / "Waiting for the first frame…" copy (`data-testid="stage-status"`).
- Arrival instant: `state?.handoff?.t ?? state?.t ?? t0`, clamped to the grid.
  The orchestrator's cross-floor contract (`src/handoff.js` on main, not yet in
  this worktree — read it defensively with optional chaining, never import it)
  passes `state.handoff = { from, to, bridge, exercise, arm, muscle, run, clock, t, rep, at }`;
  FIBER→ENERGY has `bridge: "atp"` and a real `t`/`rep` because the two floors
  share the Francis clock.
- Clock: `createRunClock` / `stepRunClock` from `../runLoop.js`, bounds from the
  view (`set` → grid; `rep` → `repAt`). Frame loop: `frameAt` → `model.update`.
  10 Hz readout to React for the rep strip and the handoff.
- Stages `silent → tour → main` exactly as today (`SILENT_MS`, `useTour`,
  `stage === "tour" && !tour.running → main`). A second `useTour` (own nonce)
  plays `energyResult` when the condition changes to `calciumOff`; the
  condition switch itself swaps the loaded bout (as the old switches did) and
  re-seeds the clock to t0.
- Guide: `Guide` from `../guide/Guide.jsx` with `useAim`, standing beside the
  tour's focus anchor (projection pattern as today), line = tour line; the
  `<p data-testid="tour-line" role="status">` live region stays as today.
- Camera: `useCameraTransition(tour.camera ?? ENERGY_CAMERA, tour.lookAt ?? [0,0,0], true, tour.index)`;
  `OrbitControls` enabled only in main; no `CameraSway`.
- Controls (main only, bottom-left, `data-testid="energy-controls"`):
  Condition `Normal | Calcium path off` (`energy-condition`), View
  `Whole set | One repetition` (`energy-view`), `Replay` (`energy-replay`, clock → t0).
  Reuse the `.fiber-levels` / `.fiber-levels__rung` chip classes for the buttons.
- Rep strip (`energy-clock`, bottom-centre): REP 1…10 | REST with a playhead;
  pointer down/drag seeks (`t = t0 + fraction·span`).
- Hover: pointer over a hit mesh → `FocusRing` at that anchor + the part's
  name; click → small card (`energy-card`, `<Html>` from drei) with name + line.
  No persistent rings, no plates, no `Gizmos`, no `Handle`.
- Title: NONE from this floor. The shell draws "ENERGY / Cellular Energy"
  top-left from `SCALE_SUBTITLE` (orchestrator, 2026-09-05). No other standing
  text (no scale-facts, no scale-time, no switch note, no seam notice). Keep
  the out-of-range notice.
- `WayIn` at `WAY_IN_AT`, `visible={stage === "main"}`, seam to signalling as today.
- CTA `See the network →` (`energy-network`, bottom-right) visible in main
  after the result beats have played (or after the tour, if the visitor never
  tests). On press: pull back — camera eases to AMPK close then out to
  `[0.3, −0.45, 7.5]` over ~1.2 s while every pool fades (group opacity) and
  AMPK stays — then `beginDescent`/`beginCrossing("down")` + hash to signalling
  via `hashForScale(state, "signalling")` (same as `WayIn`).
- Handoff for SIGNALS: do NOT write sessionStorage. Navigate exactly as
  `WayIn` does (same call, same hash); the orchestrator's `handoff.js` builds
  the `bridge: "ampk"` record at the crossing. Expose what it may want through
  `window.__energyState()` → `{ t, rep, condition, ampk: { fraction, response } }`.
- Keep `data-testid="cell-stage"` on the stage div and the `.fiber.cell-stage-only` wrapper.
- Instrument: `window.__energyState = () => ({...last frame})` for screenshots.

### `cell.css` (REWRITE)
Keep `.fiber.cell-stage-only { grid-template-columns: 1fr; grid-template-rows: minmax(0,1fr) }`.
Add `.energy-controls`, `.energy-clock` (+ `__rep`, `__rest`, `__now`),
`.energy-card`, `.energy-network`, `.energy-hover`. No floor title: the shell
draws "ENERGY / Cellular Energy" in that corner. Paper pills like
`.cell-stage-notice` (keep that rule for the out-of-range notice). Must read at
390 px wide: controls wrap, strip full width.

## Tests (one file each, run singly)
- `energyBinding.test.js`: pool conserved at every sample; ring = 1.0 at the
  Normal run's peak and < 0.05 everywhere in the KO run; Ca peak count ≈ 29;
  events never negative and sum of hydrolysis ≥ 0; `instantsOf` all inside the grid.
- `cellTour.test.js`: every beat's `focus` is an anchor id; every beat has
  camera + (seek|speed); `ms ≥ readingMs + FRAME_SLIP_MS`; the last beat is the
  test beat; `energyResult` ends on AMPK.
- `cellChainGeometry.test.js`: anchors cover every `PARTS` id; `update(null)`
  then `update(frameAt(t0))` draws 76/13/1; a KO frame at `still` draws a ring
  under 0.05 while a Normal one draws ≈ 1.

## What is deliberately not built
No percentages or figures on screen. No LKB1 in the UI (the archive keeps it).
No control arm drawn. No `pAMPK_activity` object. No SIGNALS scene, no global
rename, no routing changes.


---

# 2026-09-06 — living metabolic chamber (docs/20260906-fix/energy.md)

The owner's brief is `docs/20260906-fix/energy.md`; it outranks everything above
where they differ. This section pins only the seams between the four files so
they can be built in parallel. Nothing in it changes a number the archive owns.

## Contract deltas, by file

### `cellChainGeometry.js` (geometry lane — the orchestrator of this section)
- `ENERGY_CAMERA` is now OBLIQUE: `[1.37, 0.62, 4.45]`, lookAt `[0,0,0]` —
  ~17° azimuth from the right, ~7.5° elevation, distance 4.7 (4.2 put the
  membrane's top edge, where the contraction comes in, on the frame's edge).
  The brief's "15~20° shallow perspective". On a portrait stage the PAGE backs
  the wide framing off along the same direction (`wideCamera`, ×1.68 at 0.53
  aspect); the geometry's value is the landscape one.
- NEW `export const ENERGY_VIEW_DIR` — the unit vector from the origin toward
  `ENERGY_CAMERA`. Every tour shot dollies along it so the whole pass shares one
  perspective and the return to `ENERGY_CAMERA` after the pass is a dolly, not
  a swing (rule 4: same angle).
- Anchors gain DEPTH: nucleotide pools and PCr/Pi at z ≈ +0.25 (front), AMPK at
  z 0, CaMKK2 and the calcium entry at z ≈ −0.25 (back). Read them from
  `anchors`, never type them.
- `update(frame)` reads one more field: `frame.wallDt` — the VIEWER's seconds
  this frame (idle drift, breathing, dust parallax run on it), while `frame.dt`
  stays the run-scaled seconds that flights, calcium travel and the hinge age
  on. A held beat (speed 0) is alive; Pause (both 0) is still.
- NEW `model.spotlight(id | null)` — the selection mechanism of this floor (the
  owner's "3D element itself says selection"): the named part keeps its full
  material and every other part recedes into the paper over ~150 ms; `null`
  brings everything back. Ids are `PARTS` ids (incl. `"pi"`, `"demand"`).
  Idempotent, cheap to call every frame.
- `debug()` gains `spotlight` (the id in force), `weights`, `motes`, `phase`,
  `pulses`, `ripple`, `collarOpacity`. The page also exposes
  `window.__energySeek(t)` for still-frame review (the strip that was the
  scrubber is gone).
- The demand anchor moves to the membrane's top edge above the ATP pool and the
  "ATP demand" disc becomes a membrane ripple + a pressure front that travels
  into the ATP pool on each rep's onset (brief §8). Its `PARTS` entry stays for
  hover; nothing standing names it (rule 5).
- AMPK: see Pass 2 item 3 below — `heroForms.trimerLobes(0.19, { weld: 0.82,
  open: 0.08 })`, the shape shared with SIGNALS, the size this floor's own; the
  activity arcs ◜ ◝ and the halo as before. CaMKK2 is one bilobal body on a
  hinge with two stout binding fingers that close over the top at rest and
  spread into a V when calcium lands; it leans toward the calcium entry.
- `WAY_IN_AT` is a VALUE now, `[0.78, -0.56, 0.05]` — beside AMPK, lower right;
  the derivation is on the export. The page's portrait branch is gone.

### `cellTour.js` (tour lane)
- `shot(at, back)` = camera `at + back · ENERGY_VIEW_DIR`, lookAt `at`. Import
  `ENERGY_VIEW_DIR` beside `ENERGY_CAMERA`. `wide` unchanged. The result
  verdict's dolly keeps the direction: camera `ENERGY_CAMERA + [±0.35, 0, 0]`,
  lookAt `[±0.35, 0, 0]`.
- New test: every beat's `camera − lookAt`, normalised, is within 1° of
  `ENERGY_VIEW_DIR` (containment: no framing leaves the perspective, so the
  first frame after the pass cannot snap). All existing tests stay green; beat
  counts stay 8 / 4; lines unchanged.

### `CellScale.jsx` + `cell.css` (page lane)
- The rep strip (`RepStrip`, `energy-clock`, `.energy-clock*`, `energy-arrived`)
  is DELETED — owner item 14. It was also the scrubber; nothing replaces it.
  Replay is the only time control.
- `view` defaults to `"rep"`. Toggles stay: Condition, View, Replay.
- The loop rep is fixed at mount from the arrival instant (`repAt(seed, t0)`)
  and re-fixed only by Replay/condition (both go to that rep's start in rep
  view, `t0` in set view). Clock bounds: whole grid while either pass speaks
  and while silent; the loop rep otherwise (rep view). When a pass ends, seek
  to the loop rep's start — rule 4, the picture returns to its opening frame.
  The loop's cut (`runLoop` lap tick) resets the model like a seek, so the
  first frame after the cut is the first instant's picture and not a lit
  sensor over a refilled pool. The hold is the shared `HOLD_S` (0.9 s each
  end): the loop is 0.65 s of rep, 0.9 s held, cut, 0.9 s held — a beat of rest
  bracketing the restart, per `runLoop.js`; a shorter hold is the
  orchestrator's call (they own `runLoop.js`).
- Both `useTour` calls pass `paused: !playing` (the orchestrator lands the
  option in `tour.js`; until then it is ignored). Do NOT edit `tour.js`.
- Per frame: `model.update({ ...frame, wallDt: step })` and
  `model.spotlight?.(card ?? hover ?? focus?.id ?? null)`.
- `EnergyHalo`/`HaloRing`/`HALO_COLOR`/`ringAt` DELETED (no rings — owner item
  13; the spotlight is the mark). The standing `energy-demand-name` label
  DELETED (brief §8, rule 5). Hover pill and click card stay.
- `.energy-controls` stands at `bottom: 16px` (the 48 was derived from the
  strip). `.energy-network` unchanged.
- `cellCss.test.js` rewritten to the rules that exist; NEW `cellPage.test.js`
  reads the source and pins the absences (no `energy-clock`, `RepStrip`,
  `EnergyHalo`, `energy-demand-name`) and the presences (`paused:`,
  `spotlight`, `useState("rep")`, the seam literals `buildCellChainLevel(`,
  `to: "signalling"`, `<WayIn`, `data-testid="cell-stage"`, `stage-status`).

### `energyLattice.js` (NEW, pure — lattice lane)
```js
export function rnd(i, salt)   // the deterministic 0..1 hash cellChainGeometry.js has today (moved here)
/** Slots for a coherent cloud of n items: hexagonal rows in a lens, layered in
    z, sorted centre-out — so a pool of 13 is the tight knot at the middle of the
    same lattice a pool of 76 fills. Deterministic by seed. */
export function latticeSlots({ at, n, pitch, aspect = [1, 0.55, 0.35], layers = 3, seed = 1, jitter = 0.12 }) → [x,y,z][]
```
Invariants (tests): length n; deterministic; every slot inside the lens
(ellipsoid whose semi-axes are `aspect` × the reach n needs at `pitch`); no two
slots closer than `pitch · (1 − 2·jitter) · 0.95`; sorted so normalised distance
from `at` is non-decreasing; the first k slots of n are the first k slots of any
m > n (prefix-stable).

## Pass 2 (2026-09-06, afternoon) — the six deviations, in the owner's order

1. **The room is the inside of the fibre.** Behind the economy, all part
   `"room"`, unnamed, unhit, unspoken: four striped myofibril rods at four
   depths (`BANDS`), five mitochondria (`MITOS`, the nearest behind the ATP
   lens), one peripheral nucleus (`NUCLEUS`) under the bottom edge. Cartoon
   context; no number in it is data. `debug().furniture` counts them.
2. **AMPK rests against the third rod** (y −0.38, z −0.27, r 0.2 — its front
   face at −0.07, 0.05 into the built trimer's back at −0.116; at −0.32 the two
   were only tangent, measured). The sensor still stands mid-room in x/y; it
   is no longer in mid-air.
3. **One trimer spec.** `heroForms.trimerLobes(R, { weld, open })` is the shape
   both floors draw; ENERGY welds at 0.82 and uses `open: 0.08` as a MORPH
   TARGET on the same geometry (`AMPK_MORPH`; past 0.1 the α–β neck tears into
   a one-column slit), so the cleft hinges with `response`. Size is
   this floor's own (`R = 0.19`, not `FORM_R`) — share the shape, keep the
   scale local (orchestrator's rule, 2026-09-06). `debug().ampkOpen`.
4. **Calcium stays bound.** A landing takes one of four seats in the pocket
   (`BOUND_SLOTS`, a cartoon of a calcium sensor's sites, not a count read from
   anything), dwells `BOUND_S` 0.9 s of run time, then lets go. The hinge is
   NOT theirs: it follows the archive's CaMKK fraction from the first landing
   on — on the shipped run that fraction is 1.0 through the set and 0.79 at
   12.9 s while no particle is drawn, so a hinge that shut with the last ion
   would contradict the data (first cut of pass 2 did exactly that).
   `debug().caBound`.
5. **Portrait beats back off** in `CellScale.jsx`: beat cameras scale about
   their lookAt by `beatK = max(1, 1.05/aspect)` (×2.0 at 0.53), the wide
   frame by `portraitK` (×1.68). Direction unchanged.

## Pass 3 (2026-09-06, evening) — the owner's polish list, and stop

Owner: Concept 9/10, hierarchy 7, polish 7; "one focused polish pass and
stop". Items 1 · 2 · 4 · 5 · 6 · 7; 3 and 8 only where they fell out; 9 is the
orchestrator's.

1. **Composition** — `AT` moved 15–20 % inward along the owner's own diagonal
   (ATP/PCr top-left → ADP → AMP → AMPK centre → CaMKK2 lower right ← Ca²⁺
   from the lower-right wall). Camera untouched.
2. **Background** — rods 4 → 3, mitochondria 5 → 3, opacities −35 % (rods
   0.09, stripes 0.05, mitos 0.13/0.2, nucleus 0.1), tints further into the
   paper. Every hero touches something (measured on the built geometry after
   the review caught a typed 0.09 that was a 0.06 gap): ATP its
   mitochondrion, AMPK the middle rod, CaMKK2 the bottom rod, 0.13 in.
3. (fell out of 4) Token: larger organic body, smaller beads, a chain that
   droops (`CHAIN_DROOP`, per-link quaternions in `LINK_LOCAL`), ±15° in the
   picture plane.
4. **Hierarchy** — three lattices: `POOL_LATTICE` (ATP, dense), `ADP_LATTICE`
   (looser, shallower), `AMP_LATTICE` (loose, alone). Same token, three
   densities, read before any label.
5. **AMPK** — R 0.19 → 0.215, more central, desaturated (`#7f5f7b`),
   roughness 0.26 / room 1.9×, vertex colours: subunit lightness 1.00 / 0.94
   / 1.04 and a darkening toward the junction (a baked cleft occlusion, not
   three colours).
6. **CaMKK2** — hinge 0.6 of the angle, fingers 82° swing (lean-in 0.6 →
   lean-out 0.84), N-lobe lifts 0.04, a calcium-blue form in the cleft scaled
   by the opening (nothing while shut). Silhouette reads without colour.
7. **Depth** — scene fog toward the paper whose near/far follow the camera's
   distance (`CellScale.jsx` useFrame: near d − 0.3, far d + 2.6), so front /
   middle / back separate and nothing is blurred; contact-shadow sprites
   under AMPK, the ATP lens and CaMKK2.
8. (fell out of 7) The far edge of the membrane is paler than the near one
   under the fog.
9. Orchestrator: the way-in leaves this floor; "See the network →" carries it.

## Pass 4 (2026-09-06, night) — polish, five items; "새 geometry system을 또 만들 필요 없음"

Owner: 8/10+, direction closed. Do-not-touch: membrane direction, the
ATP/ADP/AMP population concept, calcium blue, the CaMKK2 opening concept, the
activity arcs, the ghost concept, the lens (stays in the upper right), the
warm palette. Item 6 (the guide's bubble over the focus) is the orchestrator's.

1. **Weight** — token ×0.88 in every dimension (`TOKEN_SCALE`, the creatine
   body too) and the ATP lattice pitch 0.062 → 0.054: the cloud ~13 % smaller
   in every dimension, same seventy-six. AMPK R 0.215 → 0.235 (+9 %).
   Diagonal unchanged.
2. **AMPK surface** — the weld cannot open further (`blob` is star-shaped
   about the junction; at 0.85 it thins to 0.05 R, probed), so the necks are
   read through light: roughness 0.26 → 0.18, room 1.9 → 2.3×, cleft
   occlusion 0.24 → 0.38 and wider, dents 0.06 → 0.07, subunit lightness
   1.00 / 0.92 / 1.05.
3. **Contact event** — an ion taking a SEAT sets `snap` = 1 (decay 9/s),
   which adds 0.22 of the swing to the hinge, fingers, lobe lift and cleft
   for ~0.3 s, on top of the fraction's opening; the packet leaves as before.
   Seatings, not landings: on the shipped run 5–9 particles land per rep and
   most find the seats full — snapping on all of them was a 10 Hz twitch
   (review). Cleared by `reset()` with `bindings`. `debug().snap`.
4. **Rods at three depths** — front (y 1.02, z −0.05, above PCr), middle
   (AMPK's seat, z −0.29), back (CaMKK2's seat, z −0.49); opacity 0.09 →
   0.105, stripes 0.05 → 0.06. The fog grades them. `debug().rodDepths`.
5. **Ghost = counterfactual** — on the live trimer's exact axis (offset gone),
   fill 0.14 → 0.06, and an OUTLINE: the same geometry ×1.035 drawn back-face
   (`ghostRim`, 0.2 + 0.45·g), arcs 0.1 + 0.6·g. It follows the Normal run's
   swell, turn and opening, so it stands just outside the real one.
   `debug().ghostAt`, `ghostRimOpacity`.

## Pass 5 (2026-09-06, night) — the owner's answers to the standing list

- **The View toggle is deleted** (owner: 삭제). One resting state, the loop
  rep; Replay and the condition switch return to its first instant; a pass
  that needs the set seeks there. `energy-view`, "Whole set", `setView`
  pinned absent.
- "Nothing floats" is closed — resting on unnamed context is fine.
- **Free Pi** is set apart as LOOSE: beads ×1.1, paler, drifting wider — the
  one drawn quantity that is our arithmetic no longer reads as a fourth pool.
- **The membrane ripple is gone**; the front bow is the demand event. The
  `demand` anchor and hover stay.
- Stripes 0.06 → 0.07.
- The loop's hold: with the toggle gone a cold arrival sees the held first
  instant, the pass, then the loop; the number handed to the orchestrator for
  `runLoop.js` is 0.5 s each end (its own floor for "reads as a hold").
- The browser suite is never needed again (owner); stills + unit tests.

## Pass 6 (2026-09-06, night) — final polish; the lock list is the other half

Owner: "final-polish + shell/orchestrator cleanup, not a content rethink".
Thirteen things locked (membrane, room, myofibril concept, population logic,
token grammar, calcium blue, CaMKK2 open/closed, AMPK hero, arc/halo, ghost,
magnifier, palette, tour structure) — none touched. Item 1 (the idle guide
bubble over CaMKK2) is the orchestrator's.

P0
- **Composed close-ups** (`cellTour.js`): the AMP → AMPK pair looks 70 % of
  the way to AMPK, 2.2 back (`pairAmpk`); the calcium side looks 55 % of the
  way from AMPK to CaMKK2, 2.6 back (`sensorSide`); the AMPK close is 1.8
  back and 0.07 above the trimer (`closeAmpk`). Direction unchanged, so the
  containment test holds; a new test pins subject-on-a-third and headroom.
- **Loop hold 0.9 → 0.5 s** — done on main by the orchestrator (`HOLD_S`).

P1
- **Three-band spotlight**: target 1, related 0.3 (`RELATED`, the story's
  neighbours), far 0.14, room 0.55. Pinned by test.
- **AMP as a loose drift**: `AMP_LATTICE` round, pitch 0.14, jitter 0.25.

Optional
- **Opener echo**: `model.echo()` — one bow leaves the membrane and fades on
  the viewer's clock (1.2 s, 0.35, not scaled by the spotlight — the opener
  spotlights ATP and the demand band would have faded it) while the run
  stands still; the page fires it on beat 0's entry. Not a demand event;
  spends nothing (test).
- Review corrections: `RELATED.ampk` covers the whole energy side (the result
  pass spotlights AMPK while its lines are about ATP/ADP), `RELATED.ca`
  includes AMPK; `AMP_LATTICE` is loose by pitch (0.14, jitter 0.25) — the
  first cut (0.1, jitter 0.42) put two AMP tokens through each other.
