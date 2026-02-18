/**
 * Type definitions for Durable Functions orchestrator
 */

/**
 * Retry policy configuration for Durable Functions activities
 */
export interface RetryOptions {
  firstRetryIntervalInMilliseconds: number;
  maxNumberOfAttempts: number;
  backoffCoefficient: number;
  maxRetryIntervalInMilliseconds: number;
  retryTimeoutInMilliseconds: number;
}

/**
 * Service Bus message payload for job queue
 */
export interface ServiceBusJobMessage {
  body?: {
    jobId: string;
    teamUrl: string;
    mode: "proposal" | "autofill";
  };
  jobId?: string;
  teamUrl?: string;
  mode?: "proposal" | "autofill";
}

/**
 * Normalized job payload from Service Bus message
 */
export interface NormalizedJobPayload {
  jobId: string;
  teamUrl: string;
  mode: "proposal" | "autofill";
}
