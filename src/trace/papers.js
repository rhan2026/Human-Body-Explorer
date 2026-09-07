/**
 * The three quiet lines: "<Authors> et al., <year> ↗".
 *
 * ONE PAPER PER FLOOR (md §1) and the line is the whole of what the screen says
 * about it — no title, no journal, no DOI, no "Source:". The link is the
 * pinned DOI from `sources/manifest.js`, so a pin that moves there moves here.
 *
 * THE YEAR IS THE YEAR OF THE THING THE LINK OPENS. Francis is a bioRxiv
 * preprint whose DOI is dated 2025.05.22 and REFERENCES.md links its v1/v3;
 * the md's draft said 2026 and the orchestrator's ruling (2026-09-07) was §5's:
 * "the source you reach is the source you name". `papers.test.js` reads
 * REFERENCES.md and fails if a year here stops matching the row for that DOI.
 *
 * `hint` is the native tooltip and nothing more (md: "native tooltip 수준").
 * Only what the repository records: Fowler's title is in FOWLER-REPORT.md; the
 * other two carry the venue the pin names. Nothing is invented to fill a
 * field.
 *
 * `validation` exists on Fowler alone. 18/21 and 12/16 are the authors' own
 * score against nine published papers, transcribed from their Figure 3 —
 * `SignallingReadout.jsx` carries the same words and the scenario's
 * `cannot_be_recomputed` says why the archive cannot reproduce them. They are
 * quoted, never computed, and they are behind the source line (md: "tiny
 * source popover 안에서만"), never on the stage.
 */

import { SOURCES } from "../sources/manifest.js";

export const PAPERS = Object.freeze({
  francis: Object.freeze({
    cite: "Francis et al., 2025",
    href: SOURCES.fiber[0].paper,
    hint: "bioRxiv preprint",
  }),
  lindenSantangeli: Object.freeze({
    cite: "Linden-Santangeli et al., 2025",
    href: SOURCES.cell[0].paper,
    hint: "npj Systems Biology and Applications",
  }),
  fowler: Object.freeze({
    cite: "Fowler et al., 2024",
    href: SOURCES.signalling[0].paper,
    hint: "A computational model of resistance and endurance exercise signalling in skeletal muscle · Experimental Physiology",
    validation: Object.freeze({
      resistance: "18 / 21",
      endurance: "12 / 16",
      note: "the authors' own score against nine published papers, transcribed from their Figure 3. Quoted, not recomputed.",
    }),
    /* THE PAPER'S OWN SIZE FOR ITS NETWORK, typed because it is quoted: the
       shipped archive carries 121 species rows and 264 arrows, and
       `scenarioData.js` says "nothing that draws these may print 264 as the
       paper's number". These two are the paper's, shown only while the
       pointer rests on the background constellation (md), beside the source. */
    network: Object.freeze({ components: "120", interactions: "259" }),
  }),
});
