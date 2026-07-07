import type { AppMode } from "../lib/types";

interface Props {
  appMode: AppMode;
  onChange: (mode: AppMode) => void;
  disabled?: boolean;
}

export function AppModeSwitch({ appMode, onChange, disabled }: Props) {
  return (
    <div className="app-mode-switch">
      <button
        className={appMode === "menu" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("menu")}
      >
        🍽 メニュー
      </button>
      <button
        className={appMode === "museum" ? "active" : ""}
        disabled={disabled}
        onClick={() => onChange("museum")}
      >
        🏛 博物館
      </button>
    </div>
  );
}
