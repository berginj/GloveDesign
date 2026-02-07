import { describe, expect, it, vi } from "vitest";
import { crawlSite } from "../src/crawl";
import { safeFetchText, sleep } from "../src/common/http";

vi.mock("../src/common/http", () => ({
  safeFetchText: vi.fn(),
  sleep: vi.fn(),
}));

describe("crawl discovery", () => {
  it("collects logos from lazy images, shortcut icons, srcset, and json-ld", async () => {
    const html = `
      <html>
        <head>
          <link rel="shortcut icon" href="/assets/favicon.ico" />
          <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
          <meta property="og:image" content="/assets/social-logo.png" />
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Organization","logo":"/assets/jsonld-logo.svg"}
          </script>
          <link rel="stylesheet" href="/assets/site.css" />
        </head>
        <body>
          <img data-src="/assets/lazy-logo.png" alt="Team Logo" />
          <img srcset="/assets/logo-1x.png 1x, /assets/logo-2x.png 2x" alt="Club Mark" />
          <a href="/about">About</a>
        </body>
      </html>
    `;

    const css = `
      .hero { background-image: url('/assets/css-logo.png'); }
    `;

    vi.mocked(safeFetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("/robots.txt")) {
        return { url, data: "User-agent: *\nDisallow:", bytes: 24 };
      }
      if (url.endsWith("/assets/site.css")) {
        return { url, data: css, bytes: css.length };
      }
      if (/\/terms|\/legal|\/privacy|\/policies\/terms/.test(url)) {
        throw new Error("not found");
      }
      return { url, data: html, bytes: html.length };
    });

    vi.mocked(sleep).mockResolvedValue();

    const report = await crawlSite("https://team.test/");
    const urls = report.imageCandidates.map((candidate) => candidate.url);

    expect(urls).toContain("https://team.test/assets/favicon.ico");
    expect(urls).toContain("https://team.test/assets/lazy-logo.png");
    expect(urls).toContain("https://team.test/assets/logo-2x.png");
    expect(urls).toContain("https://team.test/assets/jsonld-logo.svg");
    expect(urls).toContain("https://team.test/assets/css-logo.png");
  });
});
