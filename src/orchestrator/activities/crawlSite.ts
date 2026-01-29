import { crawlSite } from "../../crawl";
import { JobRequest } from "../../common/types";

const CRAWL_TIMEOUT_MS = 120000; // 2 minutes

export default async function crawlSiteActivity(input: JobRequest & { jobId: string }) {
  return Promise.race([
    crawlSite(input.teamUrl, input.jobId),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Crawl timeout: Site took too long to crawl (2 min limit)")), CRAWL_TIMEOUT_MS)
    ),
  ]);
}
