import { beforeEach, describe, expect, it, vi } from "vitest";
import selectLogoActivity from "../src/orchestrator/activities/selectLogo";
import { safeFetchBuffer } from "../src/common/http";
import { writeBlob } from "../src/common/storage";
import { CrawlReport, ImageCandidate } from "../src/common/types";

vi.mock("../src/common/azureClients", () => ({
  createBlobClient: vi.fn(() => ({ mocked: true })),
}));

vi.mock("../src/common/storage", () => ({
  writeBlob: vi.fn(),
}));

vi.mock("../src/common/http", () => ({
  safeFetchBuffer: vi.fn(),
}));

vi.mock("../src/logo/analyze", () => ({
  analyzeImage: vi.fn(async () => ({ entropy: 0.2, edgeDensity: 0.08, alphaRatio: 0.15 })),
}));

function buildReport(imageCandidates: ImageCandidate[]): CrawlReport {
  return {
    startUrl: "https://team.test",
    visited: ["https://team.test"],
    skipped: [],
    imageCandidates,
    cssUrls: [],
    inlineStyles: [],
    notes: [],
    robots: { checked: true, allowed: true, reason: "ok" },
    terms: { checked: true, found: false, urls: [], reason: "not found" },
    limits: {
      maxPages: 6,
      maxImages: 40,
      maxBytes: 25 * 1024 * 1024,
      maxPageBytes: 2 * 1024 * 1024,
      maxAssetBytes: 5 * 1024 * 1024,
      maxCssFiles: 6,
    },
    bytesDownloaded: 1234,
    durationMs: 100,
  };
}

describe("selectLogo edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_CONNECTION_STRING = "UseDevelopmentStorage=true";
    delete process.env.BLOB_URL;
    process.env.BLOB_CONTAINER = "glovejobs";
  });

  it("rejects invalid image data (HTML instead of image)", async () => {
    const htmlContent = Buffer.from("<html><body>404 Not Found</body></html>");

    vi.mocked(safeFetchBuffer).mockImplementation(async (url: string, options?: { maxBytes?: number }) => {
      if (options?.maxBytes === 2 * 1024 * 1024) {
        // Analysis phase
        return {
          url,
          data: htmlContent,
          bytes: htmlContent.length,
          contentType: "text/html",
        };
      }
      // Download phase
      return {
        url,
        data: htmlContent,
        bytes: htmlContent.length,
        contentType: "text/html",
      };
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-invalid/logo.svg",
      url: "https://blob.test/jobs/job-invalid/logo.svg",
    });

    const result = await selectLogoActivity({
      jobId: "job-invalid",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/fake-logo.png",
          sourceUrl: "https://team.test",
          altText: "Logo",
          context: "header",
          hints: ["logo"],
        },
      ]),
    });

    // Should fall back to placeholder
    expect(result).not.toBeNull();
    expect(result!.blobPath).toBe("jobs/job-invalid/logo.svg");
    expect(result!.reasons.some((r) => r.includes("not a valid image format"))).toBe(true);
  });

  it("accepts valid PNG image data", async () => {
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

    vi.mocked(safeFetchBuffer).mockImplementation(async (url: string, options?: { maxBytes?: number }) => {
      if (options?.maxBytes === 2 * 1024 * 1024) {
        return { url, data: pngBuffer, bytes: pngBuffer.length, contentType: "image/png" };
      }
      return { url, data: pngBuffer, bytes: pngBuffer.length, contentType: "image/png" };
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-png/logo.png",
      url: "https://blob.test/jobs/job-png/logo.png",
    });

    const result = await selectLogoActivity({
      jobId: "job-png",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/valid-logo.png",
          sourceUrl: "https://team.test",
          altText: "Logo",
          context: "header",
          hints: ["logo"],
        },
      ]),
    });

    expect(result).not.toBeNull();
    expect(result!.blobPath).toBe("jobs/job-png/logo.png");
    expect(result!.url).toContain("valid-logo.png");
  });

  it("accepts valid JPEG image data", async () => {
    // JPEG magic bytes: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    vi.mocked(safeFetchBuffer).mockImplementation(async (url: string, options?: { maxBytes?: number }) => {
      if (options?.maxBytes === 2 * 1024 * 1024) {
        return { url, data: jpegBuffer, bytes: jpegBuffer.length, contentType: "image/jpeg" };
      }
      return { url, data: jpegBuffer, bytes: jpegBuffer.length, contentType: "image/jpeg" };
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-jpeg/logo.jpg",
      url: "https://blob.test/jobs/job-jpeg/logo.jpg",
    });

    const result = await selectLogoActivity({
      jobId: "job-jpeg",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/photo.jpg",
          sourceUrl: "https://team.test",
          altText: "Logo",
          context: "header",
          hints: ["logo"],
        },
      ]),
    });

    expect(result).not.toBeNull();
    expect(result!.blobPath).toBe("jobs/job-jpeg/logo.jpg");
  });

  it("accepts valid SVG image data", async () => {
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>');

    vi.mocked(safeFetchBuffer).mockImplementation(async (url: string, options?: { maxBytes?: number }) => {
      if (options?.maxBytes === 2 * 1024 * 1024) {
        return { url, data: svgBuffer, bytes: svgBuffer.length, contentType: "image/svg+xml" };
      }
      return { url, data: svgBuffer, bytes: svgBuffer.length, contentType: "image/svg+xml" };
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-svg/logo.svg",
      url: "https://blob.test/jobs/job-svg/logo.svg",
    });

    const result = await selectLogoActivity({
      jobId: "job-svg",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/logo.svg",
          sourceUrl: "https://team.test",
          altText: "Logo",
          context: "header",
          hints: ["logo"],
        },
      ]),
    });

    expect(result).not.toBeNull();
    expect(result!.blobPath).toBe("jobs/job-svg/logo.svg");
  });

  it("accepts valid WebP image data", async () => {
    // WebP magic bytes: RIFF ... WEBP
    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

    vi.mocked(safeFetchBuffer).mockImplementation(async (url: string, options?: { maxBytes?: number }) => {
      if (options?.maxBytes === 2 * 1024 * 1024) {
        return { url, data: webpBuffer, bytes: webpBuffer.length, contentType: "image/webp" };
      }
      return { url, data: webpBuffer, bytes: webpBuffer.length, contentType: "image/webp" };
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-webp/logo.webp",
      url: "https://blob.test/jobs/job-webp/logo.webp",
    });

    const result = await selectLogoActivity({
      jobId: "job-webp",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/logo.webp",
          sourceUrl: "https://team.test",
          altText: "Logo",
          context: "header",
          hints: ["logo"],
        },
      ]),
    });

    expect(result).not.toBeNull();
    expect(result!.blobPath).toBe("jobs/job-webp/logo.webp");
  });

  it("successfully selects first candidate when valid", async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    vi.mocked(safeFetchBuffer).mockResolvedValue({
      url: "https://cdn.team.test/assets/best-logo.png",
      data: pngBuffer,
      bytes: pngBuffer.length,
      contentType: "image/png",
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-first/logo.png",
      url: "https://blob.test/jobs/job-first/logo.png",
    });

    const result = await selectLogoActivity({
      jobId: "job-first",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/best-logo.png",
          sourceUrl: "https://team.test",
          altText: "Official Team Logo",
          context: "header",
          hints: ["logo"],
        },
        {
          url: "https://cdn.team.test/assets/backup-logo.png",
          sourceUrl: "https://team.test",
          altText: "Logo",
          context: "footer",
          hints: ["logo"],
        },
      ]),
    });

    expect(result).not.toBeNull();
    expect(result!.url).toContain("best-logo.png");
    expect(result!.blobPath).toBe("jobs/job-first/logo.png");
    expect(vi.mocked(safeFetchBuffer)).toHaveBeenCalled();
    expect(vi.mocked(writeBlob)).toHaveBeenCalledTimes(1);
  });

  it("handles empty buffer", async () => {
    const emptyBuffer = Buffer.from([]);

    vi.mocked(safeFetchBuffer).mockResolvedValue({
      url: "https://cdn.team.test/assets/empty.png",
      data: emptyBuffer,
      bytes: 0,
      contentType: "image/png",
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-empty-buffer/logo.svg",
      url: "https://blob.test/jobs/job-empty-buffer/logo.svg",
    });

    const result = await selectLogoActivity({
      jobId: "job-empty-buffer",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/empty.png",
          sourceUrl: "https://team.test",
          altText: "Logo",
          context: "header",
          hints: ["logo"],
        },
      ]),
    });

    // Should fall back to placeholder
    expect(result).not.toBeNull();
    expect(result!.blobPath).toBe("jobs/job-empty-buffer/logo.svg");
  });

  it("respects configurable analysis count", async () => {
    process.env.LOGO_ANALYSIS_COUNT = "3";

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    let analysisCallCount = 0;
    vi.mocked(safeFetchBuffer).mockImplementation(async (url: string, options?: { maxBytes?: number }) => {
      if (options?.maxBytes === 2 * 1024 * 1024) {
        analysisCallCount++;
      }
      return { url, data: pngBuffer, bytes: pngBuffer.length, contentType: "image/png" };
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-config/logo.png",
      url: "https://blob.test/jobs/job-config/logo.png",
    });

    const candidates: ImageCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      url: `https://cdn.team.test/assets/logo-${i}.png`,
      sourceUrl: "https://team.test",
      altText: `Logo ${i}`,
      context: "header",
      hints: ["logo"],
    }));

    await selectLogoActivity({
      jobId: "job-config",
      crawlReport: buildReport(candidates),
    });

    // Should only analyze 3 images (per LOGO_ANALYSIS_COUNT)
    expect(analysisCallCount).toBe(3);

    delete process.env.LOGO_ANALYSIS_COUNT;
  });

  it("generates placeholder with team name from URL", async () => {
    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-placeholder/logo.svg",
      url: "https://blob.test/jobs/job-placeholder/logo.svg",
    });

    const result = await selectLogoActivity({
      jobId: "job-placeholder",
      crawlReport: buildReport([]),
    });

    expect(result).not.toBeNull();
    expect(result!.score).toBe(0.05);
    expect(result!.blobPath).toBe("jobs/job-placeholder/logo.svg");
    expect(result!.reasons.some((r) => r.includes("Placeholder"))).toBe(true);

    // Verify placeholder SVG was generated
    const writeBlobCall = vi.mocked(writeBlob).mock.calls[0];
    const svgContent = writeBlobCall[3] as string;
    expect(svgContent).toContain("<svg");
    expect(svgContent).toContain("Placeholder logo");
  });
});
