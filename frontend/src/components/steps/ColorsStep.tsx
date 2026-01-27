import { CatalogDesign, SeedCatalog } from "../../data/seedCatalog";

interface ColorsStepProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  onUpdate: (path: string, value: string) => void;
}

export function ColorsStep({ design, catalog, onUpdate }: ColorsStepProps) {
  return (
    <div>
      <h3>Component Colors</h3>
      <div className="field-grid">
        {design.componentSelections.map((selection, index) => (
          <div key={selection.componentId}>
            <label>{catalog.components.find((component) => component.id === selection.componentId)?.name}</label>
            <select
              value={selection.colorId}
              onChange={(event) => onUpdate(`componentSelections.${index}.colorId`, event.target.value)}
            >
              {catalog.colors.map((color) => (
                <option key={color.id} value={color.id}>
                  {color.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
