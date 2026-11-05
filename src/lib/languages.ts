/**
 * Menu language the user can pin ("auto" = let the OCR/AI detect it). Pinning
 * helps Vision with mixed-script menus and gives dishes a language for
 * read-aloud/phrases when detection fails. Mirrors LANGUAGE_HINTS in
 * api/_lib/validate.ts (a test keeps them in sync).
 */
export const LANGUAGE_CODES = ["th", "zh", "ko", "vi", "ja", "en"] as const;
export type LanguageHint = (typeof LANGUAGE_CODES)[number];

export const LANGUAGE_OPTIONS: { code: LanguageHint | ""; label: string }[] = [
  { code: "", label: "自動で判別" },
  { code: "th", label: "タイ語" },
  { code: "zh", label: "中国語" },
  { code: "ko", label: "韓国語" },
  { code: "vi", label: "ベトナム語" },
  { code: "ja", label: "日本語" },
  { code: "en", label: "英語" },
];

const KEY = "language-hint";

export function isLanguageHint(v: unknown): v is LanguageHint {
  return typeof v === "string" && (LANGUAGE_CODES as readonly string[]).includes(v);
}

export function loadLanguageHint(): LanguageHint | "" {
  try {
    const v = localStorage.getItem(KEY);
    return isLanguageHint(v) ? v : "";
  } catch {
    return "";
  }
}

export function saveLanguageHint(v: LanguageHint | ""): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Not persisted — fine.
  }
}
