import type { VercelRequest, VercelResponse } from "@vercel/node";
import { errorStatus, requireUser } from "./_lib/auth.js";
import { explainDishesBatch } from "./_lib/gemini.js";
import type { ExplainBatchRequest } from "../src/lib/types";

// Keeps one Gemini call's output comfortably inside the timeout; the client
// chunks larger menus into parallel requests of this size.
const MAX_ITEMS = 15;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await requireUser(req.headers.authorization);

    const { items, appMode = "menu", avoid } = req.body as ExplainBatchRequest;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: "items は必須です" });
      return;
    }
    if (items.length > MAX_ITEMS) {
      res.status(400).json({ error: `一度に説明できるのは${MAX_ITEMS}件までです` });
      return;
    }

    const results = await explainDishesBatch(
      items.map((i) => ({ name: String(i.name), original_text: i.original_text })),
      appMode,
      avoid,
    );
    res.status(200).json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "説明の取得に失敗しました";
    res.status(errorStatus(e)).json({ error: message });
  }
}
