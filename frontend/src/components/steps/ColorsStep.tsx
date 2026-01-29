import { CatalogDesign, SeedCatalog } from "../../data/seedCatalog";
import { getAllowedColorsForComponent, getPaletteAvailabilityForComponent } from "../../engine/optionEngine";

interface ColorsStepProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  onUpdate: (path: string, value: string | boolean) => void;
}

export function ColorsStep({ design, catalog, onUpdate }: ColorsStepProps) {
  const paletteMap = new Map(catalog.colorPalettes.map((palette) => [palette.id, palette]));
  return (
    <div className="step-layout">
      <div className="step-header">
        <h3>
          <span className="step-icon">◐</span>
          Component Colors
        </h3>
        <p>Mix and match colors for every panel, lace, and accent.</p>
      </div>
      <div className="section-card">
        <div className="field-grid">
          {design.componentSelections.map((selection, index) => {
            const allowedColors = getAllowedColorsForComponent(design, catalog, selection.componentId);
            const availability = getPaletteAvailabilityForComponent(design, catalog, selection.componentId);
            const paletteNames = availability.allowedPaletteIds.map((id) => paletteMap.get(id)?.name ?? id);
            return (
              <div key={selection.componentId}>
                <label>{catalog.components.find((component) => component.id === selection.componentId)?.name}</label>
                <select
                  value={selection.colorId}
                  onChange={(event) => onUpdate(`componentSelections.${index}.colorId`, event.target.value)}
                >
                  {allowedColors.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.name}
                    </option>
                  ))}
                </select>
                {availability.allowedPaletteIds.length > 0 && (
                  <div className="summary">
                    Palette focus: {paletteNames.join(", ")}. Showing {allowedColors.length} colors.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
