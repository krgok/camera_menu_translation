/** Crops the region described by a normalized (0-1000) box out of a data URL
 * image and returns a small JPEG thumbnail, for saving alongside an item. */
export function cropThumbnail(
  imageDataUrl: string,
  box: { x: number; y: number; w: number; h: number },
  maxSize = 120,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.onload = () => {
      const sx = (box.x / 1000) * img.width;
      const sy = (box.y / 1000) * img.height;
      const sw = Math.max(1, (box.w / 1000) * img.width);
      const sh = Math.max(1, (box.h / 1000) * img.height);

      const scale = Math.min(1, maxSize / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale);
      canvas.height = Math.round(sh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("画像の処理に失敗しました"));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = imageDataUrl;
  });
}

/** Downscales an arbitrary image file to a JPEG data URL, matching the size
 * budget used for live camera captures (see useCamera.captureFrame) so
 * photo-library uploads cost the same as a scan. */
export function resizeImageFile(file: File, maxDimension = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("画像の処理に失敗しました"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
