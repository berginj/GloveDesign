import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { loadCatalog } from "../../customizer/catalog";
import { validateDesign } from "../../customizer/optionEngine";
import { createDesign } from "../../customizer/store";
import { DesignInput } from "../../customizer/types";

export async function createDesignHandler(request: HttpRequest): Promise<HttpResponseInit> {
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
  const design = createDesign(validation.correctedDesign ?? body);
  return { status: 201, jsonBody: { design, validation } };
}

app.http("createDesign", {
  methods: ["POST"],
  authLevel: "function",
  route: "designs",
  handler: createDesignHandler,
});
