import { LANGUAGE_OPTIONS, isLanguageHint, type LanguageHint } from "../lib/languages";

interface Props {
  value: LanguageHint | "";
  onChange: (value: LanguageHint | "") => void;
  disabled?: boolean;
}

/** Pin the menu language when auto-detection keeps getting it wrong (e.g. mixed-script menus). */
export function LanguageHintSelect({ value, onChange, disabled }: Props) {
  return (
    <label className="context-hint">
      <span className="context-hint-label">メニューの言語</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(isLanguageHint(e.target.value) ? e.target.value : "")}
      >
        {LANGUAGE_OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
