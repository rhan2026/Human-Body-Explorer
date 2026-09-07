/**
 * The one exercise rail, on the front door and on every motion window
 * (owner, 2026-08-31: "unify the side bar… the EXERCISE text will disappear
 * and Idle will be added on the list of possible motion at the top").
 *
 * Idle IS the front door: picking it goes to the explorer, picking a
 * movement goes to its motion window — the rail navigates, it does not
 * select-in-place. The active row is wherever the viewer is standing.
 */

/**
 * What each category is called on screen. Read off `muscle-map.json`'s own
 * `category` field — the manifest already carries `resistance` / `endurance`
 * for all six, so nothing is classified twice.
 *
 * `docs/20260905-fix/body.md` §12 asks for the grouping, and asks for it in
 * these two words. A movement whose category is missing lands in neither group
 * and draws before them rather than under a guessed heading.
 */
const CATEGORY_LABEL = { resistance: "Resistance", endurance: "Endurance" };

export default function MotionList({ exercises, activeId, onPick, grouped = false }) {
  const rows = [["idle", { label: "Idle" }], ...Object.entries(exercises ?? {})];

  /* GROUPED ONLY WHERE IT IS ASKED FOR. The drawer's rail has been one flat list
     since the unification and there is no complaint about it; the top selector
     is where the six movements are the floor's navigation and the split between
     lifting and running is the thing a visitor is choosing between. Same
     component either way — a second list component is a second place the active
     row, the test ids and the Idle behaviour would have to agree. */
  if (grouped) {
    const order = ["resistance", "endurance"];
    const loose = rows.filter(([, s]) => !CATEGORY_LABEL[s.category]);
    return (
      <div className="exlist exlist--grouped" role="group" aria-label="Motions">
        {loose.map(([key, spec]) => (
          <Row key={key} id={key} spec={spec} activeId={activeId} onPick={onPick} />
        ))}
        {order.map((cat) => {
          const inCat = rows.filter(([, s]) => s.category === cat);
          if (!inCat.length) return null;
          return (
            <div className="exlist__group" key={cat}>
              <p className="exlist__heading">{CATEGORY_LABEL[cat]}</p>
              {inCat.map(([key, spec]) => (
                <Row key={key} id={key} spec={spec} activeId={activeId} onPick={onPick} />
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="exlist" role="group" aria-label="Motions">
      {rows.map(([key, spec]) => (
        <button
          key={key}
          type="button"
          className={activeId === key ? "chip chip--on chip--grow exlist__row--on" : "chip chip--grow"}
          data-testid={`exercise-row-${key}`}
          data-active={activeId === key ? "true" : "false"}
          aria-pressed={activeId === key}
          onClick={() => onPick(key)}
        >
          {spec.label}
        </button>
      ))}
    </div>
  );
}

/* The row, lifted out so the flat list and the grouped one cannot drift on the
   thing that matters about a row — its test id, its active state and the fact
   that Idle navigates like any other. */
function Row({ id, spec, activeId, onPick }) {
  return (
    <button
      type="button"
      className={activeId === id ? "chip chip--on chip--grow exlist__row--on" : "chip chip--grow"}
      data-testid={`exercise-row-${id}`}
      data-active={activeId === id ? "true" : "false"}
      aria-pressed={activeId === id}
      onClick={() => onPick(id)}
    >
      {spec.label}
    </button>
  );
}
