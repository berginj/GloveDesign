import { CatalogDesign, SeedCatalog } from "../data/seedCatalog";

export function buildInitialDesign(catalog: SeedCatalog): CatalogDesign {
  const defaultBrand = catalog.brands[0];
  const defaultSeries = catalog.series.find((item) => item.brandId === defaultBrand.id) ?? catalog.series[0];
  const defaultPattern = catalog.patterns.find((item) => item.seriesId === defaultSeries.id) ?? catalog.patterns[0];
  const selectedOptions: Record<string, string> = {};
  catalog.optionGroups.forEach((group) => {
    if (group.defaultOptionId) {
      selectedOptions[group.id] = group.defaultOptionId;
    }
  });

  const componentSelections = defaultPattern.allowedComponents.map((componentId) => ({
    componentId,
    colorId: catalog.colors[0].id,
  }));

  return {
    id: "draft",
    sport: defaultPattern.sport,
    position: defaultPattern.positions[0],
    throwHand: "RHT",
    ageLevel: "adult",
    brandId: defaultBrand.id,
    seriesId: defaultSeries.id,
    patternId: defaultPattern.id,
    selectedOptions,
    componentSelections,
    version: catalog.version,
    personalization: {
      nameLine1: "",
      nameLine2: "",
      number: "",
      specialInstructions: "",
    },
  };
}

export function updateDesignField(design: CatalogDesign, path: string, value: string, catalog?: SeedCatalog): CatalogDesign {
  const updated = structuredClone(design);
  const parts = path.split(".");
  let current: any = updated;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
  if (catalog) {
    if (path === "brandId") {
      const nextSeries = catalog.series.find((series) => series.brandId === value) ?? catalog.series[0];
      updated.seriesId = nextSeries.id;
    }
    if (path === "seriesId") {
      const series = catalog.series.find((item) => item.id === value);
      if (series) {
        updated.brandId = series.brandId;
      }
    }
    if (["patternId", "sport", "position", "brandId", "seriesId"].includes(path)) {
      const nextPattern =
        path === "patternId"
          ? catalog.patterns.find((item) => item.id === value)
          : selectPatternForDesign(updated, catalog);
      if (nextPattern) {
        updated.patternId = nextPattern.id;
        updated.sport = nextPattern.sport;
        if (!nextPattern.positions.includes(updated.position)) {
          updated.position = nextPattern.positions[0];
        }
        updated.seriesId = nextPattern.seriesId;
        const series = catalog.series.find((item) => item.id === nextPattern.seriesId);
        if (series) {
          updated.brandId = series.brandId;
        }
        updated.componentSelections = nextPattern.allowedComponents.map((componentId) => ({
          componentId,
          colorId: updated.componentSelections[0]?.colorId ?? catalog.colors[0].id,
        }));
      }
    }
  }
  return updated;
}

export function summarizeDesign(design: CatalogDesign, catalog: SeedCatalog): string {
  const pattern = catalog.patterns.find((item) => item.id === design.patternId);
  const series = catalog.series.find((item) => item.id === design.seriesId);
  const brand = catalog.brands.find((item) => item.id === design.brandId);
  return [
    `Brand: ${brand?.name ?? ""}`,
    `Series: ${series?.name ?? ""}`,
    `Pattern: ${pattern?.size ?? ""} ${pattern?.webFamily ?? ""}`,
    `Sport/Position: ${design.sport} / ${design.position}`,
    `Throw: ${design.throwHand}`,
    `Age Level: ${design.ageLevel}`,
  ].join("\n");
}

function selectPatternForDesign(design: CatalogDesign, catalog: SeedCatalog) {
  let candidates = catalog.patterns;
  if (design.seriesId) {
    candidates = candidates.filter((pattern) => pattern.seriesId === design.seriesId);
  }
  if (design.sport) {
    candidates = candidates.filter((pattern) => pattern.sport === design.sport);
  }
  if (design.position) {
    candidates = candidates.filter((pattern) => pattern.positions.includes(design.position));
  }
  if (candidates.length) {
    return candidates[0];
  }
  if (design.sport && design.position) {
    const bySport = catalog.patterns.filter(
      (pattern) => pattern.sport === design.sport && pattern.positions.includes(design.position)
    );
    if (bySport.length) {
      return bySport[0];
    }
  }
  if (design.seriesId) {
    const bySeries = catalog.patterns.filter((pattern) => pattern.seriesId === design.seriesId);
    if (bySeries.length) {
      return bySeries[0];
    }
  }
  return catalog.patterns[0];
}
