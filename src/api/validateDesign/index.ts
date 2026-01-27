import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../customizer/catalog";
import { validateDesign } from "../../customizer/optionEngine";
import { DesignInput } from "../../customizer/types";

export async function validateDesignHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const catalog = loadCatalog();
  const body = (await request.json().catch(() => null)) as DesignInput | null;
  if (!body) {
    return { status: 400, jsonBody: { error: "Design payload is required." } };
  }
  const result = validateDesign(body, catalog);
  return { status: 200, jsonBody: result };
}

app.http("validateDesign", {
  methods: ["POST"],
  authLevel: "function",
  route: "validateDesign",
  handler: validateDesignHandler,
});
