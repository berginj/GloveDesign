import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../../customizer/catalog";
import { buildDesignContext, getAvailableOptions } from "../../../customizer/optionEngine";
import { DesignInput } from "../../../customizer/types";

export async function getOptions(request: HttpRequest): Promise<HttpResponseInit> {
  const patternId = request.query.get("patternId");
  const brandId = request.query.get("brandId");
  const seriesId = request.query.get("seriesId");
  const sport = request.query.get("sport");
  const position = request.query.get("position");
  const throwHand = request.query.get("throwHand");
  const ageLevel = request.query.get("ageLevel");

  const catalog = loadCatalog();
  if (!patternId || !seriesId || !brandId || !sport || !position || !throwHand) {
    return {
      status: 400,
      jsonBody: { error: "patternId, brandId, seriesId, sport, position, throwHand are required." },
    };
  }

  const design: DesignInput = {
    sport: sport as any,
    position: position as any,
    throwHand: throwHand as any,
    ageLevel: ageLevel as any,
    brandId,
    seriesId,
    patternId,
    selectedOptions: {},
    componentSelections: [],
    version: catalog.version,
  };

  const context = buildDesignContext(design, catalog);
  const options = getAvailableOptions(catalog, context);

  return {
    status: 200,
    jsonBody: {
      optionGroups: catalog.optionGroups,
      options,
    },
  };
}

app.http("getCatalogOptions", {
  methods: ["GET"],
  authLevel: "function",
  route: "catalog/options",
  handler: getOptions,
});
