import type { AppMode } from "../lib/types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  appMode: AppMode;
  disabled?: boolean;
}

export function ContextHintInput({ value, onChange, appMode, disabled }: Props) {
  const label = appMode === "museum" ? "場所・地域のヒント" : "料理のジャンル・地域";
  const placeholder =
    appMode === "museum"
      ? "例: エジプト考古学博物館、ローマ遺跡"
      : "例: タイ料理、ベトナム・ハノイ";

  return (
    <label className="context-hint">
      <span className="context-hint-label">{label}(任意)</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
