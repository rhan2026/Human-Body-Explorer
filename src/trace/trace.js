/**
 * The Evidence Trace's arithmetic. Pure: no React, no Three, nothing typed.
 *
 * WHAT THIS IS FOR — `docs/20260907-fix/evidence_trace_clean.md`. A thin trace
 * floating in the 3D's empty space, drawn from the same archived series the
 * scene is drawing, on the same clock. "그래프는 3D의 작은 window다": x is TIME
 * over the window the floor is playing, never sample index — the Francis grid
 * is 0.009 s for 6.5 s and 0.09 s after, so an index axis would draw the
 * recovery at a tenth of its width (`fiberTrace.js` gets away with that only
 * because the drawer's whole-run plot is off).
 *
 * EVERY NUMBER HERE IS COMPUTED OFF THE SERIES IT DESCRIBES. `repPeaks` and
 * `peakChange` are how "−63 %" reaches the screen: the peak of the last
 * repetition against the first, on the protocol's own cycle, off the export.
 * CLAUDE.md §9 forbids typing a value that something counts, and §5 forbids
 * handing our arithmetic to the authors — which is why the reveal that shows
 * these says "this run" and not "Francis et al. report".
 */

/** Samples with `from <= t <= to`, in order. */
export function windowOf(t, values, from, to) {
  const out = { t: [], v: [] };
  if (!Array.isArray(t) || !Array.isArray(values)) return out;
  for (let i = 0; i < t.length && i < values.length; i += 1) {
    if (t[i] >= from && t[i] <= to) {
      out.t.push(t[i]);
      out.v.push(values[i]);
    }
  }
  return out;
}

/** Where `t` falls across a `w`-wide plot of [from, to], clamped. */
export function xOf(t, from, to, w = 100) {
  if (!Number.isFinite(t) || !(to > from)) return 0;
  return Math.min(Math.max((t - from) / (to - from), 0), 1) * w;
}

/**
 * Points for a `<polyline>` in a `0 0 {w} {h}` viewBox, y flipped, x by time.
 * Values are clamped to [lo, hi] rather than drawn outside the box.
 */
export function linePoints(ts, vs, { from, to, lo, hi, w = 100, h = 40, pad = 2 } = {}) {
  if (!ts?.length || !vs?.length || !(to > from) || !(hi > lo)) return "";
  const span = h - pad * 2;
  const pts = [];
  for (let i = 0; i < ts.length && i < vs.length; i += 1) {
    const x = xOf(ts[i], from, to, w);
    const k = Math.min(Math.max((vs[i] - lo) / (hi - lo), 0), 1);
    pts.push(`${x.toFixed(2)},${(h - pad - k * span).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** x of the window's highest sample, on the cursor's axis — the number waits for it. */
export function peakXOf(t, values, from, to, w = 100) {
  const win = windowOf(t, values, from, to);
  if (!win.v.length) return 0;
  let best = 0;
  for (let i = 1; i < win.v.length; i += 1) if (win.v[i] > win.v[best]) best = i;
  return xOf(win.t[best], from, to, w);
}

/**
 * The peak of each repetition, on the protocol's own cycle: rep k is the
 * samples in [k·cycle, (k+1)·cycle). `cycle_s` is the authors' stimulus
 * pairing; `repetitions` — the LENGTH of the run — is ours (the export's
 * `whose_protocol` says so: the published length for this stimulus is 60 s).
 * Nothing here decides either; both are read off the protocol handed in.
 * Which is one more reason the change these peaks give is "this run".
 */
export function repPeaks(t, values, protocol) {
  const cycle = protocol?.cycle_s;
  const reps = protocol?.repetitions;
  if (!(cycle > 0) || !(reps > 0) || !Array.isArray(t) || !Array.isArray(values)) return [];
  const out = [];
  for (let k = 0; k < reps; k += 1) {
    const from = k * cycle;
    const to = (k + 1) * cycle;
    let best = -1;
    for (let i = 0; i < t.length && i < values.length; i += 1) {
      if (t[i] >= from && t[i] < to && (best < 0 || values[i] > values[best])) best = i;
    }
    if (best >= 0) out.push({ rep: k + 1, t: t[best], value: values[best] });
  }
  return out;
}

/** Last peak against the first, as a fraction; null when there is no ratio. */
export function peakChange(peaks) {
  if (!peaks?.length || peaks.length < 2) return null;
  const first = peaks[0].value;
  const last = peaks[peaks.length - 1].value;
  if (!(first > 0) || !Number.isFinite(last)) return null;
  return (last - first) / first;
}

/** A store's first sample against its lowest. */
export function drop(values) {
  if (!Array.isArray(values) || !values.length) return null;
  let min = values[0];
  for (const v of values) if (v < min) min = v;
  return { from: values[0], to: min };
}

/** "−63%" / "−1.5%" / "+98%": a real minus, one decimal only under ten. */
export function pct(fraction) {
  if (!Number.isFinite(fraction)) return "";
  const p = fraction * 100;
  const digits = Math.abs(p) < 10 && p !== 0 ? 1 : 0;
  const body = Math.abs(p).toFixed(digits);
  if (Number(body) === 0) return "0%";
  return `${p < 0 ? "−" : "+"}${body}%`;
}
