import type { AppMode, RecognitionMode } from "../lib/types";

interface Props {
  modes: RecognitionMode[];
  onChange: (modes: RecognitionMode[]) => void;
  appMode: AppMode;
}

export function ModeToggle({ modes, onChange, appMode }: Props) {
  const toggle = (mode: RecognitionMode) => {
    if (modes.includes(mode)) {
      onChange(modes.filter((m) => m !== mode));
    } else {
      onChange([...modes, mode]);
    }
  };

  const textLabel =
    appMode === "museum" ? "文字(解説パネル)を認識" : "文字を認識";
  const imageLabel =
    appMode === "museum" ? "展示物・作品を認識" : "画像(料理写真)を認識";

  return (
    <div className="mode-toggle">
      <label>
        <input
          type="checkbox"
          checked={modes.includes("text")}
          onChange={() => toggle("text")}
        />
        {textLabel}
      </label>
      <label>
        <input
          type="checkbox"
          checked={modes.includes("image")}
          onChange={() => toggle("image")}
        />
        {imageLabel}
      </label>
    </div>
  );
}
