import { chromium } from "playwright";
import { promises as fs } from "fs";
import { join } from "path";
import { WizardRequest, WizardResult } from "../common/types";

export async function runWizard(request: WizardRequest): Promise<WizardResult> {
  const outputDir = process.env.OUTPUT_DIR || "./output";
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const warnings: string[] = [];
  try {
    await page.goto("https://bc2gloves.com/cart", { timeout: 45000, waitUntil: "domcontentloaded" });
    const fields = await page.$$eval("label, [data-testid]", (elements) =>
      elements.map((el) => ({
        text: (el as HTMLElement).innerText?.trim(),
        testId: (el as HTMLElement).getAttribute("data-testid"),
      }))
    );
    const schemaPath = join(outputDir, "wizard_schema_snapshot.json");
    await fs.writeFile(schemaPath, JSON.stringify({ capturedAt: new Date().toISOString(), fields }, null, 2));

    const configuredPath = join(outputDir, "configured.png");
    await page.screenshot({ path: configuredPath, fullPage: true });

    await browser.close();
    return { schemaSnapshotPath: schemaPath, configuredImagePath: configuredPath, warnings };
  } catch (error) {
    warnings.push("Wizard automation failed or was blocked.");
    await browser.close();
    const schemaPath = join(outputDir, "wizard_schema_snapshot.json");
    await fs.writeFile(schemaPath, JSON.stringify({ error: String(error) }, null, 2));
    return { schemaSnapshotPath: schemaPath, warnings };
  }
}
