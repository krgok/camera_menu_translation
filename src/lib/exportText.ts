import type { AppMode, MenuItem } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Builds a plain-text study sheet (original text / reading / translation /
 * explanation per item) and triggers a download. Items whose explanation
 * hasn't been fetched yet are included with whatever fields they have.
 */
export function exportItemsText(items: MenuItem[], appMode: AppMode): void {
  const now = new Date();
  const dateLabel = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const modeLabel = appMode === "museum" ? "博物館説明" : "料理説明";

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
    if (item.explanation) lines.push(`   説明: ${item.explanation}`);
    if (item.warning) lines.push(`   ⚠ 注意: ${item.warning}`);
    lines.push("");
  });

  // BOM so the file opens with correct encoding in Windows text editors.
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/plain;charset=utf-8",
  });
  const fileName = `scan_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.txt`;

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
