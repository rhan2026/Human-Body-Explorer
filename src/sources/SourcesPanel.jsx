/**
 * One quiet control per screen: "Sources", opening the papers that screen
 * leans on. The reattachment path for what `uiMode.js` took off on 2026-08-30
 * — the owner's words were "일단 ui상으로만 빼 그리고 나중에 붙이자", and this
 * is the "붙이자" that does not bring the old clutter back with it.
 *
 * WHY THIS SHAPE. The old look stacked evidence badges into the teaching text,
 * which is why it was cut. This is the opposite arrangement: the teaching
 * layer stays wordless about sources, and the whole answer sits behind one
 * word in the footer. §5's floor is reach, and one press is reach.
 *
 * `SHOW_SOURCES` false → nothing renders, not even the summary. The flag is a
 * module constant, so the early return can sit before everything and the
 * mounted line in each footer costs the minimal mode zero pixels and zero
 * words.
 *
 * A `<details>`, not a portal dialog: the browser owns open/close, keyboard
 * and screen-reader behaviour, and this panel — unlike `SourcePanel.jsx` — is
 * not anchored to a number it must not cover. It opens upward from the footer.
 *
 * ponytail: no Escape/outside-press close — a <details> keeps its own state.
 * If rounds find that unlivable, lift the keydown/pointerdown pair from
 * provenance/SourcePanel.jsx.
 */

import { SHOW_SOURCES } from "../uiMode.js";
import { SOURCES } from "./manifest.js";
import "./sources.css";

export default function SourcesPanel({ scale }) {
  const rows = SOURCES[scale];
  if (!SHOW_SOURCES || !rows) return null;
  return (
    <details className="sources" data-testid="sources">
      <summary>Sources</summary>
      <ul className="sources__panel">
        {rows.map((row) => (
          <li key={row.name + row.of}>
            <span className="sources__name">{row.name}</span>
            <span className="sources__of">{row.of}</span>
            {(row.paper || row.code) && (
              <span className="sources__links">
                {row.paper && (
                  <a href={row.paper} target="_blank" rel="noreferrer">
                    paper
                  </a>
                )}
                {row.code && (
                  <a href={row.code} target="_blank" rel="noreferrer">
                    code
                  </a>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
