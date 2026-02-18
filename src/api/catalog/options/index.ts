import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../../customizer/catalog";
import { buildDesignContext, getAvailableOptions } from "../../../customizer/optionEngine";
import { DesignInput, Sport, Position, ThrowHand, AgeLevel } from "../../../customizer/types";
import { ApiResponse } from "../../../common/apiHelpers";

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
    return ApiResponse.badRequest("patternId, brandId, seriesId, sport, position, throwHand are required.");
  }

  // Validate enum values
  const validSports: Sport[] = ["baseball", "fastpitch", "slowpitch"];
  const validPositions: Position[] = ["infield", "outfield", "pitcher", "catcher", "first_base", "utility", "trainer"];
  const validThrowHands: ThrowHand[] = ["RHT", "LHT"];
  const validAgeLevels: AgeLevel[] = ["youth", "teen", "adult", "pro"];

  if (!validSports.includes(sport as Sport)) {
    return ApiResponse.badRequest(`Invalid sport. Must be one of: ${validSports.join(", ")}`);
  }
  if (!validPositions.includes(position as Position)) {
    return ApiResponse.badRequest(`Invalid position. Must be one of: ${validPositions.join(", ")}`);
  }
  if (!validThrowHands.includes(throwHand as ThrowHand)) {
    return ApiResponse.badRequest(`Invalid throwHand. Must be one of: ${validThrowHands.join(", ")}`);
  }
  if (ageLevel && !validAgeLevels.includes(ageLevel as AgeLevel)) {
    return ApiResponse.badRequest(`Invalid ageLevel. Must be one of: ${validAgeLevels.join(", ")}`);
  }

  const design: DesignInput = {
    sport: sport as Sport,
    position: position as Position,
    throwHand: throwHand as ThrowHand,
    ageLevel: ageLevel as AgeLevel | undefined,
    brandId,
    seriesId,
    patternId,
    selectedOptions: {},
    componentSelections: [],
    version: catalog.version,
  };

  const context = buildDesignContext(design, catalog);
  const options = getAvailableOptions(catalog, context);

  return ApiResponse.ok({
    optionGroups: catalog.optionGroups,
    options,
  });
}

app.http("getCatalogOptions", {
  methods: ["GET"],
  authLevel: "function",
  route: "catalog/options",
  handler: getOptions,
});
