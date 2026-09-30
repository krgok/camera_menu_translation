import type { AppMode, MenuItem } from "./types";
import { formatPrice, getCachedRates } from "./currency";
import { shareOrDownload } from "./download";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Builds a plain-text study sheet (original text / reading / translation /
 * explanation per item) and shares or downloads it. Items whose
 * explanation hasn't been fetched yet are marked, so the user knows to use
 * "show all explanations" first for a complete sheet.
 */
export function exportItemsText(items: MenuItem[], appMode: AppMode): void {
  const now = new Date();
  const dateLabel = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const modeLabel = appMode === "museum" ? "博物館説明" : "料理説明";
  const rates = getCachedRates();

  const lines: string[] = [
    `スキャン結果(${modeLabel}) ${dateLabel}`,
    "=".repeat(40),
    "",
  ];

  items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.name}`);
    if (item.original_text) lines.push(`   原文: ${item.original_text}`);
    if (item.pronunciation) lines.push(`   発音(IPA): [${item.pronunciation}]`);
    if (item.source_language) lines.push(`   言語: ${item.source_language}`);
    if (typeof item.price === "number") {
      lines.push(`   価格: ${formatPrice(item.price, item.currency, rates)}`);
    }
    lines.push(`   説明: ${item.explanation ?? "(未取得)"}`);
    if (item.warning) lines.push(`   ⚠ 注意: ${item.warning}`);
    lines.push("");
  });

  // U+FEFF BOM so the file opens with the right encoding in Windows editors.
  const blob = new Blob([String.fromCharCode(0xfeff) + lines.join("\r\n")], {
    type: "text/plain;charset=utf-8",
  });
  const fileName = `scan_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
  void shareOrDownload(blob, fileName, `スキャン結果 ${dateLabel}`);
}
