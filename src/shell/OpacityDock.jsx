/**
 * The layer-opacity sliders, in the stage's bottom-left corner on the front
 * door and every motion window (owner, 2026-08-31), replacing the muscles /
 * skeleton toggle chips. Each scene hands in the layers it actually has:
 * the explorer skin + skeleton, the motion scene muscles + skeleton — the
 * motion scene ships no skin shell (it is unanimated; HANDOVER.md).
 */

export default function OpacityDock({ sliders }) {
  return (
    <div className="opacity-dock" data-testid="opacity-dock">
      {sliders.map(({ label, value, onChange }) => (
        <label key={label} className="opacity-dock__row">
          <span className="opacity-dock__name">{label}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value}
            aria-label={`${label} opacity`}
            onChange={(e) => onChange(+e.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
