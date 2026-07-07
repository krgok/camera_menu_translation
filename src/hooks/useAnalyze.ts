import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AnalyzeResponse, MenuItem, RecognitionMode } from "../lib/types";

export function useAnalyze() {
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    async (image: string, modes: RecognitionMode[]) => {
      setLoading(true);
      setError(null);
      setWarnings([]);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          throw new Error("先にGoogleでログインしてください");
        }

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ image, modes }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`解析に失敗しました (${res.status}): ${text}`);
        }

        const data: AnalyzeResponse = await res.json();
        setItems(data.items);
        setWarnings(data.warnings ?? []);
        return data.items;
      } catch (e) {
        // Keep any previously scanned items on screen — a failed retry
        // shouldn't wipe out a result the user already has.
        const message = e instanceof Error ? e.message : "解析に失敗しました";
        setError(message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    analyze,
    loading,
    elapsedSeconds,
    error,
    warnings,
    items,
    setItems,
  };
}
