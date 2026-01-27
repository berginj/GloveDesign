import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../../customizer/catalog";

export async function getPatterns(request: HttpRequest): Promise<HttpResponseInit> {
  const catalog = loadCatalog();
  const sport = request.query.get("sport");
  const position = request.query.get("position");
  const ageLevel = request.query.get("ageLevel");
  const throwHand = request.query.get("throwHand");
  const brandId = request.query.get("brandId");
  const seriesId = request.query.get("seriesId");
  const size = request.query.get("size");
  const webType = request.query.get("webType");

  let results = catalog.patterns;
  if (sport) {
    results = results.filter((pattern) => pattern.sport === sport);
  }
  if (position) {
    results = results.filter((pattern) => pattern.positions.includes(position as any));
  }
  if (seriesId) {
    results = results.filter((pattern) => pattern.seriesId === seriesId);
  }
  if (brandId) {
    const seriesIds = catalog.series.filter((series) => series.brandId === brandId).map((series) => series.id);
    results = results.filter((pattern) => seriesIds.includes(pattern.seriesId));
  }
  if (size) {
    results = results.filter((pattern) => pattern.size === size);
  }
  if (webType) {
    results = results.filter((pattern) => pattern.allowedWebTypes.includes(webType));
  }

  if (ageLevel) {
    // Example: prioritize youth patterns when filtering; not a hard block.
    results = results.sort((a, b) => (a.seriesId.includes("youth") === b.seriesId.includes("youth") ? 0 : a.seriesId.includes("youth") ? -1 : 1));
  }
  if (throwHand) {
    // Placeholder: left-hand throw support can be used for future filtering.
  }

  return { status: 200, jsonBody: results };
}

app.http("getCatalogPatterns", {
  methods: ["GET"],
  authLevel: "function",
  route: "catalog/patterns",
  handler: getPatterns,
});
