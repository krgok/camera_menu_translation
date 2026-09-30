import { useEffect, useState } from "react";
import type { RatesResponse } from "./types";

const CACHE_KEY = "fx-rates";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
}

let memory: CachedRates | null = null;
let inflight: Promise<CachedRates | null> | null = null;

function readCache(): CachedRates | null {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (parsed && typeof parsed.rates === "object") {
      memory = parsed;
      return parsed;
    }
  } catch {
    // Corrupt cache — refetch.
  }
  return null;
}

/**
 * Loads JPY-based rates, preferring a <12h cache. A stale cache is still
 * returned if the network fails — an approximate yen figure from yesterday
 * beats nothing when you're offline in a basement restaurant.
 */
export function loadRates(): Promise<CachedRates | null> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) {
    return Promise.resolve(cached);
  }
  if (inflight) return inflight;
  inflight = fetch("/api/rates")
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const data: RatesResponse = await res.json();
      const next: CachedRates = { rates: data.rates, fetchedAt: Date.now() };
      memory = next;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // Storage full — the in-memory copy still works this session.
      }
      return next;
    })
    .catch(() => cached)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Synchronous access for non-React callers (e.g. the text export). */
export function getCachedRates(): Record<string, number> | null {
  return readCache()?.rates ?? null;
}

export function toYen(
  price: number,
  currency: string,
  rates: Record<string, number> | null,
): number | null {
  const code = currency.toUpperCase();
  if (code === "JPY") return price;
  const perYen = rates?.[code];
  if (!perYen || perYen <= 0) return null;
  return price / perYen;
}

export function formatYen(yen: number): string {
  // Round to a precision that matches "roughly how much" — exact yen would
  // imply false accuracy from a daily rate.
  const rounded = yen >= 1000 ? Math.round(yen / 10) * 10 : Math.round(yen);
  return `約${rounded.toLocaleString("ja-JP")}円`;
}

/** "40 THB(約170円)" — falls back to just the original price. */
export function formatPrice(
  price: number,
  currency: string | undefined,
  rates: Record<string, number> | null,
): string {
  const original = `${price.toLocaleString()}${currency ? ` ${currency}` : ""}`;
  if (!currency) return original;
  const yen = toYen(price, currency, rates);
  if (yen === null || currency.toUpperCase() === "JPY") return original;
  return `${original}(${formatYen(yen)})`;
}

export function useRates(): Record<string, number> | null {
  const [rates, setRates] = useState<Record<string, number> | null>(
    () => getCachedRates(),
  );
  useEffect(() => {
    let cancelled = false;
    loadRates().then((r) => {
      if (!cancelled && r) setRates(r.rates);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return rates;
}
