/**
 * Static, offline phrase book for ordering. Fixed phrases are free, instant
 * and work without a connection (unlike asking Gemini every time).
 *
 * NOTE: the wording below was written by an AI assistant and has NOT been
 * reviewed by native speakers. Have a native speaker (e.g. family in Bangkok)
 * check the Thai/Chinese/Korean/Vietnamese text before relying on it,
 * especially the allergy phrases.
 */

export type PhraseLang = "th" | "zh" | "ko" | "vi" | "en";

export const PHRASE_LANGS: { code: PhraseLang; label: string }[] = [
  { code: "th", label: "タイ語" },
  { code: "zh", label: "中国語" },
  { code: "ko", label: "韓国語" },
  { code: "vi", label: "ベトナム語" },
  { code: "en", label: "英語" },
];

export function isPhraseLang(code: string | null | undefined): code is PhraseLang {
  return PHRASE_LANGS.some((l) => l.code === code);
}

/** Maps any ISO 639-1 code (zh-TW, TH ...) to a supported phrase language. */
export function toPhraseLang(code: string | null | undefined): PhraseLang | null {
  const base = code?.toLowerCase().split(/[-_]/)[0];
  return isPhraseLang(base) ? base : null;
}

export type PhraseKey =
  | "one"
  | "two"
  | "recommend"
  | "notSpicy"
  | "lessSpicy"
  | "noCilantro"
  | "takeaway"
  | "water"
  | "bill"
  | "vegetarian"
  | "halal"
  | "noPork";

/** Fixed phrases: Japanese gloss + text per language. */
export const BASIC_PHRASES: Record<
  PhraseKey,
  { ja: string } & Record<PhraseLang, string>
> = {
  one: {
    ja: "これを1つください",
    th: "ขออันนี้หนึ่งที่",
    zh: "请给我一份这个。",
    ko: "이거 하나 주세요.",
    vi: "Cho tôi một phần này.",
    en: "One of this, please.",
  },
  two: {
    ja: "これを2つください",
    th: "ขออันนี้สองที่",
    zh: "请给我两份这个。",
    ko: "이거 두 개 주세요.",
    vi: "Cho tôi hai phần này.",
    en: "Two of this, please.",
  },
  recommend: {
    ja: "おすすめは何ですか?",
    th: "มีอะไรแนะนำไหม",
    zh: "有什么推荐的吗?",
    ko: "추천 메뉴가 뭐예요?",
    vi: "Bạn có thể gợi ý món nào không?",
    en: "What do you recommend?",
  },
  notSpicy: {
    ja: "辛くしないでください",
    th: "ไม่เผ็ด",
    zh: "不要辣。",
    ko: "안 맵게 해 주세요.",
    vi: "Đừng cho cay.",
    en: "Not spicy, please.",
  },
  lessSpicy: {
    ja: "辛さ控えめでお願いします",
    th: "เผ็ดน้อย",
    zh: "少放辣。",
    ko: "덜 맵게 해 주세요.",
    vi: "Cho ít cay thôi.",
    en: "Mild spice, please.",
  },
  noCilantro: {
    ja: "パクチー抜きでお願いします",
    th: "ไม่ใส่ผักชี",
    zh: "不要香菜。",
    ko: "고수는 빼 주세요.",
    vi: "Đừng cho ngò.",
    en: "No cilantro, please.",
  },
  takeaway: {
    ja: "持ち帰りでお願いします",
    th: "ขอห่อกลับบ้านหน่อย",
    zh: "请帮我打包。",
    ko: "포장해 주세요.",
    vi: "Cho tôi mang về.",
    en: "Takeaway, please.",
  },
  water: {
    ja: "お水をください",
    th: "ขอน้ำเปล่าหน่อย",
    zh: "请给我一杯水。",
    ko: "물 좀 주세요.",
    vi: "Cho tôi một ly nước.",
    en: "Water, please.",
  },
  bill: {
    ja: "お会計をお願いします",
    th: "เช็คบิลหน่อย",
    zh: "请结账。",
    ko: "계산해 주세요.",
    vi: "Tính tiền giúp tôi.",
    en: "The bill, please.",
  },
  vegetarian: {
    ja: "私はベジタリアン(肉・魚を食べない)です",
    th: "ฉันกินมังสวิรัติ",
    zh: "我吃素。",
    ko: "저는 채식주의자예요.",
    vi: "Tôi ăn chay.",
    en: "I am vegetarian.",
  },
  halal: {
    ja: "ハラール(イスラム教徒が食べられる食事)のみ食べます",
    th: "ฉันกินเฉพาะอาหารฮาลาล",
    zh: "我只吃清真食品。",
    ko: "저는 할랄 음식만 먹어요.",
    vi: "Tôi chỉ ăn đồ halal.",
    en: "I only eat halal food.",
  },
  noPork: {
    ja: "豚肉は食べません",
    th: "ฉันไม่กินหมู",
    zh: "我不吃猪肉。",
    ko: "저는 돼지고기를 못 먹어요.",
    vi: "Tôi không ăn thịt heo.",
    en: "I don't eat pork.",
  },
};

export const BASIC_PHRASE_ORDER: PhraseKey[] = [
  "one",
  "two",
  "recommend",
  "notSpicy",
  "lessSpicy",
  "noCilantro",
  "takeaway",
  "water",
  "bill",
  "vegetarian",
  "halal",
  "noPork",
];

export type IngredientKey =
  | "shrimp"
  | "crab"
  | "shellfish"
  | "seafood"
  | "fish"
  | "peanut"
  | "treenut"
  | "egg"
  | "milk"
  | "wheat"
  | "soy"
  | "sesame"
  | "pork"
  | "beef"
  | "chicken"
  | "meat"
  | "alcohol"
  | "cilantro"
  | "fishSauce"
  | "shrimpPaste"
  | "oysterSauce";

/** Ingredient words: Japanese label + word per phrase language. */
export const INGREDIENTS: Record<
  IngredientKey,
  { ja: string } & Record<PhraseLang, string>
> = {
  shrimp: { ja: "エビ", th: "กุ้ง", zh: "虾", ko: "새우", vi: "tôm", en: "shrimp" },
  crab: { ja: "カニ", th: "ปู", zh: "螃蟹", ko: "게", vi: "cua", en: "crab" },
  shellfish: { ja: "貝類", th: "หอย", zh: "贝类", ko: "조개류", vi: "động vật có vỏ", en: "shellfish" },
  seafood: { ja: "魚介類", th: "อาหารทะเล", zh: "海鲜", ko: "해산물", vi: "hải sản", en: "seafood" },
  fish: { ja: "魚", th: "ปลา", zh: "鱼", ko: "생선", vi: "cá", en: "fish" },
  peanut: { ja: "ピーナッツ", th: "ถั่วลิสง", zh: "花生", ko: "땅콩", vi: "đậu phộng", en: "peanuts" },
  treenut: { ja: "ナッツ類", th: "ถั่วเปลือกแข็ง", zh: "坚果", ko: "견과류", vi: "các loại hạt", en: "tree nuts" },
  egg: { ja: "卵", th: "ไข่", zh: "鸡蛋", ko: "계란", vi: "trứng", en: "egg" },
  milk: { ja: "乳製品", th: "นม", zh: "牛奶", ko: "우유", vi: "sữa", en: "dairy" },
  wheat: { ja: "小麦(グルテン)", th: "แป้งสาลี", zh: "小麦", ko: "밀", vi: "lúa mì", en: "wheat/gluten" },
  soy: { ja: "大豆", th: "ถั่วเหลือง", zh: "大豆", ko: "대두", vi: "đậu nành", en: "soy" },
  sesame: { ja: "ごま", th: "งา", zh: "芝麻", ko: "참깨", vi: "mè", en: "sesame" },
  pork: { ja: "豚肉", th: "หมู", zh: "猪肉", ko: "돼지고기", vi: "thịt heo", en: "pork" },
  beef: { ja: "牛肉", th: "เนื้อวัว", zh: "牛肉", ko: "소고기", vi: "thịt bò", en: "beef" },
  chicken: { ja: "鶏肉", th: "ไก่", zh: "鸡肉", ko: "닭고기", vi: "thịt gà", en: "chicken" },
  meat: { ja: "肉全般", th: "เนื้อสัตว์", zh: "肉", ko: "고기", vi: "thịt", en: "meat" },
  alcohol: { ja: "アルコール", th: "แอลกอฮอล์", zh: "酒精", ko: "술(알코올)", vi: "rượu bia", en: "alcohol" },
  cilantro: { ja: "パクチー", th: "ผักชี", zh: "香菜", ko: "고수", vi: "ngò", en: "cilantro" },
  fishSauce: { ja: "魚醤(ナンプラー)", th: "น้ำปลา", zh: "鱼露", ko: "액젓", vi: "nước mắm", en: "fish sauce" },
  shrimpPaste: { ja: "エビペースト", th: "กะปิ", zh: "虾酱", ko: "새우젓", vi: "mắm tôm", en: "shrimp paste" },
  oysterSauce: { ja: "オイスターソース", th: "น้ำมันหอย", zh: "蚝油", ko: "굴소스", vi: "dầu hào", en: "oyster sauce" },
};

export const INGREDIENT_ORDER = Object.keys(INGREDIENTS) as IngredientKey[];

export function isIngredientKey(v: unknown): v is IngredientKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(INGREDIENTS, v);
}

const CONTAINS: Record<PhraseLang, string> = {
  th: "อันนี้มี{X}ไหม",
  zh: "这个里面有{X}吗?",
  ko: "이거 {X} 들어가요?",
  vi: "Món này có {X} không?",
  en: "Does this contain {X}?",
};

const ALLERGIC: Record<PhraseLang, string> = {
  th: "ฉันแพ้{X}",
  zh: "我对{X}过敏。",
  ko: "저는 {X} 알레르기가 있어요.",
  vi: "Tôi bị dị ứng {X}.",
  en: "I am allergic to {X}.",
};

// Thai is written without spaces; the other languages need one around the word.
function fill(template: string, word: string): string {
  return template.replace("{X}", word);
}

export type PhraseSelection =
  | { kind: "basic"; key: PhraseKey }
  | { kind: "contains"; ingredient: IngredientKey }
  | { kind: "allergic"; ingredient: IngredientKey };

export interface BuiltPhrase {
  text: string;
  /** Japanese gloss, so the user knows what they are about to show/say. */
  ja: string;
}

export function buildPhrase(lang: PhraseLang, sel: PhraseSelection): BuiltPhrase {
  if (sel.kind === "basic") {
    const p = BASIC_PHRASES[sel.key];
    return { text: p[lang], ja: p.ja };
  }
  const ing = INGREDIENTS[sel.ingredient];
  if (sel.kind === "contains") {
    return {
      text: fill(CONTAINS[lang], ing[lang]),
      ja: `これには${ing.ja}が入っていますか?`,
    };
  }
  return {
    text: fill(ALLERGIC[lang], ing[lang]),
    ja: `私は${ing.ja}のアレルギーです`,
  };
}
