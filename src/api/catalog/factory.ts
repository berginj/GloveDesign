import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog, Catalog } from "../../customizer/catalog";

/**
 * Generic factory function to create catalog endpoints
 * Eliminates duplication across catalog API routes
 */
export function createCatalogEndpoint<K extends keyof Catalog>(
  catalogKey: K,
  functionName: string,
  route: string
): void {
  const handler = async (_request: HttpRequest): Promise<HttpResponseInit> => {
    const catalog = loadCatalog();
    return {
      status: 200,
      jsonBody: catalog[catalogKey],
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300", // Cache for 5 minutes
      },
    };
  };

  app.http(functionName, {
    methods: ["GET"],
    authLevel: "function",
    route,
    handler,
  });
}
