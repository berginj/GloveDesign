import { useMemo, useState } from "react";
import { CatalogDesign, SeedCatalog } from "../../data/seedCatalog";

interface PatternStepProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  onUpdate: (path: string, value: string) => void;
}

export function PatternStep({ design, catalog, onUpdate }: PatternStepProps) {
  const [sizeFilter, setSizeFilter] = useState("all");
  const [webFilter, setWebFilter] = useState("all");

  const sizes = useMemo(() => Array.from(new Set(catalog.patterns.map((pattern) => pattern.size))), [catalog]);
  const webFamilies = useMemo(() => Array.from(new Set(catalog.patterns.map((pattern) => pattern.webFamily))), [catalog]);

  const patterns = useMemo(() => {
    let results = catalog.patterns.filter((pattern) => pattern.sport === design.sport);
    results = results.filter((pattern) => pattern.positions.includes(design.position));
    results = results.filter((pattern) => pattern.seriesId === design.seriesId);
    if (design.ageLevel === "youth") {
      const youth = results.filter((pattern) => pattern.seriesId.includes("youth"));
      if (youth.length) {
        results = youth;
      }
    }
    if (sizeFilter !== "all") {
      results = results.filter((pattern) => pattern.size === sizeFilter);
    }
    if (webFilter !== "all") {
      results = results.filter((pattern) => pattern.webFamily === webFilter);
    }
    return results;
  }, [catalog, design, sizeFilter, webFilter]);

  return (
    <div>
      <h3>Pattern & Size</h3>
      <div className="field-grid">
        <div>
          <label>Brand</label>
          <select value={design.brandId} onChange={(event) => onUpdate("brandId", event.target.value)}>
            {catalog.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Series</label>
          <select value={design.seriesId} onChange={(event) => onUpdate("seriesId", event.target.value)}>
            {catalog.series
              .filter((series) => series.brandId === design.brandId)
              .map((series) => (
                <option key={series.id} value={series.id}>
                  {series.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label>Pattern</label>
          <select value={design.patternId} onChange={(event) => onUpdate("patternId", event.target.value)}>
            {patterns.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.size} - {pattern.webFamily} - {pattern.typicalUse}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Filter Size</label>
          <select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}>
            <option value="all">All sizes</option>
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Filter Web</label>
          <select value={webFilter} onChange={(event) => setWebFilter(event.target.value)}>
            <option value="all">All webs</option>
            {webFamilies.map((web) => (
              <option key={web} value={web}>
                {web}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="summary">
        {patterns.length === 0 && <div>No patterns match the current filters.</div>}
        {patterns
          .filter((pattern) => pattern.id === design.patternId)
          .map((pattern) => (
            <div key={pattern.id}>
              <strong>{pattern.size}" {pattern.webFamily}</strong>
              <div>Use: {pattern.typicalUse}</div>
              <div>Pocket: {pattern.pocketDepth}</div>
              <div>Fit notes: {pattern.fitNotes}</div>
            </div>
          ))}
      </div>
    </div>
  );
}
