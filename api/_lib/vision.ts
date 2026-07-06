import { fetchWithTimeout } from "./fetchWithTimeout.js";

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
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    throw new Error(`Vision API エラー: ${res.status} ${await res.text()}`);
  }

  const data: any = await res.json();
  const annotations = data.responses?.[0]?.textAnnotations ?? [];

  return annotations.slice(1).map((a: any) => {
    const vertices = a.boundingPoly.vertices as {
      x?: number;
      y?: number;
    }[];
    const xs = vertices.map((v) => v.x ?? 0);
    const ys = vertices.map((v) => v.y ?? 0);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
      text: a.description as string,
      box: {
        x: (minX / imageWidth) * 1000,
        y: (minY / imageHeight) * 1000,
        w: ((maxX - minX) / imageWidth) * 1000,
        h: ((maxY - minY) / imageHeight) * 1000,
      },
    };
  });
}
