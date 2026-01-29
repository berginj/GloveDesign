import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createJobStoreFromEnv } from "../../../common/jobStore";

export async function listJobs(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const limitParam = request.query.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam ?? "25", 10) || 25, 1), 100);
  const store = createJobStoreFromEnv();
  if (!store) {
    return { status: 500, jsonBody: { error: "Job store not configured." } };
  }
  await store.init();
  const jobs = await store.listRecent(limit);
  context.log(`Debug list returned ${jobs.length} jobs.`);
  return { status: 200, jsonBody: { count: jobs.length, jobs } };
}

app.http("debugListJobs", {
  methods: ["GET"],
  authLevel: "function",
  route: "debug/jobs",
  handler: listJobs,
});
