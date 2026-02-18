import { describe, it, expect } from "vitest";
import {
  categorizeError,
  getActivityErrorMessage,
  isInfrastructureError,
  isRetryableError,
} from "../../../src/common/errorCategorization";

describe("errorCategorization module", () => {
  describe("categorizeError", () => {
    describe("storage errors", () => {
      it("should categorize storage not configured errors", () => {
        const error = new Error("storage not configured");
        const result = categorizeError(error);

        expect(result.category).toBe("storage");
        expect(result.message).toContain("Blob storage");
        expect(result.isInfrastructure).toBe(true);
        expect(result.isRetryable).toBe(false);
      });

      it("should categorize BLOB errors", () => {
        const error = new Error("BLOB connection failed");
        const result = categorizeError(error);

        expect(result.category).toBe("storage");
        expect(result.isInfrastructure).toBe(true);
      });
    });

    describe("queue errors", () => {
      it("should categorize Service Bus errors", () => {
        const error = new Error("Service Bus connection failed");
        const result = categorizeError(error);

        expect(result.category).toBe("queue");
        expect(result.message).toContain("Message queue");
        expect(result.isInfrastructure).toBe(true);
        expect(result.isRetryable).toBe(false);
      });

      it("should categorize SERVICEBUS errors", () => {
        const error = new Error("SERVICEBUS_CONNECTION not set");
        const result = categorizeError(error);

        expect(result.category).toBe("queue");
      });
    });

    describe("database errors", () => {
      it("should categorize Job store errors", () => {
        const error = new Error("Job store initialization failed");
        const result = categorizeError(error);

        expect(result.category).toBe("database");
        expect(result.message).toContain("Database");
        expect(result.isInfrastructure).toBe(true);
        expect(result.isRetryable).toBe(false);
      });

      it("should categorize COSMOS errors", () => {
        const error = new Error("COSMOS_ENDPOINT not configured");
        const result = categorizeError(error);

        expect(result.category).toBe("database");
      });

      it("should categorize TABLE errors", () => {
        const error = new Error("TABLE connection failed");
        const result = categorizeError(error);

        expect(result.category).toBe("database");
      });
    });

    describe("robots.txt errors", () => {
      it("should categorize robots.txt blocking", () => {
        const error = new Error("Blocked by robots.txt");
        const result = categorizeError(error);

        expect(result.category).toBe("robots");
        expect(result.message).toContain("blocks automated crawling");
        expect(result.isInfrastructure).toBe(false);
        expect(result.isRetryable).toBe(false);
      });

      it("should categorize Disallow errors", () => {
        const error = new Error("Disallow: /");
        const result = categorizeError(error);

        expect(result.category).toBe("robots");
      });
    });

    describe("timeout errors", () => {
      it("should categorize timeout errors", () => {
        const error = new Error("Request timeout exceeded");
        const result = categorizeError(error);

        expect(result.category).toBe("timeout");
        expect(result.message).toContain("took too long");
        expect(result.isInfrastructure).toBe(false);
        expect(result.isRetryable).toBe(true);
      });

      it("should categorize ETIMEDOUT errors", () => {
        const error = new Error("connect ETIMEDOUT");
        const result = categorizeError(error);

        expect(result.category).toBe("timeout");
        expect(result.isRetryable).toBe(true);
      });
    });

    describe("network errors", () => {
      it("should categorize ENOTFOUND errors", () => {
        const error = new Error("getaddrinfo ENOTFOUND example.com");
        const result = categorizeError(error);

        expect(result.category).toBe("network");
        expect(result.message).toContain("not found or unreachable");
        expect(result.isInfrastructure).toBe(false);
        expect(result.isRetryable).toBe(true);
      });

      it("should categorize DNS errors", () => {
        const error = new Error("DNS lookup failed");
        const result = categorizeError(error);

        expect(result.category).toBe("network");
        expect(result.isRetryable).toBe(true);
      });

      it("should categorize EAI_AGAIN errors", () => {
        const error = new Error("getaddrinfo EAI_AGAIN");
        const result = categorizeError(error);

        expect(result.category).toBe("network");
        expect(result.isRetryable).toBe(true);
      });
    });

    describe("unknown errors", () => {
      it("should categorize unknown errors", () => {
        const error = new Error("Something unexpected happened");
        const result = categorizeError(error);

        expect(result.category).toBe("unknown");
        expect(result.message).toContain("unexpected");
        expect(result.isInfrastructure).toBe(false);
        expect(result.isRetryable).toBe(false);
      });
    });
  });

  describe("getActivityErrorMessage", () => {
    it("should generate message for validateJob activity", () => {
      const error = new Error("Invalid URL");
      const message = getActivityErrorMessage("validateJob", error);

      expect(message).toContain("Failed to validate team URL");
      expect(message).toContain("Invalid URL");
    });

    it("should generate message for crawlSite activity", () => {
      const error = new Error("connect ETIMEDOUT");
      const message = getActivityErrorMessage("crawlSite", error);

      expect(message).toContain("Failed to crawl team website");
      expect(message).toContain("took too long");
    });

    it("should generate message for selectLogo activity", () => {
      const error = new Error("No logo found");
      const message = getActivityErrorMessage("selectLogo", error);

      expect(message).toContain("Failed to select or upload team logo");
    });

    it("should generate message for extractColors activity", () => {
      const error = new Error("Invalid image format");
      const message = getActivityErrorMessage("extractColors", error);

      expect(message).toContain("Failed to extract color palette");
    });

    it("should generate message for generateDesign activity", () => {
      const error = new Error("Template error");
      const message = getActivityErrorMessage("generateDesign", error);

      expect(message).toContain("Failed to generate glove design");
    });

    it("should generate message for runWizard activity", () => {
      const error = new Error("Browser crash");
      const message = getActivityErrorMessage("runWizard", error);

      expect(message).toContain("Failed to run autofill wizard");
    });

    it("should generate message for writeOutputs activity", () => {
      const error = new Error("BLOB connection failed");
      const message = getActivityErrorMessage("writeOutputs", error);

      expect(message).toContain("Failed to save job outputs");
      expect(message).toContain("Blob storage");
    });

    it("should generate message for unknown activities", () => {
      const error = new Error("Some error");
      const message = getActivityErrorMessage("unknownActivity", error);

      expect(message).toContain("Branding job failed");
    });

    it("should include infrastructure error details", () => {
      const error = new Error("COSMOS_ENDPOINT not set");
      const message = getActivityErrorMessage("validateJob", error);

      expect(message).toContain("Database not configured");
      expect(message).toContain("contact support");
    });
  });

  describe("isInfrastructureError", () => {
    it("should return true for storage errors", () => {
      const error = new Error("BLOB connection failed");
      expect(isInfrastructureError(error)).toBe(true);
    });

    it("should return true for queue errors", () => {
      const error = new Error("Service Bus error");
      expect(isInfrastructureError(error)).toBe(true);
    });

    it("should return true for database errors", () => {
      const error = new Error("COSMOS connection failed");
      expect(isInfrastructureError(error)).toBe(true);
    });

    it("should return false for network errors", () => {
      const error = new Error("ENOTFOUND");
      expect(isInfrastructureError(error)).toBe(false);
    });

    it("should return false for timeout errors", () => {
      const error = new Error("timeout");
      expect(isInfrastructureError(error)).toBe(false);
    });

    it("should return false for robots.txt errors", () => {
      const error = new Error("robots.txt Disallow");
      expect(isInfrastructureError(error)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for timeout errors", () => {
      const error = new Error("ETIMEDOUT");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return true for network errors", () => {
      const error = new Error("ENOTFOUND");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for storage errors", () => {
      const error = new Error("BLOB not configured");
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for robots.txt errors", () => {
      const error = new Error("robots.txt blocks crawling");
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for unknown errors", () => {
      const error = new Error("Random error");
      expect(isRetryableError(error)).toBe(false);
    });
  });
});
