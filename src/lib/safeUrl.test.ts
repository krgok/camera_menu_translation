import { describe, expect, it } from "vitest";
import { safeReferenceUrl, safeThumbnailSrc } from "./safeUrl";

describe("safeReferenceUrl", () => {
  it("WikipediaのhttpsリンクだけOK", () => {
    expect(safeReferenceUrl("https://ja.wikipedia.org/wiki/Special:Search?search=%E9%87%91&go=Go")).toContain("wikipedia.org");
  });
  it("javascript:・data:・http・他ドメイン・なりすましドメインは null", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>1</script>",
      "http://ja.wikipedia.org/",
      "https://evil.example/",
      "https://wikipedia.org.evil.example/",
      "https://evilwikipedia.org/",
      "not a url",
      null,
      42,
    ]) {
      expect(safeReferenceUrl(bad)).toBeNull();
    }
  });
});

describe("safeThumbnailSrc", () => {
  it("JPEG data URLだけ通す", () => {
    expect(safeThumbnailSrc("data:image/jpeg;base64,/9j/4AAQ")).not.toBeNull();
    expect(safeThumbnailSrc("https://tracker.example/x.png")).toBeNull();
    expect(safeThumbnailSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(safeThumbnailSrc(null)).toBeNull();
  });
});
