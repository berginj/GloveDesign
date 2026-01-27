import { v4 as uuidv4 } from "uuid";
import { Design, DesignInput, Order, PriceBreakdown } from "./types";

const designs = new Map<string, Design>();
const orders = new Map<string, Order>();

export function createDesign(input: DesignInput): Design {
  const now = new Date().toISOString();
  const design: Design = {
    ...input,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
  designs.set(design.id, design);
  return design;
}

export function updateDesign(id: string, input: DesignInput): Design | null {
  const existing = designs.get(id);
  if (!existing) {
    return null;
  }
  const updated: Design = {
    ...existing,
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  };
  designs.set(id, updated);
  return updated;
}

export function getDesign(id: string): Design | null {
  return designs.get(id) ?? null;
}

export function createOrder(designId: string, customerInfo: Record<string, string>, priceBreakdown: PriceBreakdown): Order {
  const order: Order = {
    id: uuidv4(),
    designId,
    customerInfo,
    priceBreakdown,
    status: "review",
    createdAt: new Date().toISOString(),
  };
  orders.set(order.id, order);
  return order;
}

export function getOrder(id: string): Order | null {
  return orders.get(id) ?? null;
}
