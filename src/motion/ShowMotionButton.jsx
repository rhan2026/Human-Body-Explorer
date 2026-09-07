/**
 * One Show-motion button, used everywhere an exercise can be chosen.
 *
 * Both call sites — the explorer's exercise list and the motion viewer's own
 * exercise rail — render this rather than their own button, so the label, the
 * active state and the disabled reason cannot drift apart between them. It is a
 * plain `<button>`, so it is keyboard reachable and operable without any extra
 * handling; `aria-pressed` carries the active state to a screen reader, which a
 * colour change alone does not.
 *
 * The disabled state is deliberately narrow. A button is only ever disabled when
 * the exercise genuinely has no motion definition, and it says so — a control
 * that looks live and does nothing is the specific failure this replaces.
 */

const LABELS = {
  idle: "Show motion",
  playing: "Pause motion",
  paused: "Resume motion",
  missing: "No motion yet",
};

export function ShowMotionButton({
  state = "idle",
  onClick,
  exerciseLabel,
  className = "",
  /** "md" full-width, "sm" compact pill, "xs" glyph-only — the dense list
   *  rows. The accessible name never shrinks with the button: aria-label and
   *  title carry the words the xs glyph drops. */
  size = "md",
}) {
  const disabled = state === "missing";
  const active = state === "playing" || state === "paused";

  const title = disabled
    ? `${exerciseLabel ?? "This exercise"} has no motion definition yet`
    : state === "playing"
      ? `Pause the ${exerciseLabel ?? "current"} animation`
      : state === "paused"
        ? `Resume the ${exerciseLabel ?? "current"} animation`
        : `Animate ${exerciseLabel ?? "this exercise"} on the anatomy model`;

  return (
    <button
      type="button"
      className={[
        "btn-motion",
        `btn-motion--${size}`,
        active ? "btn-motion--on" : "",
        disabled ? "btn-motion--off" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={disabled ? undefined : active}
      aria-label={`${LABELS[state]}${exerciseLabel ? `: ${exerciseLabel}` : ""}`}
      title={title}
      data-testid="show-motion"
      data-motion-state={state}
    >
      <span className="btn-motion__glyph" aria-hidden="true">
        {state === "playing" ? "❙❙" : "▶"}
      </span>
      {size !== "xs" && LABELS[state]}
    </button>
  );
}
