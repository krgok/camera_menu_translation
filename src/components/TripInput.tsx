interface Props {
  value: string;
  recent: string[];
  onChange: (value: string) => void;
}

/** Which trip the next saved dishes belong to (optional). */
export function TripInput({ value, recent, onChange }: Props) {
  return (
    <label className="context-hint">
      <span className="context-hint-label">保存先の旅行(任意)</span>
      <input
        type="text"
        value={value}
        maxLength={60}
        list="recent-trips"
        placeholder="例: 2026年12月 バンコク"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id="recent-trips">
        {recent.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </label>
  );
}
