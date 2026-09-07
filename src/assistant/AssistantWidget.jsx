import { useEffect, useRef, useState } from "react";
import { askAssistant } from "../ask/askStream.js";
import "./assistant.css";

/**
 * The Anatomy Assistant, connected and streamed: Send posts the conversation
 * to /api/assistant, a dev/preview-server middleware (server/) that holds
 * the API key and the system prompt server-side and streams Claude's answer
 * back as NDJSON. The widget itself knows no secret and no prompt — it sends
 * the words and, with them, what the screen holds right now
 * (shell/assistantContext.js, read at the moment of Send). A page with no
 * server behind it gets an honest "not connected" line instead of a silent
 * failure.
 *
 * Every assistant reply is one message object with its own status —
 * "thinking" (dots, before the first delta), "streaming" (text arriving,
 * caret), "complete", "error" — and the thinking bubble IS the answer
 * bubble: the first delta changes its state, nothing is removed or
 * re-created, so the log never jumps. Stop aborts the fetch (which cancels
 * the model run server-side) and keeps whatever text already arrived.
 *
 * It floats over the stage rather than owning a layout region — moving,
 * resizing, minimizing or closing it cannot resize the canvas, which is the
 * same invariant the drawer keeps. The top-left corner is a resize grip
 * (the box is anchored bottom-right, so growth runs up and left); the ×
 * button left at the owner's ask (2026-08-31) — minimize is the one way to
 * put it away. Position, size and the conversation live in component state.
 * Nothing is persisted.
 *
 * THE STREAM CLIENT MOVED OUT, 2026-09-06 — `ask/askStream.js`. Bell's box
 * (`ask/AskBell.jsx`) asks the same server the same way, and two copies of the
 * NDJSON reader is how a protocol drifts; this widget keeps its log, its drag
 * and its Retry, and imports the wire half. Behaviour unchanged.
 */

/**
 * The welcome line is the front door's one sentence saying what this is —
 * gate-first-time-walk reads it. The scripted example exchange that used to
 * sit under it left with the mockup era: the next message in this log is a
 * real answer.
 */
const SEED = [
  {
    role: "assistant",
    text: "Pick an exercise in the menu and the muscles it works light up on the body.",
  },
];

/* One chip, not a menu of them: the widget rides every scale now, and each
   visible word here is spent on all five screens' word budgets at once. */
const SUGGESTIONS = ["What does this muscle do?"];

/** Keep the box this far inside every viewport edge. */
const MARGIN = 12;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max < min ? min : max);

export default function AssistantWidget({ placeholder = "Ask about this view…", defaultMinimized = false }) {
  const [busy, setBusy] = useState(false);
  // The in-flight request, for Stop and for unmount cleanup.
  const abortRef = useRef(null);
  // Follow the log's end only while the viewer is already there — a reader
  // who scrolled up to an earlier answer is not fought token by token.
  const followRef = useRef(true);
  // Phones start on the pill: the expanded box is nearly full-width there and
  // sits exactly where the pick pill answers "what did I just click". A view
  // whose bottom-right corner is a readout panel starts on the pill too
  // (`defaultMinimized`) — read once, on first mount only: after that the
  // widget's state is the viewer's.
  const [minimized, setMinimized] = useState(
    () => defaultMinimized || window.matchMedia("(max-width: 640px)").matches,
  );
  const [messages, setMessages] = useState(SEED);
  const [draft, setDraft] = useState("");
  // null = the CSS default corner (bottom-right). Set once the user drags.
  const [pos, setPos] = useState(null);
  // null = the CSS default 330px box. Set once the user drags the grip.
  const [size, setSize] = useState(null);
  const resize = useRef(null);
  const boxRef = useRef(null);
  const logRef = useRef(null);
  const drag = useRef(null);
  // A drag that ends on the minimized pill must not also count as the click
  // that restores it.
  const suppressClick = useRef(false);

  /**
   * Drag, from the header only. Direct style writes during the move and one
   * setState on release — a React render per pointermove is exactly the
   * per-frame state churn the 3D page next door cannot afford. Pointer capture
   * makes the same code serve mouse and touch, and keeps the events off the
   * canvas underneath, so dragging the widget can never orbit the model.
   */
  const startDrag = (event) => {
    if (event.target.closest(".assistant__ctl")) return;
    // One drag at a time, by the first finger down: a second touch must not
    // steal the box or leave two captured pointers fighting over it.
    if (drag.current || event.isPrimary === false) return;
    const rect = boxRef.current.getBoundingClientRect();
    drag.current = {
      id: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      x0: event.clientX,
      y0: event.clientY,
      moved: false,
      last: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    if (!drag.current.moved && Math.hypot(event.clientX - drag.current.x0, event.clientY - drag.current.y0) < 3) return;
    drag.current.moved = true;
    const box = boxRef.current;
    const rect = box.getBoundingClientRect();
    const x = clamp(event.clientX - drag.current.dx, MARGIN, window.innerWidth - rect.width - MARGIN);
    const y = clamp(event.clientY - drag.current.dy, MARGIN, window.innerHeight - rect.height - MARGIN);
    drag.current.last = { x, y };
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.right = "auto";
    box.style.bottom = "auto";
  };

  const endDrag = (event) => {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    if (drag.current.last) setPos(drag.current.last);
    // Only a completed drag suppresses the click that follows it. A cancelled
    // one produces no click, and leaving the flag set would swallow the next
    // keyboard activation of the pill instead.
    suppressClick.current = event.type === "pointerup" && drag.current.moved;
    drag.current = null;
  };

  const dragHandlers = { onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag };

  /**
   * Resize, from the top-left grip, the same shape as the drag: direct style
   * writes during the move, one setState on release. The bottom-right corner
   * holds still — it is the corner the box lives in — so the grip's corner
   * follows the pointer and growth runs up and left.
   */
  const startResize = (event) => {
    if (resize.current || event.isPrimary === false) return;
    const rect = boxRef.current.getBoundingClientRect();
    resize.current = { id: event.pointerId, right: rect.right, bottom: rect.bottom, last: null };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveResize = (event) => {
    const grip = resize.current;
    if (!grip || event.pointerId !== grip.id) return;
    const width = clamp(grip.right - event.clientX, 260, window.innerWidth - MARGIN * 2);
    const height = clamp(grip.bottom - event.clientY, 300, window.innerHeight - MARGIN * 2);
    grip.last = { width, height };
    const box = boxRef.current;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    box.style.maxHeight = "none";
    if (pos) {
      box.style.left = `${grip.right - width}px`;
      box.style.top = `${grip.bottom - height}px`;
    }
  };

  const endResize = (event) => {
    const grip = resize.current;
    if (!grip || event.pointerId !== grip.id) return;
    if (grip.last) {
      setSize(grip.last);
      if (pos) setPos({ x: Math.max(MARGIN, grip.right - grip.last.width), y: Math.max(MARGIN, grip.bottom - grip.last.height) });
    }
    resize.current = null;
  };

  const resizeHandlers = { onPointerDown: startResize, onPointerMove: moveResize, onPointerUp: endResize, onPointerCancel: endResize };

  // A dragged position can fall outside a shrunken window, and the expanded
  // box is taller than the pill it may have been dragged as — re-clamp on both.
  useEffect(() => {
    const reclamp = () =>
      setPos((p) => {
        const rect = boxRef.current?.getBoundingClientRect();
        if (!p || !rect) return p;
        const x = clamp(p.x, MARGIN, window.innerWidth - rect.width - MARGIN);
        const y = clamp(p.y, MARGIN, window.innerHeight - rect.height - MARGIN);
        return x === p.x && y === p.y ? p : { x, y };
      });
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [minimized]);

  // On new messages AND on restore: the log remounts when un-minimizing, and
  // without the second dep a long conversation reopens scrolled to its oldest
  // line. Follows only while the viewer is near the end; their own scroll
  // position is theirs (the log's onScroll keeps followRef honest).
  useEffect(() => {
    if (followRef.current) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, minimized, busy]);

  // A request left running when the widget closes or unmounts is cancelled.
  useEffect(() => () => abortRef.current?.abort(), []);

  const posStyle = pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined;


  if (minimized) {
    return (
      <button
        type="button"
        ref={boxRef}
        className="assistant--min"
        style={posStyle}
        data-testid="assistant-min"
        aria-label="Restore the Anatomy Assistant"
        {...dragHandlers}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setMinimized(false);
        }}
      >
        <span className="assistant__dot" aria-hidden="true" />
        Assistant
      </button>
    );
  }

  /**
   * The interface answers the press before the network is touched: the
   * user's line, a cleared input and the thinking bubble land immediately,
   * then the stream fills that same bubble. `base` exists for Retry, which
   * re-asks a question with the failed exchange sliced off.
   */
  const send = async (asked, base) => {
    const text = (asked ?? draft).trim();
    if (!text || busy) return;
    // Error bubbles are interface state, not conversation — they stay out of
    // what the model is shown.
    const history = [...(base ?? messages).filter((m) => m.status !== "error"), { role: "user", text }];
    const controller = new AbortController();
    abortRef.current = controller;
    followRef.current = true;
    setMessages([...history, { role: "assistant", text: "", status: "thinking" }]);
    setDraft("");
    setBusy(true);
    // The live bubble is always the last message; nothing else writes while
    // a request is in flight (Send is a Stop button until then).
    const patch = (up) => setMessages((m) => [...m.slice(0, -1), up(m[m.length - 1])]);
    try {
      // The wire half — fetch, the NDJSON reader, navigate, Stop and the
      // "not connected" line — is `ask/askStream.js`, shared with Bell's box.
      await askAssistant(history, { signal: controller.signal, patch });
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  /** Re-ask the question under an error bubble, with the failure sliced off. */
  const retry = (index) => {
    const askedBy = messages[index - 1];
    if (busy || !askedBy || askedBy.role !== "user") return;
    send(askedBy.text, messages.slice(0, index - 1));
  };

  const sizeStyle = size ? { width: size.width, height: size.height, maxHeight: "none" } : undefined;

  return (
    <section className="assistant" ref={boxRef} style={{ ...posStyle, ...sizeStyle }} data-testid="assistant" aria-label="Anatomy Assistant">
      {/* Pointer-only by design: a keyboard cannot operate it, so it hides
          from the tree; the box works at its default size without it. */}
      <span className="assistant__resize" data-testid="assistant-resize" aria-hidden="true" {...resizeHandlers} />
      <header className="assistant__bar" data-testid="assistant-drag" {...dragHandlers}>
        <span className="assistant__dot" aria-hidden="true" />
        <strong className="assistant__title">Anatomy Assistant</strong>
        {/* The beta badge left at the owner's ask (2026-08-31). The claim it
            carried — a live model's answers are not the app's reviewed
            content — now rests on the prompt's own honesty rules alone. */}
        <button type="button" className="assistant__ctl" aria-label="Minimize the assistant" onClick={() => setMinimized(true)}>
          —
        </button>
      </header>

      <div
        className="assistant__log"
        ref={logRef}
        data-testid="assistant-log"
        onScroll={() => {
          const log = logRef.current;
          followRef.current = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 48;
        }}
      >
        {messages.map((message, index) => (
          <p
            key={index}
            className={`assistant__msg assistant__msg--${message.role}${message.status === "streaming" ? " assistant__msg--streaming" : ""}`}
          >
            {message.status === "thinking" ? (
              <span className="assistant__dots" aria-label="Thinking">
                <span />
                <span />
                <span />
              </span>
            ) : (
              message.text
            )}
            {message.note && <span className="assistant__note">{message.note}</span>}
            {message.status === "error" && index === messages.length - 1 && !busy && (
              <button type="button" className="assistant__retry" onClick={() => retry(index)}>
                Retry
              </button>
            )}
          </p>
        ))}
      </div>

      <div className="assistant__chips">
        {SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" className="chip" onClick={() => setDraft(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="assistant__composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        {/* The placeholder names the view — pure UI context from the route,
            not an interpretation of anything. */}
        {/* The placeholder is the accessible name — a separate aria-label is
            hidden words every scale's budget pays for. */}
        <input
          className="input"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        {busy ? (
          <button
            type="button"
            className="assistant__send assistant__send--stop"
            aria-label="Stop"
            onClick={() => abortRef.current?.abort()}
          >
            ■
          </button>
        ) : (
          <button type="submit" className="assistant__send" aria-label="Send">
            ➤
          </button>
        )}
      </form>
    </section>
  );
}
