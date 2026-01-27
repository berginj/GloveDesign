import { useMemo, useState } from "react";
import { StartLanding } from "./components/StartLanding";
import { WizardStep, WizardStepId } from "./components/WizardStep";
import { GlovePreview } from "./components/GlovePreview";
import { DesignSummary } from "./components/DesignSummary";
import { loadSeedCatalog } from "./data/seedCatalog";
import { buildDesignContext, getAvailableOptions } from "./engine/optionEngine";
import { buildInitialDesign, updateDesignField } from "./state/designState";

const steps: WizardStepId[] = ["start", "pattern", "materials", "colors", "build", "personalize", "review", "checkout"];

export function App() {
  const catalog = useMemo(() => loadSeedCatalog(), []);
  const [activeStep, setActiveStep] = useState<WizardStepId>("start");
  const [design, setDesign] = useState(() => buildInitialDesign(catalog));
  const [started, setStarted] = useState(false);

  const update = (path: string, value: string) => {
    setDesign((prev) => updateDesignField(prev, path, value, catalog));
  };

  const availableOptions = useMemo(() => {
    try {
      return getAvailableOptions(catalog, buildDesignContext(design, catalog));
    } catch {
      return catalog.options;
    }
  }, [catalog, design]);

  return (
    <div className="app">
      <div className="panel">
        {!started ? (
          <StartLanding
            design={design}
            catalog={catalog}
            onUpdate={update}
            onStart={() => {
              setStarted(true);
              setActiveStep("pattern");
            }}
          />
        ) : (
          <>
            <h2>Custom Glove Builder</h2>
            <div className="step-nav">
              {steps.map((step) => (
                <button
                  key={step}
                  className={`step-button ${activeStep === step ? "active" : ""}`}
                  onClick={() => setActiveStep(step)}
                >
                  {step.toUpperCase()}
                </button>
              ))}
            </div>
            <WizardStep step={activeStep} catalog={catalog} design={design} availableOptions={availableOptions} onUpdate={update} />
          </>
        )}
      </div>

      <div className="panel preview">
        <GlovePreview design={design} />
        <DesignSummary design={design} catalog={catalog} />
      </div>
    </div>
  );
}
