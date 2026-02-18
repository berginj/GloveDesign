import { describe, it, expect } from "vitest";
import type { RetryOptions, ServiceBusJobMessage, NormalizedJobPayload } from "../../../src/orchestrator/types";

describe("orchestrator types", () => {
  describe("RetryOptions", () => {
    it("should accept valid retry options", () => {
      const options: RetryOptions = {
        firstRetryIntervalInMilliseconds: 1000,
        maxNumberOfAttempts: 3,
        backoffCoefficient: 2,
        maxRetryIntervalInMilliseconds: 10000,
        retryTimeoutInMilliseconds: 60000,
      };

      expect(options.firstRetryIntervalInMilliseconds).toBe(1000);
      expect(options.maxNumberOfAttempts).toBe(3);
      expect(options.backoffCoefficient).toBe(2);
      expect(options.maxRetryIntervalInMilliseconds).toBe(10000);
      expect(options.retryTimeoutInMilliseconds).toBe(60000);
    });
  });

  describe("ServiceBusJobMessage", () => {
    it("should accept message with body property", () => {
      const message: ServiceBusJobMessage = {
        body: {
          jobId: "test-123",
          teamUrl: "https://example.com",
          mode: "proposal",
        },
      };

      expect(message.body?.jobId).toBe("test-123");
      expect(message.body?.teamUrl).toBe("https://example.com");
      expect(message.body?.mode).toBe("proposal");
    });

    it("should accept message with flat properties", () => {
      const message: ServiceBusJobMessage = {
        jobId: "test-456",
        teamUrl: "https://example.org",
        mode: "autofill",
      };

      expect(message.jobId).toBe("test-456");
      expect(message.teamUrl).toBe("https://example.org");
      expect(message.mode).toBe("autofill");
    });

    it("should accept message with both body and flat properties", () => {
      const message: ServiceBusJobMessage = {
        body: {
          jobId: "body-123",
          teamUrl: "https://body.com",
          mode: "proposal",
        },
        jobId: "flat-456",
        teamUrl: "https://flat.com",
        mode: "autofill",
      };

      expect(message.body?.jobId).toBe("body-123");
      expect(message.jobId).toBe("flat-456");
    });

    it("should accept empty message", () => {
      const message: ServiceBusJobMessage = {};
      expect(message.body).toBeUndefined();
      expect(message.jobId).toBeUndefined();
    });
  });

  describe("NormalizedJobPayload", () => {
    it("should accept valid normalized payload", () => {
      const payload: NormalizedJobPayload = {
        jobId: "norm-789",
        teamUrl: "https://normalized.com",
        mode: "proposal",
      };

      expect(payload.jobId).toBe("norm-789");
      expect(payload.teamUrl).toBe("https://normalized.com");
      expect(payload.mode).toBe("proposal");
    });

    it("should enforce mode to be proposal or autofill", () => {
      const proposalPayload: NormalizedJobPayload = {
        jobId: "test-1",
        teamUrl: "https://example.com",
        mode: "proposal",
      };

      const autofillPayload: NormalizedJobPayload = {
        jobId: "test-2",
        teamUrl: "https://example.com",
        mode: "autofill",
      };

      expect(proposalPayload.mode).toBe("proposal");
      expect(autofillPayload.mode).toBe("autofill");
    });
  });
});
