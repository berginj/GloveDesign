import { CosmosClient, Container } from "@azure/cosmos";
import { JobRecord, JobStage, JobOutputs } from "./types";

export class CosmosJobStore {
  private container: Container;

  constructor(client: CosmosClient, databaseId: string, containerId: string) {
    this.container = client.database(databaseId).container(containerId);
  }

  async init(): Promise<void> {
    await this.container.database.createIfNotExists({ id: this.container.database.id });
    await this.container.database.containers.createIfNotExists({ id: this.container.id, partitionKey: "/jobId" });
  }

  async upsertJob(job: JobRecord): Promise<void> {
    await this.container.items.upsert(job);
  }

  async updateStage(jobId: string, stage: JobStage, outputs?: JobOutputs, error?: string): Promise<void> {
    const { resource } = await this.container.item(jobId, jobId).read<JobRecord>();
    if (!resource) {
      return;
    }
    const updated: JobRecord = {
      ...resource,
      stage,
      updatedAt: new Date().toISOString(),
      outputs: outputs ?? resource.outputs,
      error,
    };
    await this.container.items.upsert(updated);
  }
}
