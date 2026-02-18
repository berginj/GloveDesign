import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../customizer/catalog";
import { validateDesign } from "../../customizer/optionEngine";
import { DesignInput } from "../../customizer/types";
import { ApiResponse, parseJsonBody } from "../../common/apiHelpers";

export async function validateDesignHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const bodyResult = await parseJsonBody<DesignInput>(request, "Design payload is required.");
  if ("error" in bodyResult) {
    return bodyResult.error;
  }

  const catalog = loadCatalog();
  const result = validateDesign(bodyResult.data, catalog);

  return ApiResponse.ok(result);
}

app.http("validateDesign", {
  methods: ["POST"],
  authLevel: "function",
  route: "validateDesign",
  handler: validateDesignHandler,
});
