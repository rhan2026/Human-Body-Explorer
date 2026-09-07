/**
 * The nine the cell screen draws, and the one thing the run actually shows.
 *
 * WHY THIS FILE EXISTS. The owner's spec for this scale, 2026-08-31:
 *
 *     Muscle Cell → ATP consumption → Energy stress → AMP / ADP changes
 *                 → AMPK activation → Cellular energy response
 *
 * with the headline *"How does the muscle cell know it is running low on
 * energy?"* — and the animation being ATP spent, an energy gauge falling, AMPK
 * switching on. Same shape as the signalling scale: a handful of named things
 * with arrows, drawn as what they are, instead of a chart of everything.
 *
 * WHAT THE ARCHIVE SHIPS, and it is the spec's own chain almost exactly:
 * `ATP`, `ADP`, `AMP` and `PCr` in mM, `ATP_hydrolysis_total` in mM/s,
 * `CaMKK_active_fraction`, `pAMPK_fraction`, `pAMPK_activity`, `sensor_ratio`.
 * Ten series, one of them `t`. Nothing here is invented; every drawn object is
 * one of those names.
 *
 * ── AND THE LAST ARROW IS NOT IN THE DATA ────────────────────────────────────
 *
 * Measured 2026-08-31 across the four shipped runs, 501 samples each:
 *
 *   · The bout costs energy, plainly. ATP 7.5573 → 6.0246 mM, PCr 1.2709 →
 *     0.5336, ADP 1.2675 → 2.4576, AMP 0.0957 → 0.4436 — a 4.6x rise.
 *   · `pAMPK_fraction` rises 0.8910 → 0.9984.
 *   · **And it rises identically in the rest control.** 0.8910, 0.9151, 0.9362,
 *     0.9684, 0.9874, 0.9956, 0.9984 — the same seven numbers to four decimals,
 *     in a run whose own description says the ONLY difference is "the energy
 *     cost of the bout and nothing else".
 *
 * So in this coupling the energy state does not move AMPK at all. The knockouts
 * say what does:
 *
 *   · CaMKK2 knocked out: pAMPK 0.8910 → 0.8934. The whole rise is gone.
 *   · LKB1 knocked out:   pAMPK 0.0000 → 0.3498. The resting 89 % is gone.
 *
 * LKB1 holds AMPK at 89 % at rest; calcium through CaMKK2 pushes the last 11 %
 * during the run; the ATP and AMP the bout actually spends move it by nothing.
 *
 * THAT IS THE SCREEN'S ANSWER, and it is a better one than the spec's. Asked
 * "how does the cell know it is running low on energy", this model answers: in
 * these thirteen seconds, it does not find out from the energy. It finds out
 * from the calcium — the same calcium the fibre scale one level up spends the
 * whole run releasing. §5's rule is show the mismatch rather than draw around
 * it, and the mismatch here is the interesting part.
 *
 * WHAT THE MODEL HAS NO SERIES FOR, and which therefore is not drawn: the
 * spec's last step, "energy-production response connects toward mitochondria".
 * There is no mitochondrial output in this export — the ten series above are all
 * of it. `pAMPK_activity` and `sensor_ratio` are what AMPK's activation is read
 * OUT as, not what it goes on to do.
 *
 * And what the numbers are fitted to, which the picture must not overstate:
 * `provenance.fitted_to` — "AMPK biosensor recordings, not exercise and not
 * muscle fibres."
 */

/** The runs this scale compares. Ids, not paths; the loader adds the rest. */
export const CHAIN_RUNS = Object.freeze({
  bout: "ampk_francis_soce_on",
  rest: "ampk_francis_rest_control",
  noCalciumArm: "ampk_francis_soce_on_camkk2_ko",
  noEnergyArm: "ampk_francis_soce_on_lkb1_ko",
});

/**
 * A drawn node: one archive series, placed on a grid.
 *
 * `col` runs -1 (the energy side) to +1 (the calcium side); `row` is depth down
 * the chain. `form` names the shape `cellForms.js` builds, and `unit` is the
 * archive's own, never retyped here.
 */
/* EVERY NAME SAYS WHAT THE THING IS — the scale's own `·` shape, which the fibre
   has used since it was drawn (`Myosin · thick`, `Terminal cisterna · the store`)
   and this scale never adopted. Measured 2026-09-04: eight plates, eight bare
   technical nouns, and `gate-legibility` reporting them as such at three widths —
   "a visitor who does not know the word learns nothing from it, and this scale
   exists for that visitor".
   THE RING'S SENTENCE IS NOT A SUBSTITUTE. Pressing a part says more (see `SAYS`
   in `CellScale.jsx`), and that is a press a visitor has to know to make; the
   plate is what they read without asking. Three or four words each, and none of
   them a figure — the value is already on the plate beside the name. */
export const CHAIN_NODES = Object.freeze([
  { id: "ATP_hydrolysis_total", label: "ATP demand · fuel being spent", row: 0, col: -0.55, form: "demand" },
  { id: "ATP", label: "ATP · the fuel", row: 1, col: -1, form: "nucleotide" },
  { id: "PCr", label: "PCr · the reserve", row: 1, col: -0.1, form: "buffer" },
  { id: "ADP", label: "ADP · spent fuel", row: 2, col: -1, form: "nucleotide" },
  { id: "AMP", label: "AMP · the scarce one", row: 2, col: -0.1, form: "nucleotide" },
  { id: "CaMKK_active_fraction", label: "CaMKK2 · the calcium switch", row: 2, col: 1, form: "kinase" },
  { id: "pAMPK_fraction", label: "AMPK · the energy sensor", row: 3, col: 0.1, form: "trimer" },
  { id: "pAMPK_activity", label: "AMPK activity · sensor at work", row: 4, col: 0.1, form: "output" },
]);

export const CHAIN_IDS = Object.freeze(CHAIN_NODES.map((n) => n.id));

/**
 * The arrows, and the one that is drawn as a question rather than as a claim.
 *
 * `kind`:
 *   `spends`  — the bout consuming ATP, and ATP becoming ADP becoming AMP.
 *               Straight arithmetic of the model's own state variables.
 *   `senses`  — an arm INTO AMPK. Two of them, and they are what the knockouts
 *               separate.
 *   `reads`   — AMPK's activation being read out.
 *
 * `moves` is filled in by `chainReading` from the runs themselves, not typed: an
 * arm that the archive shows moving nothing is drawn as not moving anything.
 */
export const CHAIN_LINKS = Object.freeze([
  { from: "ATP_hydrolysis_total", to: "ATP", kind: "spends" },
  { from: "ATP", to: "ADP", kind: "spends" },
  { from: "ADP", to: "AMP", kind: "spends" },
  { from: "PCr", to: "ATP", kind: "spends" },
  { from: "AMP", to: "pAMPK_fraction", kind: "senses", arm: "energy" },
  { from: "CaMKK_active_fraction", to: "pAMPK_fraction", kind: "senses", arm: "calcium" },
  { from: "pAMPK_fraction", to: "pAMPK_activity", kind: "reads" },
]);

/**
 * One series' values, from either shape a run arrives in.
 *
 * TWO SHAPES ON PURPOSE, and this function is where they meet. The APP reads
 * every number through `scenarioData.js`'s loader, which exposes `series(name)`
 * as a FUNCTION returning `{ values, unit, t }` and refuses to hand out a sample
 * without an evidence label. The TESTS in this directory read the shipped JSON
 * bytes directly, which is deliberate — a gate that goes through the same loader
 * as the app cannot catch the loader hiding something.
 *
 * The first version of this file assumed the loader's `series` was an object
 * keyed by name, like the raw file's. It is not. Every level came back
 * undefined, every node drew quiet, and the whole cell rendered grey and dead —
 * while `cellChain.test.js` passed, because it was reading the other shape. A
 * gate that reads the bytes proves the data; only opening the page proves the
 * wiring.
 */
/* EXPORTED, because the walks read the same archives and the shape trap is the
   same one. Measured twice now: `scenarioData.js` hands back an object whose
   `series` is a FUNCTION, the raw JSON's is a plain object, and a reader that
   assumes either one silently returns nothing for the other — the cell rendered
   entirely grey through that once, with every gate green, and the signalling
   walk came back empty through it on 2026-09-01. */
export function valuesOf(run, name) {
  if (!run) return null;
  if (typeof run.series === "function") return run.series(name)?.values ?? null;
  const raw = run.series?.[name];
  return Array.isArray(raw) ? raw : null;
}

/** Largest absolute value of a series, for scaling a drawn quantity. */
const span = (values) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return { lo, hi, range: hi - lo };
};

/**
 * How much each arm actually separates the bout from doing nothing.
 *
 * WHY THIS IS COMPUTED AND NOT WRITTEN DOWN. The whole point of this screen is
 * an arrow that the data does not support, and an arrow whose weakness is TYPED
 * stops being a measurement the moment the archive changes. `separation` is the
 * largest gap between the bout and the rest control over the run, per series, in
 * that series' own units — so "the energy cost moves AMPK by 0.0000" is a number
 * this file read this morning and not a sentence somebody once believed.
 */
export function chainSeparation(bout, rest, ids = CHAIN_IDS) {
  const out = {};
  for (const id of ids) {
    const a = valuesOf(bout, id);
    const b = valuesOf(rest, id);
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      out[id] = null;
      continue;
    }
    let worst = 0;
    for (let i = 0; i < a.length; i += 1) {
      const d = Math.abs(a[i] - b[i]);
      if (d > worst) worst = d;
    }
    out[id] = worst;
  }
  return out;
}

/**
 * How much of AMPK's rise each arm is responsible for, 0..1.
 *
 * EACH ARM NEEDS ITS OWN COUNTERFACTUAL, and the first version of this used one
 * for both and got the wrong answer. `chainSeparation(bout, rest)` reports
 * 0.00000 for `CaMKK_active_fraction` — not because calcium does nothing, but
 * because the rest control holds calcium IDENTICAL by design ("identical
 * calcium, identical model, identical parameters, ATP demand held flat"). Asking
 * it whether calcium matters is asking a question it was built not to answer,
 * and taking the 0 at face value would have drawn BOTH arms dead.
 *
 * So each arm is measured by removing that arm and nothing else:
 *
 *   · CALCIUM — the CaMKK2 knockout. AMPK's rise goes from 0.1074 to 0.0024, so
 *     calcium accounts for essentially all of it.
 *   · ENERGY — the rest control, which removes the bout's energy cost and
 *     nothing else. The rise is unchanged to four decimals, so the energy the
 *     bout spends accounts for none of it.
 *
 * Same question, same shape of answer, different run — because "hold this arm
 * still" is a different experiment for each.
 */
export function armStrength(runs) {
  const rise = (r) => {
    const s = valuesOf(r, "pAMPK_fraction");
    if (!Array.isArray(s) || s.length < 2) return null;
    return s[s.length - 1] - s[0];
  };
  const whole = rise(runs?.bout);
  if (!whole) return { calcium: 0, energy: 0 };
  const share = (without) => {
    const kept = rise(without);
    if (kept === null) return 0;
    return Math.min(1, Math.max(0, 1 - kept / whole));
  };
  return { calcium: share(runs?.noCalciumArm), energy: share(runs?.rest) };
}

/**
 * What each drawn node is doing at one instant, as a 0..1 for the drawing.
 *
 * NORMALISED AGAINST THE RUN'S OWN RANGE, not against zero: `pAMPK_fraction`
 * never leaves 0.89..1.00 and `ATP` never leaves 6.02..7.56, so a bar drawn from
 * zero would show two flat lines and say the run does nothing. The number a
 * viewer is shown as a VALUE stays the archive's own with the archive's own
 * unit; this fraction only decides how full a shape is drawn.
 *
 * `falling` is what the shape does when its series goes DOWN — ATP and PCr are
 * spent, so their drawn fullness is the value itself, and the picture empties.
 */
export function chainReading(bout, tSeconds) {
  const t = valuesOf(bout, "t") ?? bout?.series?.(CHAIN_IDS[0])?.t ?? null;
  if (!Array.isArray(t) || !t.length) return { t: 0, index: 0, value: {}, level: {} };
  let i = 0;
  while (i < t.length - 1 && t[i + 1] <= tSeconds) i += 1;
  const value = {};
  const level = {};
  for (const id of CHAIN_IDS) {
    const s = valuesOf(bout, id);
    if (!Array.isArray(s)) continue;
    const { lo, range } = span(s);
    value[id] = s[i];
    level[id] = range > 0 ? (s[i] - lo) / range : 0;
  }
  return { t: t[i], index: i, value, level };
}
