import { describe, expect, it } from "vitest";
import { loadCatalog } from "../../src/customizer/catalog";
import { buildDesignContext, evaluateRule, validateDesign } from "../../src/customizer/optionEngine";
import { DesignInput } from "../../src/customizer/types";

describe("option engine", () => {
  it("evaluates basic rules", () => {
    const catalog = loadCatalog();
    const pattern = catalog.patterns[0];
    const design: DesignInput = {
      sport: pattern.sport,
      position: pattern.positions[0],
      throwHand: "RHT",
      ageLevel: "adult",
      brandId: catalog.brands[0].id,
      seriesId: pattern.seriesId,
      patternId: pattern.id,
      selectedOptions: {},
      componentSelections: [],
      version: catalog.version,
    };
    const context = buildDesignContext(design, catalog);
    expect(evaluateRule({ equals: ["sport", pattern.sport] }, context)).toBe(true);
    expect(evaluateRule({ includes: ["allowedWebTypes", "H-web"] }, context)).toBe(
      context.allowedWebTypes.includes("H-web")
    );
  });

  it("flags two-tone lace when unsupported", () => {
    const catalog = loadCatalog();
    const catcher = catalog.patterns.find((item) => item.id === "pattern-hp-33");
    if (!catcher) {
      throw new Error("Test pattern missing.");
    }
    const design: DesignInput = {
      sport: catcher.sport,
      position: catcher.positions[0],
      throwHand: "RHT",
      ageLevel: "adult",
      brandId: catalog.brands[0].id,
      seriesId: catcher.seriesId,
      patternId: catcher.id,
      selectedOptions: { "lace-two-tone": "opt-lace-two-tone-on" },
      componentSelections: [
        { componentId: "lace-finger", colorId: catalog.colors[0].id },
        { componentId: "lace-web", colorId: catalog.colors[1].id },
      ],
      version: catalog.version,
    };
    const result = validateDesign(design, catalog);
    expect(result.issues.some((issue) => issue.code === "lace_two_tone_not_supported")).toBe(true);
  });

  it("rejects unsupported pad options", () => {
    const catalog = loadCatalog();
    const pattern = catalog.patterns.find((item) => !item.features.supportsThumbPad);
    if (!pattern) {
      throw new Error("Test pattern missing.");
    }
    const design: DesignInput = {
      sport: pattern.sport,
      position: pattern.positions[0],
      throwHand: "RHT",
      ageLevel: "adult",
      brandId: catalog.brands[0].id,
      seriesId: pattern.seriesId,
      patternId: pattern.id,
      selectedOptions: { "thumb-pad": "opt-thumb-pad-on" },
      componentSelections: [],
      version: catalog.version,
    };
    const result = validateDesign(design, catalog);
    expect(result.issues.some((issue) => issue.code === "option_unavailable")).toBe(true);
  });
});
