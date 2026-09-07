/**
 * The answer to "where did this number come from?", one gesture from the number.
 *
 * The shape is the argument. A viewer arrives with one question and almost never
 * the fourteen-field version of it, so the panel opens with the one sentence
 * that answers it — what kind of number this is — and everything heavier sits
 * below, in the order somebody actually asks: whose work, what was checked,
 * where it disagrees, what could not be got. The record itself is at the
 * bottom, whole, because PRD-v2 §7's fourteen fields are the thing this project
 * is demonstrating and shrinking them is allowed while deleting them is not.
 *
 * WHAT IS OURS AND WHAT IS THE RECORD'S. Every sentence here that describes the
 * science is a string out of the scenario file, rendered unchanged. The prose
 * this component owns is about labels and headings only. `evidence.js` holds
 * that contract and `evidence.test.js` enforces it — read the header of either
 * before adding a sentence.
 *
 * One panel at a time, and it closes on Escape or on any click outside it. It
 * is a portal onto `document.body` because the badges live inside scale panels
 * that scroll and clip, and an explanation that is cut off by its own container
 * is the failure this lane exists to fix.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LADDER, meaning, refusal, groupRecord, readingOf, placeSheet } from "./evidence.js";
import "./provenance.css";

/**
 * The paper, where a viewer can open it.
 *
 * Both prefixes resolve through doi.org — `biorxiv:10.1101/…` is a DOI with a
 * server name in front of it. A link is not a claim, which is why this is the
 * only outbound thing on the panel: everything else would be us saying
 * something about the paper rather than handing it over.
 */
function paperHref(paperId) {
  const doi = String(paperId ?? "").replace(/^(doi|biorxiv):/, "");
  return /^10\.\d{4,}\//.test(doi) ? `https://doi.org/${doi}` : null;
}


/**
 * Where an ARCHIVE identifier goes when somebody presses it.
 *
 * Q15 R5, 2026-08-27. Every record names the archive its numbers were produced
 * from and none of them linked it: `zenodo:10.5281/zenodo.15485446` on the
 * Francis runs, `github:natejlinden/AMPK@71513c063dee…` on the AMPK ones. The
 * PAPER opened; the code did not — and the code is what somebody checking the
 * port would actually want. `exercise.ipynb cell 7`, cited twenty times across
 * the shipped records, lives inside that GitHub tree.
 *
 * The field is prose with an identifier at the front — "…@sha (branch rev1, the
 * branch the published figures were produced on…)" — so this reads the head and
 * ignores the commentary. A pinned SHA is the point: the link goes to the tree
 * that produced these numbers, not to whatever `main` says today.
 */
function archiveHref(text) {
  const head = String(text ?? "").trim();
  const gh = head.match(/^github:([\w.-]+)\/([\w.-]+)@([0-9a-f]{7,40})/i);
  if (gh) return `https://github.com/${gh[1]}/${gh[2]}/tree/${gh[3]}`;
  const zen = head.match(/^zenodo:(10\.\d{4,}\/[\w.-]+)/i);
  if (zen) return `https://doi.org/${zen[1]}`;
  return null;
}

/** The six, with this one marked. Distance from an observation — see `evidence.js`. */
function Ladder({ word }) {
  return (
    <ol className="prov-ladder" aria-label="how far this number sits from somebody observing it">
      {LADDER.map((w) => (
        <li key={w} className={w === word ? "is-here" : undefined} aria-current={w === word || undefined}>
          {w}
        </li>
      ))}
    </ol>
  );
}

export default function SourcePanel({ word, why, source, paper = null, anchor = null, onClose }) {
  const box = useRef(null);

  /* THE SHEET OPENS AWAY FROM THE NUMBER, and where that is depends on the
     viewport as much as on the badge — so it is recomputed on every render and
     a resize forces one. Placement decided at open time went stale the moment a
     phone was rotated. The rule itself is `placeSheet` in evidence.js, where it
     is arithmetic and has its own tests; here it is only wiring. */
  const [, resized] = useState(0);
  useEffect(() => {
    const onResize = () => resized((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const place = placeSheet(anchor?.current?.getBoundingClientRect(), window.innerWidth, window.innerHeight);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    /* Pointerdown rather than click: the badge that opened this panel is itself
       inside a scene that treats pointerdown as "the viewer took over" (see
       cinematic.js), so waiting for click would let a stale panel sit through a
       camera move. */
    /* AND THE BADGE THAT OPENED IT IS NOT "OUTSIDE". Q12 R5, 2026-08-27: the
       badge carries `aria-expanded`, which announces a disclosure, and a
       disclosure closes when you press it again. Pressing it again did nothing,
       on all three deep scales. `Evidence.jsx`'s handler is a real toggle —
       `setOpen((v) => !v)` — and the two handlers were cancelling: the
       pointerdown here fired first and closed the panel, then the button's own
       click reopened it. Net effect zero, which is indistinguishable on screen
       from a control that does nothing.
       `anchor` was already being passed in for placement; it is the exclusion
       too. Escape and a press outside still close, and the pointerdown timing
       above is unchanged. */
    const onDown = (e) =>
      box.current &&
      !box.current.contains(e.target) &&
      !anchor?.current?.contains(e.target) &&
      onClose();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    box.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose, anchor]);

  let groups = [];
  let reading = [];
  let record = null;
  try {
    record = source?.provenance ?? source ?? null;
    groups = record ? groupRecord(source) : [];
    reading = readingOf(source);
  } catch (err) {
    /* A record that cannot be grouped is a record that must be seen failing.
       CLAUDE.md §5: the silent version of this is a number shipping unlabelled. */
    groups = [{ heading: "This record could not be read", kind: null, entries: [{ key: "error", text: String(err.message) }] }];
  }

  /* THE PAPER A NUMBER LEANS ON, EVEN WHEN NO ARCHIVE IS ATTACHED TO IT.
     Q15 R1, 2026-08-27: pressed all 21 badges. Seventeen open a full record and
     link a DOI. One of the four that do not is the cell's `Mapped` protocol
     badge, whose own sentence reads *"The stride is the authors' — the bioRxiv
     preprint, p.17, gives 0.1625 s of 100 Hz activation per 0.65 s stride"* —
     it NAMES a paper and a page and gives no way to get there, while every
     `Derived` badge two hundred pixels away links the same preprint.
     `decisions.md` #18 is why it has no `source`: a record attaches when the
     number is a function of that scenario's values, and this mapping is ours.
     That rule is about the ARCHIVE, not about the paper — §5's floor is reach,
     and "p.17 of a preprint" is not reach.
     `paper` is the way to say "ours, leaning on theirs" without handing our
     number to their provenance. The record still says "No scenario record is
     attached to this number." */
  const href = paperHref(record?.paper_id ?? paper);

  return createPortal(
    <aside className={`prov is-${place}`} ref={box} tabIndex={-1} role="dialog" aria-label={`Where ${word} numbers come from`}>
      <header className="prov-head">
        <span className="prov-word">{word}</span>
        <button type="button" className="prov-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>

      <p className="prov-meaning">{meaning(word)}</p>
      {why && <p className="prov-why">{why}</p>}

      <Ladder word={word} />
      <p className="prov-refusal">{refusal()}</p>

      {reading.length > 0 && (
        <dl className="prov-reading">
          {reading.map((e) => (
            <div key={e.key}>
              <dt>{e.key}</dt>
              <dd>{e.text}</dd>
            </div>
          ))}
        </dl>
      )}

      {href && (
        <p className="prov-paper">
          <a href={href} target="_blank" rel="noreferrer">
            Open the paper
          </a>
        </p>
      )}

      {/* THE SECOND GESTURE, and it is a `<details>` because the browser already
          owns this behaviour — keyboard, screen readers and find-in-page all
          work on it without a line from us.
          Closed by default is the whole design. A viewer asked one question and
          the honest short answer is four lines; the AMPK record underneath runs
          2,376 px, and printing it unbidden is how the fourteen fields became
          furniture nobody reads. The count is on the summary so the depth is
          visible before the click — CLAUDE.md §9: show the number, do not
          promise it in a sentence. */}
      {groups.length > 0 && (
        <details className="prov-record">
          <summary>
            The whole record · {groups.reduce((n, g) => n + g.entries.length, 0) + reading.length} fields
          </summary>
          {groups.map((group) => (
            <section key={group.heading} className={`prov-group${group.kind ? ` prov-group--${group.kind}` : ""}`}>
              <h3>{group.heading}</h3>
              {group.entries.map((entry) => (
                <p key={entry.key} className="prov-entry">
                  <span className="prov-key">{entry.key}</span>
                  {/* THE ARCHIVE IS THE ONE FIELD IN HERE SOMEBODY WOULD PRESS.
                      Q15 R5: every record names the archive its numbers came
                      from and none linked it — `zenodo:10.5281/zenodo.15485446`
                      on the Francis runs, `github:natejlinden/AMPK@71513c06…` on
                      the AMPK ones. The paper opened; the CODE did not, and the
                      code is what somebody checking the port wants.
                      `exercise.ipynb cell 7` is cited twenty times across the
                      shipped records and lives inside that GitHub tree — the
                      only copy in this repository is under `local/`, which is
                      gitignored, so the archive link is the citation's only
                      honest route. */}
                  {archiveHref(entry.text) ? (
                    <>
                      <a href={archiveHref(entry.text)} target="_blank" rel="noreferrer">
                        Open the archive
                      </a>{" "}
                    </>
                  ) : null}
                  {entry.text}
                </p>
              ))}
            </section>
          ))}
        </details>
      )}

      {groups.length === 0 && (
        /* Says what is true and stops. The first draft said "no published model
           stands behind this one", which is a claim about the science and is
           wrong for half the numbers that land here: the bead count is our
           arithmetic over the model's own concentrations, and a paper very much
           stands behind those. What is actually the case is only that no record
           was attached to this badge — the sentence above it is the answer. */
        <p className="prov-none">No scenario record is attached to this number.</p>
      )}

      {/* ONE CLAIM ABOUT THE WHOLE ARTIFACT, so it is written once and two
          spellings of it would be two claims. The anchor this used to name —
          "App.jsx:349's, character for character" — is gone; that copy left with
          the Explore and Data sections on 2026-08-31 and the note outlived it.

          AND IT SAID SOMETHING FALSE UNTIL 2026-09-05. "The papers behind this
          are peer-reviewed" is true of two of the three and not of the one this
          app leans on hardest: `REFERENCES.md:48` records Francis et al. as a
          bioRxiv **preprint v3**, and Francis is calcium, force, fatigue and
          recovery — the whole of what FIBER draws and the input ENERGY's
          calcium arm rides in on. Linden-Santangeli (npj Syst Biol Appl) and
          Fowler (Exp Physiol) are the reviewed two.
          CAUGHT BY THE ENERGY LANE'S OWN AUDIT, on its floor, in a copy of this
          sentence. §5 forbids exactly this shape — writing that something was
          reviewed when it was not is a claim, not a label — and a blanket
          "peer-reviewed" is how a preprint gets laundered into a journal by a
          sentence nobody re-read after the sources changed.
          NAMED RATHER THAN HEDGED. "Some of it is reviewed" is true and reaches
          nobody; which model is which is the fact a visitor would actually want,
          and it is one clause. */}
      <p className="prov-review">
        The signalling and AMPK models behind this are peer-reviewed; the calcium one is still a
        preprint. This reading of them is neither — nothing here has been externally reviewed.
      </p>
    </aside>,
    document.body,
  );
}
