import { describe, expect, it, vi } from "vitest";
import { extractPalette, mergeColors } from "../src/colors/extract";
import { safeFetchBuffer, safeFetchText } from "../src/common/http";

vi.mock("../src/common/http", () => ({
  safeFetchText: vi.fn(),
  safeFetchBuffer: vi.fn(),
}));

describe("color merge", () => {
  it("merges similar colors", () => {
    const merged = mergeColors([
      { hex: "#112233", confidence: 0.5, evidence: ["css"] },
      { hex: "#112235", confidence: 0.5, evidence: ["logo"] },
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0].confidence).toBeGreaterThan(0.5);
  });

  it("extracts palette from css and logo sources", async () => {
    const logoBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAH0lEQVQoU2NkYGBg+M+ABdLw///P0B8GhgYAwxoCCp6G7tYAAAAASUVORK5CYII=",
      "base64"
    );

    vi.mocked(safeFetchText).mockResolvedValue({
      url: "https://team.test/assets/site.css",
      data: ":root { --team-primary: #112233; }",
      bytes: 36,
    });
    vi.mocked(safeFetchBuffer).mockResolvedValue({
      url: "https://team.test/logo.png",
      data: logoBuffer,
      bytes: logoBuffer.length,
      contentType: "image/png",
    });

    const palette = await extractPalette("https://team.test/logo.png", ["https://team.test/assets/site.css"], []);
    expect(palette.primary.hex).toBeDefined();
    expect(palette.raw.length).toBeGreaterThan(0);
  });
});
