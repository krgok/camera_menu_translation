import { fetchWithTimeout } from "./fetchWithTimeout.js";
import { UpstreamError } from "./errors.js";
import { MAX_OCR_BLOCKS } from "./limits.js";

export interface OcrTextBlock {
  text: string;
  // bounding box normalized to 0-1000 on both axes
  box: { x: number; y: number; w: number; h: number };
}

/**
 * Runs Cloud Vision TEXT_DETECTION on a base64 JPEG (without the data URL
 * prefix) and returns per-block text with normalized bounding boxes.
 * Skips the first element of textAnnotations, which is the full-page text.
 */
export async function detectText(
  base64Image: string,
  imageWidth: number,
  imageHeight: number,
): Promise<OcrTextBlock[]> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_VISION_API_KEY が未設定です");

  const res = await fetchWithTimeout(
    "https://vision.googleapis.com/v1/images:annotate",
    {
      method: "POST",
      // Key in a header (not the query string) so it never lands in URLs/logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    },
    15000,
  );

  if (!res.ok) {
    // Log the upstream body server-side; never return it to the client.
    throw new UpstreamError(
      `文字認識サービスでエラーが発生しました (${res.status})`,
      (await res.text()).slice(0, 500),
    );
  }

  const data: any = await res.json();
  const annotations = data.responses?.[0]?.textAnnotations ?? [];

  const blocks: OcrTextBlock[] = [];
  for (const a of annotations.slice(1, MAX_OCR_BLOCKS + 1)) {
    const vertices = a?.boundingPoly?.vertices;
    if (typeof a?.description !== "string" || !Array.isArray(vertices) || vertices.length === 0) {
      continue;
    }
    const xs = vertices.map((v: { x?: number }) => v.x ?? 0);
    const ys = vertices.map((v: { y?: number }) => v.y ?? 0);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    blocks.push({
      text: a.description,
      box: {
        x: (minX / imageWidth) * 1000,
        y: (minY / imageHeight) * 1000,
        w: ((maxX - minX) / imageWidth) * 1000,
        h: ((maxY - minY) / imageHeight) * 1000,
      },
    });
  }
  return blocks;
}
