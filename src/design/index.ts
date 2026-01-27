import { GloveDesign, GloveVariant, PaletteResult } from "../common/types";

const MIN_CONTRAST = 2.2;

export function generateDesign(jobId: string, teamUrl: string, logoUrl: string, logoBlobPath: string, palette: PaletteResult): GloveDesign {
  const variants: GloveVariant[] = [
    {
      id: "A",
      components: {
        palm: palette.primary.hex,
        back: palette.secondary.hex,
        web: palette.secondary.hex,
        laces: palette.neutral.hex,
        stitching: palette.accent.hex,
        binding: palette.secondary.hex,
        wrist: palette.primary.hex,
        logoPlacement: palette.accent.hex,
      },
      notes: ["Classic layout with primary palm and secondary web."],
    },
    {
      id: "B",
      components: {
        palm: palette.secondary.hex,
        back: palette.primary.hex,
        web: palette.primary.hex,
        laces: palette.neutral.hex,
        stitching: palette.accent.hex,
        binding: palette.primary.hex,
        wrist: palette.secondary.hex,
        logoPlacement: palette.primary.hex,
      },
      notes: ["Inverted contrast with bold web and back."],
    },
    {
      id: "C",
      components: {
        palm: palette.neutral.hex,
        back: palette.neutral.hex,
        web: palette.primary.hex,
        laces: palette.primary.hex,
        stitching: palette.accent.hex,
        binding: palette.secondary.hex,
        wrist: palette.secondary.hex,
        logoPlacement: palette.primary.hex,
      },
      notes: ["Minimal neutral base with strong web and accents."],
    },
  ];

  const adjusted = variants.map((variant) => adjustContrast(variant, palette.neutral.hex));

  return {
    jobId,
    team: { sourceUrl: teamUrl },
    logo: { url: logoUrl, blobPath: logoBlobPath },
    palette,
    variants: adjusted,
  };
}

function adjustContrast(variant: GloveVariant, neutralHex: string): GloveVariant {
  const notes = [...variant.notes];
  const pairs: Array<[keyof GloveVariant["components"], keyof GloveVariant["components"], string]> = [
    ["palm", "web", "palm/web"],
    ["back", "web", "back/web"],
    ["palm", "laces", "palm/laces"],
    ["back", "binding", "back/binding"],
    ["palm", "stitching", "palm/stitching"],
    ["back", "wrist", "back/wrist"],
  ];

  for (const [baseKey, accentKey, label] of pairs) {
    const base = variant.components[baseKey];
    const accent = variant.components[accentKey];
    if (!base || !accent) {
      continue;
    }
    const ratio = contrastRatio(base, accent);
    if (ratio < MIN_CONTRAST) {
      variant.components[accentKey] = neutralHex;
      notes.push(`Adjusted ${label} to neutral for contrast (${ratio.toFixed(2)}).`);
    }
  }

  return { ...variant, notes };
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
