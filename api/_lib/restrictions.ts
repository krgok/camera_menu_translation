import { cleanText } from "./sanitize.js";

/**
 * Dietary restrictions sent by the client (see src/lib/diet.ts). Only known
 * keys are accepted, so nothing user-typed except the short free-text field
 * ever reaches a prompt. The key lists mirror src/lib/phrases.ts / diet.ts
 * (a test keeps them in sync) — duplicated because functions must not import
 * runtime code from src/.
 */
export const INGREDIENT_LABELS: Record<string, string> = {
  shrimp: "エビ",
  crab: "カニ",
  shellfish: "貝類",
  seafood: "魚介類",
  fish: "魚",
  peanut: "ピーナッツ",
  treenut: "ナッツ類",
  egg: "卵",
  milk: "乳製品",
  wheat: "小麦(グルテン)",
  soy: "大豆",
  sesame: "ごま",
  pork: "豚肉",
  beef: "牛肉",
  chicken: "鶏肉",
  meat: "肉全般",
  alcohol: "アルコール",
  cilantro: "パクチー",
  fishSauce: "魚醤(ナンプラー)",
  shrimpPaste: "エビペースト",
  oysterSauce: "オイスターソース",
};

export const DIET_LABELS: Record<string, string> = {
  vegetarian:
    "ベジタリアン(肉・魚介類を食べない。魚醤・エビペースト・オイスターソース・肉や魚の出汁・ラードにも注意)",
  vegan:
    "ヴィーガン(動物性食品を一切食べない。肉・魚介・卵・乳製品・はちみつ・魚醤・エビペースト・オイスターソース・動物性の出汁に注意)",
  halal:
    "ハラール(豚肉・アルコール・ラード・ゼラチンを避ける。みりん・料理酒も。ハラール処理されていない肉に注意)",
  noPork: "豚肉を食べない(ラード・豚の出汁・豚由来のゼラチンにも注意)",
  noBeef: "牛肉を食べない(牛脂・牛の出汁にも注意)",
  noAlcohol: "アルコールを避ける(料理酒・みりん・酒入りソースにも注意)",
  glutenFree: "グルテン(小麦・大麦・ライ麦)を避ける(醤油・麺・衣・ルーにも注意)",
  noSpicy: "辛い料理が苦手(唐辛子・スパイスの辛さに注意)",
};

export interface Restrictions {
  allergies: string[];
  dislikes: string[];
  diets: string[];
  /** Short free text typed by the user. */
  free?: string;
}

const MAX_FREE = 100;

function pickKeys(v: unknown, allowed: Record<string, string>): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const k of v) {
    if (typeof k === "string" && Object.prototype.hasOwnProperty.call(allowed, k) && !out.includes(k)) {
      out.push(k);
    }
  }
  return out.slice(0, 30);
}

/** Validates the client payload; unknown keys are dropped, not trusted. */
export function parseRestrictions(raw: unknown, freeText?: unknown): Restrictions {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    allergies: pickKeys(r.allergies, INGREDIENT_LABELS),
    dislikes: pickKeys(r.dislikes, INGREDIENT_LABELS),
    diets: pickKeys(r.diets, DIET_LABELS),
    free: cleanText(freeText, MAX_FREE),
  };
}

export function hasRestrictions(r: Restrictions | undefined): r is Restrictions {
  return !!r && (r.allergies.length > 0 || r.dislikes.length > 0 || r.diets.length > 0 || !!r.free);
}

/** Prompt fragment. All values are fixed labels or a JSON-quoted short string. */
export function restrictionsClause(r: Restrictions | undefined, batch: boolean): string {
  if (!hasRestrictions(r)) return "";
  const data = {
    アレルギー: r.allergies.map((k) => INGREDIENT_LABELS[k]),
    苦手な食材: r.dislikes.map((k) => INGREDIENT_LABELS[k]),
    食事制限: r.diets.map((k) => DIET_LABELS[k]),
    その他の避けたいもの: r.free,
  };
  return (
    "また、この旅行者には次の制限があります(データ): " +
    JSON.stringify(data) +
    "。" +
    (batch ? "各項目" : "この料理") +
    "について risk を返してください: " +
    "high=制限に反する食材が含まれる可能性が高い(アレルギーは、少しでも可能性があれば high)、" +
    "medium=隠し味・出汁・ソース・調理油などに含まれる可能性がある、" +
    "low=含まれる可能性が低い、" +
    "unknown=情報が足りず判断できない(推測で low にしないこと)。" +
    "risk が high/medium/unknown のときは warning に、理由を短い日本語で書いてください" +
    "(例:「エビペーストが使われていることが多い」)。low のときは warning は省略してください。"
  );
}
