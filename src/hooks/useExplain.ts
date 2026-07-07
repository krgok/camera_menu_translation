import { useCallback, useState } from "react";
import { supabase } from "../lib/supabase";
import type { ExplainResponse, MenuItem } from "../lib/types";

export function useExplain() {
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const explain = useCallback(async (item: MenuItem): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return null;

      const res = await fetch("/api/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: item.name,
          original_text: item.original_text,
        }),
      });
      if (!res.ok) return null;

      const data: ExplainResponse = await res.json();
      return data.explanation;
    } catch {
      return null;
    }
  }, []);

  return { explain, loadingIndex, setLoadingIndex };
}
