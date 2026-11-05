import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { respondError } from "./_lib/errors.js";
import { assertBodySize, validateBatchBody } from "./_lib/validate.js";
import { explainDishesBatch } from "./_lib/gemini.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await requireUser(req.headers.authorization);
    assertBodySize(req.headers["content-length"]);
    // One Gemini call per request: the client chunks bigger menus (see
    // MAX_BATCH_ITEMS) so each call stays inside the timeout.
    const { items, appMode, avoid } = validateBatchBody(req.body);

    const results = await explainDishesBatch(items, appMode, avoid);
    res.status(200).json({ results });
  } catch (e) {
    respondError(res, e, "説明の取得に失敗しました");
  }
}
