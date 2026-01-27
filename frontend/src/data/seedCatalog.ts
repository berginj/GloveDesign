import type { Catalog, ComponentSelection, DesignInput, Personalization } from "./catalogTypes";
import { loadSeedCatalogData } from "./seedCatalogLoader";

export type SeedCatalog = Catalog;
export type CatalogDesign = DesignInput & {
  id: string;
  selectedOptions: Record<string, string>;
  componentSelections: ComponentSelection[];
  personalization: Personalization;
};

let cached: SeedCatalog | null = null;

export function loadSeedCatalog(): SeedCatalog {
  if (cached) {
    return cached;
  }
  cached = loadSeedCatalogData();
  return cached;
}
