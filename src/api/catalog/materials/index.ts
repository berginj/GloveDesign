import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../../customizer/catalog";

export async function getMaterials(_request: HttpRequest): Promise<HttpResponseInit> {
  const catalog = loadCatalog();
  return { status: 200, jsonBody: catalog.materials };
}

app.http("getCatalogMaterials", {
  methods: ["GET"],
  authLevel: "function",
  route: "catalog/materials",
  handler: getMaterials,
});
