import { JobRequest } from "../../common/types";
import { ensureHttpScheme, validateUrlWithDns } from "../../common/validation";

export default async function validateJob(input: JobRequest): Promise<{ ok: boolean; reason?: string }> {
  if (!input?.teamUrl) {
    return { ok: false, reason: "teamUrl is required." };
  }
  const normalizedUrl = ensureHttpScheme(input.teamUrl);
  const validation = await validateUrlWithDns(normalizedUrl);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }
  return { ok: true };
}
