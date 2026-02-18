import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../customizer/catalog";
import { validateDesign } from "../../customizer/optionEngine";
import { updateDesign } from "../../customizer/store";
import { DesignInput } from "../../customizer/types";
import { ApiResponse, parseJsonBody, validateRequired } from "../../common/apiHelpers";

export async function updateDesignHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const designId = request.params.designId;
  const validationError = validateRequired(designId, "designId");
  if (validationError) {
    return validationError;
  }

  const bodyResult = await parseJsonBody<DesignInput>(request, "Design payload is required.");
  if ("error" in bodyResult) {
    return bodyResult.error;
  }
  const body = bodyResult.data;
  const catalog = loadCatalog();
  const validation = validateDesign(body, catalog);
  const blocking = validation.issues.filter((issue) => issue.severity === "error");
  if (blocking.length) {
    return ApiResponse.badRequest("Design validation failed.", { issues: blocking });
  }

  const updated = updateDesign(designId, validation.correctedDesign ?? body);
  if (!updated) {
    return ApiResponse.notFound("Design not found.");
  }

  return ApiResponse.ok({ design: updated, validation });
}

app.http("updateDesign", {
  methods: ["PUT"],
  authLevel: "function",
  route: "designs/{designId}",
  handler: updateDesignHandler,
});
