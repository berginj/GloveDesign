import { GloveDesign, GloveVariant, PaletteResult } from "../common/types";

export function generateDesign(jobId: string, teamUrl: string, logoUrl: string, logoBlobPath: string, palette: PaletteResult): GloveDesign {
  const variants: GloveVariant[] = [
    {
      id: "A",
      components: {
        body: palette.primary.hex,
        web: palette.secondary.hex,
        stitching: palette.accent.hex,
        laces: palette.neutral.hex,
      },
      notes: ["Classic layout with primary body and secondary web."],
    },
    {
      id: "B",
      components: {
        body: palette.secondary.hex,
        web: palette.primary.hex,
        piping: palette.neutral.hex,
        stitching: palette.primary.hex,
      },
      notes: ["High-contrast layout with inverted main colors."],
    },
    {
      id: "C",
      components: {
        body: palette.neutral.hex,
        web: palette.primary.hex,
        stitching: palette.accent.hex,
        logo: palette.primary.hex,
      },
      notes: ["Minimal base with primary accents."],
    },
  ];

  return {
    jobId,
    team: { sourceUrl: teamUrl },
    logo: { url: logoUrl, blobPath: logoBlobPath },
    palette,
    variants: variants.map((variant) => ({
      ...variant,
      notes: [...variant.notes, ...contrastNotes(variant)],
    })),
  };
}

function contrastNotes(variant: GloveVariant): string[] {
  const notes: string[] = [];
  const pairs: [string, string, string][] = [
    [variant.components.body, variant.components.web, "body/web"],
    [variant.components.body, variant.components.stitching ?? variant.components.piping ?? "#ffffff", "body/detail"],
  ];
  for (const [a, b, label] of pairs) {
    if (!a || !b) {
      continue;
    }
    const ratio = contrastRatio(a, b);
    if (ratio < 2.0) {
      notes.push(`Low contrast on ${label} (${ratio.toFixed(2)})`);
    }
  }
  return notes;
}

export function contrastRatio(color1: string, color2: string): number {
  const l1 = luminance(color1);
  const l2 = luminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}
