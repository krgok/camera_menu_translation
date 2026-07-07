import type { HistoryEntry } from "../lib/history";

interface Props {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ history, onSelect }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="history-panel">
      {history.map((entry) => (
        <button
          key={entry.timestamp}
          className="history-thumb"
          onClick={() => onSelect(entry)}
        >
          <img src={entry.image} alt="過去のスキャン" />
          <span>{entry.items.length}件</span>
        </button>
      ))}
    </div>
  );
}
