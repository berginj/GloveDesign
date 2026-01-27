import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../customizer/catalog";
import { validateDesign } from "../../customizer/optionEngine";
import { updateDesign } from "../../customizer/store";
import { DesignInput } from "../../customizer/types";

export async function updateDesignHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const designId = request.params.designId;
  if (!designId) {
    return { status: 400, jsonBody: { error: "designId is required." } };
  }
  const body = (await request.json().catch(() => null)) as DesignInput | null;
  if (!body) {
    return { status: 400, jsonBody: { error: "Design payload is required." } };
  }
  const catalog = loadCatalog();
  const validation = validateDesign(body, catalog);
  const blocking = validation.issues.filter((issue) => issue.severity === "error");
  if (blocking.length) {
    return { status: 400, jsonBody: { error: "Design validation failed.", issues: blocking } };
  }
  const updated = updateDesign(designId, validation.correctedDesign ?? body);
  if (!updated) {
    return { status: 404, jsonBody: { error: "Design not found." } };
  }
  return { status: 200, jsonBody: { design: updated, validation } };
}

app.http("updateDesign", {
  methods: ["PUT"],
  authLevel: "function",
  route: "designs/{designId}",
  handler: updateDesignHandler,
});
