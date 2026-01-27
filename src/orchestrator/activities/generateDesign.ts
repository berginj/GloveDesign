import { generateDesign } from "../../design";
import { PaletteResult } from "../../common/types";

export default async function generateDesignActivity(input: {
  jobId: string;
  teamUrl: string;
  logoUrl: string;
  logoBlobPath: string;
  palette: PaletteResult;
}) {
  return generateDesign(input.jobId, input.teamUrl, input.logoUrl, input.logoBlobPath, input.palette);
}
