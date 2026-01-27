import { CatalogDesign, SeedCatalog } from "../data/seedCatalog";
import { Option } from "../data/catalogTypes";
import { StartStep } from "./steps/StartStep";
import { PatternStep } from "./steps/PatternStep";
import { MaterialsStep } from "./steps/MaterialsStep";
import { ColorsStep } from "./steps/ColorsStep";
import { BuildStep } from "./steps/BuildStep";
import { PersonalizeStep } from "./steps/PersonalizeStep";
import { ReviewStep } from "./steps/ReviewStep";
import { CheckoutStep } from "./steps/CheckoutStep";

export type WizardStepId = "start" | "pattern" | "materials" | "colors" | "build" | "personalize" | "review" | "checkout";

interface WizardStepProps {
  step: WizardStepId;
  catalog: SeedCatalog;
  design: CatalogDesign;
  availableOptions: Option[];
  onUpdate: (path: string, value: string) => void;
}

export function WizardStep({ step, catalog, design, availableOptions, onUpdate }: WizardStepProps) {
  switch (step) {
    case "start":
      return <StartStep design={design} onUpdate={onUpdate} />;
    case "pattern":
      return <PatternStep design={design} catalog={catalog} onUpdate={onUpdate} />;
    case "materials":
      return <MaterialsStep design={design} catalog={catalog} availableOptions={availableOptions} onUpdate={onUpdate} />;
    case "colors":
      return <ColorsStep design={design} catalog={catalog} onUpdate={onUpdate} />;
    case "build":
      return <BuildStep design={design} catalog={catalog} availableOptions={availableOptions} onUpdate={onUpdate} />;
    case "personalize":
      return <PersonalizeStep design={design} catalog={catalog} availableOptions={availableOptions} onUpdate={onUpdate} />;
    case "review":
      return <ReviewStep design={design} catalog={catalog} />;
    case "checkout":
      return <CheckoutStep design={design} />;
    default:
      return null;
  }
}
