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

describe("selectLogo activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_CONNECTION_STRING = "UseDevelopmentStorage=true";
    delete process.env.BLOB_URL;
    process.env.BLOB_CONTAINER = "glovejobs";
  });

  it("uses placeholder blob URL when no logo candidates are found", async () => {
    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-empty/logo.svg",
      url: "https://blob.test/jobs/job-empty/logo.svg",
    });

    const result = await selectLogoActivity({
      jobId: "job-empty",
      crawlReport: buildReport([]),
    });

    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://blob.test/jobs/job-empty/logo.svg");
    expect(result!.url).not.toBe("https://team.test");
    expect(result!.blobPath).toBe("jobs/job-empty/logo.svg");
  });

  it("falls back to placeholder when all candidate downloads fail", async () => {
    vi.mocked(safeFetchBuffer).mockRejectedValue(new Error("403 forbidden"));
    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-fallback/logo.svg",
      url: "https://blob.test/jobs/job-fallback/logo.svg",
    });

    const result = await selectLogoActivity({
      jobId: "job-fallback",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/team-logo.svg",
          sourceUrl: "https://team.test",
          altText: "Team Logo",
          context: "header",
          hints: ["logo"],
        },
      ]),
    });

    expect(result).not.toBeNull();
    expect(result!.blobPath).toBe("jobs/job-fallback/logo.svg");
    expect(result!.reasons.some((reason) => reason.includes("all candidate downloads failed"))).toBe(true);
    expect(vi.mocked(writeBlob)).toHaveBeenCalledTimes(1);
  });

  it("tries another candidate when top-ranked logo upload fails", async () => {
    vi.mocked(safeFetchBuffer).mockImplementation(async (url: string, options?: { maxBytes?: number }) => {
      if (options?.maxBytes === 2 * 1024 * 1024) {
        return {
          url,
          data: Buffer.from("analysis"),
          bytes: 8,
          contentType: "image/png",
        };
      }
      if (url.includes("bad-logo")) {
        throw new Error("download blocked");
      }
      return {
        url,
        data: Buffer.from("image"),
        bytes: 5,
        contentType: "image/png",
      };
    });

    vi.mocked(writeBlob).mockResolvedValue({
      path: "jobs/job-retry/logo.png",
      url: "https://blob.test/jobs/job-retry/logo.png",
    });

    const result = await selectLogoActivity({
      jobId: "job-retry",
      crawlReport: buildReport([
        {
          url: "https://cdn.team.test/assets/bad-logo.svg",
          sourceUrl: "https://team.test",
          altText: "Official Team Logo",
          context: "header",
          hints: ["logo"],
        },
        {
          url: "https://cdn.team.test/assets/good-logo.png",
          sourceUrl: "https://team.test",
          altText: "brand mark",
          context: "main",
          hints: ["logo"],
        },
      ]),
    });

    expect(result).not.toBeNull();
    expect(result!.url).toContain("good-logo.png");
    expect(result!.blobPath).toBe("jobs/job-retry/logo.png");
    expect(result!.reasons.some((reason) => reason.includes("Uploaded to jobs/job-retry/logo.png"))).toBe(true);
  });
});
