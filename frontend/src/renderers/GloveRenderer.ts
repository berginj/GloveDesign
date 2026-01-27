export interface RenderInput {
  patternId: string;
  componentSelections: Array<{ componentId: string; colorId: string }>;
  materialSelections: Record<string, string>;
}

export interface RenderResult {
  imageUrls: string[];
  colorChips: Array<{ componentId: string; hex: string; label: string }>;
}

export interface GloveRenderer {
  render(input: RenderInput): Promise<RenderResult>;
}
