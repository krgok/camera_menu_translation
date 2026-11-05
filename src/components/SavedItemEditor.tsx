import { useState } from "react";
import { RATING_LABEL } from "../lib/saved";
import type { SavedItem } from "../lib/supabase";

interface Props {
  item: SavedItem;
  trips: string[];
  onUpdate: (patch: { trip?: string | null; rating?: number | null; note?: string | null }) => Promise<void>;
}

/** Rating, trip and memo for one saved dish. */
export function SavedItemEditor({ item, trips, onUpdate }: Props) {
  const [note, setNote] = useState(item.note ?? "");
  const [trip, setTrip] = useState(item.trip ?? "");
  const [busy, setBusy] = useState(false);

  const run = async (patch: Parameters<Props["onUpdate"]>[0]) => {
    setBusy(true);
    try {
      await onUpdate(patch);
    } finally {
      setBusy(false);
    }
  };
  const rate = (value: 1 | -1) => run({ rating: item.rating === value ? null : value });

  return (
    <div className="saved-editor">
      <div className="saved-editor-row" role="group" aria-label="評価">
        {([1, -1] as const).map((v) => (
          <button
            key={v}
            disabled={busy}
            aria-pressed={item.rating === v}
            className={item.rating === v ? "active" : ""}
            onClick={() => rate(v)}
          >
            {v === 1 ? "👍" : "👎"} {RATING_LABEL[v]}
          </button>
        ))}
      </div>
      <div className="saved-editor-row">
        <input
          type="text"
          value={trip}
          maxLength={60}
          list={`trips-${item.id}`}
          aria-label="旅行名"
          placeholder="旅行名(例: 2026年12月 バンコク)"
          onChange={(e) => setTrip(e.target.value)}
        />
        <datalist id={`trips-${item.id}`}>
          {trips.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          disabled={busy || trip.trim() === (item.trip ?? "")}
          onClick={() => run({ trip: trip.trim() || null })}
        >
          旅行を設定
        </button>
      </div>
      <div className="saved-editor-row">
        <textarea
          value={note}
          maxLength={500}
          rows={2}
          aria-label="メモ"
          placeholder="メモ(お店の名前、味の感想など)"
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          disabled={busy || note.trim() === (item.note ?? "")}
          onClick={() => run({ note: note.trim() || null })}
        >
          メモを保存
        </button>
      </div>
    </div>
  );
}
