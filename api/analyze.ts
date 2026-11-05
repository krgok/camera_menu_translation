import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { consumeQuota } from "./_lib/quota.js";
import { publicMessage, respondError } from "./_lib/errors.js";
import { assertBodySize, validateAnalyzeBody } from "./_lib/validate.js";
import { detectText } from "./_lib/vision.js";
import { groupMenuItems, identifyDishes } from "./_lib/gemini.js";
import { dedupeItems } from "./_lib/dedupe.js";
import type { MenuItem } from "../src/lib/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Order matters for cost: authenticate -> validate input (size, type,
    // dimensions) -> daily quota -> only then call paid APIs.
    const { user, token } = await requireUser(req.headers.authorization);
    assertBodySize(req.headers["content-length"]);
    const { image, modes, appMode, contextHint, languageHint } = validateAnalyzeBody(req.body);
    // Count this paid call (per user + global, per day) before it happens.
    await consumeQuota(user.id, token, "analyze");

    const tasks: Promise<MenuItem[]>[] = [];
    if (modes.includes("text")) {
      tasks.push(
        detectText(image.base64, image.width, image.height, languageHint).then((blocks) =>
          groupMenuItems(blocks, appMode, contextHint, languageHint),
        ),
      );
    }
    if (modes.includes("image")) {
      tasks.push(identifyDishes(image.base64, appMode, contextHint));
    }

    const settled = await Promise.allSettled(tasks);

    let items: MenuItem[] = [];
    const warnings: string[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") {
        items.push(...result.value);
      } else {
        warnings.push(publicMessage(result.reason, "解析に失敗しました"));
      }
    }

    items = dedupeItems(items);

    if (items.length === 0 && warnings.length > 0) {
      res.status(502).json({ error: warnings.join(" / ") });
      return;
    }

    res.status(200).json({ items, warnings: warnings.length ? warnings : undefined });
  } catch (e) {
    respondError(res, e, "解析に失敗しました");
  }
}
