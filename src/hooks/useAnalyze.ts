import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "../lib/api";
import type { AnalyzeResponse, AppMode, MenuItem, RecognitionMode } from "../lib/types";

export function useAnalyze() {
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Blocks overlapping scans (double tap / retry while loading): each one is billed.
  const inflightRef = useRef(false);

  useEffect(() => {
    if (loading) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const analyze = useCallback(
    async (
      image: string,
      modes: RecognitionMode[],
      appMode: AppMode,
      contextHint?: string,
    ) => {
      if (inflightRef.current) return [];
      inflightRef.current = true;
      setLoading(true);
      setError(null);
      setWarnings([]);
      try {
        const data = await postJson<AnalyzeResponse>("/api/analyze", {
          image,
          modes,
          appMode,
          contextHint,
        });
        setItems(data.items ?? []);
        setWarnings(data.warnings ?? []);
        return data.items ?? [];
      } catch (e) {
        // Keep any previously scanned items on screen — a failed retry
        // shouldn't wipe out a result the user already has.
        setError(e instanceof Error ? e.message : "解析に失敗しました");
        return [];
      } finally {
        inflightRef.current = false;
        setLoading(false);
      }
    },
    [],
  );

  // Clears stale error/warning banners (e.g. when the user goes back to the
  // live camera after a failed scan).
  const resetStatus = useCallback(() => {
    setError(null);
    setWarnings([]);
  }, []);

  return {
    analyze,
    loading,
    elapsedSeconds,
    error,
    warnings,
    items,
    setItems,
    resetStatus,
  };
}
