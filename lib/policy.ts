import { findCatalogItem } from "@/lib/catalog";

export const MAX_TRANSACTION_PAISE = 1_000_000;
export const MAX_ITEMS = 5;

export type CartLine = { itemId: string; quantity: number };

export type VoucherInput = {
  code: string;
  discountPaise: number;
};

export type PlanType = "one-time" | "autopay-replenishment";

export class MoneyPolicyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "MoneyPolicyError";
  }
}

export function validateMoneyAction(
  lines: CartLine[],
  approved: boolean,
  voucher?: VoucherInput | null,
  planType: PlanType = "one-time",
  recurringCadenceDays?: number,
) {
  if (!approved) throw new MoneyPolicyError("Explicit buyer approval is required.", "APPROVAL_REQUIRED");
  if (!Array.isArray(lines) || lines.length === 0) throw new MoneyPolicyError("Cart is empty.", "EMPTY_CART");
  if (lines.length > MAX_ITEMS) {
    throw new MoneyPolicyError(`Cart exceeds the ${MAX_ITEMS}-item limit.`, "TOO_MANY_ITEMS");
  }
  if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
    throw new MoneyPolicyError("Duplicate cart lines are not allowed.", "DUPLICATE_ITEM");
  }

  let originalAmountPaise = 0;
  const resolved = lines.map((line) => {
    const item = findCatalogItem(line.itemId);
    if (!item) throw new MoneyPolicyError(`Unknown catalog item: ${line.itemId}`, "UNKNOWN_ITEM");
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 3) {
      throw new MoneyPolicyError(`Invalid quantity for ${item.name}.`, "INVALID_QUANTITY");
    }
    originalAmountPaise += item.pricePaise * line.quantity;
    return { ...item, quantity: line.quantity };
  });

  if (originalAmountPaise > MAX_TRANSACTION_PAISE) {
    throw new MoneyPolicyError("This purchase exceeds the agent's ₹10,000 spending boundary.", "AMOUNT_LIMIT");
  }

  let discountPaise = 0;
  if (voucher && typeof voucher.discountPaise === "number" && voucher.discountPaise > 0) {
    // Enforce merchant margin limit: max 35% discount allowed on any cart
    const maxDiscountAllowed = Math.round(originalAmountPaise * 0.35);
    discountPaise = Math.min(voucher.discountPaise, maxDiscountAllowed);
  }

  // 5% additional discount for automated recurring replenishment subscribers
  if (planType === "autopay-replenishment") {
    const subscriberDiscount = Math.round(originalAmountPaise * 0.05);
    discountPaise = Math.min(originalAmountPaise * 0.35, discountPaise + subscriberDiscount);
  }

  const finalAmountPaise = Math.max(100, originalAmountPaise - discountPaise); // Minimum 1 INR

  return {
    resolved,
    amountPaise: finalAmountPaise,
    originalAmountPaise,
    discountPaise,
    voucherCode: voucher?.code,
    planType,
    recurringCadenceDays: planType === "autopay-replenishment" ? (recurringCadenceDays ?? 20) : undefined,
  };
}
