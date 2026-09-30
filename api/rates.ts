import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchWithTimeout } from "./_lib/fetchWithTimeout.js";

/**
 * Proxies a free, keyless exchange-rate feed (JPY base) so the browser
 * doesn't depend on a third party's CORS policy. Rates are public data and
 * cost nothing, so no auth — and the CDN cache header means Vercel serves
 * it from the edge for hours instead of invoking the function each time.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const upstream = await fetchWithTimeout(
      "https://open.er-api.com/v6/latest/JPY",
      {},
      8000,
    );
    if (!upstream.ok) throw new Error(`rates upstream ${upstream.status}`);
    const data: any = await upstream.json();
    if (data.result !== "success" || typeof data.rates !== "object") {
      throw new Error("rates upstream returned an unexpected payload");
    }
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=21600, stale-while-revalidate=86400",
    );
    res.status(200).json({
      rates: data.rates,
      updated: data.time_last_update_utc ?? "",
    });
  } catch (e) {
    res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "為替レートを取得できませんでした" });
  }
}
