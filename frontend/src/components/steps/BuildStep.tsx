import { CatalogDesign, SeedCatalog } from "../../data/seedCatalog";
import { Option } from "../../data/catalogTypes";

interface BuildStepProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
  availableOptions: Option[];
  onUpdate: (path: string, value: string) => void;
}

const buildGroups = [
  "web-type",
  "back-style",
  "wrist-fit",
  "welting-style",
  "lace-length",
  "pocket-depth",
  "finger-shift",
  "lace-two-tone",
  "thumb-pad",
  "pinky-pad",
  "extra-heel-pad",
];

export function BuildStep({ design, catalog, availableOptions, onUpdate }: BuildStepProps) {
  const availableIds = new Set(availableOptions.map((option) => option.id));
  return (
    <div className="step-layout">
      <div className="step-header">
        <h3>
          <span className="step-icon">◈</span>
          Build Options
        </h3>
        <p>Set web type, wrist fit, padding add-ons, and lace details.</p>
      </div>
      <div className="section-card">
        <div className="field-grid">
          {buildGroups.map((groupId) => (
            <div key={groupId}>
              <label>{catalog.optionGroups.find((group) => group.id === groupId)?.name}</label>
              <select
                value={design.selectedOptions[groupId]}
                onChange={(event) => onUpdate(`selectedOptions.${groupId}`, event.target.value)}
              >
                {catalog.options
                  .filter((option) => option.groupId === groupId)
                  .map((option) => (
                    <option key={option.id} value={option.id} disabled={!availableIds.has(option.id)}>
                      {option.label}
                      {!availableIds.has(option.id) ? " (unavailable)" : ""}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
