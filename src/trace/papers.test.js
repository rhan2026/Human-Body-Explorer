import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { PAPERS } from "./papers.js";
import { SOURCES } from "../sources/manifest.js";

/**
 * THE SOURCE YOU REACH IS THE SOURCE YOU NAME (CLAUDE.md §5). Each line is
 * "<Authors> et al., <year> ↗" and the year has to be the year of the thing the
 * link opens — not the year somebody expected the journal version to appear.
 */
const REFS = await readFile(new URL("../../../REFERENCES.md", import.meta.url), "utf8");

test("every paper line links the pinned DOI from the sources manifest, and nothing else", () => {
  assert.equal(PAPERS.francis.href, SOURCES.fiber[0].paper);
  assert.equal(PAPERS.lindenSantangeli.href, SOURCES.cell[0].paper);
  assert.equal(PAPERS.fowler.href, SOURCES.signalling[0].paper);
  for (const p of Object.values(PAPERS)) assert.match(p.href, /^https:\/\/doi\.org\/10\.\d{4,}\//);
});

test("the year on each line is the year of the thing the link opens", () => {
  for (const p of Object.values(PAPERS)) {
    const year = /, (\d{4})$/.exec(p.cite)?.[1];
    assert.ok(year, `${p.cite} carries no year`);
    const doi = p.href.replace("https://doi.org/", "");
    const row = REFS.split("\n").find((l) => l.includes(doi));
    assert.ok(row, `REFERENCES.md has no row for ${doi}`);
    const posted = /^10\.1101\/(\d{4})\./.exec(doi)?.[1];
    if (posted) {
      /* A bioRxiv DOI carries its posting date; the preprint the link opens is
         dated by it, and the row records no other year. */
      assert.equal(year, posted, `${p.cite}: the preprint DOI ${doi} was posted in ${posted}`);
    } else {
      /* The row's own date, with the DOI's digits taken out of the way. */
      const rest = row.split(doi).join("");
      assert.ok(rest.includes(year), `${p.cite}: REFERENCES.md's row for ${doi} does not carry ${year}:\n${row}`);
    }
  }
});

test("Fowler's validation is the authors' quoted score and says so; no other paper carries one", () => {
  assert.equal(PAPERS.fowler.validation.resistance, "18 / 21");
  assert.equal(PAPERS.fowler.validation.endurance, "12 / 16");
  assert.match(PAPERS.fowler.validation.note, /Quoted, not recomputed/);
  assert.equal(PAPERS.francis.validation, undefined);
  assert.equal(PAPERS.lindenSantangeli.validation, undefined);
});

test("Fowler's network size is the paper's quoted pair, and not the archive's own counts", async () => {
  const run = JSON.parse(await readFile(new URL("../../public/scenarios/fowler_resistance.json", import.meta.url), "utf8"));
  const species = Object.keys(run.nodes).length;
  const arrows = run.edges.length;
  assert.equal(PAPERS.fowler.network.components, "120");
  assert.equal(PAPERS.fowler.network.interactions, "259");
  assert.notEqual(Number(PAPERS.fowler.network.components), species, "121 is the archive's species count, not the paper's");
  assert.notEqual(Number(PAPERS.fowler.network.interactions), arrows, "264 is the archive's arrow count, not the paper's");
});

test("no line carries a title, a journal or a DOI as text — one quiet line (md rule 5)", () => {
  for (const p of Object.values(PAPERS)) {
    assert.match(p.cite, /^[A-Z][A-Za-z-]+ et al\., \d{4}$/);
  }
});
