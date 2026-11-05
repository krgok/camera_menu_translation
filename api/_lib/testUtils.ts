/** Test helpers (not shipped as a function: `_lib` is ignored by Vercel). */

/** Smallest structurally valid JPEG header: SOI + SOF0 (w x h) + EOI. */
export function tinyJpeg(width: number, height: number): Buffer {
  const sof = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    height >> 8, height & 0xff,
    width >> 8, width & 0xff,
    0x01, 0x11, 0x00,
  ]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

export function jpegDataUrl(width = 800, height = 600): string {
  return `data:image/jpeg;base64,${tinyJpeg(width, height).toString("base64")}`;
}

export function fakeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    setHeader(k: string, v: string) {
      res.headers[k] = v;
      return res;
    },
  };
  return res;
}
