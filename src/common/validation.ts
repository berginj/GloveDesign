import { URL } from "url";
import { isIP } from "net";
import { promises as dns } from "dns";

const PRIVATE_IPV4_RANGES = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
];

const PRIVATE_IPV6_RANGES = [/^::1$/i, /^fc/i, /^fd/i, /^fe80/i];

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "169.254.169.254"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

export function validateUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
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
    if (isBlockedHostname(hostname)) {
      return { ok: false, reason: "Blocked hostname." };
    }
    return { ok: true, url };
  } catch (error) {
    return { ok: false, reason: "Invalid URL." };
  }
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    return PRIVATE_IPV6_RANGES.some((range) => range.test(ip.toLowerCase()));
  }
  return PRIVATE_IPV4_RANGES.some((range) => range.test(ip));
}

export function ensureHttpScheme(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

export async function validateUrlWithDns(rawUrl: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  const basic = validateUrl(rawUrl);
  if (!basic.ok) {
    return basic;
  }
  const hostname = basic.url.hostname;
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { ok: false, reason: "Private IP ranges are not allowed." };
    }
    return basic;
  }
  if (isBlockedHostname(hostname)) {
    return { ok: false, reason: "Blocked hostname." };
  }
  try {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) {
      return { ok: false, reason: "Hostname did not resolve." };
    }
    const hasPrivate = addresses.some((addr) => isPrivateIp(addr.address));
    if (hasPrivate) {
      return { ok: false, reason: "Hostname resolves to private IP ranges." };
    }
  } catch (error) {
    return { ok: false, reason: "Failed to resolve hostname." };
  }
  return basic;
}

function isBlockedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTS.has(hostname.toLowerCase())) {
    return true;
  }
  return BLOCKED_SUFFIXES.some((suffix) => hostname.toLowerCase().endsWith(suffix));
}

export function isSafeHostname(hostname: string): boolean {
  if (isIP(hostname)) {
    return !isPrivateIp(hostname);
  }
  if (isBlockedHostname(hostname)) {
    return false;
  }
  return true;
}
