/**
 * "Francis et al., 2025 ↗" — one quiet line, and the door to the paper.
 *
 * md "Source 표현": 10–11 px, grey, no underline, darker on hover, opens the
 * paper in a new tab, and that is the end of it. No title, no journal, no DOI,
 * no "Source:". The native tooltip carries what the repository records about
 * the venue (`papers.js`) and nothing invented.
 *
 * THE ONE EXCEPTION IS THE ONE FLOOR WITH SECOND-ORDER EVIDENCE. Fowler carries
 * the authors' validation score (18/21, 12/16), which is model confidence
 * rather than model content and belongs off the stage — md: *"논문 source를
 * 클릭했을 때 나오는 tiny source popover 안에서만"*. So a paper WITH a
 * `validation` opens a tiny popover on press — two rows and "Open paper ↗" —
 * and a paper without one is a plain link. Rule 5 holds either way: what is on
 * the stage is one line.
 */

import { useEffect, useRef, useState } from "react";
import { PAPERS } from "./papers.js";
import "./trace.css";

export default function SourceLine({ paper, className = "" }) {
  const p = PAPERS[paper];
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (!p) return null;
  const line = (
    <>
      {p.cite} <span aria-hidden="true">↗</span>
    </>
  );
  if (!p.validation) {
    return (
      <a className={`source ${className}`.trim()} href={p.href} target="_blank" rel="noreferrer" title={p.hint} data-testid="source-line">
        {line}
      </a>
    );
  }
  return (
    <span className={`source__holder ${className}`.trim()} ref={box}>
      <button type="button" className="source" title={p.hint} aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="source-line">
        {line}
      </button>
      {open && (
        <span className="source__pop" role="dialog" aria-label="Model validation" data-testid="source-pop">
          <span className="source__pop-title">Model validation</span>
          <span className="source__pop-row"><span>Resistance</span><span>{p.validation.resistance}</span></span>
          <span className="source__pop-row"><span>Endurance</span><span>{p.validation.endurance}</span></span>
          {/* No tooltip here: the popover is the md's four lines and nothing
              more; `validation.note` stays in papers.js as the record. */}
          <a href={p.href} target="_blank" rel="noreferrer">
            Open paper <span aria-hidden="true">↗</span>
          </a>
        </span>
      )}
    </span>
  );
}
