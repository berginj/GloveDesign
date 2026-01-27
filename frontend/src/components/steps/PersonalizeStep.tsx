import { CatalogDesign, SeedCatalog } from "../../data/seedCatalog";
import { Option } from "../../data/catalogTypes";

interface PersonalizeStepProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  availableOptions: Option[];
  onUpdate: (path: string, value: string) => void;
}

export function PersonalizeStep({ design, catalog, availableOptions, onUpdate }: PersonalizeStepProps) {
  const availableIds = new Set(availableOptions.map((option) => option.id));

  const optionsForGroup = (groupId: string) =>
    catalog.options.filter((option) => option.groupId === groupId).map((option) => ({
      ...option,
      unavailable: !availableIds.has(option.id),
    }));

  return (
    <div>
      <h3>Personalization</h3>
      <div className="field-grid">
        <div>
          <label>Name Embroidery</label>
          <select
            value={design.selectedOptions["name-embroidery"]}
            onChange={(event) => onUpdate("selectedOptions.name-embroidery", event.target.value)}
          >
            {optionsForGroup("name-embroidery").map((option) => (
              <option key={option.id} value={option.id} disabled={option.unavailable}>
                {option.label}
                {option.unavailable ? " (unavailable)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Name Line 1</label>
          <input value={design.personalization.nameLine1} onChange={(event) => onUpdate("personalization.nameLine1", event.target.value)} />
        </div>
        <div>
          <label>Name Line 2</label>
          <input value={design.personalization.nameLine2} onChange={(event) => onUpdate("personalization.nameLine2", event.target.value)} />
        </div>
        <div>
          <label>Number Embroidery</label>
          <select
            value={design.selectedOptions["number-embroidery"]}
            onChange={(event) => onUpdate("selectedOptions.number-embroidery", event.target.value)}
          >
            {optionsForGroup("number-embroidery").map((option) => (
              <option key={option.id} value={option.id} disabled={option.unavailable}>
                {option.label}
                {option.unavailable ? " (unavailable)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Jersey Number</label>
          <input value={design.personalization.number} onChange={(event) => onUpdate("personalization.number", event.target.value)} />
        </div>
        <div>
          <label>Palm Stamp</label>
          <select
            value={design.selectedOptions["palm-stamp"]}
            onChange={(event) => onUpdate("selectedOptions.palm-stamp", event.target.value)}
          >
            {optionsForGroup("palm-stamp").map((option) => (
              <option key={option.id} value={option.id} disabled={option.unavailable}>
                {option.label}
                {option.unavailable ? " (unavailable)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Patch/Emblem</label>
          <select
            value={design.selectedOptions["patch-select"]}
            onChange={(event) => onUpdate("selectedOptions.patch-select", event.target.value)}
          >
            {optionsForGroup("patch-select").map((option) => (
              <option key={option.id} value={option.id} disabled={option.unavailable}>
                {option.label}
                {option.unavailable ? " (unavailable)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Special Instructions</label>
          <textarea
            value={design.personalization.specialInstructions}
            onChange={(event) => onUpdate("personalization.specialInstructions", event.target.value)}
          />
        </div>
        <div>
          <label>Custom Logo Upload</label>
          <input type="file" disabled />
        </div>
      </div>
    </div>
  );
}
