import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../../customizer/catalog";

export async function getColors(_request: HttpRequest): Promise<HttpResponseInit> {
  const catalog = loadCatalog();
  return { status: 200, jsonBody: catalog.colors };
}

app.http("getCatalogColors", {
  methods: ["GET"],
  authLevel: "function",
  route: "catalog/colors",
  handler: getColors,
});
