/**
 * The runs the ENERGY floor loads, and our protocol clock. No Three.js.
 *
 * TRIMMED 2026-09-05 (`ENERGY.md`): the two-arm bead apportioning, the three
 * switches, `DRAWN`, `molecules`, `coincident` and `drawnAt` all left with the
 * node-and-arrow picture they served. `energyBinding.js` is the binding now —
 * one bout, a 90-token pool, a calcium run, a ring.
 *
 * WHAT SURVIVES AND WHY. `REP_SECONDS`/`REPS` are the clock the fibre and this
 * floor share. `RUNS` is the visitor's one switch. The four constants at the
 * bottom are NOT part of this floor: `cellGeometry.js` still imports them, it
 * is a live runtime import of the fibre (`FiberScene.jsx` → `CELL_CAMERA`) and
 * of four foreign tests, and the contract restricts edits to that file to one
 * line. Deleting them here would fail module linking for the whole fibre
 * floor. They go when `cellGeometry.js` does.
 */

/** Our protocol: ten repetitions of a 0.65 s cycle, then 6.5 s of recovery. */
export const REP_SECONDS = 0.65;
export const REPS = 10;

/**
 * THE ONE SWITCH, and it changes one parameter. `ampk_francis_soce_on_camkk2_ko`
 * is the authors' own surgery (`gsa.knockout`) on the coupled run: kCaMKK set
 * to zero, same calcium, same demand, same clock. Measured on the shipped
 * pair: every energy series identical to the byte; `CaMKK_active_fraction`
 * identical too — the KO cuts CaMKK2's route INTO AMPK, not its response to
 * calcium; `pAMPK_fraction` 0.8910 → 0.9984 against 0.8910 → 0.8934.
 *
 * "Calcium path off" and not "CaMKK2 off": the visitor is told which INPUT is
 * removed, in the words the tour used to introduce it. LKB1 left the public UI
 * (owner, 2026-09-05: "Research / deeper mode에서 나중에"); the archive keeps it.
 */
export const RUNS = Object.freeze({
  normal: Object.freeze({ bout: "ampk_francis_soce_on", label: "Normal" }),
  calciumOff: Object.freeze({ bout: "ampk_francis_soce_on_camkk2_ko", label: "Calcium path off" }),
});

/* ── Kept for `cellGeometry.js` only — see the header. Not read by this floor. ── */

/** 0.25 mM per bead made the conserved 8.9205 mM pool 36 beads. */
export const POOL_BEADS = 36;
export const AMPK_MOLECULES = 20;
export const CAMKK_MOLECULES = 10;
/** Peak ATP demand of the INPUT the integrator ran on, quoted from provenance. */
export const PEAK_DEMAND_mM_PER_S = 1.88256;
