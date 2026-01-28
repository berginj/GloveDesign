import { CatalogDesign, SeedCatalog } from "../../data/seedCatalog";
import { Option } from "../../data/catalogTypes";

interface MaterialsStepProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  availableOptions: Option[];
  onUpdate: (path: string, value: string) => void;
}

export function MaterialsStep({ design, catalog, availableOptions, onUpdate }: MaterialsStepProps) {
  const availableIds = new Set(availableOptions.map((option) => option.id));

  const optionsForGroup = (groupId: string) =>
    catalog.options.filter((option) => option.groupId === groupId).map((option) => ({
      ...option,
      unavailable: !availableIds.has(option.id),
    }));

  return (
    <div className="step-layout">
      <div className="step-header">
        <h3>Base Materials</h3>
        <p>Dial in the feel, break-in, and lining before you pick colors.</p>
      </div>
      <div className="section-card">
        <div className="field-grid">
          <div>
            <label>Leather Type</label>
            <select
              value={design.selectedOptions["leather-type"]}
              onChange={(event) => onUpdate("selectedOptions.leather-type", event.target.value)}
            >
              {optionsForGroup("leather-type").map((option) => (
                <option key={option.id} value={option.id} disabled={option.unavailable}>
                  {option.label}
                  {option.unavailable ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Overlay Material</label>
            <select
              value={design.selectedOptions["overlay-material"]}
              onChange={(event) => onUpdate("selectedOptions.overlay-material", event.target.value)}
            >
              {optionsForGroup("overlay-material").map((option) => (
                <option key={option.id} value={option.id} disabled={option.unavailable}>
                  {option.label}
                  {option.unavailable ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Lining</label>
            <select
              value={design.selectedOptions["lining-type"]}
              onChange={(event) => onUpdate("selectedOptions.lining-type", event.target.value)}
            >
              {optionsForGroup("lining-type").map((option) => (
                <option key={option.id} value={option.id} disabled={option.unavailable}>
                  {option.label}
                  {option.unavailable ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Padding Profile</label>
            <select
              value={design.selectedOptions["padding-profile"]}
              onChange={(event) => onUpdate("selectedOptions.padding-profile", event.target.value)}
            >
              {optionsForGroup("padding-profile").map((option) => (
                <option key={option.id} value={option.id} disabled={option.unavailable}>
                  {option.label}
                  {option.unavailable ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Break-In</label>
            <select
              value={design.selectedOptions["break-in"]}
              onChange={(event) => onUpdate("selectedOptions.break-in", event.target.value)}
            >
              {optionsForGroup("break-in").map((option) => (
                <option key={option.id} value={option.id} disabled={option.unavailable}>
                  {option.label}
                  {option.unavailable ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Stiffness</label>
            <select
              value={design.selectedOptions["stiffness"]}
              onChange={(event) => onUpdate("selectedOptions.stiffness", event.target.value)}
            >
              {optionsForGroup("stiffness").map((option) => (
                <option key={option.id} value={option.id} disabled={option.unavailable}>
                  {option.label}
                  {option.unavailable ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
