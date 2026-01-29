export type Sport = "baseball" | "fastpitch" | "slowpitch";
export type ThrowHand = "RHT" | "LHT";
export type AgeLevel = "youth" | "teen" | "adult" | "pro";
export type Position =
  | "infield"
  | "outfield"
  | "pitcher"
  | "catcher"
  | "first_base"
  | "utility"
  | "trainer";

export interface Brand {
  id: string;
  name: string;
  description?: string;
}

export interface Series {
  id: string;
  brandId: string;
  name: string;
  basePrice: number;
  description?: string;
}

export interface PatternFamily {
  id: string;
  name: string;
  description?: string;
  sizeRange: string;
  defaultComponents: string[];
  renderProfileId?: string;
}

export interface Pattern {
  id: string;
  seriesId: string;
  familyId: string;
  sport: Sport;
  positions: Position[];
  size: string;
  webFamily: string;
  pocketDepth: "shallow" | "medium" | "deep";
  typicalUse: string;
  fitNotes: string;
  allowedWebTypes: string[];
  allowedBackStyles: string[];
  allowedWristFits: string[];
  allowedComponents: string[];
  features: PatternFeatures;
}

export interface PatternFeatures {
  laceTwoTone: boolean;
  supportsThumbPad: boolean;
  supportsPinkyPad: boolean;
  supportsExtraHeel: boolean;
  supportsFingerShift: boolean;
  supportsPalmStamp: boolean;
  supportsNameEmbroidery: boolean;
  supportsNumberEmbroidery: boolean;
  supportsPatch: boolean;
}

export interface Component {
  id: string;
  name: string;
  zone:
    | "palm"
    | "web"
    | "binding"
    | "laces"
    | "stitching"
    | "shell"
    | "heel"
    | "wrist"
    | "logo"
    | "lining"
    | "overlay";
  renderLayerKey: string;
}

export interface Color {
  id: string;
  name: string;
  hex: string;
  finish: "matte" | "gloss" | "metallic";
  materialCompat: string[];
}

export interface Material {
  id: string;
  name: string;
  type: "leather" | "synthetic" | "mesh";
  upcharge: number;
  textureId?: string;
  notes?: string;
}

export type UIControlType = "select" | "swatch" | "toggle" | "text" | "grid" | "multi-select";

export interface OptionGroup {
  id: string;
  name: string;
  uiControlType: UIControlType;
  sortOrder: number;
  allowMultiple?: boolean;
  defaultOptionId?: string;
  description?: string;
}

export type Rule =
  | { all: Rule[] }
  | { any: Rule[] }
  | { not: Rule }
  | { equals: [string, string | number | boolean] }
  | { in: [string, Array<string | number>] }
  | { includes: [string, string] }
  | { exists: [string] }
  | { gt: [string, number] }
  | { lt: [string, number] };

export interface PriceRule {
  type: "flat" | "percent" | "formula";
  amount?: number;
  percent?: number;
  expression?: string;
}

export interface LeadTimeRule {
  type: "days" | "formula";
  days?: number;
  expression?: string;
}

export interface OptionUI {
  controlType?: UIControlType;
  hint?: string;
  swatchRef?: string;
  maxChars?: number;
}

export interface Option {
  id: string;
  groupId: string;
  label: string;
  description?: string;
  affectedComponents?: string[];
  availability?: Rule;
  incompatibilities?: string[];
  dependencies?: string[];
  priceRule?: PriceRule;
  leadTimeRule?: LeadTimeRule;
  uiMeta?: OptionUI;
  paletteConstraint?: PaletteConstraint;
  materialRef?: string;
}

export interface ColorPalette {
  id: string;
  name: string;
  description?: string;
  colorIds: string[];
  tags?: string[];
  availability?: Rule;
}

export interface PaletteConstraint {
  paletteIds: string[];
  scope?: "all" | "components";
  componentIds?: string[];
  mode?: "restrict" | "prefer";
}

export interface Texture {
  id: string;
  name: string;
  description?: string;
  svgPattern: string;
  scale?: number;
}

export interface RenderShape {
  type: "path";
  d: string;
}

export interface RenderLayer {
  id: string;
  componentId: string;
  shape: RenderShape;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  textureId?: string;
}

export interface RenderView {
  id: string;
  label: string;
  width: number;
  height: number;
  layers: RenderLayer[];
}

export interface RenderProfile {
  id: string;
  name: string;
  familyIds: string[];
  views: RenderView[];
}

export interface EmbroideryFont {
  id: string;
  name: string;
  cssFamily: string;
  weight?: number;
  style?: string;
  letterSpacing?: number;
}

export interface EmbroideryPlacement {
  id: string;
  name: string;
  description?: string;
  maxChars: number;
  viewId: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  familyIds?: string[];
}

export interface ComponentSelection {
  componentId: string;
  colorId: string;
  materialId?: string;
  finish?: "matte" | "gloss" | "metallic";
}

export interface Personalization {
  nameLine1?: string;
  nameLine2?: string;
  number?: string;
  patchId?: string;
  palmStampId?: string;
  specialInstructions?: string;
  embroidery?: Array<{
    placementId: string;
    text: string;
    fontId: string;
    threadColorId: string;
    enabled?: boolean;
  }>;
}

export interface DesignInput {
  sport: Sport;
  position: Position;
  throwHand: ThrowHand;
  ageLevel?: AgeLevel;
  brandId: string;
  seriesId: string;
  patternId: string;
  selectedOptions: Record<string, string | string[]>;
  componentSelections: ComponentSelection[];
  personalization?: Personalization;
  version: string;
}

export interface Design extends DesignInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  designId: string;
  customerInfo: Record<string, string>;
  priceBreakdown: PriceBreakdown;
  status: "created" | "review" | "approved" | "in_production" | "shipped";
  createdAt: string;
}

export interface PriceBreakdown {
  basePrice: number;
  optionTotal: number;
  leadTimeDays: number;
  total: number;
  details: Array<{ optionId: string; label: string; delta: number }>;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  correctedDesign?: DesignInput;
  priceBreakdown?: PriceBreakdown;
}

export interface Catalog {
  version: string;
  brands: Brand[];
  series: Series[];
  patternFamilies: PatternFamily[];
  patterns: Pattern[];
  components: Component[];
  colors: Color[];
  colorPalettes: ColorPalette[];
  materials: Material[];
  textures: Texture[];
  optionGroups: OptionGroup[];
  options: Option[];
  renderProfiles: RenderProfile[];
  embroideryFonts: EmbroideryFont[];
  embroideryPlacements: EmbroideryPlacement[];
}

export interface DesignContext {
  sport: Sport;
  position: Position;
  throwHand: ThrowHand;
  ageLevel?: AgeLevel;
  brandId: string;
  seriesId: string;
  patternId: string;
  size: string;
  selectedOptions: Record<string, string | string[]>;
  componentSelections: ComponentSelection[];
  features: PatternFeatures;
  allowedWebTypes: string[];
  allowedBackStyles: string[];
  allowedWristFits: string[];
}
