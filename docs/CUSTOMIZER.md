# Glove Customizer Product Spec + Build Notes

This document captures the product structure and implementation hooks for the glove customization web app.

## Information Architecture
1) Start
   - Sport, Position, Throwing Hand, Age Level
2) Pattern & Size
   - Pattern library filtered by sport/position/age/hand
   - Pattern cards show size, web family, pocket depth, fit notes
3) Customization
   - Materials (leather, overlays, lining, padding, break-in, stiffness)
   - Component colors (granular panel + lace colors)
   - Build options (web type, back style, wrist fit, welting, lace length, pocket depth)
4) Personalization
   - Embroidery, palm stamp, patch selection, special instructions
   - Custom logo upload (disabled placeholder)
5) Review
   - Design summary + JSON export
   - Pricing breakdown + lead time estimate
6) Checkout (stub)
   - Contact + shipping info
   - Create order (no payment)

## Key Screens (wireframe-level)
- Wizard layout with step navigation + side preview
- Pattern library grid with filters
- Option panels grouped by category with swatches/selects/toggles
- Review summary + pricing breakdown
- Checkout stub with contact + shipping form + external order handoff (configurable URL)

## Data Model (storage-level)
- Brand { id, name }
- Series { id, brandId, name, basePrice, description }
- PatternFamily { id, name, sizeRange, defaultComponents[] }
- Pattern { id, seriesId, sport, positions[], size, webFamily, pocketDepth, typicalUse, fitNotes, allowedWebTypes[], allowedBackStyles[], allowedWristFits[], allowedComponents[], features{} }
- Component { id, name, zone, renderLayerKey }
- Color { id, name, hex, finish, materialCompat[] }
- Material { id, name, type, upcharge, notes }
- OptionGroup { id, name, uiControlType, sortOrder, allowMultiple?, defaultOptionId? }
- Option { id, groupId, label, description, availability, incompatibilities, dependencies, priceRule, leadTimeRule, uiMeta }
- Design { id, userId?, patternId, selectedOptions, componentSelections, createdAt, version }
- Order { id, designId, customerInfo, priceBreakdown, status, createdAt }

## Example JSON Config Snippets
Pattern:
```json
{
  "id": "pattern-hp-11-5",
  "seriesId": "series-heritage-pro",
  "familyId": "family-infield",
  "sport": "baseball",
  "positions": ["infield", "utility"],
  "size": "11.5",
  "webFamily": "H-web",
  "allowedWebTypes": ["H-web", "I-web", "modified-trap"],
  "allowedBackStyles": ["conventional", "modified-open"],
  "allowedWristFits": ["standard", "contour"],
  "allowedComponents": ["shell-thumb", "palm", "web", "binding", "lace-finger"],
  "features": { "laceTwoTone": true, "supportsPalmStamp": true }
}
```

Component:
```json
{ "id": "lace-web", "name": "Web Laces", "zone": "laces", "renderLayerKey": "laceWeb" }
```

Option group:
```json
{ "id": "web-type", "name": "Web Type", "uiControlType": "select", "sortOrder": 70, "defaultOptionId": "opt-web-default" }
```

Option + rule:
```json
{
  "id": "opt-web-trap",
  "groupId": "web-type",
  "label": "Trap",
  "availability": { "includes": ["allowedWebTypes", "trap"] },
  "priceRule": { "type": "flat", "amount": 8 }
}
```

## Example Config References
- Patterns: `src/customizer/catalog/patterns.json`
- Components: `src/customizer/catalog/components.json`
- Option Groups: `src/customizer/catalog/option-groups.json`
- Options: `src/customizer/catalog/options.json`
- Colors/Materials: `src/customizer/catalog/colors.json`, `src/customizer/catalog/materials.json`

## Option Engine (core abstraction)
Contracts:
- `Rule` supports `all`, `any`, `not`, `equals`, `in`, `includes`, `exists`, `gt`, `lt`
- `Option` supports availability, dependencies, incompatibilities
- Pricing + lead time rules

Interfaces (trimmed):
```ts
interface Rule {
  all?: Rule[];
  any?: Rule[];
  not?: Rule;
  equals?: [string, string | number | boolean];
  in?: [string, Array<string | number>];
  includes?: [string, string];
}

interface Option {
  id: string;
  groupId: string;
  label: string;
  availability?: Rule;
  dependencies?: string[];
  incompatibilities?: string[];
  priceRule?: PriceRule;
  leadTimeRule?: LeadTimeRule;
}
```

Pipeline:
1) Build a context from the selected pattern + options
2) Filter available options by rule evaluation
3) Validate dependencies/incompatibilities
4) Compute pricing + lead time
5) Return warnings + errors

Pseudocode:
```
context = buildContext(design, catalog)
availableOptions = options.filter(o => evaluateRule(o.availability, context))
errors = []
for each selected option:
  if !available -> error
  if missing dependency -> error
  if conflicts -> error
price = basePrice + sum(option.priceRule)
leadTime = baseLeadTime + sum(option.leadTimeRule)
return { errors, warnings, price, leadTime }
```

Implementation: `src/customizer/optionEngine.ts`

## Frontend Component Structure
- `App` orchestrates the wizard, holds design state, and computes availability.
- `WizardStep` renders the active step component.
- Step components:
  - `StartStep` (sport, position, throw hand, age level)
  - `PatternStep` (filtered pattern library + size/web filters)
  - `MaterialsStep` (leather/lining/padding/break-in/stiffness)
  - `ColorsStep` (component-level color selections)
  - `BuildStep` (web/back/wrist/welting/lace length/finger shift/pads)
  - `PersonalizeStep` (embroidery, palm stamp, patches, special instructions)
  - `ReviewStep` (validation + price breakdown)
  - `CheckoutStep` (stub form)
- `GlovePreview` uses `PlaceholderRenderer` via the `GloveRenderer` interface.

## Preview Renderer Contract
- `GloveRenderer.render(design): Promise<RenderResult>`
  - Input: `patternId`, `componentSelections`, `materialSelections`
  - Output: `imageUrls[]` + `colorChips[]`
- Placeholder implementation: `frontend/src/renderers/PlaceholderRenderer.ts`
- Future: `SvgLayerRenderer` or `ThreeJsRenderer` can be added without changing app state shape

## Checkout Handoff
- The checkout step includes an external order handoff link.
- Configure it with `VITE_ORDER_URL` (defaults to `https://aka.ms/myorder`).

## API Endpoints (Functions)
- `GET /api/catalog/brands`
- `GET /api/catalog/series?brandId=`
- `GET /api/catalog/patterns?filters...`
- `GET /api/catalog/colors`
- `GET /api/catalog/materials`
- `GET /api/catalog/options?patternId=...`
- `POST /api/validateDesign`
- `POST /api/designs`
- `PUT /api/designs/{id}`
- `GET /api/designs/{id}`
- `POST /api/orders`
- `GET /api/orders/{id}`

Validation logic:
- `validateDesign` checks rule availability, dependencies, incompatibilities, and component constraints.
- Returns errors (hard blocks) and warnings (review flags).
- Pricing + lead time is calculated from `Series.basePrice` + option deltas.

## Test Plan (high level)
- Rule evaluation (equals, in, includes, not)
- Availability filtering
- Dependency + incompatibility checks
- Pricing + lead time calculations
- Component selection validation (unsupported components, two-tone lace rules)

## Developer Guide: Add a New Pattern
1) Add a new pattern entry in `src/customizer/catalog/patterns.json`.
2) Ensure `allowedComponents` contains the relevant component IDs.
3) Update `pattern-families.json` if new family is needed.
4) Confirm `allowedWebTypes`, `allowedBackStyles`, and `allowedWristFits`.

## Developer Guide: Add a New Option
1) Add/choose an `OptionGroup` in `option-groups.json`.
2) Add the option in `options.json` with:
   - `availability` rules
   - `dependencies` or `incompatibilities`
   - `priceRule` / `leadTimeRule`
3) UI will pick it up automatically for its group.
