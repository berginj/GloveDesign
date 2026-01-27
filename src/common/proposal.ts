import { CrawlReport, GloveDesign, LogoScore, PaletteResult, WizardResult } from "./types";

export function buildProposal(
  design: GloveDesign,
  logo: LogoScore,
  palette: PaletteResult,
  report: CrawlReport,
  wizardResult?: WizardResult
): string {
  const lines = [
    `# Glove Design Proposal`,
    ``,
    `**Team URL:** ${design.team.sourceUrl}`,
    `**Logo Candidate:** ${logo.url}`,
    `**Logo Evidence:** ${logo.reasons.join("; ")}`,
    ``,
    `## Palette`,
    `- Primary: ${palette.primary.hex} (${palette.primary.evidence.join(", ")})`,
    `- Secondary: ${palette.secondary.hex} (${palette.secondary.evidence.join(", ")})`,
    `- Accent: ${palette.accent.hex} (${palette.accent.evidence.join(", ")})`,
    `- Neutral: ${palette.neutral.hex} (${palette.neutral.evidence.join(", ")})`,
    ``,
    `## Variants`,
  ];

  for (const variant of design.variants) {
    lines.push(`### Variant ${variant.id}`);
    lines.push(`- Components: ${JSON.stringify(variant.components)}`);
    lines.push(`- Notes: ${variant.notes.join("; ")}`);
    lines.push("");
  }

  if (report.notes.length > 0) {
    lines.push("## Crawl Notes");
    lines.push(...report.notes.map((note) => `- ${note}`));
  }

  if (wizardResult?.autofillAttempted) {
    lines.push("");
    lines.push("## Wizard Autofill");
    lines.push(`- Attempted: ${wizardResult.autofillAttempted ? "yes" : "no"}`);
    lines.push(`- Succeeded: ${wizardResult.autofillSucceeded ? "yes" : "no"}`);
    if (wizardResult.warnings.length > 0) {
      lines.push("### Warnings");
      lines.push(...wizardResult.warnings.map((warning) => `- ${warning}`));
    }
    if (!wizardResult.autofillSucceeded) {
      lines.push("### Manual Steps");
      const steps = wizardResult.manualSteps ?? defaultManualSteps();
      lines.push(...steps.map((step) => `- ${step}`));
    }
  }

  return lines.join("\n");
}

export function defaultManualSteps(): string[] {
  return [
    "Open https://bc2gloves.com/cart and start the glove wizard.",
    "Select glove model and size, then choose colors matching the proposal palette.",
    "Upload the logo from the job artifacts.",
    "Review the preview and adjust contrast if any panel colors blend together.",
    "Save screenshots of the configuration for approval.",
  ];
}
