import { JobRequest } from "../../common/types";
import { ensureHttpScheme, validateUrlWithDns } from "../../common/validation";
import { logInfo, logWarn } from "../../common/logging";

export default async function validateJob(input: JobRequest): Promise<{ ok: boolean; reason?: string }> {
  const jobId = (input as any).jobId ?? "unknown";

  logInfo("validate_start", { jobId, stage: "validation" }, { teamUrl: input.teamUrl });

  if (!input?.teamUrl) {
    const reason = "teamUrl is required.";
    logWarn("validate_missing_url", { jobId, stage: "validation" }, { reason });
    return { ok: false, reason };
  }

  const normalizedUrl = ensureHttpScheme(input.teamUrl);
  logInfo("validate_normalized", { jobId, stage: "validation" }, {
    original: input.teamUrl,
    normalized: normalizedUrl
  });

  try {
    const validation = await validateUrlWithDns(normalizedUrl);
    if (!validation.ok) {
      logWarn("validate_url_failed", { jobId, stage: "validation" }, {
        url: normalizedUrl,
        reason: validation.reason
      });
      return { ok: false, reason: validation.reason };
    }

    logInfo("validate_success", { jobId, stage: "validation" }, { url: normalizedUrl });
    return { ok: true };
  } catch (error) {
    const reason = `URL validation error: ${String(error)}`;
    logWarn("validate_error", { jobId, stage: "validation" }, {
      url: normalizedUrl,
      error: String(error),
      errorStack: (error as Error).stack
    });
    return { ok: false, reason };
  }
}
