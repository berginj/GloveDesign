import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../../customizer/catalog";

export async function getSeries(request: HttpRequest): Promise<HttpResponseInit> {
  const catalog = loadCatalog();
  const brandId = request.query.get("brandId");
  const results = brandId ? catalog.series.filter((item) => item.brandId === brandId) : catalog.series;
  return { status: 200, jsonBody: results };
}

app.http("getCatalogSeries", {
  methods: ["GET"],
  authLevel: "function",
  route: "catalog/series",
  handler: getSeries,
});
