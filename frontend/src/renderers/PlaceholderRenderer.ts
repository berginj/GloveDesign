import { GloveRenderer, RenderInput, RenderResult } from "./GloveRenderer";
import { loadSeedCatalog } from "../data/seedCatalog";

export class PlaceholderRenderer implements GloveRenderer {
  async render(input: RenderInput): Promise<RenderResult> {
    const catalog = loadSeedCatalog();
    const colorMap = new Map(catalog.colors.map((color) => [color.id, color]));
    const componentMap = new Map(catalog.components.map((component) => [component.id, component]));
    const colorChips = input.componentSelections.map((selection) => {
      const color = colorMap.get(selection.colorId);
      const component = componentMap.get(selection.componentId);
      return {
        componentId: selection.componentId,
        hex: color?.hex ?? "#cccccc",
        label: `${component?.name ?? selection.componentId}`,
      };
    });
    return {
      imageUrls: ["placeholder://glove-front", "placeholder://glove-back"],
      colorChips,
    };
  }
}
