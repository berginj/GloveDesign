import { createCosmosClient } from "../../common/azureClients";
import { CosmosJobStore } from "../../common/jobStore";
import { JobOutputs, JobStage } from "../../common/types";

export default async function updateJobStageActivity(input: { jobId: string; stage: JobStage; outputs?: JobOutputs; error?: string }) {
  const cosmosEndpoint = process.env.COSMOS_ENDPOINT;
  const cosmosDb = process.env.COSMOS_DATABASE || "glovejobs";
  const cosmosContainer = process.env.COSMOS_CONTAINER || "jobs";
  if (!cosmosEndpoint) {
    return;
  }
  const client = createCosmosClient(cosmosEndpoint);
  const store = new CosmosJobStore(client, cosmosDb, cosmosContainer);
  await store.init();
  await store.updateStage(input.jobId, input.stage, input.outputs, input.error);
}
