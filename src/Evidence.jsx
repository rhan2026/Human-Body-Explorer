/**
 * The evidence word that rides beside a number on screen, and the door behind it.
 *
 * PRD-v2 §7 defines six labels and requires one on every visible number. Until
 * now the fibre panel carried a single badge in its footer covering the whole
 * panel, which is the wrong granularity in a way that flatters us: `Derived`
 * over a list that also holds a Hill curve with textbook constants and an ATP
 * counter in arbitrary units reads as though the published model produced all
 * of them. It produced two.
 *
 * Extracted from `Descent.jsx:Fact` rather than written again — same styling,
 * one definition, so the two surfaces cannot drift into disagreeing about what
 * a badge looks like. Descent keeps its own `Fact` wrapper for the three-column
 * grid it lives in; only the badge itself moved here.
 *
 * IT IS NOW A BUTTON, and that is this lane's whole change. The badge was
 * already on all nineteen labelled numbers in the app and was a dead pixel on
 * every one of them: the fourteen-field record hung off a `title` attribute,
 * which no touch screen has ever shown anybody. The project's central claim —
 * every number here came out of a published model and says which — was true and
 * unreadable. Making the one shared badge open the record reaches every number
 * at once, which is also why no scale component had to be edited to get it.
 *
 * THE SLOT, for lane 2's gizmo and for anything else that draws a number:
 *
 *     <EvidenceBadge source={reading} title={why}>{word}</EvidenceBadge>
 *
 * `source` is optional and is either a frozen provenance record or a reading
 * carrier from `scenarioData.js` (which holds one under `.provenance`, plus the
 * four per-reading fields a file cannot store). Omit it and the panel still
 * answers — the word's meaning and this number's own `title` — and says that no
 * record is attached rather than implying one was lost.
 *
 * PASS IT WHEN THE NUMBER IS A FUNCTION OF THAT SCENARIO'S VALUES, and not
 * otherwise. This is the same rule the `evidence` prop already follows in
 * `CellReadout` — "passed rather than assumed so that a row can never inherit a
 * neighbour's label" — and it matters more here, because the panel prints the
 * record's paper, archive and validation under a heading that reads "whose work
 * is this". Hanging the AMPK record off a threshold transcribed from a preprint
 * would attribute the transcription to the model, which is the §5 failure with
 * better typography. A quoted number's `title` is its whole provenance.
 *
 * There is deliberately no second badge component and no second opinion about
 * what an evidence word means — `provenance/evidence.js` holds that alone.
 */

import { SHOW_SOURCES } from "./uiMode.js";
import { useRef, useState } from "react";
import SourcePanel from "./provenance/SourcePanel.jsx";
import { LADDER, REFUSED } from "./provenance/evidence.js";
import "./provenance/provenance.css";

/**
 * @param children the label — one of PRD-v2 §7's six words
 * @param title    the long form, still on hover for a mouse; it is also the
 *                 sentence the panel shows about this particular number
 * @param source   optional provenance record or reading carrier (see above)
 */
export default function EvidenceBadge({ children, title, source, paper = null }) {
  const [open, setOpen] = useState(false);
  /* The button itself, not a rect taken when it was pressed. The sheet opens
     away from the number (see `placeSheet`), and the first version stored the
     rect at click time — which went stale the moment the viewport changed,
     because the badge reflows with everything else. Measured: opened at 1440
     with the badge's bottom at 305, then narrowed to 320x640, and the placement
     was still being decided from a y the badge no longer had. Handing over the
     element lets the panel re-measure on every render instead. */
  const badge = useRef(null);
  const word = typeof children === "string" ? children : String(children);

  /* CHECKED WHEN THE BADGE DRAWS, NOT WHEN SOMEBODY PRESSES IT. The panel has
     to reject a word it has no meaning for, and doing only that would leave a
     number sitting on screen looking labelled until the one viewer who asks
     detonates it. CLAUDE.md §5 is about shipping, so the failure belongs at the
     moment of shipping — same posture as `scenarioData.js`, which refuses a
     scenario with no evidence_type rather than handing one out and hoping. */
  if (!LADDER.includes(word)) {
    throw new Error(
      word === REFUSED
        ? `"${REFUSED}" is not a label this repository may use (PRD-v2 §7, decisions.md #9)`
        : `"${word}" is not one of PRD-v2 §7's evidence words: ${LADDER.join(", ")}`,
    );
  }

  if (!SHOW_SOURCES) return null;
  return (
    <>
      {/* NO `title`. It was a second copy of `why`, reachable only by a mouse
          resting on the right pixel — the record below renders the same string
          for everyone, on a click, on any input. `SignallingReadout.jsx` had
          already written the argument for its own paragraph: *"a tooltip has
          not been cut, it has been put where only a mouse user hovering the
          right pixel will ever see it. The §5 record belongs there; a paragraph
          does not."* The same is true of this attribute.
          Measured 2026-08-27 on signalling, where it mattered: the badges
          carried titles of 14, 14, 7, 10, 16 and **40** words — 101 of the
          scale's 129 hidden words at rest, and 200 during a pass, which broke
          `gate-word-budget`'s floor that hidden may not exceed shown. §5's
          floor is REACH, and the click is the reach. */}
      <button
        type="button"
        className="evidence"
        ref={badge}
        aria-expanded={open}
        /* THE ACTION, NOT THE DESTINATION. This read "— where this number came
           from", which describes what you would find rather than what pressing
           does, and a button is named by its action. Shorter is the side effect
           and it matters: `gate-word-budget` counts an accessible name as a
           hidden word, and fifteen badges on the fibre scale spent 94 of them
           saying the same six words. That gate's third case is aimed at prose
           parked in a `title` — an accessible name is not that, it is the
           button's primary text for anyone using a screen reader, and the honest
           way past the collision is a better name rather than a looser gate. */
        aria-label={`${word} — show source`}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>
      {open && (
        <SourcePanel word={word} why={title} source={source} paper={paper} anchor={badge} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
