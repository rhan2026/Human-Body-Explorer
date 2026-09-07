/**
 * The run behind the instant, for the fibre panel's rows.
 *
 * WHY THIS EXISTS. The panel drew each row as a bar at the current value, and
 * the current value is almost always nothing. The protocol is ten repetitions
 * on a 0.65 s cycle with a 0.1625 s stimulus, so a calcium transient occupies a
 * quarter of each cycle for the first 6.5 s and the remaining 6.5 s is recovery.
 * Measured on `soce_on.json`: peak myoplasmic calcium 29.42 µM at t=2.76 s,
 * against 0.245 at t=3.0 and 0.174 at t=3.8. A viewer who opens this scale and
 * looks sees flat bars and the word "At rest", because they have landed between
 * twitches — which is where they will land nearly every time.
 *
 * A trace with a playhead says the same number and also says where it sits in
 * ten repetitions. Same row, same label, no extra words: the panel is at 191 of
 * the 200-word ceiling and a chart that needed a caption would spend the rest.
 *
 * NOT A SECOND OPINION ABOUT THE VALUE. The bar's height and the trace's height
 * come from one axis — `CA_FULL_SCALE_UM` for calcium, and force_relative is
 * already 0 to 1 — so the playhead crosses the line exactly where the bar would
 * have ended. Two drawings of one number that disagree are worse than one.
 *
 * The cell scale's `Track` in `CellReadout.jsx` does the two-arm version of this
 * and is NOT reused: `cellClaims.test.js` reads that file as text in six places,
 * so moving the component out of it would break assertions that are about the
 * cell's claims rather than about charts.
 */

/** Points for a `<polyline>` in a `0 0 100 {height}` viewBox, y flipped. */
export function tracePoints(values, full, height = 20, pad = 1) {
  if (!values?.length || !(full > 0)) return "";
  const span = height - pad * 2;
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const y = height - pad - Math.min(Math.max(v / full, 0), 1) * span;
      return `${(i * step).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/**
 * Where the playhead stands, 0-100 across the same viewBox.
 *
 * Clamped, because the fibre clock is allowed to sit outside the archive's
 * range — `FiberScene` clamps and the panel says so — and a playhead drawn off
 * the plot would be a second, silent way of saying it.
 */
export function playheadX(t, t0, tEnd) {
  if (!Number.isFinite(t) || !(tEnd > t0)) return 0;
  return Math.min(Math.max((t - t0) / (tEnd - t0), 0), 1) * 100;
}
