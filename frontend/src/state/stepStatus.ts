import type { CatalogDesign, SeedCatalog } from "../data/seedCatalog";
import type { WizardStepId } from "../components/WizardStep";
import { validateDesign } from "../engine/optionEngine";

export type StepStatus = "complete" | "attention" | "incomplete";

const materialGroups = ["leather-type", "overlay-material", "lining-type", "padding-profile", "break-in", "stiffness"];

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

export function computeStepStatuses(design: CatalogDesign, catalog: SeedCatalog): Record<WizardStepId, StepStatus> {
  const statuses: Record<WizardStepId, StepStatus> = {
    start: "complete",
    pattern: "complete",
    materials: "complete",
    colors: "complete",
    build: "complete",
    personalize: "complete",
    review: "complete",
    checkout: "complete",
  };

  for (const group of materialGroups) {
    if (!design.selectedOptions[group]) {
      statuses.materials = "incomplete";
    }
  }

  for (const group of buildGroups) {
    if (!design.selectedOptions[group]) {
      statuses.build = "incomplete";
    }
  }

  if (design.componentSelections.some((selection) => !selection.colorId)) {
    statuses.colors = "incomplete";
  }

  const validation = validateDesign(design, catalog);
  for (const issue of validation.issues) {
    const step = mapIssueToStep(issue.path);
    if (!step) {
      continue;
    }
    if (issue.severity === "error") {
      statuses[step] = "incomplete";
    } else if (statuses[step] !== "incomplete") {
      statuses[step] = "attention";
    }
  }

  return statuses;
}

function mapIssueToStep(path?: string): WizardStepId | null {
  if (!path) {
    return null;
  }
  if (path.startsWith("sport") || path.startsWith("position") || path.startsWith("throwHand") || path.startsWith("ageLevel")) {
    return "start";
  }
  if (path.startsWith("patternId") || path.startsWith("seriesId") || path.startsWith("brandId")) {
    return "pattern";
  }
  if (path.startsWith("selectedOptions.leather-type") || path.startsWith("selectedOptions.overlay-material")) {
    return "materials";
  }
  if (path.startsWith("selectedOptions.lining-type") || path.startsWith("selectedOptions.padding-profile")) {
    return "materials";
  }
  if (path.startsWith("selectedOptions.break-in") || path.startsWith("selectedOptions.stiffness")) {
    return "materials";
  }
  if (path.startsWith("selectedOptions.web-type") || path.startsWith("selectedOptions.back-style")) {
    return "build";
  }
  if (path.startsWith("selectedOptions.wrist-fit") || path.startsWith("selectedOptions.welting-style")) {
    return "build";
  }
  if (path.startsWith("selectedOptions.lace-length") || path.startsWith("selectedOptions.pocket-depth")) {
    return "build";
  }
  if (path.startsWith("selectedOptions.finger-shift") || path.startsWith("selectedOptions.lace-two-tone")) {
    return "build";
  }
  if (path.startsWith("selectedOptions.thumb-pad") || path.startsWith("selectedOptions.pinky-pad")) {
    return "build";
  }
  if (path.startsWith("selectedOptions.extra-heel-pad")) {
    return "build";
  }
  if (path.startsWith("componentSelections")) {
    return "colors";
  }
  if (path.startsWith("personalization") || path.startsWith("selectedOptions.name-embroidery") || path.startsWith("selectedOptions.number-embroidery") || path.startsWith("selectedOptions.palm-stamp") || path.startsWith("selectedOptions.patch-select")) {
    return "personalize";
  }
  return null;
}
