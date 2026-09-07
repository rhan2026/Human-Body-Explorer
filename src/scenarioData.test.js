import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { loadScenario, listScenarios } from "./scenarioData.js";

/**
 * The app fetches these off the site root; node reads the same committed bytes
 * off disk. Same files, same parser — the transport is the only substitution.
 */
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));

const rawFile = (name) => readJson(`/scenarios/${name}.json`);

/** The label this port has not earned. PRD-v2 §7, CLAUDE.md §5. */
const UNEARNED_LABEL = "Modelled";

test("the index names every exported arm of all three models", async () => {
  const listed = await listScenarios(readJson);
  assert.deepEqual(listed.map((s) => s.id).sort(), [
    "ampk_2dg_camkk2_ko",
    "ampk_2dg_lkb1_ko",
    "ampk_2dg_wt",
    "ampk_francis_rest_control",
    "ampk_francis_soce_on",
    "ampk_francis_soce_on_camkk2_ko",
    "ampk_francis_soce_on_lkb1_ko",
    "fowler_endurance",
    "fowler_resistance",
    "fowler_rest",
    "rest_only",
    "soce_off",
    "soce_on",
  ]);
  // The description is the honest caveat on the arm — soce_off is the comparison
  // for the store and NOT for force. It has to survive the load.
  assert.match(listed.find((s) => s.id === "soce_off").description, /NOT for force/);
});

test("every listed scenario loads, and none of them hands out an unlabelled number", async () => {
  for (const { id } of await listScenarios(readJson)) {
    const s = await loadScenario(id, readJson);
    assert.equal(s.provenance.evidence_type, "Derived", id);
    // The ten per-file provenance fields, PRD-v2 §7 / decisions.md #14. The
    // other four are per-reading and arrive on the carrier, asserted below.
    for (const field of [
      "model_id", "paper_id", "model_version", "archive_version",
      "port_source_sha256", "scenario", "inputs", "time_unit",
      "evidence_type", "confidence",
    ]) {
      assert.ok(s.provenance[field], `${id} provenance.${field}`);
    }
    assert.equal(s.provenance.scenario, id);

    for (const name of s.seriesNames()) {
      const r = s.sample(name, s.grid.t0);
      assert.equal(typeof r.value, "number", `${id}/${name}`);
      assert.ok(r.unit, `${id}/${name} sample has no unit`);
      assert.equal(r.provenance.evidence_type, "Derived");
      assert.throws(() => { r.value = 0; }, `${id}/${name} reading is not frozen`);
    }
  }
});

test("what is ours travels with the value, not beside it", async () => {
  // The AMPK coupling runs the authors' model on an input file we made, because
  // theirs was never published; the Fowler rest arm is a control the paper does
  // not run. Both statements live in `provenance`, which is the only thing the
  // loader attaches to a reading — so both reach a screen.
  const coupled = await loadScenario("ampk_francis_soce_on", readJson);
  assert.match(coupled.sample("ATP", 1).provenance.stands_in_for.what_is_ours, /ours/i);
  assert.match(coupled.provenance.uncertainty, /NONE SHIPS/);

  const rest = await loadScenario("fowler_rest", readJson);
  assert.match(rest.provenance.stands_in_for, /OURS/);

  const authors = await loadScenario("fowler_resistance", readJson);
  assert.equal(authors.provenance.stands_in_for, undefined);
});

test("a named scenario arrives with its provenance record unmodified", async () => {
  const s = await loadScenario("soce_on", readJson);
  const file = await rawFile("soce_on");
  assert.deepEqual({ ...s.provenance }, file.provenance);
  assert.equal(s.provenance.evidence_type, "Derived");
  assert.match(s.provenance.integrator, /NOT MATLAB ode15s/);
  assert.match(s.provenance.known_discrepancy, /10-12% NRMSE/);
});

test("the sampler answers with an archived sample, never a value between two", async () => {
  const s = await loadScenario("soce_on", readJson);
  const file = await rawFile("soce_on");
  const t = file.series.t;
  const force = file.series.force_relative;

  // 70% of the way from sample 100 to sample 101 is nearest to 101. An
  // interpolating sampler would answer with something in between; that number
  // is in neither the archive nor the paper.
  const between = t[100] + 0.7 * (t[101] - t[100]);
  const r = s.sample("force_relative", between);
  assert.equal(r.index, 101);
  assert.equal(r.value, force[101]);
  assert.equal(r.t, t[101]);
  assert.equal(r.requestedT, between);

  // and the snap is visible: the reading reports the sample time it landed on,
  // which is not the time that was asked for.
  assert.notEqual(r.t, r.requestedT);

  // over the whole grid, every answer is a value that exists in the archive.
  const archived = new Set(force);
  for (let k = 0; k <= 1900; k++) {
    assert.ok(archived.has(s.sample("force_relative", k * 0.00713).value), `t=${k * 0.00713}`);
  }
});

test("every sample time round-trips to its own index", async () => {
  const s = await loadScenario("rest_only", readJson);
  const t = (await rawFile("rest_only")).series.t;
  for (let i = 0; i < t.length; i++) {
    assert.equal(s.sample("Ca_myo_total", t[i]).index, i, `t[${i}]=${t[i]}`);
  }
});

test("a time off the end of the grid says so instead of quietly snapping", async () => {
  const s = await loadScenario("soce_on", readJson);
  const file = await rawFile("soce_on");
  const t = file.series.t;
  const last = t.length - 1;

  const after = s.sample("force_relative", t[last] + 5);
  assert.equal(after.outOfRange, true);
  assert.equal(after.index, last);
  assert.equal(after.value, file.series.force_relative[last]);

  const before = s.sample("force_relative", -1);
  assert.equal(before.outOfRange, true);
  assert.equal(before.index, 0);

  assert.equal(s.sample("force_relative", t[10]).outOfRange, false);
  assert.equal(s.sample("force_relative", t[last]).outOfRange, false);
  assert.equal(s.sample("force_relative", t[0]).outOfRange, false);
});

test("the grid the readings snap to is published, and it publishes no single step", async () => {
  const s = await loadScenario("soce_on", readJson);
  const t = (await rawFile("soce_on")).series.t;
  assert.equal(s.grid.count, t.length);
  assert.equal(s.grid.t0, t[0]);
  assert.equal(s.grid.tEnd, t[t.length - 1]);
  // The export is dense through the work (0.009 s) and coarse through the
  // recovery (0.09 s). One "dt" would be a number describing neither half.
  assert.equal("dt" in s.grid, false);
});

test("the coarse recovery half snaps by search, not by a step size the grid does not have", async () => {
  const s = await loadScenario("soce_on", readJson);
  const t = (await rawFile("soce_on")).series.t;
  const coarse = t.findIndex((_, k) => k > 0 && t[k] - t[k - 1] > 0.05);
  assert.ok(coarse > 0, "the export really does change rate partway through");
  const gap = t[coarse + 1] - t[coarse];

  assert.equal(s.sample("force_relative", t[coarse] + 0.4 * gap).index, coarse);
  assert.equal(s.sample("force_relative", t[coarse] + 0.6 * gap).index, coarse + 1);
  // an exact tie lands on the earlier sample, always the same way
  assert.equal(s.sample("force_relative", t[coarse] + 0.5 * gap).index, coarse);
});

test("a grid that does not increase is refused rather than searched", async () => {
  const bent = async (path) => {
    const doc = await readJson(path);
    if (path.endsWith("soce_on.json")) doc.series.t[400] += 5;
    return doc;
  };
  await assert.rejects(() => loadScenario("soce_on", bent), /increas/i);
});

test("provenance cannot be dropped from a reading or from a series", async () => {
  const s = await loadScenario("soce_on", readJson);
  const reading = s.sample("force_relative", 1.4);
  const series = s.series("force_relative");

  assert.equal(reading.provenance, s.provenance, "same record, not a copy");
  assert.equal(series.provenance, s.provenance);
  assert.equal(s.protocol.provenance, s.provenance);
  assert.equal(s.sampling.provenance, s.provenance);

  // frozen: a caller cannot strip the label off a number on its way to a screen.
  for (const carrier of [reading, series, s, s.protocol, s.sampling, s.grid]) {
    assert.throws(() => {
      delete carrier.provenance;
    }, TypeError);
    assert.throws(() => {
      carrier.provenance = null;
    }, TypeError);
  }
  // and the record itself cannot be quietly rewritten on the way past
  assert.throws(() => {
    s.provenance.source = "somewhere else";
  }, TypeError);
  assert.throws(() => {
    delete s.provenance.known_discrepancy;
  }, TypeError);
  assert.throws(() => {
    series.values[0] = 99;
  }, TypeError);
});

test("nothing this module hands out exposes numbers without the record", async () => {
  const s = await loadScenario("soce_on", readJson);
  const bearsNumbers = (v) => typeof v === "number" || (Array.isArray(v) && typeof v[0] === "number");

  const walk = (node, path) => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (Object.values(node).some(bearsNumbers)) {
      assert.ok(node.provenance, `${path} exposes numbers with no provenance`);
    }
    for (const [k, v] of Object.entries(node)) if (k !== "provenance") walk(v, `${path}.${k}`);
  };

  for (const name of s.seriesNames()) {
    walk(s.series(name), `series(${name})`);
    walk(s.sample(name, 2.5), `sample(${name})`);
  }
  walk(s, "scenario");
  walk(await listScenarios(readJson), "index");

  // and no bare array of floats is reachable as a top-level export result.
  assert.equal(Array.isArray(s.series("force_relative")), false);
  assert.equal(typeof s.sample("force_relative", 1), "object");
});

test("the protocol and the units travel with the values", async () => {
  const s = await loadScenario("soce_on", readJson);
  const file = await rawFile("soce_on");
  assert.equal(s.protocol.repetitions, file.protocol.repetitions);
  assert.equal(s.protocol.cycle_s, file.protocol.cycle_s);
  assert.equal(s.units.force_relative, "fraction_of_maximum");
  assert.equal(s.sample("force_relative", 1).unit, "fraction_of_maximum");
  assert.equal(s.sample("Ca_myo_total", 1).unit, "uM");
  assert.equal(s.series("Ca_SR_total").unit, "uM");
  assert.equal(s.sample("force_relative", 1).scenario, "soce_on");
  assert.deepEqual(
    s.seriesNames().slice().sort(),
    ["Ca_SR_total", "Ca_myo_total", "Pi_myo_total", "force_relative", "t"],
  );
});

test("the series is the archive's, in order and entire", async () => {
  const s = await loadScenario("soce_off", readJson);
  const file = await rawFile("soce_off");
  const series = s.series("force_relative");
  assert.equal(series.values.length, file.series.t.length);
  assert.equal(series.values.length, 796);   // 795 archived strides + the last sample
  assert.deepEqual([...series.values], file.series.force_relative);
  assert.deepEqual([...series.t], file.series.t);
  assert.equal(series.series, "force_relative");
});

test("an unknown scenario, an unknown series and a time that is not a time all refuse", async () => {
  const s = await loadScenario("soce_on", readJson);
  await assert.rejects(() => loadScenario("soce_maybe", readJson), /soce_maybe/);
  assert.throws(() => s.series("effort"), /effort/);
  assert.throws(() => s.sample("effort", 1), /effort/);
  for (const bad of [NaN, Infinity, -Infinity, "1.0", null, undefined, {}]) {
    assert.throws(() => s.sample("force_relative", bad), TypeError, `sample(force, ${String(bad)})`);
  }
});

test("a scenario with no evidence label does not load at all", async () => {
  const stripped = async (path) => {
    const doc = await readJson(path);
    if (path.endsWith("soce_on.json")) delete doc.provenance.evidence_type;
    return doc;
  };
  await assert.rejects(() => loadScenario("soce_on", stripped), /evidence_type/);
});

test("no code path in this module returns or constructs the unearned label", async () => {
  const source = await readFile(new URL("./scenarioData.js", import.meta.url), "utf8");
  assert.ok(!source.includes(UNEARNED_LABEL), `scenarioData.js names ${UNEARNED_LABEL}`);

  const seen = [JSON.stringify(await listScenarios(readJson))];
  for (const id of ["soce_on", "soce_off", "rest_only"]) {
    const s = await loadScenario(id, readJson);
    seen.push(JSON.stringify([s, s.protocol, s.units, s.sampling, s.grid, s.provenance]));
    for (const name of s.seriesNames()) {
      seen.push(JSON.stringify([s.series(name), s.sample(name, 3.2), s.sample(name, 1e6)]));
    }
  }
  for (const out of seen) assert.ok(!out.includes(UNEARNED_LABEL), out.slice(0, 200));
});

test("the Fowler arms hand out all 121 nodes and the pathway to group them by", async () => {
  // decisions.md P-6: the twelve phenotypes do NOT separate the two conditions,
  // so a signalling screen has to reach upstream. It can only do that if the
  // whole network arrives AND arrives grouped — 121 unlabelled arrays are not a
  // screen. This is the accessor half of that; the export half is pinned in
  // science/tests/test_scenarios_signalling.py.
  const s = await loadScenario("fowler_resistance", readJson);
  assert.equal(s.seriesNames().length, 122); // 121 nodes + t

  const { nodes, roles } = s.network;
  assert.equal(Object.keys(nodes).length, 121);
  assert.deepEqual(nodes.integrin, {
    name: "integrin", type: "receptor", pathway: "Integrin",
  });
  // 57 of the 121 have no pathway in the authors' sheet and ship blank. The
  // screen falls back to `type`, which is complete. Nothing invents a group.
  assert.equal(Object.values(nodes).filter((n) => n.pathway === "").length, 57);
  assert.equal(Object.values(nodes).filter((n) => !n.type).length, 0);
  assert.equal(nodes.Mitochondrial_Biogenesis.pathway, "");

  assert.equal(roles.by_measured_separation.length, 121);
  assert.equal(roles.phenotypes.length, 12);
  assert.deepEqual(roles.inputs, ["ResistanceExercise", "EnduranceExercise"]);
  // every ranked name is a node the file actually carries
  for (const id of roles.by_measured_separation) assert.ok(nodes[id], id);

  // the label cannot be stripped off the grouping on its way to a screen
  assert.equal(s.network.provenance, s.provenance);
  assert.throws(() => { delete s.network.provenance; }, TypeError);
  assert.throws(() => { s.network.nodes.integrin.pathway = "Calcium"; }, TypeError);
});

test("a scenario with no node table still loads and says so with empties", async () => {
  const s = await loadScenario("soce_on", readJson);
  assert.deepEqual(s.network.nodes, {});
  assert.deepEqual(s.network.roles, {});
});
