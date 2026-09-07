import { useEffect, useState } from "react";

/**
 * The line from a pick's answer to the pick.
 *
 * TWO SCALES ASK A VIEWER TO POINT AT SOMETHING, and until 2026-08-26 both
 * answered somewhere else. The body scale put the muscle's record in a panel
 * pinned top-left — measured at 1440x900, a click at (685, 398) answered at
 * (115, 82), 572 px, 34% of the screen diagonal. The explorer put its
 * confirmation in a pill across the bottom of the stage, up to 680 px from a
 * pick at the shoulder. Both already carry the comment that says why they
 * exist: the explorer's is *"it drove the emissive on one mesh out of 467 and
 * nothing else — which is a confirmation only for someone already looking at
 * the right pixel"*, and the body's is panel 7 of the front-door walk. Each
 * fixed WHICH MESH lights. Neither fixed which card.
 *
 * A line rather than a move, on both. The body's record is 340 px of rows and
 * the explorer's pill is centred under a standing figure; a panel that followed
 * the pointer would cover the thing it is about, which is the trade `Gizmos`
 * takes the other way round for plates small enough to place.
 *
 * From the card's NEAREST EDGE, the way `gizmoLayout.leader` does it, so the
 * line reads as coming out of the plate rather than out of its middle. Null
 * while the pick is inside the card, where there is nothing to point at.
 */
export default function PickLeader({ screen, stage, card, className = "pick-leader" }) {
  const [d, setD] = useState(null);

  useEffect(() => {
    if (!screen) {
      setD(null);
      return undefined;
    }
    const draw = () => {
      const s = document.querySelector(stage)?.getBoundingClientRect();
      const c = document.querySelector(card)?.getBoundingClientRect();
      if (!s || !c) return setD(null);
      const ax = screen[0] - s.x;
      const ay = screen[1] - s.y;
      const ex = Math.min(Math.max(ax, c.x - s.x), c.right - s.x);
      const ey = Math.min(Math.max(ay, c.y - s.y), c.bottom - s.y);
      return setD(ex === ax && ey === ay ? null : `M${ex},${ey} L${ax},${ay}`);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [screen, stage, card]);

  if (!d) return null;
  return (
    <svg className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
