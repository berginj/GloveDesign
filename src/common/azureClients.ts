import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient } from "@azure/storage-blob";
import { ServiceBusClient } from "@azure/service-bus";
import { CosmosClient } from "@azure/cosmos";

export function createBlobClient(blobUrl: string) {
  const credential = new DefaultAzureCredential();
  return new BlobServiceClient(blobUrl, credential);
}

export function createServiceBusClient(namespace: string) {
  const credential = new DefaultAzureCredential();
  return new ServiceBusClient(namespace, credential);
}

export function createCosmosClient(endpoint: string) {
  const credential = new DefaultAzureCredential();
  return new CosmosClient({ endpoint, aadCredentials: credential });
}
