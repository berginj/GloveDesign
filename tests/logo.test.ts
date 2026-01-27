import { describe, expect, it } from "vitest";
import { scoreLogoCandidates } from "../src/logo/scoring";

describe("logo scoring", () => {
  it("prefers header svg logo", () => {
    const scored = scoreLogoCandidates([
      { url: "https://example.com/logo.svg", sourceUrl: "https://example.com", context: "header", hints: [] },
      { url: "https://example.com/photo.jpg", sourceUrl: "https://example.com", context: "main", hints: [] },
    ]);
    expect(scored[0].score).toBeGreaterThan(scored[1].score);
  });
});
