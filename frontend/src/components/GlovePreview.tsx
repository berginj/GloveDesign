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
  const [activeView, setActiveView] = useState(0);

  useEffect(() => {
    let active = true;
    renderer
      .render({
        patternId: design.patternId,
        componentSelections: design.componentSelections,
        materialSelections: design.selectedOptions,
        personalization: design.personalization,
      })
      .then((output) => {
        if (active) {
          setResult(output);
          setActiveView(0);
        }
      });
    return () => {
      active = false;
    };
  }, [design, renderer]);

  const views = result?.views ?? [];
  const active = views[activeView];

  return (
    <>
      <div className="preview-viewport">
        {active ? (
          <img src={active.url} alt={`Glove preview ${active.label}`} />
        ) : (
          <div className="silhouette" />
        )}
        {views.length > 1 && (
          <div className="view-toggle">
            {views.map((view, index) => (
              <button
                key={view.id}
                className={index === activeView ? "active" : ""}
                onClick={() => setActiveView(index)}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </div>
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
