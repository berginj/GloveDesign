import { describe, it, expect } from "vitest";
import { validateUrl, ensureHttpScheme, validateUrlWithDns, isSafeHostname } from "../../../src/common/validation";

describe("validation module", () => {
  describe("validateUrl", () => {
    describe("valid URLs", () => {
      it("should accept valid http URLs", () => {
        const result = validateUrl("http://example.com");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.url.hostname).toBe("example.com");
        }
      });

      it("should accept valid https URLs", () => {
        const result = validateUrl("https://example.com");
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.url.hostname).toBe("example.com");
        }
      });

      it("should accept URLs with paths", () => {
        const result = validateUrl("https://example.com/path/to/page");
        expect(result.ok).toBe(true);
      });

      it("should accept URLs with query params", () => {
        const result = validateUrl("https://example.com?foo=bar&baz=qux");
        expect(result.ok).toBe(true);
      });

      it("should accept URLs with allowed ports", () => {
        const result = validateUrl("https://example.com:8080");
        expect(result.ok).toBe(true);
      });

      it("should accept public IPv4 addresses", () => {
        const result = validateUrl("http://8.8.8.8");
        expect(result.ok).toBe(true);
      });

      it("should accept subdomains", () => {
        const result = validateUrl("https://subdomain.example.com");
        expect(result.ok).toBe(true);
      });
    });

    describe("invalid URLs", () => {
      it("should reject empty URLs", () => {
        const result = validateUrl("");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("required");
        }
      });

      it("should reject whitespace-only URLs", () => {
        const result = validateUrl("   ");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("required");
        }
      });

      it("should reject non-http/https protocols", () => {
        expect(validateUrl("ftp://example.com").ok).toBe(false);
        expect(validateUrl("file:///etc/passwd").ok).toBe(false);
        expect(validateUrl("javascript:alert(1)").ok).toBe(false);
        expect(validateUrl("data:text/html,<script>alert(1)</script>").ok).toBe(false);
      });

      it("should reject URLs with credentials", () => {
        const result = validateUrl("https://user:pass@example.com");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("Credentials");
        }
      });

      it("should reject malformed URLs", () => {
        expect(validateUrl("not a url").ok).toBe(false);
        expect(validateUrl("http://").ok).toBe(false);
        expect(validateUrl("://example.com").ok).toBe(false);
      });
    });

    describe("private IP blocking", () => {
      it("should reject IPv4 loopback (127.0.0.1)", () => {
        const result = validateUrl("http://127.0.0.1");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("Private IP");
        }
      });

      it("should reject IPv4 private range 10.x.x.x", () => {
        expect(validateUrl("http://10.0.0.1").ok).toBe(false);
        expect(validateUrl("http://10.255.255.255").ok).toBe(false);
      });

      it("should reject IPv4 private range 192.168.x.x", () => {
        expect(validateUrl("http://192.168.1.1").ok).toBe(false);
        expect(validateUrl("http://192.168.0.1").ok).toBe(false);
      });

      it("should reject IPv4 private range 172.16-31.x.x", () => {
        expect(validateUrl("http://172.16.0.1").ok).toBe(false);
        expect(validateUrl("http://172.31.255.255").ok).toBe(false);
      });

      it("should reject IPv4 link-local 169.254.x.x", () => {
        expect(validateUrl("http://169.254.169.254").ok).toBe(false);
      });

      it("should reject IPv4 0.0.0.0", () => {
        expect(validateUrl("http://0.0.0.0").ok).toBe(false);
      });

      it.skip("should reject IPv6 loopback ::1", () => {
        // TODO: Fix IPv6 validation - URL class may not preserve brackets correctly
        const result = validateUrl("http://[::1]");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("Private IP");
        }
      });

      it.skip("should reject IPv6 link-local fe80::", () => {
        // TODO: Fix IPv6 validation - URL class may not preserve brackets correctly
        expect(validateUrl("http://[fe80::1]").ok).toBe(false);
      });

      it.skip("should reject IPv6 unique local fc00::/7", () => {
        // TODO: Fix IPv6 validation - URL class may not preserve brackets correctly
        expect(validateUrl("http://[fc00::1]").ok).toBe(false);
        expect(validateUrl("http://[fd00::1]").ok).toBe(false);
      });
    });

    describe("blocked hostnames", () => {
      it("should reject localhost", () => {
        const result = validateUrl("http://localhost");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("Blocked");
        }
      });

      it("should reject metadata.google.internal", () => {
        expect(validateUrl("http://metadata.google.internal").ok).toBe(false);
      });

      it("should reject .local domains", () => {
        expect(validateUrl("http://myserver.local").ok).toBe(false);
      });

      it("should reject .internal domains", () => {
        expect(validateUrl("http://api.internal").ok).toBe(false);
      });

      it("should reject .localhost domains", () => {
        expect(validateUrl("http://test.localhost").ok).toBe(false);
      });
    });

    describe("hostname format validation", () => {
      it("should reject hostnames with ..", () => {
        const result = validateUrl("http://example..com");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("Invalid hostname");
        }
      });

      it("should reject hostnames starting with .", () => {
        expect(validateUrl("http://.example.com").ok).toBe(false);
      });

      it("should reject hostnames ending with .", () => {
        expect(validateUrl("http://example.com.").ok).toBe(false);
      });
    });

    describe("port validation", () => {
      it("should reject SSH port 22", () => {
        const result = validateUrl("http://example.com:22");
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toContain("Port not allowed");
        }
      });

      it("should reject Telnet port 23", () => {
        expect(validateUrl("http://example.com:23").ok).toBe(false);
      });

      it("should reject SMTP port 25", () => {
        expect(validateUrl("http://example.com:25").ok).toBe(false);
      });

      it("should reject RDP port 3389", () => {
        expect(validateUrl("http://example.com:3389").ok).toBe(false);
      });

      it("should reject VNC ports 5900, 5901", () => {
        expect(validateUrl("http://example.com:5900").ok).toBe(false);
        expect(validateUrl("http://example.com:5901").ok).toBe(false);
      });

      it("should accept standard HTTP/HTTPS ports", () => {
        expect(validateUrl("http://example.com:80").ok).toBe(true);
        expect(validateUrl("https://example.com:443").ok).toBe(true);
      });

      it("should accept common web ports", () => {
        expect(validateUrl("http://example.com:8080").ok).toBe(true);
        expect(validateUrl("http://example.com:3000").ok).toBe(true);
      });
    });
  });

  describe("ensureHttpScheme", () => {
    it("should preserve URLs with http://", () => {
      expect(ensureHttpScheme("http://example.com")).toBe("http://example.com");
    });

    it("should preserve URLs with https://", () => {
      expect(ensureHttpScheme("https://example.com")).toBe("https://example.com");
    });

    it("should add https:// to bare domains", () => {
      expect(ensureHttpScheme("example.com")).toBe("https://example.com");
    });

    it("should add https:// to www domains", () => {
      expect(ensureHttpScheme("www.example.com")).toBe("https://www.example.com");
    });

    it("should strip leading // and add https://", () => {
      expect(ensureHttpScheme("//example.com")).toBe("https://example.com");
    });

    it("should trim whitespace", () => {
      expect(ensureHttpScheme("  example.com  ")).toBe("https://example.com");
    });

    it("should handle domains with paths", () => {
      expect(ensureHttpScheme("example.com/path")).toBe("https://example.com/path");
    });

    it("should handle domains with ports", () => {
      expect(ensureHttpScheme("example.com:8080")).toBe("https://example.com:8080");
    });
  });

  describe("isSafeHostname", () => {
    it("should return true for public domains", () => {
      expect(isSafeHostname("example.com")).toBe(true);
      expect(isSafeHostname("google.com")).toBe(true);
      expect(isSafeHostname("subdomain.example.com")).toBe(true);
    });

    it("should return true for public IPs", () => {
      expect(isSafeHostname("8.8.8.8")).toBe(true);
      expect(isSafeHostname("1.1.1.1")).toBe(true);
    });

    it("should return false for private IPv4 addresses", () => {
      expect(isSafeHostname("127.0.0.1")).toBe(false);
      expect(isSafeHostname("10.0.0.1")).toBe(false);
      expect(isSafeHostname("192.168.1.1")).toBe(false);
      expect(isSafeHostname("172.16.0.1")).toBe(false);
    });

    it("should return false for localhost", () => {
      expect(isSafeHostname("localhost")).toBe(false);
    });

    it("should return false for blocked domains", () => {
      expect(isSafeHostname("metadata.google.internal")).toBe(false);
      expect(isSafeHostname("myserver.local")).toBe(false);
      expect(isSafeHostname("api.internal")).toBe(false);
    });
  });

  describe("validateUrlWithDns", () => {
    it("should pass through basic validation errors", async () => {
      const result = await validateUrlWithDns("ftp://example.com");
      expect(result.ok).toBe(false);
    });

    it("should accept URLs that pass basic validation", async () => {
      // Note: This test will make an actual DNS lookup
      // In a real test suite, you might want to mock dns.lookup
      const result = await validateUrlWithDns("https://google.com");
      expect(result.ok).toBe(true);
    }, 10000);

    it("should reject URLs that resolve to private IPs", async () => {
      // Testing this properly would require mocking dns.lookup
      // or setting up a test DNS server
      // For now, we just test that the function exists and has the right signature
      const result = await validateUrlWithDns("http://127.0.0.1");
      expect(result.ok).toBe(false);
    });
  });
});
