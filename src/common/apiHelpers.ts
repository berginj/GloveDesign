/**
 * API helper utilities to reduce code duplication across endpoints
 */

import { HttpResponseInit, InvocationContext } from "@azure/functions";
import { createJobStoreFromEnv } from "./jobStore";
import type { JobStore } from "./jobStore";

/**
 * Standard error response builders
 */
export const ApiResponse = {
  /**
   * 400 Bad Request
   */
  badRequest(error: string, details?: unknown): HttpResponseInit {
    return {
      status: 400,
      jsonBody: details ? { error, ...details } : { error },
    };
  },

  /**
   * 404 Not Found
   */
  notFound(error: string): HttpResponseInit {
    return {
      status: 404,
      jsonBody: { error },
    };
  },

  /**
   * 500 Internal Server Error
   */
  internalError(error: string): HttpResponseInit {
    return {
      status: 500,
      jsonBody: { error },
    };
  },

  /**
   * 200 OK with JSON body
   */
  ok<T>(data: T): HttpResponseInit {
    return {
      status: 200,
      jsonBody: data,
    };
  },

  /**
   * 202 Accepted with JSON body
   */
  accepted<T>(data: T): HttpResponseInit {
    return {
      status: 202,
      jsonBody: data,
    };
  },
};

/**
 * Validates that a required parameter is present
 * Returns error response if missing, null otherwise
 */
export function validateRequired(
  value: string | undefined,
  paramName: string
): HttpResponseInit | null {
  if (!value) {
    return ApiResponse.badRequest(`${paramName} is required.`);
  }
  return null;
}

/**
 * Initializes and returns the job store, or returns an error response
 */
export async function getJobStore(
  context: InvocationContext
): Promise<{ store: JobStore } | { error: HttpResponseInit }> {
  const store = createJobStoreFromEnv();
  if (!store) {
    context.error("Job store not configured. Set COSMOS_ENDPOINT or TABLE_CONNECTION_STRING.");
    return {
      error: ApiResponse.internalError("Job store not configured. Please check server configuration."),
    };
  }

  try {
    await store.init();
    return { store };
  } catch (error) {
    context.error(`Failed to initialize job store: ${String(error)}`);
    return {
      error: ApiResponse.internalError("Failed to connect to job store."),
    };
  }
}

/**
 * Parses JSON body from request, returns error response if invalid
 */
export async function parseJsonBody<T>(
  request: { json: () => Promise<unknown> },
  errorMessage = "Invalid JSON body."
): Promise<{ data: T } | { error: HttpResponseInit }> {
  try {
    const data = (await request.json()) as T;
    if (!data) {
      return { error: ApiResponse.badRequest(errorMessage) };
    }
    return { data };
  } catch {
    return { error: ApiResponse.badRequest(errorMessage) };
  }
}
