import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getDesign, createOrder } from "../../customizer/store";
import { loadCatalog } from "../../customizer/catalog";
import { validateDesign } from "../../customizer/optionEngine";

export async function createOrderHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const body = (await request.json().catch(() => null)) as { designId?: string; customerInfo?: Record<string, string> } | null;
  if (!body?.designId || !body.customerInfo) {
    return { status: 400, jsonBody: { error: "designId and customerInfo are required." } };
  }
  const design = getDesign(body.designId);
  if (!design) {
    return { status: 404, jsonBody: { error: "Design not found." } };
  }

  const catalog = loadCatalog();
  const validation = validateDesign(design, catalog);
  const blocking = validation.issues.filter((issue) => issue.severity === "error");
  if (blocking.length) {
    return { status: 400, jsonBody: { error: "Design validation failed.", issues: blocking } };
  }
  if (!validation.priceBreakdown) {
    return { status: 500, jsonBody: { error: "Price breakdown unavailable." } };
  }
  const order = createOrder(body.designId, body.customerInfo, validation.priceBreakdown);
  return { status: 201, jsonBody: order };
}

app.http("createOrder", {
  methods: ["POST"],
  authLevel: "function",
  route: "orders",
  handler: createOrderHandler,
});
