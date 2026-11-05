import { NO_TRIP, SORT_LABELS, type SavedFilter, type SortOrder } from "../lib/saved";

interface Props {
  filter: SavedFilter;
  trips: string[];
  total: number;
  shown: number;
  onChange: (f: SavedFilter) => void;
  onExport: () => void;
}

/** Search, trip filter, sort and export for the saved list. */
export function SavedToolbar({ filter, trips, total, shown, onChange, onExport }: Props) {
  return (
    <div className="saved-toolbar">
      <input
        type="search"
        value={filter.query}
        placeholder="料理名・原文・メモで検索"
        aria-label="検索"
        onChange={(e) => onChange({ ...filter, query: e.target.value })}
      />
      <div className="saved-toolbar-row">
        <select
          value={filter.trip}
          aria-label="旅行で絞り込み"
          onChange={(e) => onChange({ ...filter, trip: e.target.value })}
        >
          <option value="">すべての旅行</option>
          <option value={NO_TRIP}>旅行未設定</option>
          {trips.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={filter.order}
          aria-label="並べ替え"
          onChange={(e) => onChange({ ...filter, order: e.target.value as SortOrder })}
        >
          {(Object.keys(SORT_LABELS) as SortOrder[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <button onClick={onExport} disabled={shown === 0}>
          📄 書き出し
        </button>
      </div>
      <p className="context-hint-note">
        {shown === total ? `${total}件` : `${shown}件 / 全${total}件`}
      </p>
    </div>
  );
}
