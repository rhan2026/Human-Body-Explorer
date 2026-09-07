/**
 * What each screen leans on, for the one control that answers "where does this
 * come from?" — `SourcesPanel.jsx` renders these rows and nothing else does.
 *
 * CONTRACT. A row is a citation, not a claim: `name` is whose work, `of` says
 * which part of the screen leans on it, `paper`/`code` are full URLs a visitor
 * can press. A row with neither link says outright that nothing published
 * stands behind that part — the same wording family the evidence badges use
 * (`gate-evidence-survives`). No numbers in `of`: counted values do not get
 * typed into prose (CLAUDE.md §9), and the per-number story stays with the
 * badges and the scenario records, which remain the deep route.
 *
 * The URLs restate REFERENCES.md §1–§2's pins — paper DOIs via doi.org, code
 * at the pinned Zenodo record or GitHub commit, never a default branch. If a
 * pin moves there, it moves here; both quote `docs/PRD-v2.md` §4.
 *
 * The front door is deliberately absent: `App.jsx`'s footer already names all
 * three papers with DOI links, ungated, and a second copy of one claim is two
 * claims to reconcile.
 */
export const SOURCES = {
  body: [
    {
      name: "BodyParts3D",
      of: "muscle and bone meshes",
      paper: null,
      code: "https://lifesciencedb.jp/bp3d/",
    },
    {
      name: "Z-Anatomy",
      of: "the remaining muscle meshes",
      paper: null,
      code: "https://www.z-anatomy.com/",
    },
    {
      name: "BodyExplorer",
      of: "the mesh set ours is derived from",
      paper: null,
      code: "https://github.com/johanbellander/BodyExplorer",
    },
    {
      name: "Muscle roles",
      of: "which muscles light up — our curated mapping; no published source stands behind it",
      paper: null,
      code: null,
    },
    {
      name: "Effort curve",
      of: "muscle brightness — hand-authored; no published model stands behind it",
      paper: null,
      code: null,
    },
  ],
  fiber: [
    {
      name: "Francis et al.",
      of: "calcium, force and the SR store — their model, our port",
      paper: "https://doi.org/10.1101/2025.05.22.655415",
      code: "https://doi.org/10.5281/zenodo.15485446",
    },
  ],
  cell: [
    {
      name: "Linden-Santangeli et al.",
      of: "the AMPK sensor — their model, our run",
      paper: "https://doi.org/10.1038/s41540-025-00588-w",
      code: "https://github.com/natejlinden/AMPK/tree/71513c063dee2e985c024099f44586be403dfc7d",
    },
    {
      name: "Francis et al.",
      of: "the exercise driving the sensor — their stride, our mapping",
      paper: "https://doi.org/10.1101/2025.05.22.655415",
      code: "https://doi.org/10.5281/zenodo.15485446",
    },
  ],
  signalling: [
    {
      name: "Fowler et al.",
      of: "the network and both bouts — their table, our port",
      paper: "https://doi.org/10.1113/EP091712",
      code: "https://doi.org/10.5281/zenodo.10257879",
    },
  ],
};
