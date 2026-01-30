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
      retryCount?: number;
      lastRetryAt?: string;
      instanceId?: string;
    }
  ): Promise<void>;
  getJob(jobId: string): Promise<JobRecord | null>;
  listRecent(limit: number): Promise<JobRecord[]>;
  listStaleJobs(stages: JobStage[], olderThanIso: string, limit: number): Promise<JobRecord[]>;
  getLatestCompletedJobByTeamUrl(teamUrl: string): Promise<JobRecord | null>;
  getLatestJobByTeamUrl(teamUrl: string): Promise<JobRecord | null>;
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
      retryCount?: number;
      lastRetryAt?: string;
      instanceId?: string;
    } = {}
  ): Promise<void> {
    const { resource } = await this.container.item(jobId, jobId).read<JobRecord>();
    if (!resource) {
      return;
    }
    const now = new Date().toISOString();
    const stageTimestamps = { ...(resource.stageTimestamps ?? {}), [stage]: now };
    const updated: JobRecord = {
      ...resource,
      stage,
      updatedAt: now,
      stageTimestamps,
      outputs: updates.outputs ?? resource.outputs,
      error: updates.error ?? resource.error,
      errorDetails: updates.errorDetails ?? resource.errorDetails,
      autofillAttempted: updates.autofillAttempted ?? resource.autofillAttempted,
      autofillSucceeded: updates.autofillSucceeded ?? resource.autofillSucceeded,
      wizardWarnings: updates.wizardWarnings ?? resource.wizardWarnings,
      retryCount: updates.retryCount ?? resource.retryCount,
      lastRetryAt: updates.lastRetryAt ?? resource.lastRetryAt,
      instanceId: updates.instanceId ?? resource.instanceId,
    };
    await this.container.items.upsert(updated);
  }

  async getJob(jobId: string): Promise<JobRecord | null> {
    const { resource } = await this.container.item(jobId, jobId).read<JobRecord>();
    return resource ?? null;
  }

  async listRecent(limit: number): Promise<JobRecord[]> {
    const query = {
      query: "SELECT * FROM c ORDER BY c.updatedAt DESC OFFSET 0 LIMIT @limit",
      parameters: [{ name: "@limit", value: limit }],
    };
    const { resources } = await this.container.items.query<JobRecord>(query).fetchAll();
    return resources ?? [];
  }

  async listStaleJobs(stages: JobStage[], olderThanIso: string, limit: number): Promise<JobRecord[]> {
    if (!stages.length) {
      return [];
    }
    const query = {
      query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@stages, c.stage) AND c.updatedAt < @cutoff ORDER BY c.updatedAt ASC OFFSET 0 LIMIT @limit",
      parameters: [
        { name: "@stages", value: stages },
        { name: "@cutoff", value: olderThanIso },
        { name: "@limit", value: limit },
      ],
    };
    const { resources } = await this.container.items.query<JobRecord>(query).fetchAll();
    return resources ?? [];
  }

  async getLatestCompletedJobByTeamUrl(teamUrl: string): Promise<JobRecord | null> {
    const query = {
      query: "SELECT * FROM c WHERE c.teamUrl = @teamUrl AND c.stage = 'completed' ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 1",
      parameters: [{ name: "@teamUrl", value: teamUrl }],
    };
    const { resources } = await this.container.items.query<JobRecord>(query).fetchAll();
    return resources?.[0] ?? null;
  }

  async getLatestJobByTeamUrl(teamUrl: string): Promise<JobRecord | null> {
    const query = {
      query: "SELECT * FROM c WHERE c.teamUrl = @teamUrl ORDER BY c.updatedAt DESC OFFSET 0 LIMIT 1",
      parameters: [{ name: "@teamUrl", value: teamUrl }],
    };
    const { resources } = await this.container.items.query<JobRecord>(query).fetchAll();
    return resources?.[0] ?? null;
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
      teamUrl: job.teamUrl,
      mode: job.mode,
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
      retryCount?: number;
      lastRetryAt?: string;
      instanceId?: string;
    } = {}
  ): Promise<void> {
    const existing = await this.getJob(jobId);
    if (!existing) {
      return;
    }
    const now = new Date().toISOString();
    const stageTimestamps = { ...(existing.stageTimestamps ?? {}), [stage]: now };
    const updated: JobRecord = {
      ...existing,
      stage,
      updatedAt: now,
      stageTimestamps,
      outputs: updates.outputs ?? existing.outputs,
      error: updates.error ?? existing.error,
      errorDetails: updates.errorDetails ?? existing.errorDetails,
      autofillAttempted: updates.autofillAttempted ?? existing.autofillAttempted,
      autofillSucceeded: updates.autofillSucceeded ?? existing.autofillSucceeded,
      wizardWarnings: updates.wizardWarnings ?? existing.wizardWarnings,
      retryCount: updates.retryCount ?? existing.retryCount,
      lastRetryAt: updates.lastRetryAt ?? existing.lastRetryAt,
      instanceId: updates.instanceId ?? existing.instanceId,
    };

    await this.table.upsertEntity({
      partitionKey: "job",
      rowKey: jobId,
      teamUrl: updated.teamUrl,
      mode: updated.mode,
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

  async listRecent(limit: number): Promise<JobRecord[]> {
    const entities = this.table.listEntities<{ payload: string }>({
      queryOptions: { filter: "PartitionKey eq 'job'" },
    });
    const results: JobRecord[] = [];
    for await (const entity of entities) {
      if (entity.payload) {
        try {
          results.push(JSON.parse(entity.payload));
        } catch {
          // ignore bad payload
        }
      }
      if (results.length >= limit) {
        break;
      }
    }
    return results
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  async listStaleJobs(stages: JobStage[], olderThanIso: string, limit: number): Promise<JobRecord[]> {
    if (!stages.length) {
      return [];
    }
    const entities = this.table.listEntities<{ payload: string }>({
      queryOptions: { filter: "PartitionKey eq 'job'" },
    });
    const results: JobRecord[] = [];
    for await (const entity of entities) {
      if (!entity.payload) {
        continue;
      }
      try {
        const job = JSON.parse(entity.payload) as JobRecord;
        if (stages.includes(job.stage) && job.updatedAt < olderThanIso) {
          results.push(job);
        }
      } catch {
        // ignore bad payload
      }
    }
    return results
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, limit);
  }

  async getLatestCompletedJobByTeamUrl(teamUrl: string): Promise<JobRecord | null> {
    const escaped = teamUrl.replace(/'/g, "''");
    const entities = this.table.listEntities<{ payload: string }>({
      queryOptions: { filter: `PartitionKey eq 'job' and teamUrl eq '${escaped}' and stage eq 'completed'` },
    });
    let latest: JobRecord | null = null;
    for await (const entity of entities) {
      if (!entity.payload) {
        continue;
      }
      try {
        const job = JSON.parse(entity.payload) as JobRecord;
        if (!latest || job.updatedAt > latest.updatedAt) {
          latest = job;
        }
      } catch {
        // ignore bad payload
      }
    }
    return latest;
  }

  async getLatestJobByTeamUrl(teamUrl: string): Promise<JobRecord | null> {
    const escaped = teamUrl.replace(/'/g, "''");
    const entities = this.table.listEntities<{ payload: string }>({
      queryOptions: { filter: `PartitionKey eq 'job' and teamUrl eq '${escaped}'` },
    });
    let latest: JobRecord | null = null;
    for await (const entity of entities) {
      if (!entity.payload) {
        continue;
      }
      try {
        const job = JSON.parse(entity.payload) as JobRecord;
        if (!latest || job.updatedAt > latest.updatedAt) {
          latest = job;
        }
      } catch {
        // ignore bad payload
      }
    }
    return latest;
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
