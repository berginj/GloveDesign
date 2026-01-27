import { describe, expect, it } from "vitest";
import { mergeColors } from "../src/colors/extract";

describe("color merge", () => {
  it("merges similar colors", () => {
    const merged = mergeColors([
      { hex: "#112233", confidence: 0.5, evidence: ["css"] },
      { hex: "#112235", confidence: 0.5, evidence: ["logo"] },
    ]);
    expect(merged.length).toBe(1);
    expect(merged[0].confidence).toBeGreaterThan(0.5);
  });
});
