import version from "./version.json";
import brands from "./brands.json";
import series from "./series.json";
import patternFamilies from "./pattern-families.json";
import patterns from "./patterns.json";
import components from "./components.json";
import colors from "./colors.json";
import materials from "./materials.json";
import optionGroups from "./option-groups.json";
import options from "./options.json";
import { Catalog } from "../types";

let cached: Catalog | null = null;

export function loadCatalog(): Catalog {
  if (cached) {
    return cached;
  }
  cached = {
    version: version.version,
    brands,
    series,
    patternFamilies,
    patterns,
    components,
    colors,
    materials,
    optionGroups,
    options,
  };
  return cached;
}
