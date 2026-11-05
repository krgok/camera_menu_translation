import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { consumeQuota } from "./_lib/quota.js";
import { respondError } from "./_lib/errors.js";
import { assertBodySize, validateExplainBody } from "./_lib/validate.js";
import { explainDish } from "./_lib/gemini.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { user, token } = await requireUser(req.headers.authorization);
    assertBodySize(req.headers["content-length"]);
    const { name, original_text, appMode, restrictions } = validateExplainBody(req.body);
    // Count this paid call (per user + global, per day) before it happens.
    await consumeQuota(user.id, token, "explain");

    const { explanation, warning, risk, references } = await explainDish(
      name,
      original_text,
      appMode,
      restrictions,
    );
    res.status(200).json({ explanation, warning, risk, references });
  } catch (e) {
    respondError(res, e, "説明の取得に失敗しました");
  }
}
