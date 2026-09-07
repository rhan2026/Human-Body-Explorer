/**
 * The muscle-group chips, shared by the front door and every motion window
 * (owner, 2026-08-31: the classification "has the function to dim out and
 * highlight specific muscles" — so it is the one highlighting control).
 *
 * Multi-select: `selected` is a Set of group keys; a chip toggles its group,
 * All selects every group. The scenes decide what "off" paints as — the
 * explorer hides, the motion scene dims hard.
 */

export default function GroupChips({ groups, selected, onChange }) {
  const keys = Object.keys(groups ?? {});
  const allOn = keys.length > 0 && keys.every((k) => selected.has(k));
  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };
  return (
    <div className="chips">
      {/* ONE CLASS FOR THE STATEMENT, PER-CONTEXT PAINT — 2026-09-04.
          The look is unchanged and the owner's call stands: "Selected wears the
          button's own face; UNSELECTED dims" (2026-08-31) — the blue
          selected-state left these chips. What changed is that "on" is now said
          the same way here as in `MotionScene`, `MotionList` and
          `FiberControls`, and `styles.css` gives THIS row the plain face back.
          Why it matters: `gate-legibility` holds that paint and speech agree,
          and it could only read one of the app's two ways of painting "on". With
          every group selected — which is how the door opens — nothing was dim,
          so there was no inversion to infer from and seventeen chips read as
          claiming a state nothing showed. Two conventions for one statement is
          the defect; the paint was never the problem. */}
      <button
        type="button"
        className={allOn ? "chip chip--on" : "chip chip--dim"}
        aria-pressed={allOn}
        onClick={() => onChange(new Set(keys))}
      >
        All
      </button>
      {Object.entries(groups ?? {}).map(([key, group]) => (
        <button
          key={key}
          type="button"
          className={selected.has(key) ? "chip chip--on" : "chip chip--dim"}
          aria-pressed={selected.has(key)}
          onClick={() => toggle(key)}
        >
          <span className="dot" style={{ background: group.color }} />
          {group.label}
        </button>
      ))}
    </div>
  );
}
