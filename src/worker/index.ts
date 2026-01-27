import { chromium, Page } from "playwright";
import { createServer } from "http";
import { promises as fs } from "fs";
import { join } from "path";
import { createBlobClient, createServiceBusClient } from "../common/azureClients";
import { writeBlob } from "../common/storage";
import { ArtifactLocation, PaletteResult, WizardRequest, WizardResult } from "../common/types";

const WIZARD_URL = "https://bc2gloves.com/cart";
const DEFAULT_OUTPUT_DIR = "./output";

type SelectOption = { value: string; label: string };
type SelectField = { selector: string; label?: string; name?: string; options: SelectOption[] };

export async function runWizard(request: WizardRequest): Promise<WizardResult> {
  const outputDir = process.env.OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: process.env.WORKER_HEADLESS !== "false" });
  const page = await browser.newPage();
  const warnings: string[] = [];
  let autofillSucceeded = false;

  try {
    await page.goto(WIZARD_URL, { timeout: 45000, waitUntil: "domcontentloaded" });
    const blocked = await detectBlocked(page);
    if (blocked) {
      warnings.push(blocked);
      const schemaSnapshot = await captureSchemaSnapshot(page, request.jobId, outputDir);
      await browser.close();
      return await finalizeResult(request.jobId, schemaSnapshot, warnings, false);
    }

    const schemaSnapshot = await captureSchemaSnapshot(page, request.jobId, outputDir);
    const selects = await collectSelectFields(page);
    const mapping = mapSelections(selects, request.design.palette);
    if (!mapping.ok) {
      warnings.push(mapping.reason);
      await browser.close();
      return await finalizeResult(request.jobId, schemaSnapshot, warnings, false);
    }

    for (const selection of mapping.selections) {
      await page.selectOption(selection.selector, selection.value);
    }

    const logoApplied = await uploadLogoIfAvailable(page, request.logoBlobPath);
    if (!logoApplied) {
      warnings.push("Logo upload was not applied (no supported file input found).");
    }

    const configuredPath = join(outputDir, "configured.png");
    await page.screenshot({ path: configuredPath, fullPage: true });
    await browser.close();
    autofillSucceeded = true;

    const configuredImage = await uploadWorkerArtifact(request.jobId, configuredPath, "configured.png", "image/png");
    const schemaArtifact = await uploadWorkerArtifact(
      request.jobId,
      schemaSnapshot.path,
      "wizard_schema_snapshot.json",
      "application/json"
    );

    return {
      schemaSnapshot: schemaArtifact ?? schemaSnapshot,
      configuredImage: configuredImage ?? undefined,
      warnings,
      autofillAttempted: true,
      autofillSucceeded,
      mappingConfidence: mapping.confidence,
      manualSteps: autofillSucceeded ? undefined : defaultManualSteps(),
    };
  } catch (error) {
    warnings.push("Wizard automation failed or was blocked.");
    const schemaSnapshot = await captureSchemaSnapshot(page, request.jobId, outputDir, error);
    await browser.close();
    return await finalizeResult(request.jobId, schemaSnapshot, warnings, false);
  }
}

async function captureSchemaSnapshot(page: Page, jobId: string, outputDir: string, error?: unknown): Promise<ArtifactLocation> {
  const fields = await page.$$eval("label, select, input, textarea", (elements) =>
    elements.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el as any).innerText?.trim(),
      name: (el as any).name,
      id: (el as any).id,
      type: (el as any).type,
    }))
  );
  const snapshot = {
    capturedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    fields,
    error: error ? String(error) : undefined,
  };
  const schemaPath = join(outputDir, "wizard_schema_snapshot.json");
  await fs.writeFile(schemaPath, JSON.stringify(snapshot, null, 2));
  return { path: schemaPath, url: "" };
}

async function collectSelectFields(page: Page): Promise<SelectField[]> {
  return page.$$eval("select", (elements) =>
    elements.map((el) => {
      const select = el as any;
      const label = select.labels?.[0]?.innerText?.trim();
      const options = Array.from(select.options).map((option) => ({
        value: (option as any).value,
        label: (option as any).textContent?.trim() ?? (option as any).value,
      }));
      const selector = select.id ? `#${select.id}` : select.name ? `select[name="${select.name}"]` : "select";
      return {
        selector,
        label,
        name: select.name,
        options,
      };
    })
  );
}

function mapSelections(selects: SelectField[], palette: PaletteResult): { ok: true; selections: Array<{ selector: string; value: string }>; confidence: number } | { ok: false; reason: string } {
  const selections: Array<{ selector: string; value: string; confidence: number }> = [];
  const paletteMap = {
    primary: palette.primary.hex,
    secondary: palette.secondary.hex,
    accent: palette.accent.hex,
    neutral: palette.neutral.hex,
  };

  for (const select of selects) {
    const label = (select.label || select.name || "").toLowerCase();
    if (!/color|palm|back|web|lace|stitch|binding|wrist|accent|primary|secondary/i.test(label)) {
      continue;
    }
    const target = pickTargetColor(label, paletteMap);
    const targetName = nearestColorName(target);
    const option = select.options.find((opt) => opt.label.toLowerCase().includes(targetName.name));
    if (!option) {
      return { ok: false, reason: `Could not map color for "${label || select.selector}".` };
    }
    const confidence = targetName.confidence;
    selections.push({ selector: select.selector, value: option.value, confidence });
  }

  if (!selections.length) {
    return { ok: false, reason: "No color fields detected for mapping." };
  }
  const averageConfidence = selections.reduce((sum, s) => sum + s.confidence, 0) / selections.length;
  if (averageConfidence < 0.55) {
    return { ok: false, reason: "Mapping confidence too low for safe autofill." };
  }

  return {
    ok: true,
    selections: selections.map((selection) => ({ selector: selection.selector, value: selection.value })),
    confidence: averageConfidence,
  };
}

function pickTargetColor(label: string, palette: Record<string, string>): string {
  if (/primary|palm|back/i.test(label)) {
    return palette.primary;
  }
  if (/secondary|web/i.test(label)) {
    return palette.secondary;
  }
  if (/accent|stitch/i.test(label)) {
    return palette.accent;
  }
  if (/lace|binding|wrist|neutral/i.test(label)) {
    return palette.neutral;
  }
  return palette.primary;
}

async function uploadLogoIfAvailable(page: Page, logoBlobPath?: string): Promise<boolean> {
  if (!logoBlobPath) {
    return false;
  }
  const fileInputs = await page.$$("input[type='file']");
  if (!fileInputs.length) {
    return false;
  }
  const logoPath = await downloadLogoToTemp(logoBlobPath);
  if (!logoPath) {
    return false;
  }
  await fileInputs[0].setInputFiles(logoPath);
  return true;
}

async function downloadLogoToTemp(blobPath: string): Promise<string | null> {
  const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  if (!blobUrl) {
    return null;
  }
  const client = createBlobClient(blobUrl);
  const container = client.getContainerClient(containerName);
  const blob = container.getBlobClient(blobPath);
  const response = await blob.download();
  const buffer = await streamToBuffer(response.readableStreamBody);
  if (!buffer) {
    return null;
  }
  const tempPath = join(process.env.OUTPUT_DIR || DEFAULT_OUTPUT_DIR, "logo-upload");
  await fs.writeFile(tempPath, buffer);
  return tempPath;
}

async function uploadWorkerArtifact(jobId: string, localPath: string, name: string, contentType: string): Promise<ArtifactLocation | null> {
  const blobUrl = process.env.BLOB_URL || process.env.BLOB_CONNECTION_STRING;
  const containerName = process.env.BLOB_CONTAINER || "glovejobs";
  if (!blobUrl) {
    return null;
  }
  const client = createBlobClient(blobUrl);
  const content = await fs.readFile(localPath);
  const result = await writeBlob(client, containerName, `jobs/${jobId}/${name}`, content, contentType, jobId, "wizard");
  return { path: result.path, url: result.url };
}

async function detectBlocked(page: Page): Promise<string | null> {
  const body = (await page.content()).toLowerCase();
  if (
    body.includes("captcha") ||
    body.includes("access denied") ||
    body.includes("blocked") ||
    body.includes("sign in") ||
    body.includes("login")
  ) {
    return "Autofill blocked by site protections.";
  }
  return null;
}

async function finalizeResult(
  jobId: string,
  schemaSnapshot: ArtifactLocation,
  warnings: string[],
  succeeded: boolean
): Promise<WizardResult> {
  const uploadedSchema = await uploadWorkerArtifact(jobId, schemaSnapshot.path, "wizard_schema_snapshot.json", "application/json");
  return {
    schemaSnapshot: uploadedSchema ?? schemaSnapshot,
    warnings,
    autofillAttempted: true,
    autofillSucceeded: succeeded,
    manualSteps: succeeded ? undefined : defaultManualSteps(),
  };
}

function defaultManualSteps(): string[] {
  return [
    "Open https://bc2gloves.com/cart and start the glove wizard.",
    "Select glove model and size, then choose colors matching the proposal palette.",
    "Upload the logo from the job artifacts.",
    "Review the preview and adjust contrast if any panel colors blend together.",
    "Save screenshots of the configuration for approval.",
  ];
}

function nearestColorName(hex: string): { name: string; confidence: number } {
  const palette = [
    { name: "black", hex: "#000000" },
    { name: "white", hex: "#ffffff" },
    { name: "gray", hex: "#808080" },
    { name: "navy", hex: "#001f3f" },
    { name: "blue", hex: "#005eff" },
    { name: "red", hex: "#d0021b" },
    { name: "maroon", hex: "#800000" },
    { name: "orange", hex: "#f26b38" },
    { name: "gold", hex: "#d4af37" },
    { name: "yellow", hex: "#f5d000" },
    { name: "green", hex: "#2ecc40" },
    { name: "teal", hex: "#39cccc" },
    { name: "purple", hex: "#6f42c1" },
    { name: "pink", hex: "#f783ac" },
    { name: "brown", hex: "#8b4513" },
    { name: "tan", hex: "#d2b48c" },
  ];

  let best = palette[0];
  let bestDist = Infinity;
  for (const color of palette) {
    const dist = colorDistance(hex, color.hex);
    if (dist < bestDist) {
      bestDist = dist;
      best = color;
    }
  }
  const confidence = Math.max(0.4, 1 - bestDist / 200);
  return { name: best.name, confidence };
}

function colorDistance(a: string, b: string): number {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

async function streamToBuffer(stream?: NodeJS.ReadableStream | null): Promise<Buffer | null> {
  if (!stream) {
    return null;
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (data) => chunks.push(Buffer.from(data)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function runWorkerServer(port = 7072) {
  const server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body) as WizardRequest;
        const result = await runWizard(parsed);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
  });
  server.listen(port);
  console.log(`Wizard worker listening on ${port}`);
}

async function processQueueOnce() {
  const queueName = process.env.WIZARD_QUEUE;
  const replyQueue = process.env.WIZARD_RESULTS_QUEUE || (queueName ? `${queueName}-results` : undefined);
  const sbNamespace = process.env.SERVICEBUS_NAMESPACE || process.env.SERVICEBUS_CONNECTION;
  if (!queueName || !replyQueue || !sbNamespace) {
    console.error("Wizard queue processing not configured.");
    return;
  }
  const client = createServiceBusClient(sbNamespace);
  const receiver = client.createReceiver(queueName);
  const messages = await receiver.receiveMessages(1, { maxWaitTimeInMs: 10000 });
  if (!messages.length) {
    await receiver.close();
    await client.close();
    console.log("No wizard messages received.");
    return;
  }
  const message = messages[0];
  const request = message.body as WizardRequest;
  const result = await runWizard(request);
  const sender = client.createSender(replyQueue);
  await sender.sendMessages({ body: result, correlationId: message.correlationId || request.jobId });
  await sender.close();
  await receiver.completeMessage(message);
  await receiver.close();
  await client.close();
}

if (require.main === module) {
  const mode = process.argv[2];
  if (mode === "--server") {
    const port = process.env.PORT ? Number(process.env.PORT) : 7072;
    runWorkerServer(port).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  } else {
    processQueueOnce().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}
