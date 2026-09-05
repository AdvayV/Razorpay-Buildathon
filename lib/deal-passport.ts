import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { CartLine } from "@/lib/policy";

type DealPayload = {
  v: 1;
  actionId: string;
  cartHash: string;
  code: string;
  discountPaise: number;
  expiresAt: number;
};

const DEMO_SECRET = "razorpay-buildathon-demo-signing-key-not-for-production";

function getSigningKey() {
  const configured = process.env.DEAL_SIGNING_SECRET;
  if (configured) return { key: configured, securityMode: "configured-hmac" as const };
  if (process.env.PAYMENTS_MOCK_MODE !== "false") return { key: DEMO_SECRET, securityMode: "demo-hmac" as const };
  throw new Error("DEAL_SIGNING_SECRET is required when real payments are enabled.");
}

export function cartFingerprint(lines: CartLine[]) {
  const canonical = [...lines].map(({ itemId, quantity }) => `${itemId}:${quantity}`).sort().join("|");
  return createHmac("sha256", "cart-fingerprint-v1").update(canonical).digest("hex");
}

export function issueDealPassport(input: Omit<DealPayload, "v" | "cartHash"> & { lines: CartLine[] }) {
  const { key, securityMode } = getSigningKey();
  const payload: DealPayload = {
    v: 1,
    actionId: input.actionId,
    cartHash: cartFingerprint(input.lines),
    code: input.code,
    discountPaise: input.discountPaise,
    expiresAt: input.expiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", key).update(encoded).digest("base64url");
  return { token: `${encoded}.${signature}`, securityMode };
}

export function verifyDealPassport(token: string, actionId: string, lines: CartLine[]) {
  const { key, securityMode } = getSigningKey();
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("Malformed deal passport.");
  const expected = createHmac("sha256", key).update(encoded).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("Deal passport signature is invalid.");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DealPayload;
  if (payload.v !== 1 || payload.actionId !== actionId) throw new Error("Deal passport belongs to another action.");
  if (payload.cartHash !== cartFingerprint(lines)) throw new Error("Cart changed after this deal was issued.");
  if (!Number.isSafeInteger(payload.discountPaise) || payload.discountPaise < 1) throw new Error("Invalid deal amount.");
  if (!Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= Date.now()) throw new Error("Deal passport has expired.");
  return { ...payload, securityMode };
}
