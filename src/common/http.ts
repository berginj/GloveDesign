import axios, { AxiosResponse } from "axios";
import { URL } from "url";
import { validateUrlWithDns } from "./validation";
import { logWarn } from "./logging";

const DEFAULT_USER_AGENT = "GloveDesignBot/1.0 (+https://github.com/berginj/GloveDesign)";

export interface FetchBudget {
  maxBytes: number;
  usedBytes: number;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  retries?: number;
  userAgent?: string;
  jobId?: string;
  stage?: string;
  budget?: FetchBudget;
}

export interface FetchResult<T> {
  url: string;
  data: T;
  bytes: number;
  contentType?: string;
}

export async function safeFetchText(url: string, options: FetchOptions = {}): Promise<FetchResult<string>> {
  return fetchWithRedirects<string>(url, { ...options, responseType: "text" });
}

export async function safeFetchBuffer(url: string, options: FetchOptions = {}): Promise<FetchResult<Buffer>> {
  return fetchWithRedirects<Buffer>(url, { ...options, responseType: "arraybuffer" });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRedirects<T>(
  initialUrl: string,
  options: FetchOptions & { responseType: "text" | "arraybuffer" }
): Promise<FetchResult<T>> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024;
  const retries = options.retries ?? 1;
  let currentUrl = initialUrl;

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const validation = await validateUrlWithDns(currentUrl);
    if (!validation.ok) {
      throw new Error(`Blocked URL: ${validation.reason}`);
    }

    const response = (await requestWithRetries(currentUrl, {
      timeoutMs,
      maxBytes,
      retries,
      responseType: options.responseType,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    })) as AxiosResponse<T>;

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      const redirectedUrl = new URL(response.headers.location, currentUrl).toString();
      currentUrl = redirectedUrl;
      continue;
    }

    const bytes = typeof response.data === "string" ? Buffer.byteLength(response.data) : Buffer.byteLength(response.data as Buffer);
    if (bytes > maxBytes) {
      throw new Error(`Response exceeded max bytes (${bytes} > ${maxBytes}).`);
    }
    applyBudget(bytes, options.budget);
    return {
      url: currentUrl,
      data: response.data,
      bytes,
      contentType: response.headers["content-type"],
    };
  }

  logWarn("redirect_limit_exceeded", { jobId: options.jobId, stage: options.stage }, { url: initialUrl });
  throw new Error("Too many redirects.");
}

async function requestWithRetries<T>(url: string, options: { timeoutMs: number; maxBytes: number; retries: number; responseType: "text" | "arraybuffer"; userAgent: string }) {
  let attempt = 0;
  while (attempt <= options.retries) {
    try {
      return await axios.get(url, {
        timeout: options.timeoutMs,
        responseType: options.responseType,
        maxRedirects: 0,
        maxBodyLength: options.maxBytes,
        maxContentLength: options.maxBytes,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: {
          "User-Agent": options.userAgent,
          Accept: "*/*",
        },
      });
    } catch (error) {
      if (attempt >= options.retries) {
        throw error;
      }
      await sleep(200 * (attempt + 1));
      attempt += 1;
    }
  }
  throw new Error("Request failed after retries.");
}

function applyBudget(bytes: number, budget?: FetchBudget) {
  if (!budget) {
    return;
  }
  if (budget.usedBytes + bytes > budget.maxBytes) {
    throw new Error("Download budget exceeded.");
  }
  budget.usedBytes += bytes;
}
