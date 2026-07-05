import type { RecognitionMode } from "../lib/types";

interface Props {
  modes: RecognitionMode[];
  onChange: (modes: RecognitionMode[]) => void;
}

export function ModeToggle({ modes, onChange }: Props) {
  const toggle = (mode: RecognitionMode) => {
    if (modes.includes(mode)) {
      onChange(modes.filter((m) => m !== mode));
    } else {
      onChange([...modes, mode]);
    }
  };

  return (
    <div className="mode-toggle">
      <label>
        <input
          type="checkbox"
          checked={modes.includes("text")}
          onChange={() => toggle("text")}
        />
        文字を認識
      </label>
      <label>
        <input
          type="checkbox"
          checked={modes.includes("image")}
          onChange={() => toggle("image")}
        />
        画像(料理写真)を認識
      </label>
    </div>
  );
}
