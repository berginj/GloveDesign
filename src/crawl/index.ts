import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { CrawlReport, ImageCandidate } from "../common/types";
import { logInfo, logWarn } from "../common/logging";

const MAX_IMAGES = 30;
const MAX_PAGES = 3;

export async function crawlSite(startUrl: string, jobId?: string): Promise<CrawlReport> {
  const visited: string[] = [];
  const skipped: string[] = [];
  const imageCandidates: ImageCandidate[] = [];
  const cssUrls: string[] = [];
  const notes: string[] = [];

  const robotsAllowed = await checkRobots(startUrl);
  if (!robotsAllowed) {
    notes.push("robots.txt disallows crawling. Proposal-only mode recommended.");
    return { startUrl, visited, skipped, imageCandidates, cssUrls, notes };
  }

  const queue = [startUrl];
  const seen = new Set<string>();

  while (queue.length > 0 && visited.length < MAX_PAGES && imageCandidates.length < MAX_IMAGES) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);
    try {
      const response = await axios.get(current, { timeout: 15000 });
      visited.push(current);
      const $ = cheerio.load(response.data);
      collectImages($, current, imageCandidates);
      collectMetaImages($, current, imageCandidates);
      collectInlineBackgrounds($, current, imageCandidates);
      collectStylesheets($, current, cssUrls);
      const links = collectLinks($, current, startUrl);
      for (const link of links) {
        if (queue.length + visited.length < MAX_PAGES && !seen.has(link)) {
          queue.push(link);
        }
      }
    } catch (error) {
      skipped.push(current);
      logWarn("crawl_failed", { jobId }, { url: current });
    }
  }

  return { startUrl, visited, skipped, imageCandidates, cssUrls, notes };
}

function collectImages($: cheerio.CheerioAPI, sourceUrl: string, images: ImageCandidate[]) {
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
    images.push({
      url,
      sourceUrl,
      altText: $(el).attr("alt"),
      context: $(el).closest("header,nav,section,main").prop("tagName")?.toLowerCase(),
      width: parseInt($(el).attr("width") || "", 10) || undefined,
      height: parseInt($(el).attr("height") || "", 10) || undefined,
      hints: [],
    });
  });
}

function collectMetaImages($: cheerio.CheerioAPI, sourceUrl: string, images: ImageCandidate[]) {
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
      images.push({
        url,
        sourceUrl,
        altText: name,
        context: "meta",
        hints: [name],
      });
    });
  }
}

function collectInlineBackgrounds($: cheerio.CheerioAPI, sourceUrl: string, images: ImageCandidate[]) {
  $("[style*='background']").each((_i, el) => {
    if (images.length >= MAX_IMAGES) {
      return false;
    }
    const style = $(el).attr("style") || "";
    const match = /background-image:\s*url\(['"]?(.*?)['"]?\)/i.exec(style);
    if (!match) {
      return;
    }
    const url = resolveUrl(sourceUrl, match[1]);
    if (!url) {
      return;
    }
    images.push({
      url,
      sourceUrl,
      context: "inline-style",
      hints: ["background-image"],
    });
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
    if (/about|team|club|baseball|home/i.test(linkUrl.pathname)) {
      links.push(linkUrl.toString());
    }
  });
  return links.slice(0, MAX_PAGES);
}

function collectStylesheets($: cheerio.CheerioAPI, sourceUrl: string, cssUrls: string[]) {
  $("link[rel='stylesheet']").each((_i, el) => {
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

function resolveUrl(base: string, value: string): string | null {
  try {
    return new URL(value, base).toString();
  } catch (error) {
    return null;
  }
}

async function checkRobots(startUrl: string): Promise<boolean> {
  try {
    const url = new URL(startUrl);
    const robotsUrl = `${url.origin}/robots.txt`;
    const response = await axios.get(robotsUrl, { timeout: 8000 });
    const text = response.data as string;
    if (!text) {
      return true;
    }
    const disallowAll = /User-agent:\s*\*([\s\S]*?)Disallow:\s*\//i.exec(text);
    if (disallowAll) {
      return false;
    }
    return true;
  } catch (error) {
    return true;
  }
}
