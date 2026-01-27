import axios from "axios";
import { GloveDesign, JobOutputs } from "../../common/types";

export default async function runWizardActivity(input: { jobId: string; design: GloveDesign; outputs: JobOutputs }) {
  const endpoint = process.env.WIZARD_ENDPOINT;
  if (!endpoint) {
    return { skipped: true, reason: "No wizard endpoint configured." };
  }
  await axios.post(endpoint, {
    jobId: input.jobId,
    design: input.design,
    blobBaseUrl: process.env.BLOB_BASE_URL,
    logoBlobPath: input.outputs.logoBlobPath,
  });
}
