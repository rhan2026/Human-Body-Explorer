/**
 * The Evidence Trace — `docs/20260907-fix/evidence_trace_clean.md`.
 *
 * A thin scientific annotation floating in the 3D's empty space: a small
 * label, a line, at most two numbers, a very small source. No panel, no
 * border, no box. It is the floor's own archived series over the window the
 * floor is playing, with a hair-thin cursor at the instant on screen, and it
 * seeks the scene when the pointer moves along it — *"그래프는 3D의 작은
 * window다"*.
 *
 * WHEN IT EXISTS. `visible` is the floor's "main, and no demonstration is
 * running" — it arrives ~400 ms after that turns true (md: guide finishes →
 * 3D keeps moving → ~400 ms → the trace draws itself) and fades when it turns
 * false. Nothing here decides the arrival grammar; the floor does.
 *
 * IT DRAWS ITSELF AT THE MOTION'S SPEED. The line is clipped to how far the
 * cursor has travelled since the trace appeared, so on the first lap the line
 * grows with the picture; after that the whole line stands and only the cursor
 * moves. The numbers (behind "○ model result") are offered only once the
 * cursor has passed the window's peak — *"숫자는 설명이 아니라 animation의
 * 결과"*.
 *
 * NO REACT RENDER PER FRAME. The cursor and the clip are DOM attributes
 * written from a requestAnimationFrame loop off `timeRef`, the same way the
 * guide reads its anchor: sixty frames a second must not be sixty renders.
 *
 * `data-guide-clear` is on the block, so the guide keeps off it through the
 * system it already has — no shared code was touched for this.
 *
 * Lines: `[{ id, label, t, values, lo, hi, tone, ghost }]`. `ghost` is the
 * comparison drawn thin (ENERGY's Normal once the calcium path is off) and it
 * is never clipped — it is what was, not what is happening.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { linePoints, peakXOf, windowOf, xOf } from "./trace.js";
import SourceLine from "./SourceLine.jsx";
import "./trace.css";

const W = 100;
const H = 34;
export const APPEAR_MS = 400;
const FADE_MS = 320;
/* `draw: "sweep"` — the line draws itself over this long on appearing, when
   the floor's clock cannot draw it (ENERGY loops one repetition of a ten-
   repetition trace). "clock" draws exactly as far as the cursor has been. */
const SWEEP_MS = 1500;

/** Mounted from `visible` after APPEAR_MS; unmounted FADE_MS after it drops. */
function usePresence(visible) {
  /* "pending" even when visible at mount: the ~400 ms and the fade-in are
     owed on a cold arrival too (a Skip before the scenario resolves mounts
     the block with `visible` already true). */
  const [state, setState] = useState(visible ? "pending" : "out");
  useEffect(() => {
    let id;
    if (visible) {
      setState((s) => (s === "in" ? s : "pending"));
      id = setTimeout(() => setState("in"), APPEAR_MS);
    } else {
      /* Dropped before it ever showed: nothing to fade, nothing to mount. */
      setState((s) => (s === "out" || s === "pending" ? "out" : "leaving"));
      id = setTimeout(() => setState("out"), FADE_MS);
    }
    return () => clearTimeout(id);
  }, [visible]);
  return state;
}

export default function EvidenceTrace({
  visible = false,
  lines = [],
  from,
  to,
  timeRef = null,
  onSeek = null,
  /** The subject's place on the stage — `{x, y, r}` or `{x, y, w, h}` in stage
      pixels, written per frame by the floor. When the camera brings the subject onto the
      block, the block goes to the other side (md: "camera가 움직이면 evidence는
      screen-space에서 부드럽게 relocation") — a class flip, and the CSS
      transition is the smoothness. Hysteresis: it moves only when its own
      place is covered and the other is clear, so it cannot vibrate. */
  avoidRef = null,
  paper,
  /** `{ label, rows: [[name, value], …] }`, offered after the peak; null for none. */
  reveal = null,
  /** Object-specific rows that are already earned — `[[name, value], …]`. */
  note = null,
  noteLabel = null,
  /** "clock": the line exists as far as the cursor has travelled. "sweep": it
      draws itself over SWEEP_MS on appearing (and again when the lines change). */
  draw = "clock",
  className = "",
  testid = "evidence-trace",
}) {
  const presence = usePresence(visible);
  const rootRef = useRef(null);
  const cursors = useRef([]);
  const clips = useRef([]);
  const reached = useRef(0);
  const [pastPeak, setPastPeak] = useState(false);
  const [opened, setOpened] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const flippedRef = useRef(false);

  const drawn = useMemo(
    () =>
      lines.map((l) => {
        const win = windowOf(l.t, l.values, from, to);
        return {
          ...l,
          points: linePoints(win.t, win.v, { from, to, lo: l.lo, hi: l.hi, w: W, h: H }),
          peakX: peakXOf(l.t, l.values, from, to, W),
        };
      }),
    [lines, from, to],
  );
  const peakX = useMemo(() => Math.max(0, ...drawn.filter((l) => !l.ghost).map((l) => l.peakX)), [drawn]);

  /* A new window or a new set of lines starts the drawing over. */
  useEffect(() => {
    reached.current = 0;
    setPastPeak(false);
    setOpened(false);
  }, [from, to, lines]);
  /* An object's own rows replace the model result (md rule 2: never more than
     two values standing) — the reveal folds when a note arrives. */
  useEffect(() => {
    if (note?.length) setOpened(false);
  }, [note]);
  useEffect(() => {
    if (presence !== "in") reached.current = 0;
  }, [presence]);

  useEffect(() => {
    if (presence !== "in") return undefined;
    let id = 0;
    let wasPast = false;
    /* "clock": the line is drawn by the cursor FROM THE WINDOW'S START, so it
       waits for the cursor to get there — after a pass the floor's clock is
       parked wherever the pass left it (FIBER holds at the window's end for
       half a second before the cut), and seeding from that instant would put
       the whole line up in one frame. Armed when the cursor is at the start
       or has just wrapped; until then nothing is drawn.
       "sweep": the line draws itself over SWEEP_MS, but only while the
       floor's clock is moving — Pause holds it, as it holds the picture. */
    let armed = draw !== "clock";
    let prevX = null;
    let prevT = null;
    let swept = 0;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const t = timeRef?.current;
      const x = xOf(t, from, to, W);
      const moved = prevT !== null && t !== prevT;
      if (!armed && (x < 2 || (prevX !== null && x < prevX))) armed = true;
      if (draw === "sweep" && moved) swept = Math.min(W, swept + ((now - last) / SWEEP_MS) * W);
      /* The cursor can go backwards (a seek, a lap) — the drawing does not.
         And under "sweep" the cursor never seeds the drawing: the room's clock
         sits in the arrival's loop rep, and a line that began at rep 7 would
         be two-thirds up before it had been drawn at all. */
      if (draw === "clock" && armed && x > reached.current) reached.current = x;
      if (swept > reached.current) reached.current = swept;
      prevX = x;
      prevT = t;
      last = now;
      const r = reached.current;
      for (const c of cursors.current) {
        if (c) {
          c.setAttribute("x1", x);
          c.setAttribute("x2", x);
        }
      }
      for (const k of clips.current) if (k) k.setAttribute("width", r);
      if (!wasPast && r >= peakX && r > 0) {
        wasPast = true;
        setPastPeak(true);
      }
      /* THE OTHER SIDE, when the subject arrives on this one. Checked every
         sixth frame — a layout read, not a draw. The mirrored place is this
         block's own box reflected across the stage's vertical midline. */
      if (avoidRef && rootRef.current && (frame++ % 6 === 0)) {
        const s = avoidRef.current;
        const el = rootRef.current;
        const stage = el.offsetParent;
        if (s && stage && (s.r > 0 || s.w > 0)) {
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          const here = { x: el.offsetLeft, y: el.offsetTop };
          const there = { x: stage.clientWidth - el.offsetLeft - w, y: el.offsetTop };
          /* A circle `{x, y, r}` or a rectangle `{x, y, w, h}` — both as the
             box they occupy; the question is only whether it reaches ours. */
          const sx0 = s.r > 0 ? s.x - s.r : s.x;
          const sy0 = s.r > 0 ? s.y - s.r : s.y;
          const sx1 = s.r > 0 ? s.x + s.r : s.x + s.w;
          const sy1 = s.r > 0 ? s.y + s.r : s.y + s.h;
          const covers = (b) => sx1 > b.x && sx0 < b.x + w && sy1 > b.y && sy0 < b.y + h;
          if (covers(here) && !covers(there)) {
            flippedRef.current = !flippedRef.current;
            setFlipped(flippedRef.current);
          }
        }
      }
      id = requestAnimationFrame(tick);
    };
    let frame = 0;
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [presence, from, to, peakX, timeRef, draw, lines, avoidRef]);

  if (presence === "out" || presence === "pending") return null;
  const uid = testid.replace(/[^a-z0-9]/gi, "");
  const seekAt = (e) => {
    if (!onSeek || !(to > from)) return;
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    onSeek(from + f * (to - from));
  };
  const rows = [...(note ?? []), ...(opened && reveal ? reveal.rows : [])];

  return (
    <div
      ref={rootRef}
      className={`trace ${presence === "in" ? "trace--in" : ""}${flipped ? " trace--flip" : ""} ${className}`.trim()}
      data-testid={testid}
      data-guide-clear=""
    >
      {drawn.map((l, i) => (
        <div className="trace__row" key={l.id}>
          <p className="trace__label">{l.label}{l.mark ? <span className="trace__mark">{l.mark}</span> : null}</p>
          <svg
            className={`trace__plot${onSeek ? " trace__plot--seeks" : ""}`}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            onPointerMove={onSeek ? seekAt : undefined}
            onPointerDown={onSeek ? seekAt : undefined}
          >
            <defs>
              <clipPath id={`${uid}-clip-${i}`}>
                <rect
                  x="0"
                  y="0"
                  width="0"
                  height={H}
                  ref={(el) => {
                    clips.current[i] = l.ghost ? null : el;
                  }}
                />
              </clipPath>
            </defs>
            {l.points && (
              <polyline
                points={l.points}
                className={`trace__line trace__line--${l.tone ?? "ink"}${l.ghost ? " trace__line--ghost" : ""}`}
                style={l.color ? { stroke: l.color } : undefined}
                clipPath={l.ghost ? undefined : `url(#${uid}-clip-${i})`}
              />
            )}
            {!l.ghost && (
              <line
                className="trace__cursor"
                x1="0"
                x2="0"
                y1="0"
                y2={H}
                ref={(el) => {
                  cursors.current[i] = el;
                }}
              />
            )}
          </svg>
        </div>
      ))}
      {rows.length > 0 && (
        <dl className="trace__nums" data-testid={`${testid}-nums`}>
          {note?.length && noteLabel ? <dt className="trace__nums-title">{noteLabel}</dt> : null}
          {opened && reveal?.label ? <dt className="trace__nums-title">{reveal.label}</dt> : null}
          {rows.map(([name, value]) => (
            <div className="trace__num" key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="trace__foot">
        {reveal && !note?.length && (
          <button
            type="button"
            className={`trace__dot${pastPeak ? " trace__dot--ready" : ""}`}
            aria-pressed={opened}
            aria-hidden={!pastPeak}
            tabIndex={pastPeak ? 0 : -1}
            onClick={() => pastPeak && setOpened((o) => !o)}
            data-testid={`${testid}-reveal`}
          >
            <span aria-hidden="true">{opened ? "●" : "○"}</span> model result
          </button>
        )}
        <SourceLine paper={paper} />
      </p>
    </div>
  );
}
