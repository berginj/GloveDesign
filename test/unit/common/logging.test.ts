import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logInfo, logWarn, logError, LogContext } from "../../../src/common/logging";

describe("logging module", () => {
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("logInfo", () => {
    it("should log info message with context", () => {
      const context: LogContext = { jobId: "test-123", stage: "crawl" };
      logInfo("Test message", context);

      expect(consoleInfoSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);

      expect(loggedData.level).toBe("info");
      expect(loggedData.message).toBe("Test message");
      expect(loggedData.jobId).toBe("test-123");
      expect(loggedData.stage).toBe("crawl");
      expect(loggedData.ts).toBeDefined();
    });

    it("should use default values for missing context", () => {
      logInfo("Test message");

      const loggedData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);

      expect(loggedData.jobId).toBe("unknown");
      expect(loggedData.stage).toBe("unknown");
    });

    it("should include additional data when provided", () => {
      const data = { url: "https://example.com", count: 5 };
      logInfo("Test message", {}, data);

      const loggedData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);

      expect(loggedData.data).toEqual(data);
    });

    it("should handle partial context", () => {
      const context: LogContext = { jobId: "test-456" };
      logInfo("Test message", context);

      const loggedData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);

      expect(loggedData.jobId).toBe("test-456");
      expect(loggedData.stage).toBe("unknown");
    });

    it("should include ISO timestamp", () => {
      logInfo("Test message");

      const loggedData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);

      expect(loggedData.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should output valid JSON", () => {
      logInfo("Test message", { jobId: "test" }, { key: "value" });

      const output = consoleInfoSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe("logWarn", () => {
    it("should log warning message with context", () => {
      const context: LogContext = { jobId: "warn-123", stage: "validation" };
      logWarn("Warning message", context);

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(loggedData.level).toBe("warn");
      expect(loggedData.message).toBe("Warning message");
      expect(loggedData.jobId).toBe("warn-123");
      expect(loggedData.stage).toBe("validation");
    });

    it("should use default values for missing context", () => {
      logWarn("Warning message");

      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(loggedData.jobId).toBe("unknown");
      expect(loggedData.stage).toBe("unknown");
    });

    it("should include additional data when provided", () => {
      const data = { retryCount: 3, lastError: "Timeout" };
      logWarn("Warning message", {}, data);

      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(loggedData.data).toEqual(data);
    });

    it("should output valid JSON", () => {
      logWarn("Warning message", { jobId: "test" });

      const output = consoleWarnSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe("logError", () => {
    it("should log error message with context", () => {
      const context: LogContext = { jobId: "error-123", stage: "crawl" };
      logError("Error message", context);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(loggedData.level).toBe("error");
      expect(loggedData.message).toBe("Error message");
      expect(loggedData.jobId).toBe("error-123");
      expect(loggedData.stage).toBe("crawl");
    });

    it("should use default values for missing context", () => {
      logError("Error message");

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(loggedData.jobId).toBe("unknown");
      expect(loggedData.stage).toBe("unknown");
    });

    it("should include error details in data", () => {
      const data = {
        error: "ECONNREFUSED",
        stack: "Error: Connection refused\n  at ...",
      };
      logError("Connection failed", {}, data);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(loggedData.data).toEqual(data);
    });

    it("should handle complex error data", () => {
      const data = {
        error: new Error("Test error"),
        nested: { level: 1, value: "test" },
      };
      logError("Complex error", {}, data as any);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(loggedData.data).toBeDefined();
      // Error object gets stringified, so we just check that data exists
    });

    it("should output valid JSON", () => {
      logError("Error message", { jobId: "test" });

      const output = consoleErrorSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe("log format consistency", () => {
    it("should have consistent structure across log levels", () => {
      const context: LogContext = { jobId: "test", stage: "test" };
      const data = { test: "value" };

      logInfo("Info", context, data);
      logWarn("Warn", context, data);
      logError("Error", context, data);

      const infoData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      const warnData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      const errorData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      // All should have the same structure
      expect(Object.keys(infoData).sort()).toEqual(Object.keys(warnData).sort());
      expect(Object.keys(infoData).sort()).toEqual(Object.keys(errorData).sort());

      // All should have required fields
      const requiredFields = ["level", "message", "jobId", "stage", "data", "ts"];
      requiredFields.forEach((field) => {
        expect(infoData).toHaveProperty(field);
        expect(warnData).toHaveProperty(field);
        expect(errorData).toHaveProperty(field);
      });
    });

    it("should use different log levels", () => {
      logInfo("Info");
      logWarn("Warn");
      logError("Error");

      const infoData = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      const warnData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      const errorData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(infoData.level).toBe("info");
      expect(warnData.level).toBe("warn");
      expect(errorData.level).toBe("error");
    });
  });
});
