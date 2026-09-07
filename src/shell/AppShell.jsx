import { useEffect, useState } from "react";
import { setPanelOpen, usePanelOpen } from "./uiState.js";
import { SCALE_LABEL, SCALE_SUBTITLE } from "../scaleRoute.js";
import MotionList from "./MotionList.jsx";

/**
 * The application chrome every scale scene shares: the ☰ trigger, the left
 * overlay drawer, and the scrim that blurs and locks the page behind it.
 *
 * Rendered BESIDE a scene's content, not around it — every element here is
 * `position: fixed`, so no scene root is restructured, no canvas gains a new
 * parent, and opening the drawer cannot resize anything. That is the whole
 * invariant: the drawer overlays the viewport; the visualization underneath
 * never learns it opened. overlay-ui.spec.js measures it per scene through
 * each one's own debug hook.
 *
 * The drawer's first rows are the same on every scale — the breadcrumb chain
 * (ScaleTrail, current step marked) — and everything after `drawer` is the
 * scene's own: its Back control, its context, its About-this-data section.
 * One shell, adapted contents; never a second sidebar system.
 *
 * A scene that wants to react to the lock (an OrbitControls `enabled` flip)
 * reads `usePanelOpen()` from ./uiState.js — the state is shared, not owned
 * here, because the Router's assistant needs it too.
 */
/**
 * The blur + dim + interaction lock, rendered once by the Router beside the
 * assistant — never inside a scene (see the note in AppShell's body). The
 * render loop keeps running behind it; no material is touched. Clicking it
 * closes, like the trigger.
 */
export function Scrim() {
  const panelOpen = usePanelOpen();
  return (
    <div
      className={panelOpen ? "scrim scrim--on" : "scrim"}
      data-testid="scrim"
      onClick={() => setPanelOpen(false)}
      aria-hidden="true"
    />
  );
}

/**
 * `title` is the large half of the heading — what this floor is showing right
 * now. The body passes its movement's label; the deep floors pass nothing and
 * fall back to their own subtitle. Optional everywhere: a floor with nothing
 * to add draws its name alone rather than a placeholder.
 */
export default function AppShell({ scale = null, title = null, titleMenu = null, drawer }) {
  const panelOpen = usePanelOpen();
  const [menuOpen, setMenuOpen] = useState(false);

  /* Escape and a click anywhere else close it. Not a scrim: the drawer's scrim
     locks and blurs the whole page, which is far too much furniture for a list
     of six, and this popover is meant to be a glance rather than a mode. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    const onDown = (e) => {
      if (!e.target.closest?.(".shell-title--floor")) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [menuOpen]);

  // Each scene arrives with its chrome closed: navigating from inside the
  // drawer would otherwise land you on a new scale already blurred and locked.
  useEffect(() => {
    setPanelOpen(false);
    return () => setPanelOpen(false);
  }, []);

  useEffect(() => {
    if (!panelOpen) return undefined;
    // Opening can strand a hover cursor (the scrim owns the pointer now, so
    // no onPointerOut ever fires to clear it).
    document.body.style.cursor = "";
    const onKey = (event) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  /* THE ☰ ONLY EXISTS WHERE A DRAWER DOES, 2026-09-06. Owner: *"body 밑 단계에서는
     hamburger left side bar 없어도 될듯 … 이동은 돋보기로 할 수 있잖아 그리고 그 위로
     올라가는건 오른 쪽 위에 go up go home같은거 있지않아?"* — and they are right on all
     three floors below BODY. Down is `WayIn`, the lens standing in the scene
     (`fiber/FiberScene.jsx:1276`, `cell/CellScale.jsx:529`), and SIGNALS is the last
     floor so it has nothing below it at all. Up and home are `shell/Ways.jsx` at
     top right, on every one of them.
     SIGNALS was already passing `drawer={null}`: the button opened an empty panel
     and blurred the page behind it, which is a control that costs a press and pays
     nothing. Gating on the drawer rather than on the scale name means a floor that
     grows a drawer gets its door back without editing this file.
     ONLY THE TRIGGER AND THE PANEL. The floor heading below is this component's
     other job and stays on all five surfaces — an early return here would have
     taken "FIBER · Muscle fiber" off the three floors with the button, which is
     the opposite of what was asked. */
  return (
    <>
      {drawer && (
        <button
          type="button"
          className="menu-trigger"
          data-testid="menu-trigger"
          aria-expanded={panelOpen}
          aria-label={panelOpen ? "Close the controls" : "Open the controls"}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <span aria-hidden="true">{panelOpen ? "×" : "☰"}</span>
        </button>
      )}
      {/* WHERE YOU ARE, beside the trigger on every floor. Text, not a control —
          the trigger stays the only door.

          IT SAID `Human Body Explorer` ON ALL FIVE SCREENS. The owner asked for
          that string on 2026-08-31 ("semi bold black font") when there was one
          screen to name; by 2026-09-05 it was the heading over the sarcomere,
          the cytosol and the signalling network too, so the one piece of
          furniture on every floor was the only thing that never said which floor
          you were on. `docs/20260905-fix/body.md` §4 asks for the pair instead —
          small floor name over the large name of what you are actually looking
          at — and the canon of the same day makes the small half one of exactly
          four words.

          READ, NEVER TYPED. `SCALE_LABEL` and `SCALE_SUBTITLE` in
          `scaleRoute.js` are the only place a floor's user-facing name is
          written; the exercise's own label comes off the motion registry. A
          fifth spelling here is how "The cell", "CELL" and "Cell Signalling"
          became three answers to one question.

          THE FRONT DOOR IS NOT A FLOOR and keeps the product's name. It is the
          explorer, `scale` is null there, and none of the four words describes
          it.

          AND THE PRODUCT HAS ONE NAME AGAIN, 2026-09-05. This corner said
          `Human Body Explorer` while the drawer that opens three centimetres to
          its left said `Human Performance Explorer`, and so did the tab and the
          loading screen — one screen wearing two products, which is the same
          defect as `The cell` / `CELL` / `Cell Signalling` and was sitting in
          plain sight the whole time. Owner, asked which one: *"Human Body 로
          가자"*, so `App.jsx` and `index.html` came to this one rather than the
          other way round. The folder `human-performance-explorer/` and the UCSD
          Human Performance Alliance credit are untouched — a repository and a
          research programme are not what the thing on screen is called. */}
      {scale ? (
        /* AND IT SLIDES INTO THE TRIGGER'S PLACE WHERE THERE IS NO TRIGGER —
           2026-09-06, owner: *"전체적으로 hamburger없을 때 shell-title
           shell-title--floor 은 더 왼쪽으로 햄버거를 대체하게"*. The 44 px inset
           this heading has always carried was clearance for the ☰; on the three
           floors that no longer draw one it was clearance for nothing, and the
           corner read as though something had failed to load. */
        <span className={drawer ? "shell-title shell-title--floor" : "shell-title shell-title--floor shell-title--alone"}>
          <span className="shell-title__floor">{SCALE_LABEL[scale]}</span>
          {/* The large half: on the body it is the movement you are watching,
              which is the one fact that differs between `#bench_press/fiber` and
              `#push_up/fiber`. Below the body it is the subtitle the owner kept
              when the floor names changed — "Cellular Energy", "Cell Signalling"
              — because ENERGY and SIGNALS are both about a cell and their new
              names no longer say so. Absent where neither exists, rather than
              filled with the floor's own name a second time. */}
          {/* THE HEADING IS THE SELECTOR WHERE THERE IS SOMETHING TO SELECT —
              `docs/20260905-fix/body.md` §12, handed over by the BODY lane
              because `MotionList` is shared. The six movements are that floor's
              exploration axis and they were behind the ☰, so the first screen
              never showed that there were six.
              THE HEADING ITSELF, rather than a control beside it. §4 already
              puts the movement's name here in large type; a separate dropdown
              would draw the same word twice, and the second one would be the
              one that does something. Naming what you are looking at and
              offering to change it are the same gesture. */}
          {titleMenu ? (
            <button
              type="button"
              className="shell-title__subject shell-title__pick"
              data-testid="exercise-pick"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {title ?? SCALE_SUBTITLE[scale]}
              <span className="shell-title__caret" aria-hidden="true">▾</span>
            </button>
          ) : (
            (title ?? SCALE_SUBTITLE[scale]) && (
              <span className="shell-title__subject">{title ?? SCALE_SUBTITLE[scale]}</span>
            )
          )}
          {titleMenu && menuOpen && (
            <div className="shell-pick" data-testid="exercise-pick-menu">
              {/* `MotionList`, grouped — the same component the drawer's rail
                  uses, so the active row, the test ids and Idle's "go to the
                  front door" behaviour cannot drift between the two places a
                  visitor can change movement. */}
              <MotionList
                grouped
                exercises={titleMenu.exercises}
                activeId={titleMenu.activeId}
                onPick={(key) => {
                  setMenuOpen(false);
                  titleMenu.onPick(key);
                }}
              />
            </div>
          )}
        </span>
      ) : (
        <span className="shell-title">Human Body Explorer</span>
      )}

      {/* The scrim is NOT here. It renders at the Router level (main.jsx),
          because a scene root that is `position: fixed` (main.press) forms its
          own backdrop root in Chromium — a scrim inside it can blur only that
          scene's content, and the assistant floating outside stayed crisp over
          the dim on exactly one scale. One scrim, one backdrop context,
          beside the one assistant. */}

      {/* `inert` while closed: mounted for the slide, unreachable until open. */}
      {drawer && (
      <aside
        className={panelOpen ? "panel panel--left drawer drawer--open" : "panel panel--left drawer"}
        inert={!panelOpen}
      >
        {/* The breadcrumb (ScaleTrail) left every drawer at the owner's ask
            (2026-08-31), with the Show Motion header block. `scale` still
            arrives so a future header can use it. */}
        {drawer}
      </aside>
      )}
    </>
  );
}
