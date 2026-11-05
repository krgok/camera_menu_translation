import { describe, expect, it } from "vitest";
import {
  assertBodySize,
  parseJpegDataUrl,
  validateAnalyzeBody,
  validateBatchBody,
  validateExplainBody,
} from "./validate.js";
import { HttpError } from "./errors.js";
import { MAX_IMAGE_BASE64_CHARS } from "./limits.js";
import { jpegDataUrl, tinyJpeg } from "./testUtils.js";

const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof HttpError ? e.status : "other";
  }
  return "no-error";
};

describe("parseJpegDataUrl", () => {
  it("正しいJPEGから寸法を読み取る", () => {
    expect(parseJpegDataUrl(jpegDataUrl(800, 600))).toMatchObject({ width: 800, height: 600 });
  });
  it("JPEG以外(PNG等)・非文字列は 400", () => {
    expect(status(() => parseJpegDataUrl("data:image/png;base64,AAAA"))).toBe(400);
    expect(status(() => parseJpegDataUrl(123))).toBe(400);
    expect(status(() => parseJpegDataUrl(undefined))).toBe(400);
  });
  it("デコード前に長さで 413 にする", () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_IMAGE_BASE64_CHARS + 1);
    expect(status(() => parseJpegDataUrl(huge))).toBe(413);
  });
  it("base64 以外の文字を含むと 400", () => {
    expect(status(() => parseJpegDataUrl("data:image/jpeg;base64,@@@@"))).toBe(400);
  });
  it("JPEGのマジックバイトが無いと 400", () => {
    const fake = "data:image/jpeg;base64," + Buffer.from("not a jpeg at all").toString("base64");
    expect(status(() => parseJpegDataUrl(fake))).toBe(400);
  });
  it("寸法が範囲外(大きすぎ・小さすぎ)だと 400", () => {
    expect(status(() => parseJpegDataUrl(jpegDataUrl(5000, 5000)))).toBe(400);
    expect(status(() => parseJpegDataUrl(jpegDataUrl(4, 4)))).toBe(400);
  });
  it("途中で切れたJPEGでも例外は HttpError(クラッシュ・無限ループしない)", () => {
    const cut = tinyJpeg(800, 600).subarray(0, 6);
    expect(status(() => parseJpegDataUrl("data:image/jpeg;base64," + cut.toString("base64")))).toBe(400);
  });
});

describe("assertBodySize", () => {
  it("宣言サイズが上限超なら 413、未指定・正常なら通す", () => {
    expect(status(() => assertBodySize("99999999"))).toBe(413);
    expect(status(() => assertBodySize("1000"))).toBe("no-error");
    expect(status(() => assertBodySize(undefined))).toBe("no-error");
  });
});

describe("validateAnalyzeBody", () => {
  const ok = { image: jpegDataUrl(), modes: ["text", "image"] };
  it("正常系: 既定は menu、ヒントは整形される", () => {
    const v = validateAnalyzeBody({ ...ok, contextHint: "  タイ料理 <b>x</b> " });
    expect(v.appMode).toBe("menu");
    expect(v.contextHint).toBe("タイ料理 x");
  });
  it("不正な modes / appMode / ボディは 400", () => {
    expect(status(() => validateAnalyzeBody({ ...ok, modes: [] }))).toBe(400);
    expect(status(() => validateAnalyzeBody({ ...ok, modes: ["video"] }))).toBe(400);
    expect(status(() => validateAnalyzeBody({ ...ok, appMode: "x" }))).toBe(400);
    expect(status(() => validateAnalyzeBody(null))).toBe(400);
    expect(status(() => validateAnalyzeBody([]))).toBe(400);
  });
  it("長すぎるヒントは切り詰められる/極端に長ければ 400", () => {
    expect(validateAnalyzeBody({ ...ok, contextHint: "あ".repeat(300) }).contextHint).toHaveLength(100);
    expect(status(() => validateAnalyzeBody({ ...ok, contextHint: "あ".repeat(1000) }))).toBe(400);
  });
});

describe("validateExplainBody / validateBatchBody", () => {
  it("name 必須・URLのみの name は拒否", () => {
    expect(status(() => validateExplainBody({}))).toBe(400);
    expect(status(() => validateExplainBody({ name: "https://evil.example" }))).toBe(400);
    expect(validateExplainBody({ name: "ガパオ", original_text: "กะเพรา" }).name).toBe("ガパオ");
  });
  it("batch は 15件まで", () => {
    const item = { name: "a" };
    expect(validateBatchBody({ items: Array(15).fill(item) }).items).toHaveLength(15);
    expect(status(() => validateBatchBody({ items: Array(16).fill(item) }))).toBe(400);
    expect(status(() => validateBatchBody({ items: [] }))).toBe(400);
    expect(status(() => validateBatchBody({ items: "x" }))).toBe(400);
  });
});
