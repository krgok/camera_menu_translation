import { useCallback, useState } from "react";
import { postJson } from "../lib/api";
import type {
  AppMode,
  ExplainBatchResponse,
  ExplainResponse,
  MenuItem,
} from "../lib/types";

/** `onError` receives a user-facing message when a request fails. */
export function useExplain(onError?: (message: string) => void) {
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const explain = useCallback(
    async (
      item: MenuItem,
      appMode: AppMode,
      avoid?: string,
    ): Promise<ExplainResponse | null> => {
      try {
        return await postJson<ExplainResponse>("/api/explain", {
          name: item.name,
          original_text: item.original_text,
          appMode,
          avoid,
        });
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "説明の取得に失敗しました");
        return null;
      }
    },
    [onError],
  );

  // Explains up to 15 items in one request. Returns results aligned with
  // `items` (null where it failed), or all-null on a request failure.
  const explainBatch = useCallback(
    async (
      items: MenuItem[],
      appMode: AppMode,
      avoid?: string,
    ): Promise<(ExplainResponse | null)[]> => {
      const empty = items.map(() => null);
      try {
        const data = await postJson<ExplainBatchResponse>("/api/explain-batch", {
          items: items.map((i) => ({ name: i.name, original_text: i.original_text })),
          appMode,
          avoid,
        });
        return items.map((_, i) => data.results?.[i] ?? null);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : "説明の取得に失敗しました");
        return empty;
      }
    },
    [onError],
  );

  return { explain, explainBatch, loadingIndex, setLoadingIndex };
}
