import { URL } from "url";
import { isIP } from "net";

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
];

export function validateUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  try {
    const url = new URL(rawUrl);
    if (!url.protocol.startsWith("http")) {
      return { ok: false, reason: "Only http/https URLs are allowed." };
    }
    if (url.username || url.password) {
      return { ok: false, reason: "Credentials in URL are not allowed." };
    }
    const hostname = url.hostname;
    if (isIP(hostname)) {
      if (isPrivateIp(hostname)) {
        return { ok: false, reason: "Private IP ranges are not allowed." };
      }
    }
    return { ok: true, url };
  } catch (error) {
    return { ok: false, reason: "Invalid URL." };
  }
}

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IPV4_RANGES.some((range) => range.test(ip));
}

export function ensureHttpScheme(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}
