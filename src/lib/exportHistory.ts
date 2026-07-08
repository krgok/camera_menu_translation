import type { HistoryEntry } from "./history";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function folderName(timestamp: number): string {
  const d = new Date(timestamp);
  return `scan-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function headingDate(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Collapses whitespace (incl. newlines) so a value can't break out of its
// Markdown line. Full escaping is deliberately out of scope.
function inline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function buildNotes(entry: HistoryEntry): string {
  const modeLabel = entry.appMode === "museum" ? "博物館説明" : "料理説明";
  const lines: string[] = [
    `# スキャン ${headingDate(entry.timestamp)}(${modeLabel})`,
    "",
    "![スキャン写真](./photo.jpg)",
    "",
  ];

  entry.items.forEach((item, i) => {
    lines.push(`## ${i + 1}. ${inline(item.name)}`, "");
    if (item.original_text) lines.push(`- 原文表記: ${inline(item.original_text)}`);
    if (item.pronunciation) lines.push(`- 発音(IPA): [${inline(item.pronunciation)}]`);
    if (item.source_language) lines.push(`- 言語: ${inline(item.source_language)}`);
    if (item.explanation) lines.push(`- 説明: ${inline(item.explanation)}`);
    if (item.references && item.references.length > 0) {
      lines.push("- 参考リンク:");
      for (const ref of item.references) {
        lines.push(`  - [${inline(ref.title)}](${ref.url})`);
      }
    }
    lines.push("");
  });

  return lines.join("\n");
}

export async function exportHistoryZip(entries: HistoryEntry[]): Promise<void> {
  // Loaded on demand — jszip is ~100KB minified and export is a rare action,
  // so keep it out of the initial bundle.
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const entry of entries) {
    let name = folderName(entry.timestamp);
    // Same-second scans are unlikely but would silently merge folders.
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${folderName(entry.timestamp)}-${suffix++}`;
    }
    usedNames.add(name);

    const folder = zip.folder(name)!;
    const base64 = /^data:image\/\w+;base64,(.+)$/.exec(entry.image)?.[1];
    if (base64) {
      folder.file("photo.jpg", base64, { base64: true });
    }
    folder.file("notes.md", buildNotes(entry));
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const now = new Date();
  const zipName = `scan-history_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`;

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
