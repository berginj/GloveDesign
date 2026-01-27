import { CatalogDesign, SeedCatalog } from "../data/seedCatalog";
import { summarizeDesign } from "../state/designState";

interface DesignSummaryProps {
  design: CatalogDesign;
  catalog: SeedCatalog;
}

export function DesignSummary({ design, catalog }: DesignSummaryProps) {
  const summary = summarizeDesign(design, catalog);
  return (
    <div>
      <strong>Design Summary</strong>
      <div className="summary">{summary}</div>
      <div className="cta">
        <button>Save Design</button>
        <button className="secondary">Duplicate</button>
        <button className="secondary">Share Link</button>
        <button className="secondary">Export JSON</button>
      </div>
    </div>
  );
}
