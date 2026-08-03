interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Menu mode only: ingredients the traveler can't or won't eat. Passed to the
// explanation prompt so risky dishes get a ⚠ warning.
export function AvoidIngredientsInput({ value, onChange, disabled }: Props) {
  return (
    <label className="context-hint">
      <span className="context-hint-label">苦手・アレルギー食材(任意)</span>
      <input
        type="text"
        value={value}
        placeholder="例: エビ、ピーナッツ、パクチー"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
