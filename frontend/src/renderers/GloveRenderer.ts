import type { Personalization } from "../data/catalogTypes";

export interface RenderInput {
  patternId: string;
  patternFamilyId?: string;
  componentSelections: Array<{ componentId: string; colorId: string }>;
  materialSelections: Record<string, string>;
  personalization?: Personalization;
}

export interface RenderViewResult {
  id: string;
  label: string;
  url: string;
}

export interface RenderResult {
  views: RenderViewResult[];
  colorChips: Array<{ componentId: string; hex: string; label: string }>;
}

export interface GloveRenderer {
  render(input: RenderInput): Promise<RenderResult>;
}
