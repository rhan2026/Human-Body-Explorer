import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";

/**
 * EVERY IDENTIFIER THE SCREEN OFFERS IS ONE THIS REPOSITORY KNOWS.
 *
 * §5's floor is reach, and Q15 R1 made every badge open a paper or say why it
 * has none. R2 asks the next question: does what it opens correspond to
 * anything? A DOI that resolves to a 404 is a citation that looks like reach and
 * is not, and no browser test can tell the difference without the network.
 *
 * What CAN be checked offline is that the repository's own record agrees with
 * the screen. Measured 2026-08-27, five identifiers ship in the scenarios —
 * three papers and two archives — and all five are in `REFERENCES.md`:
 *
 *   10.1101/2025.05.22.655415   Francis et al., bioRxiv
 *   10.1038/s41540-025-00588-w  the AMPK paper
 *   10.1113/EP091712            Fowler et al., Exp Physiol
 *   zenodo 15485446             the Francis archive
 *   zenodo 10257879 / 10270049  the Fowler archives, v1.01 and v1.03
 *
 * The two Zenodo records are written two ways — `10.5281/zenodo.N` in the
 * scenarios and `zenodo.org/records/N` in REFERENCES — so this compares the
 * record NUMBER rather than the string. That difference is why a first sweep
 * reported them missing.
 */
test("every DOI and archive the scenarios cite is in REFERENCES.md", async () => {
  const refs = await readFile(new URL("../../../REFERENCES.md", import.meta.url), "utf8");
  const dir = new URL("../../public/scenarios/", import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && f !== "index.json");
  assert.ok(files.length > 3, "no scenarios to check — repoint this test");

  const cited = new Set();
  for (const f of files) {
    const raw = await readFile(new URL(f, dir), "utf8");
    for (const m of raw.matchAll(/10\.\d{4,}\/[A-Za-z0-9._;()/:-]+/g)) {
      /* Trailing sentence punctuation is prose, not part of the identifier. */
      cited.add(m[0].replace(/[.,;)]+$/, ""));
    }
  }
  assert.ok(cited.size >= 3, `only ${cited.size} identifiers found across ${files.length} scenarios`);

  const zenodoNumber = (id) => id.match(/zenodo\.(\d+)/)?.[1] ?? null;
  const missing = [...cited].filter((id) => {
    const n = zenodoNumber(id);
    /* Zenodo is written as a bare record number in REFERENCES and as a DOI in
       the scenarios. Everything else is compared as written. */
    return n ? !refs.includes(n) : !refs.includes(id);
  });

  assert.deepEqual(
    missing,
    [],
    `the scenarios cite identifiers REFERENCES.md does not record: ${missing.join(", ")}. A citation the ` +
      `repository itself cannot place is a reach a reader cannot follow`,
  );
});

/**
 * The front door names every paper the shipped records cite, with reach.
 *
 * Q19 R2: the landing footer said "the papers behind this are peer-reviewed"
 * while naming the anatomy's sources one line down with pressable licences —
 * the meshes were named and reachable on the one screen everybody sees, and
 * the science was a pronoun. A visitor who never descends never learned there
 * are three, or that the descent is one paper per scale.
 *
 * Tied to the RECORDS rather than to a list typed here: the paper_ids are
 * collected off the shipped scenarios, so adding a fourth paper without
 * putting it on the door goes red, and so does retiring one and leaving its
 * link behind.
 */
test("the landing footer links every paper the shipped scenarios cite", async () => {
  const dir = new URL("../../public/scenarios/", import.meta.url);
  const ids = new Set();
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json") || f === "index.json") continue;
    const p = JSON.parse(await readFile(new URL(f, dir), "utf8")).provenance;
    if (p?.paper_id) ids.add(p.paper_id);
  }
  assert.ok(ids.size >= 3, `only ${ids.size} papers cited — the shipped set has shrunk under this test`);

  const app = await readFile(new URL("../App.jsx", import.meta.url), "utf8");
  /* THE WHOLE LANDING FILE, NOT ITS FOOTER. The papers moved into the menu's
     `Data` section on 2026-08-30 at the owner's word — the section that named
     the meshes and their licences and said nothing about the science. The rule
     is unchanged and is the one that matters: every paper the shipped records
     cite is linked on the landing screen. Where on it is a design decision and
     has now been made twice. */
  /* AND THE LANDING SCREEN NAMES NONE OF THEM RIGHT NOW, ON PURPOSE — the
     `Data` section this rule followed onto the door left it again on 2026-09-06
     with the owner's *"Explore와 Data 섹션 삭제"*, and the whole figures-and-
     sources surface has been behind `uiMode.js`'s `SHOW_SOURCES = false` since
     2026-08-30 — their own switch, in their own words: *"논문 아예 다 빼는데 일단
     ui상으로만 빼 그리고 나중에 붙이자"*.
     SO THIS INVERTS WHILE THE SWITCH IS OFF AND COMES BACK WHEN IT IS ON. The
     rule was right and is not repealed: every paper the shipped records cite has
     to be linked on the door. What has changed is that the door is currently not
     showing sources at all, and a case that fails for that is a case that will be
     read as noise until someone deletes it. Tying it to the flag keeps it a rule
     rather than a wish — turn the figures back on and it grades again, unchanged.
     THE FIRST HALF STILL RUNS unconditionally: the shipped set must still cite at
     least three papers, which is what catches an archive quietly losing one. */
  const { SHOW_SOURCES } = await import("../uiMode.js");
  for (const id of ids) {
    const doi = id.replace(/^(doi|biorxiv):/, "");
    const linked = app.includes(`https://doi.org/${doi}`);
    if (SHOW_SOURCES) {
      assert.ok(
        linked,
        `the shipped records cite ${id} and the landing footer does not link it — ` +
          "the door names the meshes' sources and went back to calling the science 'the papers'",
      );
    } else {
      assert.equal(
        linked,
        false,
        `${id} is linked on the door while SHOW_SOURCES is off. That is not forbidden — but the ` +
          "switch is meant to take the whole sources surface out at once, and one paper left " +
          "behind is the state it exists to prevent",
      );
    }
  }
});

/**
 * Each scale's run cites that scale's paper.
 *
 * Q19 R6 pressed every badge on the three deep scales and read the doi.org
 * links: the fibre opens Francis, the cell opens Linden-Santangeli (plus
 * Francis, whose run drives its input), signalling opens Fowler. Correct — and
 * held together only by which scenario id each scale's constants name. Swap an
 * id and every badge stays green while opening the wrong authors.
 *
 * Pinned at the constants, not the browser: the scenario each scale loads must
 * carry the paper that scale's footer names.
 */
test("each scale's scenario cites the paper its screen names", async () => {
  const paperOf = async (id) =>
    JSON.parse(await readFile(new URL(`../../public/scenarios/${id}.json`, import.meta.url), "utf8"))
      .provenance.paper_id;

  const { SCENARIOS } = await import("../signalling/signallingBinding.js");
  for (const id of Object.values(SCENARIOS)) {
    assert.equal(await paperOf(id), "doi:10.1113/EP091712", `signalling loads ${id}, which is not Fowler's`);
  }

  const { RUNS } = await import("../cell/cellBinding.js");
  for (const [key, run] of Object.entries(RUNS)) {
    /* `.filter(Boolean)` BECAUSE THE THIRD RUN LEFT — 2026-09-05, owner:
       *"Research / deeper mode에서 나중에"*. `RUNS` carried a `control` until the
       LKB1 condition came off the public UI, and this loop kept reading it: the
       failure was `paperOf(undefined)` opening `public/scenarios/undefined.json`,
       which surfaced as this case's own assertion message about the LANDING
       FOOTER — a rejected promise wearing the wrong sentence. What it grades is
       unchanged: every scenario a run loads must be Linden-Santangeli's. */
    for (const id of [run.bout, run.control].filter(Boolean)) {
      assert.equal(
        await paperOf(id),
        "doi:10.1038/s41540-025-00588-w",
        `the cell's "${key}" run loads ${id}, which is not Linden-Santangeli's`,
      );
    }
  }

  /* THE FIBRE IS BACK TO ONE RUN, and the count was never what this test is
     about. It gained a switch on 2026-08-30 — `soce_on` and `soce_off` — so
     `SCENARIO_ID` became `RUNS` and this asserted `>= 2`. The switch came down
     the same day, measured: pressing it moved the drawn store by 1.14
     percentage points and the sarcomere by 1.0 nm of 300, so it was a control
     with no result on screen (`DevFiberScene.jsx` carries the numbers).
     THE SUBSTANTIVE ASSERTION IS UNTOUCHED — every run this scale can load has
     to be Francis's, and it is still checked for every id the file names. What
     moved is the arity, which was a fact about the UI and not about the paper.
     The pattern is deliberately loose so it holds under either shape: it reads
     every `soce_*` id in the file, whether they sit in a `RUNS` table or in one
     `RUN_ID` constant. `>= 1` because a fibre scale that names NO run has lost
     its binding, which is the failure this half was ever guarding. */
  const fibreScene = await readFile(new URL("../DevFiberScene.jsx", import.meta.url), "utf8");
  const ids = [...new Set([...fibreScene.matchAll(/"(soce_[a-z]+)"/g)].map((x) => x[1]))];
  assert.ok(ids.length >= 1, `the fibre names ${ids.length} runs; it names no scenario at all`);
  for (const id of ids) {
    assert.equal(
      await paperOf(id),
      "biorxiv:10.1101/2025.05.22.655415",
      `the fibre loads ${id}, which is not Francis's`,
    );
  }
});
