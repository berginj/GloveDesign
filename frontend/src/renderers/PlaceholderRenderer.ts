import { GloveRenderer, RenderInput, RenderResult, RenderViewResult } from "./GloveRenderer";
import { loadSeedCatalog } from "../data/seedCatalog";

export class PlaceholderRenderer implements GloveRenderer {
  async render(input: RenderInput): Promise<RenderResult> {
    const catalog = loadSeedCatalog();
    const pattern = catalog.patterns.find((item) => item.id === input.patternId);
    const family = catalog.patternFamilies.find((item) => item.id === (input.patternFamilyId ?? pattern?.familyId));
    const profile =
      catalog.renderProfiles.find((item) => item.id === family?.renderProfileId) ?? catalog.renderProfiles[0];
    const colorMap = new Map(catalog.colors.map((color) => [color.id, color]));
    const componentMap = new Map(catalog.components.map((component) => [component.id, component]));
    const selectionMap = new Map(input.componentSelections.map((selection) => [selection.componentId, selection.colorId]));
    const colorChips = input.componentSelections.map((selection) => {
      const color = colorMap.get(selection.colorId);
      const component = componentMap.get(selection.componentId);
      return {
        componentId: selection.componentId,
        hex: color?.hex ?? "#cccccc",
        label: `${component?.name ?? selection.componentId}`,
      };
    });

    const overlayOptionId = input.materialSelections["overlay-material"];
    const overlayOption = catalog.options.find((option) => option.id === overlayOptionId);
    const overlayMaterial = catalog.materials.find((material) => material.id === overlayOption?.materialRef);
    const overlayTexture = catalog.textures.find((texture) => texture.id === overlayMaterial?.textureId);
    const overlayTargets = new Set(overlayOption?.affectedComponents ?? []);

    const views: RenderViewResult[] = (profile?.views ?? []).map((view) => {
      const defs = overlayTexture
        ? `<defs><pattern id="texture-${overlayTexture.id}" patternUnits="userSpaceOnUse" width="${overlayTexture.scale ?? 8}" height="${overlayTexture.scale ?? 8}">${overlayTexture.svgPattern}</pattern></defs>`
        : "";
      const layers = view.layers
        .map((layer) => {
          const colorId = selectionMap.get(layer.componentId);
          const hex = colorMap.get(colorId ?? "")?.hex ?? "#d0c5b8";
          const strokeColor = layer.stroke ? (layer.stroke === "currentColor" ? hex : layer.stroke) : undefined;
          const fill = layer.stroke ? "none" : hex;
          const path = `<path d="${layer.shape.d}" fill="${fill}"${
            strokeColor ? ` stroke="${strokeColor}" stroke-width="${layer.strokeWidth ?? 2}"` : ""
          }${layer.opacity ? ` opacity="${layer.opacity}"` : ""} />`;
          const textureOverlay =
            overlayTexture && overlayTargets.has(layer.componentId)
              ? `<path d="${layer.shape.d}" fill="url(#texture-${overlayTexture.id})" opacity="0.6" />`
              : "";
          return `${path}${textureOverlay}`;
        })
        .join("");

      const embroidery = (input.personalization?.embroidery ?? [])
        .filter((entry) => Boolean(entry.enabled) && entry.text.trim().length > 0)
        .map((entry) => {
          const placement = catalog.embroideryPlacements.find((item) => item.id === entry.placementId);
          if (!placement || placement.viewId !== view.id) {
            return "";
          }
          if (placement.familyIds?.length && family && !placement.familyIds.includes(family.id)) {
            return "";
          }
          const font = catalog.embroideryFonts.find((item) => item.id === entry.fontId);
          const thread = colorMap.get(entry.threadColorId);
          const rotation = placement.rotation ? ` rotate(${placement.rotation} ${placement.x} ${placement.y})` : "";
          return `<text x="${placement.x}" y="${placement.y}" fill="${thread?.hex ?? "#111111"}" text-anchor="middle" transform="scale(${placement.scale ?? 1})${rotation}" style="font-family:${font?.cssFamily ?? "sans-serif"};font-weight:${font?.weight ?? 600};font-style:${font?.style ?? "normal"};letter-spacing:${font?.letterSpacing ?? 0}px;font-size:14px;">${entry.text}</text>`;
        })
        .join("");

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}" viewBox="0 0 ${view.width} ${view.height}" role="img" aria-label="Glove ${view.label}">${defs}${layers}${embroidery}</svg>`;
      return {
        id: view.id,
        label: view.label,
        url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      };
    });

    return {
      views,
      colorChips,
    };
  }
}
