import { JobRequest } from "../../common/types";
import { validateUrl } from "../../common/validation";

export default async function validateJob(input: JobRequest): Promise<{ ok: boolean; reason?: string }> {
  const validation = validateUrl(input.teamUrl);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  return { ok: true };
}
