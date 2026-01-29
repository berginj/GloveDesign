import { generateDesign } from "../../design";
import { PaletteResult } from "../../common/types";

export default async function generateDesignActivity(input: {
  jobId: string;
  teamUrl: string;
  logoUrl: string;
  logoBlobPath: string;
  palette: PaletteResult;
}) {
  // Defensive checks
  if (!input.jobId || !input.teamUrl || !input.logoUrl || !input.logoBlobPath) {
    throw new Error("Missing required parameters for generateDesign activity");
  }

  if (!input.palette || typeof input.palette !== "object") {
    throw new Error("Invalid palette provided to generateDesign activity");
  }

  // Ensure palette has at least primary color
  if (!input.palette.primary?.hex) {
    throw new Error("Palette must include at least a primary color");
  }

  return generateDesign(input.jobId, input.teamUrl, input.logoUrl, input.logoBlobPath, input.palette);
}
