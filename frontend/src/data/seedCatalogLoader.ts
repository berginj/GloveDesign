import version from "../../../src/customizer/catalog/version.json";
import brands from "../../../src/customizer/catalog/brands.json";
import series from "../../../src/customizer/catalog/series.json";
import patternFamilies from "../../../src/customizer/catalog/pattern-families.json";
import patterns from "../../../src/customizer/catalog/patterns.json";
import components from "../../../src/customizer/catalog/components.json";
import colors from "../../../src/customizer/catalog/colors.json";
import materials from "../../../src/customizer/catalog/materials.json";
import optionGroups from "../../../src/customizer/catalog/option-groups.json";
import options from "../../../src/customizer/catalog/options.json";
import type { Catalog } from "./catalogTypes";

export function loadSeedCatalogData(): Catalog {
  return {
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
}
