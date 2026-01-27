import { useEffect, useMemo, useState } from "react";
import { CatalogDesign } from "../data/seedCatalog";
import { PlaceholderRenderer } from "../renderers/PlaceholderRenderer";
import { RenderResult } from "../renderers/GloveRenderer";

interface GlovePreviewProps {
  design: CatalogDesign;
  logoUrl?: string | null;
}

export function GlovePreview({ design, logoUrl }: GlovePreviewProps) {
  const renderer = useMemo(() => new PlaceholderRenderer(), []);
  const [result, setResult] = useState<RenderResult | null>(null);

  useEffect(() => {
    let active = true;
    renderer
      .render({
        patternId: design.patternId,
        componentSelections: design.componentSelections,
        materialSelections: design.selectedOptions,
      })
      .then((output) => {
        if (active) {
          setResult(output);
        }
      });
    return () => {
      active = false;
    };
  }, [design, renderer]);

  return (
    <>
      <div className="silhouette" />
      <div>
        <strong>Preview Components</strong>
        <div className="chip-row">
          {result
            ? result.colorChips.map((chip) => (
                <div key={chip.componentId} className="chip">
                  <span className="chip-color" style={{ background: chip.hex }} />
                  {chip.label}
                </div>
              ))
            : "Rendering preview..."}
        </div>
      </div>
      <div>
        <strong>Renderer Output</strong>
        <div className="summary">{JSON.stringify(result, null, 2)}</div>
      </div>
      {logoUrl && (
        <div>
          <strong>Team Logo</strong>
          <div className="logo-preview">
            <img src={logoUrl} alt="Team logo" />
          </div>
        </div>
      )}
    </>
  );
}
