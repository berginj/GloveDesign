import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { ServiceBusClient, ServiceBusAdministrationClient } from "@azure/service-bus";
import { CosmosClient } from "@azure/cosmos";
import { TableClient } from "@azure/data-tables";

export function createBlobClient(blobUrl: string) {
  const connection = process.env.BLOB_CONNECTION_STRING;
  if (connection) {
    return BlobServiceClient.fromConnectionString(connection);
  }
  if (blobUrl.startsWith("DefaultEndpointsProtocol") || blobUrl.includes("AccountKey=")) {
    return BlobServiceClient.fromConnectionString(blobUrl);
  }
  const credential = new DefaultAzureCredential();
  return new BlobServiceClient(blobUrl, credential);
}

export function createServiceBusClient(namespace: string) {
  if (namespace.includes("Endpoint=sb://")) {
    return new ServiceBusClient(namespace);
  }
  const normalized = namespace.startsWith("https://") ? namespace.replace("https://", "") : namespace;
  const credential = new DefaultAzureCredential();
  return new ServiceBusClient(normalized, credential);
}

export function createServiceBusAdminClient(namespace: string) {
  if (namespace.includes("Endpoint=sb://")) {
    return new ServiceBusAdministrationClient(namespace);
  }
  const normalized = namespace.startsWith("https://") ? namespace.replace("https://", "") : namespace;
  const credential = new DefaultAzureCredential();
  return new ServiceBusAdministrationClient(normalized, credential);
}

export function createCosmosClient(endpoint: string) {
  if (endpoint.includes("AccountEndpoint=")) {
    return new CosmosClient(endpoint);
  }
  const credential = new DefaultAzureCredential();
  return new CosmosClient({ endpoint, aadCredentials: credential });
}

export function createTableClient(tableName: string, connectionString: string) {
  return TableClient.fromConnectionString(connectionString, tableName);
}
