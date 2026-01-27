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

  return (
    <div>
      <h3>Review</h3>
      <div className="summary">{JSON.stringify(design, null, 2)}</div>
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
      {price && (
        <div className="summary">
          <strong>Price + Lead Time</strong>
          <div>Base: ${price.basePrice}</div>
          <div>Options: ${price.optionTotal}</div>
          <div>Total: ${price.total}</div>
          <div>Lead Time: {price.leadTimeDays} days</div>
        </div>
      )}
    </div>
  );
}
