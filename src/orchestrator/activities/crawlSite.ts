import { crawlSite } from "../../crawl";
import { JobRequest } from "../../common/types";

export default async function crawlSiteActivity(input: JobRequest & { jobId: string }) {
  return crawlSite(input.teamUrl, input.jobId);
}
