import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AnalyzeResponse, MenuItem, RecognitionMode } from "../lib/types";

export function useAnalyze() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);

  const analyze = useCallback(
    async (image: string, modes: RecognitionMode[]) => {
      setLoading(true);
      setError(null);
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
        return data.items;
      } catch (e) {
        const message = e instanceof Error ? e.message : "解析に失敗しました";
        setError(message);
        setItems([]);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { analyze, loading, error, items, setItems };
}
