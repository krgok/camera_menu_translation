import { useState } from "react";
import type { MenuItem } from "../lib/types";

interface Props {
  item: MenuItem;
  style: { left: number; top: number; width: number; height: number };
  onSave: (item: MenuItem) => void;
  saved: boolean;
}

export function OverlayItem({ item, style, onSave, saved }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="overlay-item"
      style={{
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
      }}
      onClick={() => setOpen((v) => !v)}
    >
      <div className="overlay-box" />
      <div className={`overlay-card ${open ? "open" : ""}`}>
        <div className="overlay-card-title">{item.name}</div>
        {open && (
          <>
            {item.original_text && (
              <div className="overlay-card-original">
                {item.original_text}
              </div>
            )}
            <div className="overlay-card-explanation">{item.explanation}</div>
            <button
              className="overlay-card-save"
              disabled={saved}
              onClick={(e) => {
                e.stopPropagation();
                onSave(item);
              }}
            >
              {saved ? "保存済み" : "★ 保存"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
