import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { crawlSite } from "../src/crawl";
import { selectBestLogo } from "../src/logo/scoring";
import { extractPalette } from "../src/colors/extract";
import { safeFetchBuffer, safeFetchText, sleep } from "../src/common/http";

vi.mock("../src/common/http", () => ({
  safeFetchText: vi.fn(),
  safeFetchBuffer: vi.fn(),
  sleep: vi.fn(),
}));

describe("extraction flow", () => {
  it("extracts candidates and palette from mocked HTML", async () => {
    const html = readFileSync("tests/fixtures/site.html", "utf8");
    const css = readFileSync("tests/fixtures/site.css", "utf8");
    const logoBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAH0lEQVQoU2NkYGBg+M+ABdLw///P0B8GhgYAwxoCCp6G7tYAAAAASUVORK5CYII=",
      "base64"
    );

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      if (url.endsWith("/assets/site.css")) {
        return { url, data: css, bytes: css.length };
      }
      return { url, data: html, bytes: html.length };
    });

    vi.mocked(safeFetchBuffer).mockResolvedValue({
      url: "https://team.test/assets/logo.png",
      data: logoBuffer,
      bytes: logoBuffer.length,
      contentType: "image/png",
    });
    vi.mocked(sleep).mockResolvedValue();

    const report = await crawlSite("https://team.test/");
    expect(report.imageCandidates.length).toBeGreaterThan(0);
    const logo = selectBestLogo(report.imageCandidates);
    expect(logo).not.toBeNull();

    const palette = await extractPalette(logo!.url, report.cssUrls, report.inlineStyles);
    expect(palette.raw.some((color) => color.hex === "#112233")).toBe(true);
  });
});
