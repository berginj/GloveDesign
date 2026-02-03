import { CatalogDesign, SeedCatalog } from "../../data/seedCatalog";
import { validateDesign } from "../../engine/optionEngine";

interface ReviewStepProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
}

export function ReviewStep({ design, catalog }: ReviewStepProps) {
  const validation = validateDesign(design, catalog);
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  const warnings = validation.issues.filter((issue) => issue.severity === "warning");
  const price = validation.priceBreakdown;

  const brand = catalog.brands.find((b) => b.id === design.brandId);
  const series = catalog.series.find((s) => s.id === design.seriesId);
  const pattern = catalog.patterns.find((p) => p.id === design.patternId);

  return (
    <div className="step-layout">
      <div className="step-header">
        <h3>
          <span className="step-icon">▣</span>
          Review
        </h3>
        <p>Check validation flags and see your price breakdown.</p>
      </div>
      <div className="section-card">
        <strong>Design Summary</strong>
        <div className="summary">
          <div><strong>Brand:</strong> {brand?.name ?? design.brandId}</div>
          <div><strong>Series:</strong> {series?.name ?? design.seriesId}</div>
          <div><strong>Pattern:</strong> {pattern?.webFamily ?? design.patternId} ({pattern?.size})</div>
          <div><strong>Sport:</strong> {design.sport}</div>
          <div><strong>Position:</strong> {design.position}</div>
          <div><strong>Throw Hand:</strong> {design.throwHand}</div>
          <div><strong>Age Level:</strong> {design.ageLevel}</div>
        </div>
      </div>
      <div className="section-card">
        <strong>Component Colors</strong>
        <div className="summary">
          {design.componentSelections.map((selection) => {
            const component = catalog.components.find((c) => c.id === selection.componentId);
            const color = catalog.colors.find((c) => c.id === selection.colorId);
            return (
              <div key={selection.componentId}>
                <strong>{component?.name ?? selection.componentId}:</strong> {color?.name ?? selection.colorId}
              </div>
            );
          })}
        </div>
      </div>
      {Object.keys(design.selectedOptions).length > 0 && (
        <div className="section-card">
          <strong>Selected Options</strong>
          <div className="summary">
            {Object.entries(design.selectedOptions).map(([groupId, optionId]) => {
              const group = catalog.optionGroups.find((g) => g.id === groupId);
              const option = catalog.options.find((o) => o.id === optionId);
              return (
                <div key={groupId}>
                  <strong>{group?.name ?? groupId}:</strong> {option?.name ?? optionId}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {design.personalization && (design.personalization.nameLine1 || design.personalization.nameLine2 || design.personalization.number) && (
        <div className="section-card">
          <strong>Personalization</strong>
          <div className="summary">
            {design.personalization.nameLine1 && <div><strong>Name Line 1:</strong> {design.personalization.nameLine1}</div>}
            {design.personalization.nameLine2 && <div><strong>Name Line 2:</strong> {design.personalization.nameLine2}</div>}
            {design.personalization.number && <div><strong>Number:</strong> {design.personalization.number}</div>}
            {design.personalization.specialInstructions && <div><strong>Special Instructions:</strong> {design.personalization.specialInstructions}</div>}
          </div>
        </div>
      )}
      <div className="section-card">
        <div className="summary">
          <strong>Validation</strong>
          {errors.length === 0 && warnings.length === 0 && <div>No issues found.</div>}
          {errors.map((issue) => (
            <div key={issue.code}>Error: {issue.message}</div>
          ))}
          {warnings.map((issue) => (
            <div key={issue.code}>Warning: {issue.message}</div>
          ))}
        </div>
      </div>
      {price && (
        <div className="section-card">
          <div className="summary">
            <strong>Price + Lead Time</strong>
            <div>Base: ${price.basePrice}</div>
            <div>Options: ${price.optionTotal}</div>
            <div>Total: ${price.total}</div>
            <div>Lead Time: {price.leadTimeDays} days</div>
          </div>
        </div>
      )}
    </div>
  );
}
