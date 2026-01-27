import { describe, expect, it } from "vitest";
import { contrastRatio } from "../src/design";

describe("contrast", () => {
  it("detects low contrast", () => {
    const ratio = contrastRatio("#ffffff", "#fefefe");
    expect(ratio).toBeLessThan(1.2);
  });

  it("detects high contrast", () => {
    const ratio = contrastRatio("#000000", "#ffffff");
    expect(ratio).toBeGreaterThan(10);
  });
});
