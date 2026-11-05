import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchWithTimeout } from "./_lib/fetchWithTimeout.js";

/**
 * Proxies a free, keyless exchange-rate feed (JPY base) so the browser
 * doesn't depend on a third party's CORS policy. Rates are public data and
 * cost nothing, so no auth — and the CDN cache header means Vercel serves
 * it from the edge for hours instead of invoking the function each time.
 * Only validated, plain numbers are forwarded (no raw upstream passthrough).
 */
export function parseRates(data: any): Record<string, number> | null {
  if (data?.result !== "success" || typeof data.rates !== "object" || data.rates === null) {
    return null;
  }
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(data.rates)) {
    if (/^[A-Z]{3}$/.test(code) && typeof value === "number" && Number.isFinite(value) && value > 0) {
      rates[code] = value;
    }
  }
  // JPY itself must be present (=1) for the feed to be trusted as JPY-based.
  return rates.JPY === 1 && Object.keys(rates).length >= 10 ? rates : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const upstream = await fetchWithTimeout(
      "https://open.er-api.com/v6/latest/JPY",
      {},
      8000,
    );
    if (!upstream.ok) throw new Error(`rates upstream ${upstream.status}`);
    const data: any = await upstream.json();
    const rates = parseRates(data);
    if (!rates) throw new Error("rates upstream returned an unexpected payload");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=21600, stale-while-revalidate=86400",
    );
    res.status(200).json({
      rates,
      updated: typeof data.time_last_update_utc === "string" ? data.time_last_update_utc.slice(0, 40) : "",
    });
  } catch (e) {
    console.error("[rates] failed:", e instanceof Error ? e.message : e);
    res.status(502).json({ error: "為替レートを取得できませんでした" });
  }
}
