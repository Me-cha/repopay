export function InfoTooltip({ text, label = 'More information' }: { text: string; label?: string }) {
  return (
    <span className="c2-tooltip-wrap">
      <button type="button" className="c2-info-trigger" aria-label={label}>
        ?
      </button>
      <span className="c2-tooltip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
