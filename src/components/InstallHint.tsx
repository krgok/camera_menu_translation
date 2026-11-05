import { useState } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

const DISMISS_KEY = "install-hint-dismissed";

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Android: an install button. iPhone: a one-time hint explaining the manual steps. */
export function InstallHint() {
  const { canInstall, needsIosHint, install } = useInstallPrompt();
  const [hidden, setHidden] = useState(dismissed);

  if (canInstall) {
    return <button onClick={install}>📲 ホーム画面に追加</button>;
  }
  if (needsIosHint && !hidden) {
    return (
      <p className="app-notice app-notice-info" role="note">
        <span>
          📲 ホーム画面に追加すると、アプリのように起動できます: Safari の共有ボタン
          (□↑)→「ホーム画面に追加」
        </span>
        <button
          aria-label="案内を閉じる"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Not persisted — it will show again next time.
            }
            setHidden(true);
          }}
        >
          ×
        </button>
      </p>
    );
  }
  return null;
}
