import { CatalogDesign } from "../../data/seedCatalog";

interface StartStepProps {
  design: CatalogDesign;
  onUpdate: (path: string, value: string) => void;
}

export function StartStep({ design, onUpdate }: StartStepProps) {
  return (
    <div className="step-layout">
      <div className="step-header">
        <h3>Start</h3>
        <p>Choose the basics so we can filter patterns and options.</p>
      </div>
      <div className="section-card">
        <div className="field-grid">
          <div>
            <label>Sport</label>
            <select value={design.sport} onChange={(event) => onUpdate("sport", event.target.value)}>
              <option value="baseball">Baseball</option>
              <option value="fastpitch">Fastpitch</option>
              <option value="slowpitch">Slowpitch</option>
            </select>
          </div>
          <div>
            <label>Position</label>
            <select value={design.position} onChange={(event) => onUpdate("position", event.target.value)}>
              <option value="infield">Infield</option>
              <option value="outfield">Outfield</option>
              <option value="pitcher">Pitcher</option>
              <option value="catcher">Catcher</option>
              <option value="first_base">First Base</option>
              <option value="utility">Utility</option>
              <option value="trainer">Trainer</option>
            </select>
          </div>
          <div>
            <label>Throwing Hand</label>
            <select value={design.throwHand} onChange={(event) => onUpdate("throwHand", event.target.value)}>
              <option value="RHT">RHT (glove on left)</option>
              <option value="LHT">LHT (glove on right)</option>
            </select>
          </div>
          <div>
            <label>Age Level</label>
            <select value={design.ageLevel} onChange={(event) => onUpdate("ageLevel", event.target.value)}>
              <option value="youth">Youth</option>
              <option value="teen">Teen</option>
              <option value="adult">Adult</option>
              <option value="pro">Pro</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
