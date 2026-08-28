import { randomUUID } from "node:crypto";

export type AuditLevel = "info" | "success" | "warning" | "error";
export type AuditEvent = {
  id: string;
  at: string;
  actionId: string;
  type: string;
  summary: string;
  detail?: Record<string, unknown>;
  level: AuditLevel;
};

type AuditState = {
  events: AuditEvent[];
  processedWebhookIds: Set<string>;
  checkoutResults: Map<string, unknown>;
};

declare global {
  var __commerceAudit: AuditState | undefined;
}

const state: AuditState = globalThis.__commerceAudit ?? {
  events: [],
  processedWebhookIds: new Set<string>(),
  checkoutResults: new Map<string, unknown>(),
};

globalThis.__commerceAudit = state;

export function writeAudit(input: Omit<AuditEvent, "id" | "at">) {
  const event: AuditEvent = {
    id: randomUUID(),
    at: new Date().toISOString(),
    ...input,
  };
  state.events.unshift(event);
  state.events = state.events.slice(0, 80);
  return event;
}

export function listAudit() {
  return state.events;
}

export function hasProcessedWebhook(id: string) {
  return state.processedWebhookIds.has(id);
}

export function markWebhookProcessed(id: string) {
  state.processedWebhookIds.add(id);
}

export function getCheckoutResult(actionId: string) {
  return state.checkoutResults.get(actionId);
}

export function setCheckoutResult(actionId: string, result: unknown) {
  state.checkoutResults.set(actionId, result);
}
