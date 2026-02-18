import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getDesign } from "../../customizer/store";
import { ApiResponse, validateRequired } from "../../common/apiHelpers";

export async function getDesignHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const designId = request.params.designId;
  const validationError = validateRequired(designId, "designId");
  if (validationError) {
    return validationError;
  }

  const design = getDesign(designId);
  if (!design) {
    return ApiResponse.notFound("Design not found.");
  }

  return ApiResponse.ok(design);
}

app.http("getDesign", {
  methods: ["GET"],
  authLevel: "function",
  route: "designs/{designId}",
  handler: getDesignHandler,
});
