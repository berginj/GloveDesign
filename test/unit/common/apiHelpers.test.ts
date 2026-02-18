import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiResponse, validateRequired, parseJsonBody } from "../../../src/common/apiHelpers";

describe("apiHelpers module", () => {
  describe("ApiResponse", () => {
    describe("badRequest", () => {
      it("should return 400 with error message", () => {
        const response = ApiResponse.badRequest("Invalid input");

        expect(response.status).toBe(400);
        expect(response.jsonBody).toEqual({ error: "Invalid input" });
      });

      it("should return 400 with error and additional details", () => {
        const response = ApiResponse.badRequest("Validation failed", {
          issues: ["Field required", "Invalid format"],
        });

        expect(response.status).toBe(400);
        expect(response.jsonBody).toEqual({
          error: "Validation failed",
          issues: ["Field required", "Invalid format"],
        });
      });
    });

    describe("notFound", () => {
      it("should return 404 with error message", () => {
        const response = ApiResponse.notFound("Resource not found");

        expect(response.status).toBe(404);
        expect(response.jsonBody).toEqual({ error: "Resource not found" });
      });
    });

    describe("internalError", () => {
      it("should return 500 with error message", () => {
        const response = ApiResponse.internalError("Something went wrong");

        expect(response.status).toBe(500);
        expect(response.jsonBody).toEqual({ error: "Something went wrong" });
      });
    });

    describe("ok", () => {
      it("should return 200 with data", () => {
        const data = { id: "123", name: "Test" };
        const response = ApiResponse.ok(data);

        expect(response.status).toBe(200);
        expect(response.jsonBody).toEqual(data);
      });

      it("should return 200 with array data", () => {
        const data = [1, 2, 3];
        const response = ApiResponse.ok(data);

        expect(response.status).toBe(200);
        expect(response.jsonBody).toEqual(data);
      });

      it("should return 200 with string data", () => {
        const response = ApiResponse.ok("success");

        expect(response.status).toBe(200);
        expect(response.jsonBody).toBe("success");
      });
    });

    describe("accepted", () => {
      it("should return 202 with data", () => {
        const data = { jobId: "abc123" };
        const response = ApiResponse.accepted(data);

        expect(response.status).toBe(202);
        expect(response.jsonBody).toEqual(data);
      });
    });
  });

  describe("validateRequired", () => {
    it("should return null when value is present", () => {
      const result = validateRequired("someValue", "paramName");

      expect(result).toBeNull();
    });

    it("should return error response when value is undefined", () => {
      const result = validateRequired(undefined, "userId");

      expect(result).not.toBeNull();
      expect(result?.status).toBe(400);
      expect(result?.jsonBody).toEqual({ error: "userId is required." });
    });

    it("should return error response when value is empty string", () => {
      const result = validateRequired("", "email");

      expect(result).not.toBeNull();
      expect(result?.status).toBe(400);
      expect(result?.jsonBody).toEqual({ error: "email is required." });
    });

    it("should accept whitespace-only strings", () => {
      // Note: This behavior validates only falsy values, not whitespace
      const result = validateRequired("  ", "name");

      expect(result).toBeNull();
    });
  });

  describe("parseJsonBody", () => {
    it("should parse valid JSON body", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({ name: "Test", value: 123 }),
      };

      const result = await parseJsonBody(mockRequest);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual({ name: "Test", value: 123 });
      }
    });

    it("should return error when JSON parsing fails", async () => {
      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      };

      const result = await parseJsonBody(mockRequest);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(400);
        expect(result.error.jsonBody).toEqual({ error: "Invalid JSON body." });
      }
    });

    it("should return error when body is null", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue(null),
      };

      const result = await parseJsonBody(mockRequest);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(400);
      }
    });

    it("should return error when body is undefined", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue(undefined),
      };

      const result = await parseJsonBody(mockRequest);

      expect("error" in result).toBe(true);
    });

    it("should use custom error message", async () => {
      const mockRequest = {
        json: vi.fn().mockRejectedValue(new Error("Parse error")),
      };

      const result = await parseJsonBody(mockRequest, "Custom error message");

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.jsonBody).toEqual({ error: "Custom error message" });
      }
    });

    it("should parse array bodies", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue([1, 2, 3]),
      };

      const result = await parseJsonBody<number[]>(mockRequest);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual([1, 2, 3]);
      }
    });

    it("should handle empty object bodies", async () => {
      const mockRequest = {
        json: vi.fn().mockResolvedValue({}),
      };

      const result = await parseJsonBody(mockRequest);

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual({});
      }
    });
  });
});
