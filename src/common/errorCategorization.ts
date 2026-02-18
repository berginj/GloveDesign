/**
 * Error categorization module
 * Provides human-readable error messages based on error content and context
 */

export type ErrorCategory =
  | "storage"
  | "queue"
  | "database"
  | "robots"
  | "timeout"
  | "network"
  | "unknown";

export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  isInfrastructure: boolean;
  isRetryable: boolean;
}

/**
 * Activity-specific error message templates
 */
const ACTIVITY_MESSAGES: Record<string, string> = {
  validateJob: "Failed to validate team URL",
  crawlSite: "Failed to crawl team website",
  selectLogo: "Failed to select or upload team logo",
  extractColors: "Failed to extract color palette",
  generateDesign: "Failed to generate glove design",
  runWizard: "Failed to run autofill wizard",
  writeOutputs: "Failed to save job outputs",
  initialization: "Failed to initialize job orchestration",
};

/**
 * Categorizes an error based on its content
 */
export function categorizeError(error: unknown): ErrorInfo {
  const errorStr = String(error);

  // Storage errors
  if (errorStr.includes("storage not configured") || errorStr.includes("BLOB")) {
    return {
      category: "storage",
      message: "Blob storage not configured. Please contact support.",
      isInfrastructure: true,
      isRetryable: false,
    };
  }

  // Queue/Service Bus errors
  if (errorStr.includes("Service Bus") || errorStr.includes("SERVICEBUS")) {
    return {
      category: "queue",
      message: "Message queue not configured. Please contact support.",
      isInfrastructure: true,
      isRetryable: false,
    };
  }

  // Database errors
  if (errorStr.includes("Job store") || errorStr.includes("COSMOS") || errorStr.includes("TABLE")) {
    return {
      category: "database",
      message: "Database not configured. Please contact support.",
      isInfrastructure: true,
      isRetryable: false,
    };
  }

  // Robots.txt blocking
  if (errorStr.includes("robots.txt") || errorStr.includes("Disallow")) {
    return {
      category: "robots",
      message: "Website blocks automated crawling.",
      isInfrastructure: false,
      isRetryable: false,
    };
  }

  // Timeout errors
  if (errorStr.includes("timeout") || errorStr.includes("ETIMEDOUT")) {
    return {
      category: "timeout",
      message: "Website took too long to respond.",
      isInfrastructure: false,
      isRetryable: true,
    };
  }

  // Network/DNS errors
  if (errorStr.includes("ENOTFOUND") || errorStr.includes("DNS") || errorStr.includes("EAI_AGAIN")) {
    return {
      category: "network",
      message: "Website not found or unreachable.",
      isInfrastructure: false,
      isRetryable: true,
    };
  }

  // Unknown error
  return {
    category: "unknown",
    message: errorStr,
    isInfrastructure: false,
    isRetryable: false,
  };
}

/**
 * Generates a user-friendly error message for a specific activity
 */
export function getActivityErrorMessage(activity: string, error: unknown): string {
  const baseMessage = ACTIVITY_MESSAGES[activity] ?? "Branding job failed";
  const errorInfo = categorizeError(error);

  return `${baseMessage}: ${errorInfo.message}`;
}

/**
 * Checks if an error is related to infrastructure/configuration issues
 */
export function isInfrastructureError(error: unknown): boolean {
  return categorizeError(error).isInfrastructure;
}

/**
 * Checks if an error is likely to succeed on retry
 */
export function isRetryableError(error: unknown): boolean {
  return categorizeError(error).isRetryable;
}
