/**
 * The AMPK archive, turned into the quantities the ENERGY floor draws. Pure; no
 * Three.js. Every number here is read off the shipped JSON through `valuesOf`
 * or is one of the four drawing decisions listed under OURS.
 *
 * MEASURED from `public/scenarios/*.json`, 2026-09-05 — four runs on one 13 s
 * clock, 501 samples each:
 *
 *   run                                pAMPK_fraction    ATP mM          PCr mM          ADP mM          AMP mM
 *   ampk_francis_soce_on (Normal)      0.8910 → 0.9984   7.557 → 6.025   1.271 → 0.534   1.268 → 2.458   0.096 → 0.444
 *   …_camkk2_ko (Calcium path off)     0.8910 → 0.8934   identical       identical       identical       identical
 *   ampk_francis_rest_control          0.8910 → 0.9984   demand flat
 *
 *   · `CaMKK_active_fraction` 0 → 0.9996 in BOTH Normal and KO. The authors'
 *     KO zeroes the coupling constant kCaMKK: CaMKK2 still binds calcium, what
 *     is cut is its route INTO AMPK. So `camkk` is the same in both conditions
 *     and `coupled` is the only thing that differs — the geometry draws the
 *     route, not the sensor, as the thing switched off.
 *   · The energy route moves AMPK by 0.0000 (rest control == Normal). Nothing
 *     drawn is false; the visitor's expectation is theirs.
 *   · Calcium is the FIBER's own archive, `soce_on.json` `Ca_myo_total` (µM),
 *     0.10 → peak 29.4, ten pulses, 796 samples on the same 0–13 s clock.
 *   · ATP+ADP+AMP is conserved by the model at 8.9205 mM (8.920456..8.920484
 *     across the run — rounding in the export, not drift).
 *
 * OURS — the drawing decisions, and nothing else in this file is one:
 *   · THE TOKEN QUANTUM. 90 tokens for the conserved pool, so one token is
 *     8.9205 / 90 mM. Ninety and not thirty-six because AMP spans 0.096..0.444
 *     mM: at 0.25 mM/bead it had under two beads to say it in (the old
 *     `cellBinding.apportion` note), at this quantum it has one to four.
 *   · THE CALCIUM QUANTUM. One visible particle per µM, so the peak is ~29
 *     particles — enough to read as a pulse, few enough to travel one by one.
 *   · FREE Pi. The archive carries no cytosolic Pi in this export, so the
 *     bead cloud is phosphate conservation over the drawn species: whatever
 *     phosphate the tokens held at t0 and no longer hold is free. Anchored at
 *     t0 so the cloud is empty on arrival and grows as PCr and ATP are spent.
 *   · THE RING. `response` is (pAMPK(t) − pAMPK(t0)) / span, where `span` is
 *     the NORMAL run's own largest rise (`responseSpan`). So Normal reaches
 *     exactly 1 at its peak and the KO run, on the same scale, reaches 0.02 —
 *     which is the comparison the visitor's test is for. Never typed.
 */

import { valuesOf } from "./cellChain.js";
import { REPS, REP_SECONDS, RUNS } from "./cellBinding.js";

export const POOL = 90;
/** The pool the shipped Normal run conserves, for callers with no run in hand. */
export const QUANTUM_mM = 8.9205 / POOL;
/** THE QUANTUM COMES FROM THE FILE: the conserved pool is the run's own
    ATP+ADP+AMP at its first sample over POOL tokens, so a re-exported archive
    with a different pool re-scales every count instead of quietly drifting
    off a typed 8.9205. */
export function quantumOf(bout) {
  const sum = at(bout, "ATP", 0) + at(bout, "ADP", 0) + at(bout, "AMP", 0);
  return sum > 0 ? sum / POOL : QUANTUM_mM;
}
export const CA_QUANTUM_uM = 1;

/** Labels + run ids; `RUNS` in cellBinding.js is the source. */
export const CONDITIONS = RUNS;

/** Ids are the anchor ids the geometry, the tour and the hover cards share. */
export const PARTS = Object.freeze([
  { id: "atp", name: "ATP", line: "Fuel used directly by contraction." },
  { id: "pcr", name: "PCr", line: "A rapid reserve that helps restore ATP." },
  { id: "adp", name: "ADP", line: "What remains after ATP loses one phosphate." },
  { id: "amp", name: "AMP", line: "A low-abundance nucleotide that rises during energy stress." },
  { id: "ca", name: "Ca²⁺", line: "The calcium released with each contraction." },
  { id: "camkk2", name: "CaMKK2", line: "A calcium-sensitive regulator." },
  { id: "ampk", name: "AMPK", line: "A cellular energy and stress sensor." },
  /* The one drawn thing the doc's list does not name, and the one that is our
     arithmetic (phosphate conservation) — so it gets a name and its one line,
     which is the disclosure. */
  { id: "pi", name: "Pi", line: "Phosphate set free as ATP and PCr are spent." },
  /* THE PULSE FROM UPSTAIRS. It had no name, so the one thing on this floor
     that IS the contraction the visitor just watched read as an unexplained
     disc (self-audit, 2026-09-05). The doc's own caption for it, verbatim. */
  { id: "demand", name: "ATP demand from contraction", line: "Each contraction spends ATP — one hit per repetition." },
]);

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Nearest-left sample index on a run's own `t`. The grids are not uniform
 * (`sampling.note`) and differ between the AMPK and calcium archives, so every
 * lookup is a search on the run being read, never an index shared across runs.
 */
function indexAt(times, t) {
  let lo = 0;
  let hi = times.length - 1;
  if (t <= times[0]) return 0;
  if (t >= times[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  return lo;
}

const at = (run, name, i) => valuesOf(run, name)?.[i] ?? 0;

const argmax = (values, from = 0, to = values.length - 1) => {
  let best = from;
  for (let i = from + 1; i <= to; i += 1) if (values[i] > values[best]) best = i;
  return best;
};

/** ATP/ADP/AMP as integers summing to POOL: AMP and ATP round from their own
    series, ADP takes the remainder. AMP FIRST, because it is the scarce one:
    as the rounding remainder it flickered ±1 dozens of times over a run whose
    AMP rises smoothly (audit r2), and the beat whose line is "a small amount
    becomes AMP" showed it made and unmade. ADP has the headroom to absorb a
    token of rounding without anyone seeing it. */
function tokens(run, i, q) {
  const amp = Math.min(POOL, Math.round(at(run, "AMP", i) / q));
  const atp = Math.min(POOL - amp, Math.round(at(run, "ATP", i) / q));
  return { atp, adp: POOL - atp - amp, amp, pcr: Math.round(at(run, "PCr", i) / q) };
}

const phosphates = ({ atp, adp, amp, pcr }) => 3 * atp + 2 * adp + amp + pcr;

/** Everything the picture needs at one instant. */
export function frameAt({ bout, ca, normal = null, span, coupled, t, prev, dt = 0, dim = 0 }) {
  const times = valuesOf(bout, "t") ?? [0];
  const i = indexAt(times, t);
  const q = quantumOf(bout);
  const now = tokens(bout, i, q);

  /* DEMAND IS THE RISE ABOVE REST, NOT THE ABSOLUTE RATE. At rest the muscle
     still spends ATP (0.399 mM/s against a peak of 1.848), so an absolute
     fraction sat at 0.2 forever and the demand disc read as a fixture — a pink
     moon over the cell in every still (measured 2026-09-05). What the picture
     is for is the contraction ARRIVING: near zero between reps (0.017–0.026
     inside the set, 0 only at t0 and in rest — measured 2026-09-06), a pulse
     on each. */
  const hyd = valuesOf(bout, "ATP_hydrolysis_total");
  const hydRest = hyd?.[0] ?? 0;
  const demandPeak = hyd ? hyd[argmax(hyd)] - hydRest : 0;

  const ampkLevel = at(bout, "pAMPK_fraction", i);
  const rise = ampkLevel - at(bout, "pAMPK_fraction", 0);

  const caTimes = valuesOf(ca, "t");
  const caCount = caTimes
    ? Math.max(0, Math.round(at(ca, "Ca_myo_total", indexAt(caTimes, t)) / CA_QUANTUM_uM))
    : 0;

  // A frame after the previous one converts; a frame before it (seek, replay,
  // the cut back to t0) is a new picture and fires nothing.
  const forward = prev && prev.t <= t;
  const events = forward
    ? {
        hydrolysis: Math.max(0, prev.atp - now.atp),
        recharge: Math.max(0, prev.pcr - now.pcr),
        ak: Math.max(0, now.amp - prev.amp),
      }
    : { hydrolysis: 0, recharge: 0, ak: 0 };

  return {
    t,
    ...now,
    freePi: Math.max(0, phosphates(tokens(bout, 0, q)) - phosphates(now)),
    ca: caCount,
    camkk: clamp01(at(bout, "CaMKK_active_fraction", i)),
    ampkLevel,
    response: span > 0 ? clamp01(rise / span) : 0,
    /* THE REFERENCE THE TEST IS AGAINST. With the calcium path off the ring
       stays near empty, and "mostly disappears" needs the thing it disappeared
       from on the same track: the Normal run's own response at this instant,
       drawn faint behind the live arc. Same formula, other run; null when no
       Normal run is handed in. */
    responseNormal: normal && span > 0 ? clamp01((at(normal, "pAMPK_fraction", indexAt(valuesOf(normal, "t") ?? [0], t)) - at(normal, "pAMPK_fraction", 0)) / span) : null,
    demand: demandPeak > 0 ? clamp01(((hyd?.[i] ?? 0) - hydRest) / demandPeak) : 0,
    coupled: Boolean(coupled),
    events,
    dt,
    dim,
  };
}

/** Max over the NORMAL run of (pAMPK − pAMPK[0]); the ring's full scale. */
export function responseSpan(normalBout) {
  const s = valuesOf(normalBout, "pAMPK_fraction");
  if (!s?.length) return 0;
  return s[argmax(s)] - s[0];
}

/** Rep index 0..9 containing t (rest phase → 9), and the loop bounds for the "one repetition" view. */
export function repAt(t, t0) {
  const rep = Math.min(REPS - 1, Math.max(0, Math.floor((t - t0) / REP_SECONDS)));
  const from = t0 + rep * REP_SECONDS;
  return { rep, from, to: from + REP_SECONDS };
}

/** Instants the tour needs, swept from the run, never typed. `null` where the series is missing. */
export function instantsOf(bout, ca) {
  const t = valuesOf(bout, "t");
  if (!t?.length) return { onset: null, pcrSteepest: null, ampMax: null, responseMax: null, caPeakRep1: null, still: null };
  const hyd = valuesOf(bout, "ATP_hydrolysis_total");
  const pcr = valuesOf(bout, "PCr");
  const amp = valuesOf(bout, "AMP");
  const ampk = valuesOf(bout, "pAMPK_fraction");

  const onsetI = hyd ? hyd.findIndex((v) => v > 2 * hyd[0]) : -1;
  /* ONE ONSET PER REPETITION, so a pass can play its first beats in the rep the
     visitor arrived in (doc §12: "rep 7 upstairs, rep 7 here"). Null for a rep
     with no burst — the rest phase — and the caller falls back to `onset`. */
  const onsets = [];
  for (let r = 0; r < REPS; r += 1) {
    const from = t[0] + r * REP_SECONDS;
    const to = from + REP_SECONDS;
    let found = null;
    if (hyd) for (let k = 0; k < t.length; k += 1) if (t[k] >= from && t[k] < to && hyd[k] > 2 * hyd[0]) { found = t[k]; break; }
    onsets.push(found);
  }

  let steepest = -1;
  if (pcr) {
    let worst = 0;
    for (let i = 0; i + 1 < pcr.length; i += 1) {
      const d = pcr[i + 1] - pcr[i];
      if (Number.isFinite(d) && d < worst) [worst, steepest] = [d, i];
    }
  }

  const caT = valuesOf(ca, "t");
  const caV = valuesOf(ca, "Ca_myo_total");
  let caPeakRep1 = null;
  if (caT && caV) {
    const end = indexAt(caT, t[0] + REP_SECONDS);
    caPeakRep1 = caT[argmax(caV, indexAt(caT, t[0]), end)];
  }

  return {
    onset: onsetI >= 0 ? t[onsetI] : null,
    onsets,
    pcrSteepest: steepest >= 0 ? t[steepest] : null,
    ampMax: amp ? t[argmax(amp)] : null,
    responseMax: ampk ? t[argmax(ampk)] : null,
    caPeakRep1,
    still: t[Math.max(0, t.length - 2)],
  };
}
