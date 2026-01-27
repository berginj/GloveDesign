import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getDesign } from "../../customizer/store";

export async function getDesignHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const designId = request.params.designId;
  if (!designId) {
    return { status: 400, jsonBody: { error: "designId is required." } };
  }
  const design = getDesign(designId);
  if (!design) {
    return { status: 404, jsonBody: { error: "Design not found." } };
  }
  return { status: 200, jsonBody: design };
}

app.http("getDesign", {
  methods: ["GET"],
  authLevel: "function",
  route: "designs/{designId}",
  handler: getDesignHandler,
});
