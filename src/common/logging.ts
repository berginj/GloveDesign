export interface LogContext {
  jobId?: string;
  stage?: string;
}

export function logInfo(message: string, context: LogContext = {}, data?: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      level: "info",
      message,
      jobId: context.jobId ?? "unknown",
      stage: context.stage ?? "unknown",
      data,
      ts: new Date().toISOString(),
    })
  );
}

export function logWarn(message: string, context: LogContext = {}, data?: Record<string, unknown>) {
  console.warn(
    JSON.stringify({
      level: "warn",
      message,
      jobId: context.jobId ?? "unknown",
      stage: context.stage ?? "unknown",
      data,
      ts: new Date().toISOString(),
    })
  );
}

export function logError(message: string, context: LogContext = {}, data?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      level: "error",
      message,
      jobId: context.jobId ?? "unknown",
      stage: context.stage ?? "unknown",
      data,
      ts: new Date().toISOString(),
    })
  );
}
