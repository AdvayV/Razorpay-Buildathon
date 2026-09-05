import { findCatalogItem, formatInr } from "@/lib/catalog";
import { demandSignalMap } from "@/lib/demand-trends";
import { issueDealPassport } from "@/lib/deal-passport";
import { merchantEconomics } from "@/lib/merchant-economics";
import { resolveCart } from "@/lib/policy";

export type NegotiationRequest = {
  actionId: string;
  items: Array<{ itemId: string; quantity: number }>;
  userOfferText: string;
};

export type DynamicVoucher = {
  code: string;
  discountPaise: number;
  discountPercent: number;
  reason: string;
  expiresAt: number;
  passport: string;
  securityMode: "configured-hmac" | "demo-hmac";
};

export type NegotiationResult = {
  status: "accepted" | "counter-offered" | "rejected";
  originalTotalPaise: number;
  finalTotalPaise: number;
  discountPaise: number;
  discountPercent: number;
  voucher?: DynamicVoucher;
  merchantRationale: string;
  buyerOfferExtractedPaise: number | null;
  agentDialogue: Array<{ speaker: "Buyer Agent" | "Merchant Sentinel"; message: string }>;
};

export async function negotiateDeal(req: NegotiationRequest): Promise<NegotiationResult> {
  const signalMap = demandSignalMap();
  if (typeof req.actionId !== "string" || req.actionId.length < 8) throw new Error("Invalid action ID.");
  const { resolved } = resolveCart(req.items);

  // 1. Resolve items and base total
  let originalTotalPaise = 0;
  let maxAllowableDiscountPaise = 0;
  const itemDetails: Array<{ name: string; pricePaise: number; direction: string; maxDiscountRate: number }> = [];

  for (const line of resolved) {
    const item = findCatalogItem(line.id)!;
    const lineTotal = item.pricePaise * line.quantity;
    originalTotalPaise += lineTotal;

    const signal = signalMap.get(item.id);
    const direction = signal?.direction ?? "stable";

    // Dynamic margin rules based on demand signals:
    // Falling demand = higher discount flexibility to clear stock (up to 25%)
    // Stable demand = moderate discount (up to 15%)
    // Rising demand = low discount (max 5%)
    let maxDiscountRate = 0.15;
    if (direction === "falling") maxDiscountRate = 0.25;
    if (direction === "rising") maxDiscountRate = 0.08;

    // Additional volume incentive if quantity > 1 or multiple items
    if (line.quantity >= 2 || req.items.length >= 2) {
      maxDiscountRate = Math.min(0.30, maxDiscountRate + 0.05);
    }

    const economics = merchantEconomics[item.id];
    if (!economics) throw new Error(`Missing merchant economics for ${item.id}.`);
    const protectedUnitPrice = Math.ceil(economics.costPaise * (1 + economics.minimumMarginBps / 10_000));
    const economicsDiscount = Math.max(0, lineTotal - protectedUnitPrice * line.quantity);
    const demandDiscount = Math.round(lineTotal * maxDiscountRate);
    const itemMaxDiscount = Math.min(economicsDiscount, demandDiscount);
    maxAllowableDiscountPaise += itemMaxDiscount;

    itemDetails.push({
      name: item.name,
      pricePaise: lineTotal,
      direction,
      maxDiscountRate,
    });
  }

  // 2. Parse buyer offer (e.g., "give for 800", "15% discount", "can you do 900")
  const text = req.userOfferText.toLowerCase();
  let requestedTargetPaise: number | null = null;
  let requestedDiscountPercent: number | null = null;

  const targetPriceMatch = text.match(/(?:for|at|take|pay|give)\s*(?:rs\.?|₹)?\s*(\d+)/i);
  const percentMatch = text.match(/(\d+)\s*%/);

  if (targetPriceMatch) {
    requestedTargetPaise = Number(targetPriceMatch[1]) * 100;
  } else if (percentMatch) {
    requestedDiscountPercent = Number(percentMatch[1]);
    requestedTargetPaise = Math.round(originalTotalPaise * (1 - requestedDiscountPercent / 100));
  }

  // Fallback if no specific number: default to requesting ~15% discount
  if (requestedTargetPaise === null) {
    requestedTargetPaise = Math.round(originalTotalPaise * 0.85);
  }

  const requestedDiscountPaise = Math.max(0, originalTotalPaise - requestedTargetPaise);
  const floorPricePaise = originalTotalPaise - maxAllowableDiscountPaise;

  let status: "accepted" | "counter-offered" | "rejected";
  let finalDiscountPaise = 0;
  let merchantRationale = "";
  let voucher: DynamicVoucher | undefined;

  if (requestedTargetPaise >= originalTotalPaise) {
    status = "rejected";
    finalDiscountPaise = 0;
    merchantRationale = `Offered amount (${formatInr(requestedTargetPaise)}) matches or exceeds standard price (${formatInr(originalTotalPaise)}). Standard checkout applies.`;
  } else if (requestedTargetPaise >= floorPricePaise) {
    // Accepted within policy margin
    status = "accepted";
    finalDiscountPaise = requestedDiscountPaise;
    const discountPercent = Math.round((finalDiscountPaise / originalTotalPaise) * 100);
    const voucherCode = `OFFER_DEAL_${discountPercent}PCT_${req.actionId.slice(0, 6).toUpperCase()}`;

    const expiresAt = Date.now() + 15 * 60 * 1000;
    const passport = issueDealPassport({ actionId: req.actionId, lines: req.items, code: voucherCode, discountPaise: finalDiscountPaise, expiresAt });
    voucher = {
      code: voucherCode,
      discountPaise: finalDiscountPaise,
      discountPercent,
      reason: `Buyer offer of ${formatInr(requestedTargetPaise)} meets merchant margin threshold (${discountPercent}% dynamic clearance/bundle discount).`,
      expiresAt,
      passport: passport.token,
      securityMode: passport.securityMode,
    };

    merchantRationale = `Accepted: Offer of ${formatInr(requestedTargetPaise)} preserves unit gross margins. Applied ${discountPercent}% dynamic discount.`;
  } else {
    // Counter-offer: propose floor price
    status = "counter-offered";
    finalDiscountPaise = maxAllowableDiscountPaise;
    const discountPercent = Math.round((finalDiscountPaise / originalTotalPaise) * 100);
    const counterOfferPaise = originalTotalPaise - finalDiscountPaise;
    const voucherCode = `COUNTER_OFFER_${discountPercent}PCT_${req.actionId.slice(0, 6).toUpperCase()}`;

    const expiresAt = Date.now() + 15 * 60 * 1000;
    const passport = issueDealPassport({ actionId: req.actionId, lines: req.items, code: voucherCode, discountPaise: finalDiscountPaise, expiresAt });
    voucher = {
      code: voucherCode,
      discountPaise: finalDiscountPaise,
      discountPercent,
      reason: `Merchant counter-offer: ${formatInr(counterOfferPaise)} is our lowest protected price.`,
      expiresAt,
      passport: passport.token,
      securityMode: passport.securityMode,
    };

    merchantRationale = `Requested ${formatInr(requestedTargetPaise)} exceeds maximum allowable discount (${formatInr(maxAllowableDiscountPaise)}). Counter-offered ${formatInr(counterOfferPaise)} (${discountPercent}% off).`;
  }

  const finalTotalPaise = originalTotalPaise - finalDiscountPaise;
  const discountPercent = originalTotalPaise > 0 ? Math.round((finalDiscountPaise / originalTotalPaise) * 100) : 0;

  const agentDialogue: Array<{ speaker: "Buyer Agent" | "Merchant Sentinel"; message: string }> = [
    {
      speaker: "Buyer Agent",
      message: `Proposing ${formatInr(requestedTargetPaise)} (requesting ${formatInr(requestedDiscountPaise)} off on ${formatInr(originalTotalPaise)} cart).`,
    },
    {
      speaker: "Merchant Sentinel",
      message:
        status === "accepted"
          ? `Deal approved! Margin check passed across ${itemDetails.length} items. Applying ${formatInr(finalDiscountPaise)} voucher.`
          : status === "counter-offered"
          ? `Offer below cost floor. Counter-offering ${formatInr(finalTotalPaise)} (${discountPercent}% off) based on inventory demand velocity.`
          : merchantRationale,
    },
  ];

  return {
    status,
    originalTotalPaise,
    finalTotalPaise,
    discountPaise: finalDiscountPaise,
    discountPercent,
    voucher,
    merchantRationale,
    buyerOfferExtractedPaise: requestedTargetPaise,
    agentDialogue,
  };
}
