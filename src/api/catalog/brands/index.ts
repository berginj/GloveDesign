import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../../customizer/catalog";

export async function getBrands(_request: HttpRequest): Promise<HttpResponseInit> {
  const catalog = loadCatalog();
  return { status: 200, jsonBody: catalog.brands };
}

app.http("getCatalogBrands", {
  methods: ["GET"],
  authLevel: "function",
  route: "catalog/brands",
  handler: getBrands,
});
