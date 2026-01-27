import * as cheerio from "cheerio";
import { URL } from "url";
import { CrawlReport, ImageCandidate } from "../common/types";
import { logInfo, logWarn } from "../common/logging";
import { FetchBudget, safeFetchText, sleep } from "../common/http";

const MAX_IMAGES = 30;
const MAX_PAGES = 3;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_CSS_FILES = 4;
const REQUEST_DELAY_MS = 150;

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
      collectInlineBackgrounds($, response.url, imageCandidates, seenImages);
      collectSvgReferences($, response.url, imageCandidates, seenImages);
      collectInlineStyles($, inlineStyles);
      collectStylesheets($, response.url, cssUrls, MAX_CSS_FILES);
      await collectCssBackgrounds(cssUrls, seenCss, imageCandidates, seenImages, budget, jobId);
      const links = collectLinks($, current, startUrl);
      for (const link of links) {
        if (queue.length + visited.length < MAX_PAGES && !seen.has(link)) {
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
    const src = $(el).attr("src");
    if (!src) {
      return;
    }
    const url = resolveUrl(sourceUrl, src);
    if (!url) {
      return;
    }
    if (seenImages.has(url)) {
      return;
    }
    seenImages.add(url);
    const alt = $(el).attr("alt");
    const classHint = $(el).attr("class");
    images.push({
      url,
      sourceUrl,
      altText: alt,
      context: $(el).closest("header,nav,section,main").prop("tagName")?.toLowerCase(),
      width: parseInt($(el).attr("width") || "", 10) || undefined,
      height: parseInt($(el).attr("height") || "", 10) || undefined,
      fileNameHint: fileName(url),
      hints: collectHints([alt, classHint, $(el).attr("id")]),
    });
  });
}

function collectMetaImages(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  images: ImageCandidate[],
  seenImages: Set<string>
) {
  const metas = ["og:image", "twitter:image", "apple-touch-icon", "icon", "shortcut icon"];
  for (const name of metas) {
    const selector = name.includes("icon") ? `link[rel~='${name}']` : `meta[property='${name}'], meta[name='${name}']`;
    $(selector).each((_i, el) => {
      if (images.length >= MAX_IMAGES) {
        return false;
      }
      const content = $(el).attr("content") || $(el).attr("href");
      if (!content) {
        return;
      }
      const url = resolveUrl(sourceUrl, content);
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
        altText: name,
        context: "meta",
        fileNameHint: fileName(url),
        hints: collectHints([name]),
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
  const links: string[] = [];
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
    if (/about|team|club|baseball|home|program|organization|brand/i.test(linkUrl.pathname)) {
      links.push(linkUrl.toString());
    }
  });
  return links.slice(0, MAX_PAGES);
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
      const matches = Array.from(response.data.matchAll(/url\(['"]?(.*?)['"]?\)/gi)).map((match) => match[1]);
      for (const value of matches) {
        if (images.length >= MAX_IMAGES) {
          return;
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
    if (text && inlineStyles.length < 5) {
      inlineStyles.push(text.slice(0, 10000));
    }
  });
  $("[style]").each((_i, el) => {
    if (inlineStyles.length >= 100) {
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
    const disallowRules = Array.from(ruleBlock[1].matchAll(/Disallow:\s*(.*)/gi))
      .map((match) => match[1].trim())
      .filter(Boolean);
    const allowRules = Array.from(ruleBlock[1].matchAll(/Allow:\s*(.*)/gi))
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
