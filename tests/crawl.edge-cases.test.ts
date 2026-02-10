import { beforeEach, describe, expect, it, vi } from "vitest";
import { crawlSite } from "../src/crawl";
import { safeFetchText, sleep } from "../src/common/http";

vi.mock("../src/common/http", () => ({
  safeFetchText: vi.fn(),
  sleep: vi.fn(),
}));

describe("crawl edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sleep).mockResolvedValue();
  });
  it("respects robots.txt disallow", async () => {
    const robotsTxt = "User-agent: *\nDisallow: /";

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: robotsTxt, bytes: robotsTxt.length };
      }
      return { url, data: "<html><body>Test</body></html>", bytes: 32 };
    });

    const report = await crawlSite("https://blocked.test/");

    expect(report.robots.checked).toBe(true);
    expect(report.robots.allowed).toBe(false);
    expect(report.robots.reason).toContain("disallow");
    expect(report.visited.length).toBe(0);
    expect(report.notes.some((note) => note.includes("robots.txt disallows"))).toBe(true);
  });

  it("handles missing robots.txt gracefully", async () => {
    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        throw new Error("404 not found");
      }
      return { url, data: "<html><body><img src='/logo.png'/></body></html>", bytes: 50 };
    });

    const report = await crawlSite("https://no-robots.test/");

    // When robots.txt fetch fails, checked should be false but allowed should default to true
    expect(report.robots.checked).toBe(false);
    expect(report.robots.allowed).toBe(true);
    expect(report.visited.length).toBeGreaterThan(0);
  });

  it("enforces budget limits", async () => {
    const largeHtml = "<html><body>" + "x".repeat(3 * 1024 * 1024) + "</body></html>";

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      return { url, data: largeHtml, bytes: largeHtml.length };
    });

    const report = await crawlSite("https://large.test/");

    // Should stop crawling when budget exceeded
    expect(report.bytesDownloaded).toBeLessThan(30 * 1024 * 1024);
  });

  it("discovers images with various formats", async () => {
    const html = `
      <html>
        <body>
          <img src="/logo.webp" alt="WebP Logo"/>
          <img src="/icon.avif" alt="AVIF Icon"/>
          <img src="/favicon.ico" alt="ICO Favicon"/>
          <img src="/badge.bmp" alt="BMP Badge"/>
        </body>
      </html>
    `;

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      return { url, data: html, bytes: html.length };
    });

    const report = await crawlSite("https://formats.test/");
    const urls = report.imageCandidates.map((c) => c.url);

    expect(urls).toContain("https://formats.test/logo.webp");
    expect(urls).toContain("https://formats.test/icon.avif");
    expect(urls).toContain("https://formats.test/favicon.ico");
    expect(urls).toContain("https://formats.test/badge.bmp");
  });

  it("handles CSS with data URIs", async () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="/style.css"/>
        </head>
        <body>Test</body>
      </html>
    `;

    const css = `
      .logo {
        background-image: url('data:image/svg+xml;base64,PHN2Zy8+');
      }
      .header {
        background-image: url('/header-bg.png');
      }
    `;

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      if (url.endsWith("/style.css")) {
        return { url, data: css, bytes: css.length };
      }
      return { url, data: html, bytes: html.length };
    });

    const report = await crawlSite("https://css.test/");
    const urls = report.imageCandidates.map((c) => c.url);

    // Should include actual URL but not data URI
    expect(urls).toContain("https://css.test/header-bg.png");
    expect(urls.some((url) => url.startsWith("data:"))).toBe(false);
  });

  it("handles CSS with relative paths", async () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="/assets/styles/main.css"/>
        </head>
        <body>Test</body>
      </html>
    `;

    const css = `
      .logo {
        background-image: url('../images/logo.png');
      }
      .icon {
        background-image: url('../../icons/brand.svg');
      }
    `;

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      if (url.endsWith("/assets/styles/main.css")) {
        return { url, data: css, bytes: css.length };
      }
      return { url, data: html, bytes: html.length };
    });

    const report = await crawlSite("https://relative.test/");
    const urls = report.imageCandidates.map((c) => c.url);

    // Should resolve relative paths correctly
    expect(urls).toContain("https://relative.test/assets/images/logo.png");
    expect(urls).toContain("https://relative.test/icons/brand.svg");
  });

  it("stops crawling when max pages reached", async () => {
    const generatePage = (index: number) => `
      <html>
        <body>
          <a href="/page-${index + 1}">Next</a>
          <img src="/logo-${index}.png" alt="Logo ${index}"/>
        </body>
      </html>
    `;

    let pageCount = 0;
    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      pageCount++;
      const html = generatePage(pageCount);
      return { url, data: html, bytes: html.length };
    });

    // Set max pages to 6 (default)
    const report = await crawlSite("https://many-pages.test/");

    // Should not exceed max pages limit
    expect(report.visited.length).toBeLessThanOrEqual(6);
  });

  it("stops collecting images when max images reached", async () => {
    const manyImages = Array.from({ length: 50 }, (_, i) => `<img src="/img-${i}.png" alt="Image ${i}"/>`).join("\n");
    const html = `
      <html>
        <body>
          ${manyImages}
        </body>
      </html>
    `;

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      return { url, data: html, bytes: html.length };
    });

    const report = await crawlSite("https://many-images.test/");

    // Should not exceed max images limit (40 by default)
    expect(report.imageCandidates.length).toBeLessThanOrEqual(40);
  });

  it("handles malformed JSON-LD gracefully", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            { this is not valid JSON }
          </script>
        </head>
        <body>
          <img src="/fallback-logo.png" alt="Logo"/>
        </body>
      </html>
    `;

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      return { url, data: html, bytes: html.length };
    });

    const report = await crawlSite("https://bad-json.test/");
    const urls = report.imageCandidates.map((c) => c.url);

    // Should continue and find other images
    expect(urls).toContain("https://bad-json.test/fallback-logo.png");
  });

  it("prioritizes about and team pages", async () => {
    const homeHtml = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="/team">Team</a>
          <a href="/contact">Contact</a>
          <a href="/blog">Blog</a>
        </body>
      </html>
    `;

    const aboutHtml = `
      <html>
        <body>
          <img src="/team-logo.png" alt="Team Logo"/>
        </body>
      </html>
    `;

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      if (url.includes("/about") || url.includes("/team")) {
        return { url, data: aboutHtml, bytes: aboutHtml.length };
      }
      return { url, data: homeHtml, bytes: homeHtml.length };
    });

    const report = await crawlSite("https://priority.test/");

    // Should visit about/team pages first
    expect(report.visited.some((url) => url.includes("/about") || url.includes("/team"))).toBe(true);
  });
});
