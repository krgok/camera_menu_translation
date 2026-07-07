import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { explainDish } from "./_lib/gemini.js";
import type { ExplainRequest } from "../src/lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await requireUser(req.headers.authorization);

    const { name, original_text, appMode = "menu" } = req.body as ExplainRequest;
    if (!name) {
      res.status(400).json({ error: "name は必須です" });
      return;
    }

    const { explanation, references } = await explainDish(
      name,
      original_text,
      appMode,
    );
    res.status(200).json({ explanation, references });
  } catch (e) {
    const message = e instanceof Error ? e.message : "説明の取得に失敗しました";
    const status = message.includes("認証") ? 401 : 500;
    res.status(status).json({ error: message });
  }
}
