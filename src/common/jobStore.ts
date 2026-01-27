import { CosmosClient, Container } from "@azure/cosmos";
import { TableClient } from "@azure/data-tables";
import { createCosmosClient, createTableClient } from "./azureClients";
import { JobOutputs, JobRecord, JobStage } from "./types";

export interface JobStore {
  init(): Promise<void>;
  upsertJob(job: JobRecord): Promise<void>;
  updateStage(
    jobId: string,
    stage: JobStage,
    updates?: {
      outputs?: JobOutputs;
      error?: string;
      errorDetails?: string;
      autofillAttempted?: boolean;
      autofillSucceeded?: boolean;
      wizardWarnings?: string[];
    }
  ): Promise<void>;
  getJob(jobId: string): Promise<JobRecord | null>;
}

export class CosmosJobStore implements JobStore {
  private client: CosmosClient;
  private databaseId: string;
  private containerId: string;
  private container: Container;

  constructor(client: CosmosClient, databaseId: string, containerId: string) {
    this.client = client;
    this.databaseId = databaseId;
    this.containerId = containerId;
    this.container = client.database(databaseId).container(containerId);
  }

  async init(): Promise<void> {
    const { database } = await this.client.databases.createIfNotExists({ id: this.databaseId });
    await database.containers.createIfNotExists({ id: this.containerId, partitionKey: "/jobId" });
    this.container = database.container(this.containerId);
  }

  async upsertJob(job: JobRecord): Promise<void> {
    await this.container.items.upsert(job);
  }

  async updateStage(
    jobId: string,
    stage: JobStage,
    updates: {
      outputs?: JobOutputs;
      error?: string;
      errorDetails?: string;
      autofillAttempted?: boolean;
      autofillSucceeded?: boolean;
      wizardWarnings?: string[];
    } = {}
  ): Promise<void> {
    const { resource } = await this.container.item(jobId, jobId).read<JobRecord>();
    if (!resource) {
      return;
    }
    const updated: JobRecord = {
      ...resource,
      stage,
      updatedAt: new Date().toISOString(),
      outputs: updates.outputs ?? resource.outputs,
      error: updates.error ?? resource.error,
      errorDetails: updates.errorDetails ?? resource.errorDetails,
      autofillAttempted: updates.autofillAttempted ?? resource.autofillAttempted,
      autofillSucceeded: updates.autofillSucceeded ?? resource.autofillSucceeded,
      wizardWarnings: updates.wizardWarnings ?? resource.wizardWarnings,
    };
    await this.container.items.upsert(updated);
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    const { resource } = await this.container.item(jobId, jobId).read<JobRecord>();
    return resource ?? null;
  }
}

export class TableJobStore implements JobStore {
  private table: TableClient;

  constructor(client: TableClient) {
    this.table = client;
  }

  async init(): Promise<void> {
    try {
      await this.table.createTable();
    } catch (error) {
      // Table may already exist.
    }
  }

  async upsertJob(job: JobRecord): Promise<void> {
    await this.table.upsertEntity({
      partitionKey: "job",
      rowKey: job.jobId,
      stage: job.stage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      payload: JSON.stringify(job),
    });
  }

  async updateStage(
    jobId: string,
    stage: JobStage,
    updates: {
      outputs?: JobOutputs;
      error?: string;
      errorDetails?: string;
      autofillAttempted?: boolean;
      autofillSucceeded?: boolean;
      wizardWarnings?: string[];
    } = {}
  ): Promise<void> {
    const existing = await this.getJob(jobId);
    if (!existing) {
      return;
    }
    const updated: JobRecord = {
      ...existing,
      stage,
      updatedAt: new Date().toISOString(),
      outputs: updates.outputs ?? existing.outputs,
      error: updates.error ?? existing.error,
      errorDetails: updates.errorDetails ?? existing.errorDetails,
      autofillAttempted: updates.autofillAttempted ?? existing.autofillAttempted,
      autofillSucceeded: updates.autofillSucceeded ?? existing.autofillSucceeded,
      wizardWarnings: updates.wizardWarnings ?? existing.wizardWarnings,
    };

    await this.table.upsertEntity({
      partitionKey: "job",
      rowKey: jobId,
      stage: updated.stage,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      payload: JSON.stringify(updated),
    });
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    try {
      const entity = await this.table.getEntity<{ payload: string }>("job", jobId);
      return JSON.parse(entity.payload) as JobRecord;
    } catch (error) {
      return null;
    }
  }
}

export function resolveTableConnectionString(): string | null {
  return (
    process.env.TABLE_CONNECTION_STRING ||
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AZUREWEBJOBSSTORAGE ||
    process.env.AzureWebJobsStorage ||
    null
  );
}

export function createJobStoreFromEnv(): JobStore | null {
  const cosmosEndpoint = process.env.COSMOS_ENDPOINT || process.env.COSMOS_CONNECTION_STRING;
  const cosmosDb = process.env.COSMOS_DATABASE || "glovejobs";
  const cosmosContainer = process.env.COSMOS_CONTAINER || "jobs";
  if (cosmosEndpoint) {
    const client = createCosmosClient(cosmosEndpoint);
    return new CosmosJobStore(client, cosmosDb, cosmosContainer);
  }

  const tableConnection = resolveTableConnectionString();
  if (tableConnection) {
    const tableName = process.env.TABLE_NAME || "jobs";
    const client = createTableClient(tableName, tableConnection);
    return new TableJobStore(client);
  }

  return null;
}
