import { useState } from "react";
import type { HistoryEntry } from "../lib/history";
import { exportHistoryZip } from "../lib/exportHistory";

interface Props {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ history, onSelect }: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  if (history.length === 0) return null;

  const toggleChecked = (timestamp: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  };

  const handleExport = async () => {
    const selected = history.filter((entry) => checked.has(entry.timestamp));
    if (selected.length === 0) return;
    setExporting(true);
    try {
      await exportHistoryZip(selected);
    } catch {
      alert("ZIPの作成に失敗しました");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="history-panel-block">
      <div className="history-panel">
        {history.map((entry) => (
          <div key={entry.timestamp} className="history-thumb-wrap">
            <button
              className="history-thumb"
              onClick={() => onSelect(entry)}
            >
              <img src={entry.image} alt="過去のスキャン" />
              <span className="history-thumb-mode">
                {entry.appMode === "museum" ? "博物館" : "メニュー"}
              </span>
              <span>{entry.items.length}件</span>
            </button>
            <input
              type="checkbox"
              className="history-thumb-check"
              aria-label="この履歴をダウンロード対象にする"
              checked={checked.has(entry.timestamp)}
              onClick={(e) => e.stopPropagation()}
              onChange={() => toggleChecked(entry.timestamp)}
            />
          </div>
        ))}
      </div>
      <button
        className="history-export"
        disabled={checked.size === 0 || exporting}
        onClick={handleExport}
      >
        {exporting ? "作成中..." : "選択した履歴をダウンロード"}
      </button>
    </div>
  );
}
