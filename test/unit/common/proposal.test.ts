import { describe, it, expect } from "vitest";
import { buildProposal, defaultManualSteps } from "../../../src/common/proposal";
import type { GloveDesign, LogoScore, PaletteResult, CrawlReport, WizardResult } from "../../../src/common/types";

describe("proposal module", () => {
  const mockLogo: LogoScore = {
    url: "https://example.com/logo.png",
    score: 85,
    reasons: ["High resolution", "Centered placement", "Good contrast"],
    blobPath: "jobs/test-123/logo.png",
  };

  const mockPalette: PaletteResult = {
    primary: {
      hex: "#1a2b3c",
      source: "logo",
      evidence: ["Dominant color in logo", "Used in header"],
    },
    secondary: {
      hex: "#ff5500",
      source: "css",
      evidence: ["Team color variable", "Used in navigation"],
    },
    accent: {
      hex: "#ffcc00",
      source: "logo",
      evidence: ["Accent color in logo"],
    },
    neutral: {
      hex: "#f5f5f5",
      source: "css",
      evidence: ["Background color"],
    },
  };

  const mockDesign: GloveDesign = {
    team: {
      name: "Test Team",
      sourceUrl: "https://example.com",
    },
    variants: [
      {
        id: "A",
        components: {
          palm: { materialId: "leather-1", colorId: "navy" },
          web: { materialId: "leather-1", colorId: "orange" },
        },
        notes: ["Classic design", "High contrast"],
      },
      {
        id: "B",
        components: {
          palm: { materialId: "leather-2", colorId: "white" },
          web: { materialId: "leather-2", colorId: "navy" },
        },
        notes: ["Inverse colors", "Professional look"],
      },
    ],
  };

  const mockReport: CrawlReport = {
    visited: ["https://example.com", "https://example.com/about"],
    imageCandidates: [
      { url: "https://example.com/logo.png", context: "header" },
    ],
    cssUrls: ["https://example.com/styles.css"],
    inlineStyles: ["color: #1a2b3c"],
    notes: ["Site uses responsive design", "Logo appears on all pages"],
  };

  describe("buildProposal", () => {
    it("should build basic proposal without wizard result", () => {
      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport);

      expect(proposal).toContain("# Glove Design Proposal");
      expect(proposal).toContain("**Team URL:** https://example.com");
      expect(proposal).toContain("**Logo Candidate:** https://example.com/logo.png");
      expect(proposal).toContain("**Logo Evidence:** High resolution; Centered placement; Good contrast");
    });

    it("should include palette information", () => {
      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport);

      expect(proposal).toContain("## Palette");
      expect(proposal).toContain("- Primary: #1a2b3c (Dominant color in logo, Used in header)");
      expect(proposal).toContain("- Secondary: #ff5500 (Team color variable, Used in navigation)");
      expect(proposal).toContain("- Accent: #ffcc00 (Accent color in logo)");
      expect(proposal).toContain("- Neutral: #f5f5f5 (Background color)");
    });

    it("should include all design variants", () => {
      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport);

      expect(proposal).toContain("## Variants");
      expect(proposal).toContain("### Variant A");
      expect(proposal).toContain("Classic design; High contrast");
      expect(proposal).toContain("### Variant B");
      expect(proposal).toContain("Inverse colors; Professional look");
    });

    it("should include variant components as JSON", () => {
      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport);

      expect(proposal).toContain('"palm"');
      expect(proposal).toContain('"materialId":"leather-1"');
      expect(proposal).toContain('"colorId":"navy"');
    });

    it("should include crawl notes when present", () => {
      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport);

      expect(proposal).toContain("## Crawl Notes");
      expect(proposal).toContain("- Site uses responsive design");
      expect(proposal).toContain("- Logo appears on all pages");
    });

    it("should omit crawl notes section when empty", () => {
      const reportNoNotes: CrawlReport = {
        ...mockReport,
        notes: [],
      };

      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, reportNoNotes);

      expect(proposal).not.toContain("## Crawl Notes");
    });

    it("should include wizard result when autofill was attempted", () => {
      const wizardResult: WizardResult = {
        autofillAttempted: true,
        autofillSucceeded: true,
        warnings: ["Color contrast may be low on web panel"],
        manualSteps: [],
      };

      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport, wizardResult);

      expect(proposal).toContain("## Wizard Autofill");
      expect(proposal).toContain("- Attempted: yes");
      expect(proposal).toContain("- Succeeded: yes");
    });

    it("should include wizard warnings when present", () => {
      const wizardResult: WizardResult = {
        autofillAttempted: true,
        autofillSucceeded: true,
        warnings: ["Warning 1", "Warning 2"],
        manualSteps: [],
      };

      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport, wizardResult);

      expect(proposal).toContain("### Warnings");
      expect(proposal).toContain("- Warning 1");
      expect(proposal).toContain("- Warning 2");
    });

    it("should include manual steps when autofill failed", () => {
      const wizardResult: WizardResult = {
        autofillAttempted: true,
        autofillSucceeded: false,
        warnings: [],
        manualSteps: ["Step 1", "Step 2", "Step 3"],
      };

      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport, wizardResult);

      expect(proposal).toContain("### Manual Steps");
      expect(proposal).toContain("- Step 1");
      expect(proposal).toContain("- Step 2");
      expect(proposal).toContain("- Step 3");
    });

    it("should use default manual steps when autofill failed and no custom steps provided", () => {
      const wizardResult: WizardResult = {
        autofillAttempted: true,
        autofillSucceeded: false,
        warnings: [],
        manualSteps: undefined,
      };

      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport, wizardResult);

      expect(proposal).toContain("### Manual Steps");
      expect(proposal).toContain("- Open https://bc2gloves.com/cart");
      expect(proposal).toContain("- Select glove model and size");
      expect(proposal).toContain("- Upload the logo");
    });

    it("should not include manual steps when autofill succeeded", () => {
      const wizardResult: WizardResult = {
        autofillAttempted: true,
        autofillSucceeded: true,
        warnings: [],
        manualSteps: [],
      };

      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport, wizardResult);

      expect(proposal).not.toContain("### Manual Steps");
    });

    it("should not include wizard section when not attempted", () => {
      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport);

      expect(proposal).not.toContain("## Wizard Autofill");
    });

    it("should handle empty variants array", () => {
      const designNoVariants: GloveDesign = {
        ...mockDesign,
        variants: [],
      };

      const proposal = buildProposal(designNoVariants, mockLogo, mockPalette, mockReport);

      expect(proposal).toContain("## Variants");
      // Should still have the section but no variant entries
    });

    it("should handle variant with empty notes", () => {
      const designEmptyNotes: GloveDesign = {
        ...mockDesign,
        variants: [
          {
            id: "A",
            components: { palm: { materialId: "leather-1", colorId: "navy" } },
            notes: [],
          },
        ],
      };

      const proposal = buildProposal(designEmptyNotes, mockLogo, mockPalette, mockReport);

      expect(proposal).toContain("### Variant A");
      expect(proposal).toContain("- Notes:");
    });

    it("should format output with proper markdown structure", () => {
      const proposal = buildProposal(mockDesign, mockLogo, mockPalette, mockReport);

      // Should have proper line breaks
      const lines = proposal.split("\n");
      expect(lines[0]).toBe("# Glove Design Proposal");
      expect(lines[1]).toBe("");
      expect(lines[2]).toContain("**Team URL:**");
    });
  });

  describe("defaultManualSteps", () => {
    it("should return array of manual steps", () => {
      const steps = defaultManualSteps();

      expect(Array.isArray(steps)).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
    });

    it("should include BC2 Gloves URL", () => {
      const steps = defaultManualSteps();

      const urlStep = steps.find((step) => step.includes("bc2gloves.com"));
      expect(urlStep).toBeDefined();
    });

    it("should include logo upload step", () => {
      const steps = defaultManualSteps();

      const logoStep = steps.find((step) => step.toLowerCase().includes("logo"));
      expect(logoStep).toBeDefined();
    });

    it("should include color selection step", () => {
      const steps = defaultManualSteps();

      const colorStep = steps.find((step) => step.toLowerCase().includes("color"));
      expect(colorStep).toBeDefined();
    });

    it("should include review step", () => {
      const steps = defaultManualSteps();

      const reviewStep = steps.find((step) => step.toLowerCase().includes("review"));
      expect(reviewStep).toBeDefined();
    });

    it("should return at least 4 steps", () => {
      const steps = defaultManualSteps();

      expect(steps.length).toBeGreaterThanOrEqual(4);
    });
  });
});
