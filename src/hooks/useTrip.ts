import { useCallback, useEffect, useState } from "react";

const TRIP_KEY = "current-trip";
const RECENT_KEY = "recent-trips";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The trip new saves are filed under (e.g. "2026年12月 バンコク"), plus recent names. */
export function useTrip() {
  const [trip, setTripState] = useState(() => (read(TRIP_KEY) ?? "").slice(0, 60));
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(read(RECENT_KEY) ?? "[]");
      return Array.isArray(parsed)
        ? parsed.filter((t): t is string => typeof t === "string").slice(0, 10)
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(TRIP_KEY, trip);
    } catch {
      // Not persisted — fine.
    }
  }, [trip]);

  const setTrip = useCallback((value: string) => setTripState(value.slice(0, 60)), []);

  /** Remember a trip name once it has actually been used for a save. */
  const remember = useCallback((name: string) => {
    const t = name.trim();
    if (!t) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, 10);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Not persisted — fine.
      }
      return next;
    });
  }, []);

  return { trip, setTrip, recent, remember };
}
