import {
  Catalog,
  ColorPalette,
  ComponentSelection,
  DesignContext,
  DesignInput,
  Option,
  PaletteConstraint,
  PriceBreakdown,
  Rule,
  ValidationIssue,
  ValidationResult,
} from "./types";

export function buildDesignContext(design: DesignInput, catalog: Catalog): DesignContext {
  const pattern = catalog.patterns.find((item) => item.id === design.patternId);
  if (!pattern) {
    throw new Error("Pattern not found.");
  }
  return {
    sport: design.sport,
    position: design.position,
    throwHand: design.throwHand,
    ageLevel: design.ageLevel,
    brandId: design.brandId,
    seriesId: design.seriesId,
    patternId: design.patternId,
    size: pattern.size,
    selectedOptions: design.selectedOptions,
    componentSelections: design.componentSelections,
    features: pattern.features,
    allowedWebTypes: pattern.allowedWebTypes,
    allowedBackStyles: pattern.allowedBackStyles,
    allowedWristFits: pattern.allowedWristFits,
  };
}

export function evaluateRule(rule: Rule | undefined, context: DesignContext): boolean {
  if (!rule) {
    return true;
  }
  if ("all" in rule) {
    return rule.all.every((child) => evaluateRule(child, context));
  }
  if ("any" in rule) {
    return rule.any.some((child) => evaluateRule(child, context));
  }
  if ("not" in rule) {
    return !evaluateRule(rule.not, context);
  }
  if ("equals" in rule) {
    const [path, value] = rule.equals;
    return getPathValue(context, path) === value;
  }
  if ("in" in rule) {
    const [path, values] = rule.in;
    return values.includes(getPathValue(context, path) as string | number);
  }
  if ("includes" in rule) {
    const [path, value] = rule.includes;
    const actual = getPathValue(context, path);
    return Array.isArray(actual) ? actual.includes(value) : false;
  }
  if ("exists" in rule) {
    return getPathValue(context, rule.exists[0]) !== undefined;
  }
  if ("gt" in rule) {
    const [path, value] = rule.gt;
    return Number(getPathValue(context, path)) > value;
  }
  if ("lt" in rule) {
    const [path, value] = rule.lt;
    return Number(getPathValue(context, path)) < value;
  }
  return true;
}

export function getAvailableOptions(catalog: Catalog, context: DesignContext): Option[] {
  return catalog.options.filter((option) => evaluateRule(option.availability, context));
}

export function getAvailablePalettes(catalog: Catalog, context: DesignContext): ColorPalette[] {
  return catalog.colorPalettes.filter((palette) => evaluateRule(palette.availability, context));
}

export function getPaletteAvailabilityForComponent(
  design: DesignInput,
  catalog: Catalog,
  componentId: string
): { allowedPaletteIds: string[]; preferredPaletteIds: string[]; restricted: boolean } {
  const context = buildDesignContext(design, catalog);
  const availablePaletteIds = getAvailablePalettes(catalog, context).map((palette) => palette.id);
  const selectedOptionIds = flattenSelectedOptions(design.selectedOptions);
  const optionMap = new Map(catalog.options.map((option) => [option.id, option]));

  let allowedPaletteIds = [...availablePaletteIds];
  const preferred = new Set<string>();
  let restricted = false;

  for (const optionId of selectedOptionIds) {
    const option = optionMap.get(optionId);
    if (!option?.paletteConstraint) {
      continue;
    }
    if (!paletteConstraintApplies(option.paletteConstraint, componentId)) {
      continue;
    }
    if (option.paletteConstraint.mode === "restrict") {
      restricted = true;
      allowedPaletteIds = allowedPaletteIds.filter((id) => option.paletteConstraint!.paletteIds.includes(id));
    } else {
      option.paletteConstraint.paletteIds.forEach((id) => {
        if (availablePaletteIds.includes(id)) {
          preferred.add(id);
        }
      });
    }
  }

  if (restricted && allowedPaletteIds.length === 0) {
    allowedPaletteIds = [...availablePaletteIds];
    restricted = false;
  }

  return {
    allowedPaletteIds,
    preferredPaletteIds: Array.from(preferred),
    restricted,
  };
}

export function getAllowedColorsForComponent(design: DesignInput, catalog: Catalog, componentId: string) {
  const availability = getPaletteAvailabilityForComponent(design, catalog, componentId);
  if (!availability.allowedPaletteIds.length) {
    return catalog.colors;
  }
  const paletteSet = new Set(
    catalog.colorPalettes
      .filter((palette) => availability.allowedPaletteIds.includes(palette.id))
      .flatMap((palette) => palette.colorIds)
  );
  const filtered = catalog.colors.filter((color) => paletteSet.has(color.id));
  return filtered.length ? filtered : catalog.colors;
}

export function validateDesign(design: DesignInput, catalog: Catalog): ValidationResult {
  const issues: ValidationIssue[] = [];
  const pattern = catalog.patterns.find((item) => item.id === design.patternId);
  if (!pattern) {
    return {
      issues: [
        {
          severity: "error",
          code: "pattern_missing",
          message: "Selected pattern does not exist.",
          path: "patternId",
        },
      ],
    };
  }

  const context = buildDesignContext(design, catalog);
  const selectedOptionIds = flattenSelectedOptions(design.selectedOptions);
  const optionMap = new Map(catalog.options.map((option) => [option.id, option]));

  for (const optionId of selectedOptionIds) {
    const option = optionMap.get(optionId);
    if (!option) {
      issues.push({
        severity: "error",
        code: "option_unknown",
        message: `Unknown option selected: ${optionId}`,
        path: `selectedOptions.${optionId}`,
      });
      continue;
    }
    if (!evaluateRule(option.availability, context)) {
      issues.push({
        severity: "error",
        code: "option_unavailable",
        message: `Option "${option.label}" is not available for this pattern.`,
        path: `selectedOptions.${option.groupId}`,
      });
    }
    if (option.dependencies?.length) {
      const missing = option.dependencies.filter((dep) => !selectedOptionIds.includes(dep));
      if (missing.length) {
        issues.push({
          severity: "error",
          code: "option_dependency",
          message: `Option "${option.label}" requires ${missing.join(", ")}.`,
          path: `selectedOptions.${option.groupId}`,
        });
      }
    }
    if (option.incompatibilities?.length) {
      const conflicts = option.incompatibilities.filter((conflict) => selectedOptionIds.includes(conflict));
      if (conflicts.length) {
        issues.push({
          severity: "error",
          code: "option_incompatible",
          message: `Option "${option.label}" is incompatible with ${conflicts.join(", ")}.`,
          path: `selectedOptions.${option.groupId}`,
        });
      }
    }
  }

  const groupedSelections = groupSelectionsByGroup(design.selectedOptions);
  for (const group of catalog.optionGroups) {
    const selected = groupedSelections.get(group.id) ?? [];
    if (!group.allowMultiple && selected.length > 1) {
      issues.push({
        severity: "error",
        code: "group_multi_select",
        message: `Option group "${group.name}" allows only one selection.`,
        path: `selectedOptions.${group.id}`,
      });
    }
  }

  const componentIssues = validateComponentSelections(design, pattern, catalog);
  issues.push(...componentIssues);

  if (!pattern.positions.includes(design.position)) {
    issues.push({
      severity: "warning",
      code: "position_mismatch",
      message: "Selected pattern is unusual for this position.",
      path: "position",
    });
  }

  const personalizationIssues = validatePersonalization(design);
  issues.push(...personalizationIssues);

  const correctedDesign = applyDefaults(design, catalog);
  const priceBreakdown = buildPriceBreakdown(correctedDesign, catalog);
  return { issues, correctedDesign, priceBreakdown };
}

export function buildPriceBreakdown(design: DesignInput, catalog: Catalog): PriceBreakdown {
  const series = catalog.series.find((item) => item.id === design.seriesId);
  const basePrice = series?.basePrice ?? 0;
  const selectedOptionIds = flattenSelectedOptions(design.selectedOptions);
  const optionMap = new Map(catalog.options.map((option) => [option.id, option]));
  const details: Array<{ optionId: string; label: string; delta: number }> = [];

  let optionTotal = 0;
  let leadTimeDays = 30;

  for (const optionId of selectedOptionIds) {
    const option = optionMap.get(optionId);
    if (!option) {
      continue;
    }
    const delta = applyPriceRule(option, basePrice);
    optionTotal += delta;
    details.push({ optionId: option.id, label: option.label, delta });
    leadTimeDays += applyLeadTimeRule(option, basePrice);
  }

  return {
    basePrice,
    optionTotal,
    leadTimeDays,
    total: basePrice + optionTotal,
    details,
  };
}

function applyDefaults(design: DesignInput, catalog: Catalog): DesignInput {
  const updated: DesignInput = JSON.parse(JSON.stringify(design));
  for (const group of catalog.optionGroups) {
    const selected = updated.selectedOptions[group.id];
    if (!selected && group.defaultOptionId) {
      updated.selectedOptions[group.id] = group.defaultOptionId;
    }
  }
  return updated;
}

function validateComponentSelections(
  design: DesignInput,
  pattern: Catalog["patterns"][number],
  catalog: Catalog
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const componentMap = new Map(catalog.components.map((component) => [component.id, component]));
  const colorMap = new Map(catalog.colors.map((color) => [color.id, color]));
  const materialMap = new Map(catalog.materials.map((material) => [material.id, material]));

  const laceColors = new Set<string>();

  for (const selection of design.componentSelections) {
    if (!componentMap.has(selection.componentId)) {
      issues.push({
        severity: "error",
        code: "component_unknown",
        message: `Unknown component: ${selection.componentId}`,
        path: `componentSelections.${selection.componentId}`,
      });
      continue;
    }
    if (!pattern.allowedComponents.includes(selection.componentId)) {
      issues.push({
        severity: "error",
        code: "component_not_allowed",
        message: `Component "${selection.componentId}" is not available on this pattern.`,
        path: `componentSelections.${selection.componentId}`,
      });
    }
    const color = colorMap.get(selection.colorId);
    if (!color) {
      issues.push({
        severity: "error",
        code: "color_unknown",
        message: `Unknown color: ${selection.colorId}`,
        path: `componentSelections.${selection.componentId}.colorId`,
      });
    } else if (selection.materialId) {
      const material = materialMap.get(selection.materialId);
      const compat = color.materialCompat ?? [];
      if (material && compat.length > 0 && !compat.includes(material.id) && !compat.includes(material.type)) {
        issues.push({
          severity: "warning",
          code: "color_material_mismatch",
          message: `Color "${color.name}" is uncommon with ${material.name}.`,
          path: `componentSelections.${selection.componentId}`,
        });
      }
    }
    if (selection.componentId.startsWith("lace-")) {
      laceColors.add(selection.colorId);
    }

    const availability = getPaletteAvailabilityForComponent(design, catalog, selection.componentId);
    if (availability.allowedPaletteIds.length) {
      const paletteSet = new Set(
        catalog.colorPalettes
          .filter((palette) => availability.allowedPaletteIds.includes(palette.id))
          .flatMap((palette) => palette.colorIds)
      );
      if (paletteSet.size && !paletteSet.has(selection.colorId)) {
        issues.push({
          severity: availability.restricted ? "error" : "warning",
          code: availability.restricted ? "palette_restricted" : "palette_preferred",
          message: availability.restricted
            ? "Selected color is outside the allowed palette for this option."
            : "Selected color is outside the preferred palette for this option.",
          path: `componentSelections.${selection.componentId}.colorId`,
        });
      }
    }
  }

  if (!pattern.features.laceTwoTone && laceColors.size > 1) {
    issues.push({
      severity: "error",
      code: "lace_two_tone_not_supported",
      message: "This pattern does not support two-tone lace colors.",
      path: "componentSelections",
    });
  }

  return issues;
}

function paletteConstraintApplies(constraint: PaletteConstraint, componentId: string) {
  if (constraint.scope === "components") {
    return (constraint.componentIds ?? []).includes(componentId);
  }
  return true;
}

function validatePersonalization(design: DesignInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const personalization = design.personalization;
  if (!personalization) {
    return issues;
  }
  const selectedOptions = design.selectedOptions ?? {};
  const nameOption = selectedOptions["name-embroidery"];
  const numberOption = selectedOptions["number-embroidery"];
  const nameSelected =
    (Array.isArray(nameOption) ? nameOption[0] : nameOption) &&
    (Array.isArray(nameOption) ? nameOption[0] : nameOption) !== "opt-name-embroidery-none";
  const numberSelected =
    (Array.isArray(numberOption) ? numberOption[0] : numberOption) &&
    (Array.isArray(numberOption) ? numberOption[0] : numberOption) !== "opt-number-embroidery-none";
  const combined = `${personalization.nameLine1 ?? ""} ${personalization.nameLine2 ?? ""} ${personalization.number ?? ""} ${personalization.specialInstructions ?? ""}`
    .toLowerCase()
    .trim();
  const restricted = ["mlb", "rawlings", "wilson", "nike", "adidas", "nhl", "nba", "ncaa"];
  if (restricted.some((word) => combined.includes(word))) {
    issues.push({
      severity: "warning",
      code: "personalization_review",
      message: "Personalization contains protected terms and may require review.",
      path: "personalization",
    });
  }
  if ((personalization.nameLine1 ?? "").length > 12 || (personalization.nameLine2 ?? "").length > 12) {
    issues.push({
      severity: "warning",
      code: "personalization_length",
      message: "Embroidery text is long and may be shortened during review.",
      path: "personalization",
    });
  }
  if (nameSelected && !(personalization.nameLine1 ?? "").trim()) {
    issues.push({
      severity: "warning",
      code: "personalization_name_missing",
      message: "Name embroidery is selected but no name was provided.",
      path: "personalization.nameLine1",
    });
  }
  if (numberSelected && !(personalization.number ?? "").trim()) {
    issues.push({
      severity: "warning",
      code: "personalization_number_missing",
      message: "Number embroidery is selected but no jersey number was provided.",
      path: "personalization.number",
    });
  }
  const embroidery = personalization.embroidery ?? [];
  for (const entry of embroidery) {
    if (entry.enabled && !(entry.text ?? "").trim()) {
      issues.push({
        severity: "warning",
        code: "personalization_embroidery_missing",
        message: "Embroidery placement is enabled but no text was provided.",
        path: "personalization.embroidery",
      });
    }
    if (entry.enabled && (!entry.fontId || !entry.threadColorId)) {
      issues.push({
        severity: "warning",
        code: "personalization_embroidery_incomplete",
        message: "Embroidery placement needs a font and thread color.",
        path: "personalization.embroidery",
      });
    }
  }
  return issues;
}

function applyPriceRule(option: Option, basePrice: number): number {
  if (!option.priceRule) {
    return 0;
  }
  if (option.priceRule.type === "flat") {
    return option.priceRule.amount ?? 0;
  }
  if (option.priceRule.type === "percent") {
    return basePrice * (option.priceRule.percent ?? 0);
  }
  if (option.priceRule.type === "formula") {
    return evaluateFormula(option.priceRule.expression ?? "", { basePrice });
  }
  return 0;
}

function applyLeadTimeRule(option: Option, basePrice: number): number {
  if (!option.leadTimeRule) {
    return 0;
  }
  if (option.leadTimeRule.type === "days") {
    return option.leadTimeRule.days ?? 0;
  }
  if (option.leadTimeRule.type === "formula") {
    return evaluateFormula(option.leadTimeRule.expression ?? "", { basePrice });
  }
  return 0;
}

function evaluateFormula(expression: string, vars: Record<string, number>): number {
  const safe = expression.replace(/[^0-9+\-*/(). _a-zA-Z]/g, "");
  if (safe !== expression) {
    return 0;
  }
  const keys = Object.keys(vars);
  const values = Object.values(vars);
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `return (${safe});`);
    const result = fn(...values);
    return Number.isFinite(result) ? Number(result) : 0;
  } catch (error) {
    return 0;
  }
}

function getPathValue(context: DesignContext, path: string): unknown {
  const parts = path.split(".");
  let current: any = context;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function flattenSelectedOptions(selectedOptions: Record<string, string | string[]>): string[] {
  return Object.values(selectedOptions).flatMap((value) => (Array.isArray(value) ? value : [value]));
}

function groupSelectionsByGroup(selectedOptions: Record<string, string | string[]>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [groupId, value] of Object.entries(selectedOptions)) {
    map.set(groupId, Array.isArray(value) ? value : [value]);
  }
  return map;
}
