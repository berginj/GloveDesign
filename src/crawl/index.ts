import * as cheerio from "cheerio";
import { URL } from "url";
import { CrawlReport, ImageCandidate } from "../common/types";
import { logInfo, logWarn } from "../common/logging";
import { FetchBudget, safeFetchText, sleep } from "../common/http";

const MAX_IMAGES = readPositiveInt(process.env.BRANDING_CRAWL_MAX_IMAGES, 40);
const MAX_PAGES = readPositiveInt(process.env.BRANDING_CRAWL_MAX_PAGES, 6);
const MAX_BYTES = readPositiveInt(process.env.BRANDING_CRAWL_MAX_BYTES, 25 * 1024 * 1024);
const MAX_PAGE_BYTES = readPositiveInt(process.env.BRANDING_CRAWL_MAX_PAGE_BYTES, 2 * 1024 * 1024);
const MAX_ASSET_BYTES = readPositiveInt(process.env.BRANDING_CRAWL_MAX_ASSET_BYTES, 5 * 1024 * 1024);
const MAX_CSS_FILES = readPositiveInt(process.env.BRANDING_CRAWL_MAX_CSS_FILES, 6);
const REQUEST_DELAY_MS = readPositiveInt(process.env.BRANDING_CRAWL_REQUEST_DELAY_MS, 150);

export async function crawlSite(startUrl: string, jobId?: string): Promise<CrawlReport> {
  const visited: string[] = [];
  const skipped: string[] = [];
  const imageCandidates: ImageCandidate[] = [];
  const cssUrls: string[] = [];
  const notes: string[] = [];
  const inlineStyles: string[] = [];
  const startedAt = Date.now();
  const budget: FetchBudget = { maxBytes: MAX_BYTES, usedBytes: 0 };
  const seenImages = new Set<string>();
  const seenCss = new Set<string>();
  const limits = {
    maxPages: MAX_PAGES,
    maxImages: MAX_IMAGES,
    maxBytes: MAX_BYTES,
    maxPageBytes: MAX_PAGE_BYTES,
    maxAssetBytes: MAX_ASSET_BYTES,
    maxCssFiles: MAX_CSS_FILES,
  };

  const robots = await checkRobots(startUrl, budget, jobId);
  const terms = await checkTerms(startUrl, budget, jobId);
  if (terms.found) {
    notes.push(`Terms page found: ${terms.urls.join(", ")}`);
  } else {
    notes.push(`Terms check: ${terms.reason}`);
  }
  if (!robots.allowed) {
    notes.push(`robots.txt disallows crawling (${robots.reason}). Proposal-only mode recommended.`);
    return {
      startUrl,
      visited,
      skipped,
      imageCandidates,
      cssUrls,
      inlineStyles,
      notes,
      robots,
      terms,
      limits,
      bytesDownloaded: budget.usedBytes,
      durationMs: Date.now() - startedAt,
    };
  }

  collectRootBrandAssets(startUrl, imageCandidates, seenImages);

  const queue = [startUrl];
  const seen = new Set<string>();
  while (queue.length > 0 && visited.length < MAX_PAGES && imageCandidates.length < MAX_IMAGES) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);
    if (REQUEST_DELAY_MS > 0) {
      await sleep(REQUEST_DELAY_MS);
    }
    try {
      const response = await safeFetchText(current, {
        timeoutMs: 15000,
        maxBytes: MAX_PAGE_BYTES,
        budget,
        jobId,
        stage: "crawl",
      });
      visited.push(response.url);
      const $ = cheerio.load(response.data);
      collectImages($, response.url, imageCandidates, seenImages);
      collectMetaImages($, response.url, imageCandidates, seenImages);
      collectJsonLdLogos($, response.url, imageCandidates, seenImages);
      collectInlineBackgrounds($, response.url, imageCandidates, seenImages);
      collectSvgReferences($, response.url, imageCandidates, seenImages);
      collectInlineStyles($, inlineStyles);
      collectStylesheets($, response.url, cssUrls, MAX_CSS_FILES);
      await collectCssBackgrounds(cssUrls, seenCss, imageCandidates, seenImages, budget, jobId);
      const links = collectLinks($, current, startUrl);
      for (const link of links) {
        if (!seen.has(link) && !queue.includes(link) && queue.length < MAX_PAGES * 4) {
          queue.push(link);
        }
      }
    } catch (error) {
      skipped.push(current);
      logWarn("crawl_failed", { jobId, stage: "crawl" }, { url: current, error: String(error) });
    }
  }

  if (visited.length >= MAX_PAGES) {
    notes.push(`Page cap reached (${MAX_PAGES}).`);
  }
  if (imageCandidates.length >= MAX_IMAGES) {
    notes.push(`Image cap reached (${MAX_IMAGES}).`);
  }
  if (budget.usedBytes >= MAX_BYTES) {
    notes.push(`Download budget reached (${MAX_BYTES} bytes).`);
  }

  return {
    startUrl,
    visited,
    skipped,
    imageCandidates,
    cssUrls,
    inlineStyles,
    notes,
    robots,
    terms,
    limits,
    bytesDownloaded: budget.usedBytes,
    durationMs: Date.now() - startedAt,
  };
}

function collectImages(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  images: ImageCandidate[],
  seenImages: Set<string>
) {
  $("img").each((_i, el) => {
    if (images.length >= MAX_IMAGES) {
      return false;
    }
    const alt = $(el).attr("alt");
    const classHint = $(el).attr("class");
    const context = $(el).closest("header,nav,section,main").prop("tagName")?.toLowerCase();
    const width = parseInt($(el).attr("width") || "", 10) || undefined;
    const height = parseInt($(el).attr("height") || "", 10) || undefined;
    const hints = collectHints([alt, classHint, $(el).attr("id"), $(el).attr("data-testid")]);

    const sources = [
      $(el).attr("src"),
      $(el).attr("data-src"),
      $(el).attr("data-original"),
      $(el).attr("data-lazy-src"),
      $(el).attr("data-src-large"),
      pickFromSrcSet($(el).attr("srcset")),
      pickFromSrcSet($(el).attr("data-srcset")),
    ].filter(Boolean) as string[];

    for (const source of sources) {
      if (images.length >= MAX_IMAGES) {
        return false;
      }
      pushImageCandidate(images, seenImages, sourceUrl, source, {
        sourceUrl,
        altText: alt,
        context,
        width,
        height,
        hints,
      });
    }
  });

  $("source[srcset]").each((_i, el) => {
    if (images.length >= MAX_IMAGES) {
      return false;
    }
    const source = pickFromSrcSet($(el).attr("srcset"));
    if (!source) {
      return;
    }
    pushImageCandidate(images, seenImages, sourceUrl, source, {
      sourceUrl,
      context: "picture",
      hints: collectHints([$(el).attr("type"), $(el).attr("media")]),
    });
  });
}

function collectMetaImages(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  images: ImageCandidate[],
  seenImages: Set<string>
) {
  const metaNames = ["og:image", "twitter:image", "og:logo"];
  for (const name of metaNames) {
    $(`meta[property='${name}'], meta[name='${name}']`).each((_i, el) => {
      if (images.length >= MAX_IMAGES) {
        return false;
      }
      const content = $(el).attr("content");
      if (!content) {
        return;
      }
      pushImageCandidate(images, seenImages, sourceUrl, content, {
        sourceUrl,
        altText: name,
        context: "meta",
        hints: collectHints([name]),
      });
    });
  }

  const linkSelectors = [
    { selector: "link[rel='icon']", label: "icon" },
    { selector: "link[rel~='icon']", label: "icon" },
    { selector: "link[rel='shortcut icon']", label: "shortcut icon" },
    { selector: "link[rel='apple-touch-icon']", label: "apple-touch-icon" },
    { selector: "link[rel='apple-touch-icon-precomposed']", label: "apple-touch-icon-precomposed" },
  ];
  for (const item of linkSelectors) {
    $(item.selector).each((_i, el) => {
      if (images.length >= MAX_IMAGES) {
        return false;
      }
      const href = $(el).attr("href");
      if (!href) {
        return;
      }
      pushImageCandidate(images, seenImages, sourceUrl, href, {
        sourceUrl,
        altText: item.label,
        context: "meta",
        hints: collectHints([item.label]),
      });
    });
  }
}

function collectInlineBackgrounds(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  images: ImageCandidate[],
  seenImages: Set<string>
) {
  $("[style*='background']").each((_i, el) => {
    if (images.length >= MAX_IMAGES) {
      return false;
    }
    const style = $(el).attr("style") || "";
    const matches = Array.from(style.matchAll(/url\(['"]?(.*?)['"]?\)/gi)).map((match) => match[1]);
    for (const value of matches) {
      if (images.length >= MAX_IMAGES) {
        return false;
      }
      const url = resolveUrl(sourceUrl, value);
      if (!url) {
        continue;
      }
      if (seenImages.has(url)) {
        continue;
      }
      seenImages.add(url);
      images.push({
        url,
        sourceUrl,
        context: "inline-style",
        fileNameHint: fileName(url),
        hints: collectHints(["background-image"]),
      });
    }
  });
}

function collectLinks($: cheerio.CheerioAPI, sourceUrl: string, startUrl: string): string[] {
  const links = new Map<string, number>();
  const start = new URL(startUrl);
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) {
      return;
    }
    const url = resolveUrl(sourceUrl, href);
    if (!url) {
      return;
    }
    const linkUrl = new URL(url);
    if (linkUrl.hostname !== start.hostname) {
      return;
    }
    if (/\.(pdf|docx?|xlsx?|pptx?|zip|png|jpe?g|webp|gif|svg)$/i.test(linkUrl.pathname)) {
      return;
    }
    const candidate = linkUrl.toString();
    const path = linkUrl.pathname.toLowerCase();
    if (path === "/") {
      links.set(candidate, Math.max(links.get(candidate) ?? 0, 5));
      return;
    }
    if (/login|signin|signup|privacy|terms|cookie|account|checkout|cart|wp-admin|admin/.test(path)) {
      return;
    }
    const score = /about|team|club|baseball|home|program|organization|brand|our-story|about-us/.test(path) ? 4 : 1;
    links.set(candidate, Math.max(links.get(candidate) ?? 0, score));
  });
  return Array.from(links.entries())
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .map(([url]) => url)
    .slice(0, Math.max(MAX_PAGES * 3, 6));
}

function collectStylesheets($: cheerio.CheerioAPI, sourceUrl: string, cssUrls: string[], limit: number) {
  $("link[rel='stylesheet']").each((_i, el) => {
    if (cssUrls.length >= limit) {
      return false;
    }
    const href = $(el).attr("href");
    if (!href) {
      return;
    }
    const url = resolveUrl(sourceUrl, href);
    if (!url) {
      return;
    }
    if (cssUrls.includes(url)) {
      return;
    }
    cssUrls.push(url);
  });
}

async function collectCssBackgrounds(
  cssUrls: string[],
  seenCss: Set<string>,
  images: ImageCandidate[],
  seenImages: Set<string>,
  budget: FetchBudget,
  jobId?: string
) {
  for (const cssUrl of cssUrls) {
    if (seenCss.size >= MAX_CSS_FILES || images.length >= MAX_IMAGES) {
      return;
    }
    if (seenCss.has(cssUrl)) {
      continue;
    }
    seenCss.add(cssUrl);
    try {
      const response = await safeFetchText(cssUrl, {
        timeoutMs: 8000,
        maxBytes: 300 * 1024,
        budget,
        jobId,
        stage: "crawl-css",
        retries: 1,
      });
      // Remove CSS comments before parsing
      const cleanedCss = response.data.replace(/\/\*[\s\S]*?\*\//g, "");

      // Extract URLs from url() declarations
      // Handles: url("..."), url('...'), url(...), with optional whitespace
      const matches = Array.from(cleanedCss.matchAll(/url\(\s*(['"]?)([^'"()]+)\1\s*\)/gi)).map((match) => match[2].trim());

      for (const value of matches) {
        if (images.length >= MAX_IMAGES) {
          return;
        }

        // Skip data URIs
        if (value.startsWith("data:")) {
          continue;
        }

        const url = resolveUrl(cssUrl, value);
        if (!url || !isLikelyImage(url)) {
          continue;
        }
        if (seenImages.has(url)) {
          continue;
        }
        seenImages.add(url);
        images.push({
          url,
          sourceUrl: cssUrl,
          context: "css",
          fileNameHint: fileName(url),
          hints: collectHints(["css-background"]),
        });
      }
    } catch (error) {
      logWarn("css_background_fetch_failed", { jobId, stage: "crawl-css" }, { url: cssUrl, error: String(error) });
    }
  }
}

function collectSvgReferences(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  images: ImageCandidate[],
  seenImages: Set<string>
) {
  $("svg image, svg use").each((_i, el) => {
    if (images.length >= MAX_IMAGES) {
      return false;
    }
    const href = $(el).attr("href") || $(el).attr("xlink:href");
    if (!href || href.startsWith("#")) {
      return;
    }
    const url = resolveUrl(sourceUrl, href);
    if (!url) {
      return;
    }
    if (seenImages.has(url)) {
      return;
    }
    seenImages.add(url);
    images.push({
      url,
      sourceUrl,
      context: "svg",
      fileNameHint: fileName(url),
      hints: collectHints(["svg"]),
    });
  });
}

function collectInlineStyles($: cheerio.CheerioAPI, inlineStyles: string[]) {
  $("style").each((_i, el) => {
    const text = $(el).text();
    if (text && inlineStyles.length < 10) {
      inlineStyles.push(text.slice(0, 10000));
    }
  });
  $("[style]").each((_i, el) => {
    if (inlineStyles.length >= 200) {
      return false;
    }
    const style = $(el).attr("style");
    if (style) {
      inlineStyles.push(style);
    }
  });
}

function resolveUrl(base: string, value: string): string | null {
  try {
    const resolved = new URL(value, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch (error) {
    return null;
  }
}

async function checkRobots(startUrl: string, budget: FetchBudget, jobId?: string) {
  try {
    const url = new URL(startUrl);
    const robotsUrl = `${url.origin}/robots.txt`;
    const response = await safeFetchText(robotsUrl, {
      timeoutMs: 8000,
      maxBytes: 200 * 1024,
      budget,
      jobId,
      stage: "robots",
    });
    const text = response.data;
    if (!text) {
      return { checked: true, allowed: true, reason: "robots.txt empty" };
    }
    const ruleBlock = /User-agent:\s*\*([\s\S]*?)(?:User-agent:|$)/i.exec(text);
    if (!ruleBlock) {
      return { checked: true, allowed: true, reason: "no explicit rules for user-agent *" };
    }
    const disallowRules = Array.from(ruleBlock[1].matchAll(/^\s*Disallow:\s*(.*)/gim))
      .map((match) => match[1].trim())
      .filter(Boolean);
    const allowRules = Array.from(ruleBlock[1].matchAll(/^\s*Allow:\s*(.*)/gim))
      .map((match) => match[1].trim())
      .filter(Boolean);
    if (disallowRules.includes("/") && !allowRules.includes("/")) {
      return { checked: true, allowed: false, reason: "disallow / for user-agent *" };
    }
    return { checked: true, allowed: true, reason: "allowed by robots.txt" };
  } catch (error) {
    logInfo("robots_fetch_failed", { jobId, stage: "robots" }, { error: String(error) });
    return { checked: false, allowed: true, reason: "robots.txt fetch failed" };
  }
}

async function checkTerms(startUrl: string, budget: FetchBudget, jobId?: string) {
  const paths = ["/terms", "/terms-of-service", "/terms-of-use", "/legal", "/privacy", "/policies/terms"];
  try {
    const base = new URL(startUrl).origin;
    const found: string[] = [];
    for (const path of paths) {
      if (found.length >= 2) {
        break;
      }
      const url = `${base}${path}`;
      try {
        const response = await safeFetchText(url, {
          timeoutMs: 8000,
          maxBytes: 200 * 1024,
          budget,
          jobId,
          stage: "terms",
          retries: 0,
        });
        if (response.data && response.data.length > 0) {
          found.push(url);
        }
      } catch (error) {
        continue;
      }
    }
    if (found.length > 0) {
      return { checked: true, found: true, urls: found, reason: "terms page reachable" };
    }
    return { checked: true, found: false, urls: [], reason: "terms page not found" };
  } catch (error) {
    logInfo("terms_check_failed", { jobId, stage: "terms" }, { error: String(error) });
    return { checked: false, found: false, urls: [], reason: "terms check failed" };
  }
}

function collectHints(values: Array<string | undefined | null>): string[] {
  const hints: string[] = [];
  values.forEach((value) => {
    if (!value) {
      return;
    }
    const normalized = value.toLowerCase();
    if (normalized.includes("logo") || normalized.includes("brand") || normalized.includes("crest") || normalized.includes("emblem")) {
      hints.push("logo");
    }
    if (normalized.includes("header") || normalized.includes("nav")) {
      hints.push("header");
    }
  });
  return Array.from(new Set(hints));
}

function fileName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split("/").pop() || "";
  } catch (error) {
    return "";
  }
}

function isLikelyImage(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("logo") ||
    /\.(png|jpe?g|svg|gif|webp)$/i.test(lower) ||
    lower.includes("brand")
  );
}

function pushImageCandidate(
  images: ImageCandidate[],
  seenImages: Set<string>,
  baseUrl: string,
  value: string,
  metadata: Omit<ImageCandidate, "url" | "fileNameHint">
) {
  if (images.length >= MAX_IMAGES) {
    return;
  }
  const url = resolveUrl(baseUrl, value);
  if (!url || seenImages.has(url)) {
    return;
  }
  seenImages.add(url);
  images.push({
    ...metadata,
    url,
    fileNameHint: fileName(url),
  });
}

function pickFromSrcSet(srcset?: string): string | null {
  if (!srcset) {
    return null;
  }
  const candidates = srcset
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!candidates.length) {
    return null;
  }
  const withDescriptors = candidates
    .map((item) => {
      const [url, descriptor] = item.split(/\s+/, 2);
      const score = descriptor?.endsWith("x")
        ? parseFloat(descriptor)
        : descriptor?.endsWith("w")
          ? parseInt(descriptor, 10) / 100
          : 1;
      return { url, score: Number.isFinite(score) ? score : 1 };
    })
    .filter((item) => Boolean(item.url))
    .sort((a, b) => b.score - a.score);
  return withDescriptors[0]?.url ?? null;
}

function collectJsonLdLogos(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  images: ImageCandidate[],
  seenImages: Set<string>
) {
  $("script[type='application/ld+json']").each((_i, el) => {
    if (images.length >= MAX_IMAGES) {
      return false;
    }
    const raw = $(el).text();
    if (!raw) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const urls = findJsonImageUrls(parsed, 0);
    for (const candidate of urls) {
      if (images.length >= MAX_IMAGES) {
        return false;
      }
      pushImageCandidate(images, seenImages, sourceUrl, candidate, {
        sourceUrl,
        context: "jsonld",
        hints: collectHints(["logo", "organization"]),
      });
    }
  });
}

function findJsonImageUrls(node: unknown, depth: number): string[] {
  if (depth > 5 || node == null) {
    return [];
  }
  if (typeof node === "string") {
    return isLikelyImage(node) || node.includes("/logo") ? [node] : [];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => findJsonImageUrls(item, depth + 1));
  }
  if (typeof node !== "object") {
    return [];
  }

  const result: string[] = [];
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase();
    if (["logo", "image", "icon", "contenturl", "thumbnailurl"].includes(lower)) {
      if (typeof value === "string") {
        result.push(value);
      } else if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        if (typeof nested.url === "string") {
          result.push(nested.url);
        }
        if (typeof nested.contentUrl === "string") {
          result.push(nested.contentUrl);
        }
      }
    }
    result.push(...findJsonImageUrls(value, depth + 1));
  }
  return Array.from(new Set(result));
}

function collectRootBrandAssets(startUrl: string, images: ImageCandidate[], seenImages: Set<string>) {
  try {
    const origin = new URL(startUrl).origin;
    const defaults = ["/favicon.ico", "/apple-touch-icon.png", "/logo.png", "/logo.svg"];
    for (const path of defaults) {
      if (images.length >= MAX_IMAGES) {
        return;
      }
      pushImageCandidate(images, seenImages, origin, path, {
        sourceUrl: origin,
        context: "root-default",
        hints: collectHints([path.includes("logo") ? "logo" : "icon"]),
      });
    }
  } catch {
    // ignore malformed start URL
  }
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
