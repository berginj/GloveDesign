import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { getOrder } from "../../customizer/store";

export async function getOrderHandler(request: HttpRequest): Promise<HttpResponseInit> {
  const orderId = request.params.orderId;
  if (!orderId) {
    return { status: 400, jsonBody: { error: "orderId is required." } };
  }
  const order = getOrder(orderId);
  if (!order) {
    return { status: 404, jsonBody: { error: "Order not found." } };
  }
  return { status: 200, jsonBody: order };
}

app.http("getOrder", {
  methods: ["GET"],
  authLevel: "function",
  route: "orders/{orderId}",
  handler: getOrderHandler,
});
