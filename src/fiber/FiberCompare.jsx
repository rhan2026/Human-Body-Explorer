/**
 * The first repetition against the last, as two bars each.
 *
 * THIS IS THE FLOOR'S WHOLE POINT AND IT WAS A SENTENCE. The fibre scale exists
 * to answer why force fades, and its answer is a comparison: the command keeps
 * arriving at full strength and the pull halves twice over. Measured on
 * `soce_on` by `forcePeaks`:
 *
 *     repetition 1    force 0.8707    calcium pulse 26.82 µM
 *     repetition 10   force 0.3239    calcium pulse 26.70 µM
 *
 * Force keeps 37.2%. Calcium keeps 99.5%. Until 2026-09-05 the app said that in
 * one line of narration and drew neither quantity anywhere a viewer could put
 * them side by side — and the three beats that had been written to draw it were
 * unreachable, filed into `stepsOf`'s `finale` and rendered by nothing.
 *
 * NO NUMBERS ON IT, AND THAT IS NOT A FLAG DECISION. `docs/objective.md`: "A
 * number does not need a taxonomy word to ship... Drop the word wherever it
 * costs more than it says." Here the number costs more than the bar: 0.8707
 * against 0.3239 asks a first-year to divide, and two bars of obviously
 * different length asks them to look. The spec is explicit — *"숫자 없어도 됨.
 * 중요한 건 comparison이 한눈에 보이는 것"*. The values are still on the state
 * and still in the archive; this is a drawing of them, not a replacement.
 *
 * BOTH ROWS ARE SCALED THE SAME WAY: each quantity against its OWN first
 * repetition, so a full bar means "as much as the first pull had". That is the
 * only scaling under which the two rows can be read against each other at all —
 * force is a fraction of maximum and calcium is µM, and a shared axis between
 * them would be a made-up unit. What the picture says is "this one held, this
 * one did not", which is exactly and only what the data says.
 *
 * THE COLUMN THAT IS LIT is the repetition the run is parked on, so the meters
 * and the 3D are the same instant. `both` lights neither and shows the pair,
 * which is the beat the line lands on.
 */

/** How much of its own first repetition a reading kept, 0..1 and never past 1. */
const kept = (now, first) =>
  typeof now === "number" && typeof first === "number" && first > 0
    ? Math.max(0, Math.min(1, now / first))
    : 0;

/**
 * WHICH TWO REPETITIONS. The pass compares the first against the LAST, because
 * that is the largest true difference the run holds and the point lands hardest
 * there. The COMPARE mode hands over `against`, so a visitor can put the first
 * repetition beside any of them and watch the gap open — which is the thing
 * that turns a conclusion into something they found. Both columns are still the
 * same two quantities scaled the same way; only the right-hand repetition
 * moves.
 *
 * @param compare `"first" | "last" | "both" | null` — which column is lit, from
 *   the storyboard beat, or `"both"` for the mode. Null draws nothing at all.
 * @param peaks `forcePeaks(scenario)`. Fewer than two repetitions is not a
 *   comparison and draws nothing, the same refusal `fiberTour` makes.
 * @param against 1-based repetition for the right column. Null means the last,
 *   which is what the pass's own beats want.
 */
export default function FiberCompare({ compare = null, peaks = [], against = null }) {
  if (!compare) return null;
  const first = peaks[0];
  const last =
    (against != null ? peaks.find((p) => p.rep === against) : null) ?? peaks[peaks.length - 1];
  if (!first || !last || first === last) return null;

  const rows = [
    {
      key: "calcium",
      label: "Calcium",
      firstFill: 1,
      lastFill: kept(last.calcium, first.calcium),
    },
    {
      key: "force",
      label: "Force",
      firstFill: 1,
      lastFill: kept(last.force, first.force),
    },
  ];

  const cols = [
    { key: "first", head: `Rep ${first.rep}`, pick: (r) => r.firstFill },
    { key: "last", head: `Rep ${last.rep}`, pick: (r) => r.lastFill },
  ];

  return (
    <div className="fiber-compare" data-testid="fiber-compare" data-showing={compare}>
      <div className="fiber-compare__grid">
        <span aria-hidden="true" />
        {cols.map((c) => (
          <p
            key={c.key}
            className="fiber-compare__head"
            data-lit={compare === c.key || compare === "both" ? "" : undefined}
          >
            {c.head}
          </p>
        ))}
        {rows.map((r) => (
          <Row key={r.key} row={r} cols={cols} compare={compare} />
        ))}
      </div>
    </div>
  );
}

function Row({ row, cols, compare }) {
  return (
    <>
      <p className="fiber-compare__name">{row.label}</p>
      {cols.map((c) => {
        const fill = c.pick(row);
        return (
          <div
            key={c.key}
            className="fiber-compare__bar"
            data-row={row.key}
            data-col={c.key}
            data-lit={compare === c.key || compare === "both" ? "" : undefined}
            /* THE ONE PLACE A NUMBER BELONGS. A bar is a picture and a picture
               is not announced; a screen reader gets the reading in words, as
               a percentage of the first repetition, which is the same thing the
               sighted reader gets from the length. */
            role="img"
            aria-label={`${row.label}, ${c.head}: ${Math.round(fill * 100)}% of the first repetition`}
          >
            <span
              className="fiber-compare__fill"
              style={{ transform: `scaleX(${fill})` }}
              aria-hidden="true"
            />
          </div>
        );
      })}
    </>
  );
}
