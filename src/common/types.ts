export type JobMode = "proposal" | "autofill";

export interface JobRequest {
  teamUrl: string;
  mode: JobMode;
}

export interface JobRecord {
  jobId: string;
  teamUrl: string;
  mode: JobMode;
  instanceId?: string;
  stage: JobStage;
  createdAt: string;
  updatedAt: string;
  stageTimestamps?: Partial<Record<JobStage, string>>;
  retryCount?: number;
  lastRetryAt?: string;
  error?: string;
  errorDetails?: string;
  autofillAttempted?: boolean;
  autofillSucceeded?: boolean;
  wizardWarnings?: string[];
  outputs?: JobOutputs;
}

export type JobStage =
  | "received"
  | "queued"
  | "validated"
  | "crawled"
  | "logo_selected"
  | "colors_extracted"
  | "design_generated"
  | "wizard_attempted"
  | "completed"
  | "failed"
  | "canceled";

export interface CrawlReport {
  startUrl: string;
  visited: string[];
  skipped: string[];
  imageCandidates: ImageCandidate[];
  cssUrls: string[];
  inlineStyles: string[];
  notes: string[];
  robots: RobotsReport;
  terms: TermsReport;
  limits: CrawlLimits;
  bytesDownloaded: number;
  durationMs: number;
  logoDecision?: LogoDecision;
}

export interface LogoDecision {
  selectedUrl: string;
  score: number;
  reasons: string[];
  analysis?: LogoAnalysis;
}

export interface RobotsReport {
  checked: boolean;
  allowed: boolean;
  reason: string;
}

export interface TermsReport {
  checked: boolean;
  found: boolean;
  urls: string[];
  reason: string;
}

export interface CrawlLimits {
  maxPages: number;
  maxImages: number;
  maxBytes: number;
  maxPageBytes: number;
  maxAssetBytes: number;
  maxCssFiles: number;
}

export interface ImageCandidate {
  url: string;
  sourceUrl: string;
  altText?: string;
  context?: string;
  width?: number;
  height?: number;
  fileNameHint?: string;
  hints: string[];
}

export interface LogoScore {
  url: string;
  score: number;
  reasons: string[];
  blobPath?: string;
  analysis?: LogoAnalysis;
}

export interface LogoAnalysis {
  width?: number;
  height?: number;
  aspectRatio?: number;
  entropy?: number;
  edgeDensity?: number;
  alphaRatio?: number;
}

export interface PaletteColor {
  hex: string;
  confidence: number;
  evidence: string[];
}

export interface PaletteResult {
  primary: PaletteColor;
  secondary: PaletteColor;
  accent: PaletteColor;
  neutral: PaletteColor;
  raw: PaletteColor[];
}

export interface GloveVariant {
  id: "A" | "B" | "C";
  components: Record<string, string>;
  notes: string[];
}

export interface GloveDesign {
  jobId: string;
  team: { name?: string; sourceUrl: string };
  logo: { url: string; blobPath: string };
  palette: PaletteResult;
  variants: GloveVariant[];
}

export interface JobOutputs {
  logo?: ArtifactLocation;
  palette?: ArtifactLocation;
  design?: ArtifactLocation;
  proposal?: ArtifactLocation;
  crawlReport?: ArtifactLocation;
  wizardSchema?: ArtifactLocation;
  configuredImage?: ArtifactLocation;
}

export interface ArtifactLocation {
  path: string;
  url: string;
}

export interface WizardRequest {
  jobId: string;
  design: GloveDesign;
  blobBaseUrl?: string;
  logoBlobPath?: string;
}

export interface WizardResult {
  schemaSnapshot: ArtifactLocation;
  configuredImage?: ArtifactLocation;
  warnings: string[];
  autofillAttempted: boolean;
  autofillSucceeded: boolean;
  manualSteps?: string[];
  mappingConfidence?: number;
}
