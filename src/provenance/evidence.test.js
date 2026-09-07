import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

import { LADDER, REFUSED, refusal, meaning, groupRecord, readingOf, placeSheet } from "./evidence.js";

/**
 * The rule this whole file exists to hold, and it was learned the expensive way.
 *
 * Three independent reviewers were asked to write one humane sentence each about
 * what this project checked — the kind of sentence a reveal panel wants at the
 * top. Every one of the three came back overstated, and the corrections filled
 * pages: "reproduced" where the repository says compared, MATLAB where the
 * oracle was Octave, "the published curve" where it was a 600 dpi digitisation
 * of a printed figure, a factor of ten where the arithmetic gives six, and one
 * sentence that had already been *withdrawn* in writing by the file it cited.
 *
 * The lesson is not "be careful". It is that a summary of a validation result is
 * a new scientific claim, and this module is not allowed to make one. So:
 *
 *   PROSE ABOUT A LABEL — ours, and it is the six sentences in `meaning`.
 *   PROSE ABOUT THE SCIENCE — the record's own, verbatim, or absent.
 *
 * `no group invents a sentence` below is the enforcement, and it is the test to
 * keep if every other test here is thrown away.
 */

const scenariosDir = new URL("../../public/scenarios/", import.meta.url);

const everyShippedRecord = async () => {
  const files = (await readdir(scenariosDir)).filter((f) => f.endsWith(".json") && f !== "index.json");
  return Promise.all(
    files.map(async (f) => [f, JSON.parse(await readFile(new URL(f, scenariosDir), "utf8")).provenance]),
  );
};

test("the ladder is the six words PRD-v2 §7 defines, ordered by distance from an observation", () => {
  assert.deepEqual(LADDER, ["Measured", "Digitized", "Derived", "Mapped", "Curated", "Illustrative"]);
  // Distance, deliberately, and not confidence. Nothing in PRD-v2 §7 ranks these
  // by how much you should believe them, and a hand-drawn curve labelled
  // Illustrative is not "less true" — it is not a measurement of anything. The
  // axis the six do share is how many steps stand between the number and
  // somebody observing it, which is what a viewer is actually asking.
  assert.ok(!LADDER.includes(REFUSED));
});

test("every shipped scenario's label is on the ladder", async () => {
  for (const [file, record] of await everyShippedRecord()) {
    assert.ok(LADDER.includes(record.evidence_type), `${file}: ${record.evidence_type}`);
  }
});

test("every word on the ladder has a sentence, and an unknown word throws", () => {
  for (const word of LADDER) {
    assert.match(meaning(word), /\S/, word);
  }
  // A number carrying a label nobody defined must break the screen, not render
  // a blank line. CLAUDE.md §5: a number that cannot be labelled does not ship,
  // and silently shipping it unexplained is the same failure wearing a badge.
  assert.throws(() => meaning("Vibes"), /Vibes/);
  assert.throws(() => meaning(undefined), /evidence/i);
});

test("Modelled has no meaning here — it has a refusal", () => {
  assert.throws(() => meaning(REFUSED), /Modelled/);
  assert.match(refusal(), /Modelled/);
  // The refusal is the point, so it must say what the word would have meant and
  // why nothing here may claim it. PRD-v2 §7, decisions.md #9.
  assert.match(refusal(), /solver/i);
});

test("a record labelled Modelled is refused rather than rendered", () => {
  assert.throws(() => groupRecord({ evidence_type: REFUSED }), /Modelled/);
});

test("every field of every shipped record reaches exactly one group", async () => {
  // The §5 obligation in its literal form: the fourteen fields keep existing and
  // keep being reachable. A field that no group claims is a field a viewer can
  // never see, which is how "the full record is available" quietly stops being
  // true — so this asserts a partition, not a subset.
  for (const [file, record] of await everyShippedRecord()) {
    const shown = groupRecord(record).flatMap((g) => g.entries.map((e) => e.key));
    assert.deepEqual(
      [...shown].sort(),
      Object.keys(record).sort(),
      `${file}: grouped keys are not exactly the record's keys`,
    );
    assert.equal(new Set(shown).size, shown.length, `${file}: a field is shown twice`);
    for (const g of groupRecord(record)) {
      assert.ok(g.entries.length > 0, `${file}: empty group "${g.heading}"`);
      assert.match(g.heading, /\S/);
    }
  }
});

test("a field this code has never seen still reaches the viewer", () => {
  // The science layer adds provenance fields — `cannot_be_recomputed` and
  // `uncertainty` did not exist when the first scenario shipped. A grouping that
  // matched on a fixed list would drop the next one silently, and the next one
  // is exactly the kind of field that gets added: an absence somebody found.
  const groups = groupRecord({ evidence_type: "Derived", a_field_from_the_future: "something" });
  const keys = groups.flatMap((g) => g.entries.map((e) => e.key));
  assert.ok(keys.includes("a_field_from_the_future"));
});

test("no group invents a sentence — every word shown comes from the record", async () => {
  // THE ONE THAT MATTERS. Any text this module puts next to a number must be a
  // value the record already carries, character for character. Summarising is
  // forbidden here, not discouraged: see this file's header for what happened
  // when three careful readers each tried to write one sentence of summary.
  for (const [file, record] of await everyShippedRecord()) {
    for (const group of groupRecord(record)) {
      for (const entry of group.entries) {
        const own = record[entry.key];
        assert.equal(
          entry.text,
          typeof own === "string" ? own : JSON.stringify(own, null, 1),
          `${file}: "${entry.key}" was rewritten on its way to the screen`,
        );
      }
    }
  }
});

test("the absences get their own place, and it says so", async () => {
  // "The authors never published this, so we made it and labelled it ours" is
  // the most persuasive thing in the record and the most buried. It is a
  // heading, not a footnote in the middle of the parameters.
  const byFile = Object.fromEntries(await everyShippedRecord());
  const headingFor = (file, key) =>
    groupRecord(byFile[file]).find((g) => g.entries.some((e) => e.key === key))?.heading;

  // Marked from the data, not by counting. The three Francis scenarios carried
  // no absence fields at all until Q16 R8, so the group was MISSING there and a
  // positional selector landed on "How it was run" — the CSS did exactly that
  // and marked the integrator as an absence. They have one now: `exported_copy`
  // says which of the archive's turning points the browser's thinned copy does
  // not contain, which is the same kind of fact as a posterior band that never
  // shipped. The lesson survives the data changing under it, which is the only
  // reason this reads the kinds instead of an index.
  const kinds = (file) => groupRecord(byFile[file]).map((g) => g.kind);
  assert.deepEqual(kinds("soce_on.json").filter(Boolean), ["absence"]);
  assert.deepEqual(kinds("ampk_2dg_wt.json").filter(Boolean), ["absence"]);
  assert.deepEqual(kinds("fowler_resistance.json").filter(Boolean), ["absence"]);
  // And where the export dropped nothing a reader could see, it says nothing:
  // fowler and the 2-DG runs lose no turning point at their strides.
  assert.equal(byFile["fowler_resistance.json"].exported_copy, undefined);
  assert.match(byFile["soce_on.json"].exported_copy, /NOT THE ARCHIVE/);

  const absences = headingFor("fowler_resistance.json", "cannot_be_recomputed");
  assert.equal(headingFor("ampk_2dg_wt.json", "uncertainty"), absences);
  assert.equal(headingFor("ampk_2dg_wt.json", "series_defined_by_us"), absences);
  assert.equal(headingFor("ampk_francis_soce_on.json", "stands_in_for"), absences);
  assert.notEqual(headingFor("fowler_resistance.json", "validation"), absences);
});

test("a reading carries the four fields a file cannot", () => {
  // PRD-v2 §7: time, variable, value and unit change with every sample, so the
  // ten stored at the top of a scenario are not the fourteen. The panel shows
  // fourteen only when it is opened over a reading, and shows ten honestly
  // rather than inventing four.
  const reading = { series: "ATP", value: 6.181, unit: "mM", t: 6.1, provenance: { evidence_type: "Derived" } };
  assert.deepEqual(readingOf(reading), [
    { key: "variable", text: "ATP" },
    { key: "value", text: "6.181" },
    { key: "unit", text: "mM" },
    { key: "time", text: "6.1" },
  ]);
  assert.deepEqual(readingOf({ evidence_type: "Derived" }), []);
  assert.deepEqual(readingOf(null), []);
});

test("the six words are what a badge may draw, and the check is the ladder", async () => {
  // `Evidence.jsx` refuses an unknown word AT RENDER rather than at click, so a
  // number never sits on screen looking labelled until somebody asks. This
  // asserts the two share one list — a second copy would be a second opinion
  // about what §7 says, and the badge is the only place a word reaches a pixel.
  const badge = await readFile(new URL("../Evidence.jsx", import.meta.url), "utf8");
  assert.match(badge, /LADDER\.includes\(word\)/);
  assert.doesNotMatch(
    badge,
    /\[\s*"Measured"/,
    "Evidence.jsx has its own copy of the six — it must import LADDER",
  );
});

test("a record and a reading are both accepted, and a reading finds its record", () => {
  const record = { evidence_type: "Derived", model_id: "francis_skelmuscleca" };
  assert.deepEqual(groupRecord({ value: 1, provenance: record }), groupRecord(record));
});

test("the sheet never opens over the number that opened it", () => {
  const at = (left, bottom, width = 66, height = 19) => ({ left, width, bottom, height });

  // Wide: a column on the edge the badge is not on. Every labelled number in
  // this app lives in a right-hand panel, which is how the first build covered
  // its own badge at x=1395 with a sheet spanning x=960..1440.
  assert.equal(placeSheet(at(1357, 300), 1440, 900), "left");
  assert.equal(placeSheet(at(120, 300), 1440, 900), "right");
  // The tie is the badge's MIDPOINT on the centre line — left 687 + half of 66
  // — not its left edge. Written as 719 first, which is a badge whose midpoint
  // is 752 and therefore genuinely on the right half.
  assert.equal(placeSheet(at(687, 300), 1440, 900), "right", "dead centre stays on the right");
  assert.equal(placeSheet(at(688, 300), 1440, 900), "left");

  /* Narrow: the sheet takes the bottom 62%, so anything whose bottom is below
     38% of the height would be covered by a bottom sheet — the line at 320x640
     is y=243.

     THE NUMBERS BELOW ARE BADGE BOTTOMS IN WINDOW COORDINATES, and the
     qualifier is there because the first set was not. Lane 2 sent measurements
     taken in the gizmo layer's own space, off the top-left of the plate rather
     than the bottom of the badge inside it — two offsets in the same direction
     (an 81 px toolbar, and ~27 px down inside the plate), so every value was
     low by about a hundred pixels. The verdicts happened to be unchanged, which
     is the dangerous kind of wrong: a false attribution that no assertion
     catches. Re-measured in window space, their four framings give

       cell       136, 254, 301, 373, 478          4 of 5 open upward
       sarcomere  188, 252, 259, 294, 443, 461, 498  6 of 7
       fiber      226, 232, 471, 503                2 of 4
       fascicle   202, 208, 496                     1 of 3

     and those are the demo page's chrome, so the scale screens will differ
     again. The rule is what generalises; the y's are what proves it is needed. */
  assert.equal(placeSheet(at(20, 188), 320, 640), "sheet-bottom", "sarcomere's highest badge, above the line");
  assert.equal(placeSheet(at(20, 243), 320, 640), "sheet-bottom", "the line itself belongs to the bottom sheet");
  assert.equal(placeSheet(at(20, 244), 320, 640), "sheet-top");
  assert.equal(placeSheet(at(20, 443), 320, 640), "sheet-top", "sarcomere");
  assert.equal(placeSheet(at(20, 498), 320, 640), "sheet-top", "sarcomere's lowest");
  // Mine, not lane 2's: the cell scale's first badge at 320x640 measured
  // top y=606.2, height 19, so its bottom is 625 — far below the line, and
  // unreachable anyway until the footer stops painting over that panel.
  assert.equal(placeSheet(at(238, 625), 320, 640), "sheet-top", "the cell scale's first badge");

  // 640 px is narrow, not wide.
  assert.equal(placeSheet(at(600, 300), 640, 800), "sheet-bottom", "640 px is narrow, not wide");
  assert.equal(placeSheet(at(600, 300), 641, 800), "left");

  // No rect is no information; the default must still be a placement.
  assert.equal(placeSheet(null, 1440, 900), "right");
});

/**
 * The strongest sentence in a record is the one that says the published check
 * covered THIS run, and for two files it was a copy.
 *
 * All five AMPK scenarios shared one `validation` literal reading "the 2-DG
 * protocol these scenarios run". Three run it. The two `ampk_francis_*` files
 * run our coupled protocol — their own `whose_protocol` says "Francis protocol
 * ours" four lines below — so the record was handing the tightest coverage
 * claim in the set to the two runs with the least of it.
 *
 * Mechanical, because the failure was mechanical: a record whose protocol is
 * ours may not also say a published analysis was computed over the protocol it
 * runs. It is free to cite that analysis; it may not annex it.
 */
test("no record claims the published check was computed over a protocol that is ours", async () => {
  const ANNEXES = [/protocol (?:this scenario|these scenarios) runs?/i];
  let checked = 0;
  for (const [file, p] of await everyShippedRecord()) {
    const whose = String(p.whose_protocol ?? "");
    if (!/\bours\b/i.test(whose)) continue;
    checked += 1;
    for (const claim of ANNEXES) {
      assert.ok(
        !claim.test(p.validation ?? ""),
        `${file}: whose_protocol says "${whose}", so validation may not say the ` +
          `published check was computed over the protocol this run uses:\n  ${p.validation}`,
      );
    }
  }
  // A rename upstream that empties this loop would make it pass by covering
  // nothing. The two coupled AMPK files and the three Francis fibre files all
  // declare part of the protocol as ours.
  assert.ok(checked >= 5, `only ${checked} records declare a protocol of ours`);
});
