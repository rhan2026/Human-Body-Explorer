/**
 * The exported Francis scenarios, read the only way they are allowed to be read.
 *
 * CONTRACT — every number this module hands out arrives attached to the record
 * that says where it came from. There is deliberately no accessor that returns a
 * bare float or a bare array of floats: `series()` and `sample()` both answer
 * with a frozen carrier holding `provenance`, and `protocol`, `sampling` and
 * `grid` carry the same record. Freezing is the enforcement — a caller cannot
 * delete the label off a value on its way to a screen. PRD-v2 §7, CLAUDE.md §5.
 *
 * Readings snap to the NEAREST sample. Nothing is interpolated: the export chose
 * not to, and a value invented between two archived samples is a number that is
 * in neither the archive nor the paper. The snap is visible — a reading reports
 * both `t` (the sample it landed on) and `requestedT` — and a time outside the
 * grid comes back with `outOfRange: true`.
 *
 * The grid is NOT uniform, whatever the export's `sampling.stride` suggests:
 * 722 samples at 0.009 s cover the 6.5 s of work, then 0.09 s covers the 6.5 s
 * of recovery, with one 0.072 s step at the seam. So nearest is found by search
 * and `grid` publishes no `dt` — a single step size would describe neither half.
 */

const INDEX_PATH = "/scenarios/index.json";

/** Browser default. Tests pass a reader over the same committed bytes on disk. */
const fetchJson = async (path) => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json();
};

export async function listScenarios(readJson = fetchJson) {
  const { scenarios } = await readJson(INDEX_PATH);
  return Object.freeze(scenarios.map((s) => Object.freeze({ ...s })));
}

export async function loadScenario(id, readJson = fetchJson) {
  const entry = (await listScenarios(readJson)).find((s) => s.id === id);
  if (!entry) throw new Error(`unknown scenario "${id}" — not in ${INDEX_PATH}`);

  const file = await readJson(`/scenarios/${entry.file}`);
  const provenance = Object.freeze({ ...file.provenance });
  if (!provenance.evidence_type) {
    throw new Error(`scenario "${id}" has no provenance.evidence_type — an unlabelled number does not ship`);
  }
  const labelled = (o) => Object.freeze({ ...o, provenance });

  const series = Object.freeze(
    Object.fromEntries(Object.entries(file.series).map(([k, v]) => [k, Object.freeze(v)])),
  );
  const names = Object.freeze(Object.keys(series));

  /**
   * The network behind the series, for the exports that have one (Fowler).
   *
   * `nodes` is node id -> {name, type, pathway}, the authors' species sheet
   * unedited — 57 of Fowler's 121 pathway cells are blank and ship blank, so a
   * consumer grouping by pathway must fall back to `type`, which is complete.
   * `roles` carries `phenotypes`, `inputs` and `by_measured_separation`, the
   * full 121-node ranking by |resistance - endurance| measured at generation
   * time, so a screen never has to invent an ordering of its own.
   *
   * It exists because 121 unlabelled arrays are not a screen. Empty objects for
   * the Francis and AMPK exports, whose archives have no node table — an
   * absent grouping reads as absent rather than as a crash.
   */
  const nodes = Object.freeze(
    Object.fromEntries(Object.entries(file.nodes ?? {}).map(([k, v]) => [k, Object.freeze(v)])),
  );
  /**
   * The wiring, as `[source, target, sign]` with sign +1 activating and -1
   * inhibiting — the model's own `!`.
   *
   * ONE ARROW IS NOT ONE INTERACTION. A rule may have two reactants, so
   * `A & B => C` is one interaction and two arrows here. The generator counts
   * 260 rules and 264 distinct arrows; the paper quotes 259 interactions for its
   * own table, and the two answer different questions. Nothing that draws these
   * may print 264 as the paper's number.
   *
   * Empty for every export whose archive has no rule table, same as `nodes`.
   */
  const edges = Object.freeze((file.edges ?? []).map((e) => Object.freeze([...e])));
  const times = series.t;
  const count = times.length;
  if (count < 2) throw new Error(`scenario "${id}" has ${count} samples — nothing to sample between`);

  const t0 = times[0];
  const tEnd = times[count - 1];
  for (let i = 1; i < count; i++) {
    if (!(times[i] > times[i - 1])) {
      throw new Error(`scenario "${id}" grid does not increase at sample ${i} (${times[i]}); the nearest-sample search assumes it does`);
    }
  }

  /** Nearest sample to t. Exact ties take the earlier sample, always. */
  const nearestIndex = (t) => {
    if (t <= t0) return 0;
    if (t >= tEnd) return count - 1;
    let lo = 0;
    let hi = count - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= t) lo = mid;
      else hi = mid;
    }
    return t - times[lo] <= times[hi] - t ? lo : hi;
  };

  const valuesOf = (name) => {
    const v = series[name];
    if (!v) throw new Error(`"${name}" is not a series in "${id}" — have: ${names.join(", ")}`);
    return v;
  };

  return Object.freeze({
    id,
    description: entry.description,
    expt: file.expt,
    provenance,
    units: Object.freeze({ ...file.units }),
    protocol: labelled(file.protocol),
    sampling: labelled(file.sampling),
    grid: labelled({ t0, tEnd, count }),
    network: labelled({ nodes, edges, roles: Object.freeze({ ...file.node_roles }) }),

    seriesNames: () => names,

    series: (name) =>
      labelled({ series: name, unit: file.units[name], values: valuesOf(name), t: times }),

    sample: (name, t) => {
      const values = valuesOf(name);
      if (typeof t !== "number" || !Number.isFinite(t)) {
        throw new TypeError(`sample("${name}", ${String(t)}): t must be a finite number of seconds`);
      }
      const index = nearestIndex(t);
      return labelled({
        scenario: id,
        series: name,
        value: values[index],
        unit: file.units[name],
        t: times[index],
        requestedT: t,
        index,
        outOfRange: t < t0 || t > tEnd,
      });
    },
  });
}
