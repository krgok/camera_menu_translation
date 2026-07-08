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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = src;
  });
}

// Burns the same numbered markers the app overlays on screen into the photo,
// so "## 1." in notes.md is findable on photo.jpg. Mirrors OverlayMarker:
// a circle centered on the box's top-left corner (translate(-50%,-50%)),
// dark fill, accent ring, light number. Returns base64 JPEG, or null so the
// caller can fall back to the plain image (a broken photo shouldn't kill the
// whole export).
async function renderPhotoWithMarkers(entry: HistoryEntry): Promise<string | null> {
  try {
    const img = await loadImage(entry.image);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
    ctx.drawImage(img, 0, 0);

    // ~3.5% of the image width, floored so markers stay tappable-size
    // (legible) even on small photos.
    const diameter = Math.max(canvas.width * 0.035, 28);
    const radius = diameter / 2;
    ctx.lineWidth = Math.max(diameter * 0.08, 2);
    ctx.font = `bold ${Math.round(diameter * 0.55)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    entry.items.forEach((item, i) => {
      // Clamp so a marker on a box at the image edge isn't cut in half.
      const cx = Math.min(
        Math.max((item.box.x / 1000) * canvas.width, radius),
        canvas.width - radius,
      );
      const cy = Math.min(
        Math.max((item.box.y / 1000) * canvas.height, radius),
        canvas.height - radius,
      );
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20, 20, 24, 0.9)";
      ctx.fill();
      ctx.strokeStyle = "#c084fc";
      ctx.stroke();
      ctx.fillStyle = "#f2f2f2";
      ctx.fillText(String(i + 1), cx, cy);
    });

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    return /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl)?.[1] ?? null;
  } catch {
    return null;
  }
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
    const base64 =
      (await renderPhotoWithMarkers(entry)) ??
      /^data:image\/\w+;base64,(.+)$/.exec(entry.image)?.[1];
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
