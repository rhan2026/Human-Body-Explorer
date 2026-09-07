import { hashForScale, trailSteps, go } from "./scaleRoute.js";

import { beginCrossing } from "./crossing.js";

/**
 * The footer chain, on every scene: which scales there are, and which one you
 * are looking at.
 *
 * It replaced fixed text that read the same on all three screens — so it named
 * the descent without ever saying where in it the viewer was — and that text
 * carried MUSCLE as a fourth peer level. It is not one: `scaleRoute.js` chooses
 * a scene from `SCALE_ORDER`, and a muscle is not in it. See `trailSteps` for
 * why a selection is not a step.
 *
 * NAVIGATION ONLY WHERE NAVIGATION IS POSSIBLE, which is what `state` decides.
 * This used to be inert everywhere, and the reason was good: a scale is not
 * reachable from every other, because the fibre, cell and signalling scenes need
 * a bout and the front door has not chosen one. A step drawn as a button there
 * promises a click that cannot happen.
 *
 * A scene that HAS a bout is the other case, and it was being served by a pair
 * of chips in a header — `to-fiber`, `to-signalling` — one scale up and one
 * down. The headers came off the scale screens on 2026-08-25 ("header제거"), so
 * the way out lives here, where the viewer is already being shown where they
 * are. Hand it `state` and the steps become buttons; leave it off and they stay
 * exactly the inert text the paragraph above describes.
 *
 * The step you are ON is never a button. It goes nowhere, and a control that
 * does nothing is worse than text that never claimed to.
 *
 * Colour comes from the footer it sits in — `currentColor` and opacity, no
 * palette variable. The press scene has its own dark mode (`press.css:154`) and
 * `--text` does not follow it, so a step painted in ink would vanish there.
 */
const ORDER = ["body", "fiber", "cell", "signalling"];

export default function ScaleTrail({ scale = null, state = null }) {
  /* A bout is what makes the lower scenes reachable, and `state.exercise` is
     where a bout is named. Without one this renders exactly what it always did. */
  const canGo = !!state?.exercise;
  /* WHERE THE DESCENT CAME FROM, AND IT LIVES HERE BECAUSE THE HEADERS DO NOT.
     The exercise and the muscle used to be four words in each scale's topbar,
     and `descent.spec.js:105-113` reads them off the screen to hold this
     project's purest recurring defect at bay — four different hashes drawing
     the same 1,024,000 pixels. Taking the headers off on 2026-08-25 took the
     two names with them and left that case with no subject; this is where they
     land instead, in the one component all three scales already share, beside
     the chain that says which of them you are looking at.
     The slug is the address's own spelling — `muscleSlug` made it, and undoing
     it is a replace rather than a manifest lookup, because a name the router
     could not spell is a name this line should not invent. */
  const from = [state?.exercise?.replace(/_/g, " "), state?.muscle?.replace(/-/g, " ")]
    .filter(Boolean)
    .join(" · ");
  return (
    <nav className="trail" aria-label="Biological scale" data-testid="scale-trail">
      {from && (
        <span className="trail__from" data-testid="descent-from">
          {from}
        </span>
      )}
      {trailSteps(scale).map(({ scale: id, label, here }) => {
        if (!canGo || here) {
          return (
            <span key={id} className="trail__step" data-scale={id} aria-current={here ? "step" : undefined}>
              {label}
            </span>
          );
        }
        return (
          <button
            key={id}
            type="button"
            className="trail__step trail__step--go"
            data-scale={id}
            /* THE OLD IDS, ON PURPOSE. Eight specs click `to-fiber`, `to-cell`
               and `to-body`, and what they assert is that a way to that scale
               exists and works — a claim this control still answers. Renaming
               them would have made a moved button look like a deleted one.
               ONE EXCEPTION, from the day the body's trail came alive (T23,
               2026-08-30): the body scene already owns `to-fiber` — the pick
               card's chip, which carries the picked muscle down — and giving
               this step the same id put two elements under one testid and
               failed eight descent specs on a strict-mode violation. On the
               body, and only for the step the pick card duplicates, the trail
               step steps aside. */
            data-testid={scale === "body" && id === "fiber" ? "trail-to-fiber" : `to-${id}`}
            onClick={() => {
              /* The wash reads as going IN or coming OUT, so it needs to know
                 which way this jump goes rather than assuming down — this is the
                 one control in the app that can move more than one step at a
                 time, and from signalling every jump is up. */
              beginCrossing(ORDER.indexOf(id) > ORDER.indexOf(scale) ? "down" : "up");
              go(hashForScale(state, id));
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
