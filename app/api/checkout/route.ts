import { after, NextResponse } from "next/server";
import { writeAudit, getCheckoutResult, setCheckoutResult } from "@/lib/audit";
import { formatInr } from "@/lib/catalog";
import { verifyDealPassport } from "@/lib/deal-passport";
import { MoneyPolicyError, validateMoneyAction, type CartLine } from "@/lib/policy";
import { createPaymentLinkWithMcp } from "@/lib/razorpay-mcp";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";

type CheckoutBody = {
  actionId?: unknown;
  approved?: unknown;
  items?: unknown;
  simulateFailure?: unknown;
  dealPassport?: unknown;
};

export async function POST(request: Request) {
  let actionId = "unknown";
  try {
    const body = (await request.json()) as CheckoutBody;
    if (typeof body.actionId !== "string" || body.actionId.length < 8) {
      return NextResponse.json({ error: "Missing agent action ID." }, { status: 400 });
    }
    actionId = body.actionId;
    const existing = getCheckoutResult(actionId);
    if (existing) {
      writeAudit({ actionId, type: "money.idempotent_replay", summary: "Returned the existing checkout safely", level: "warning" });
      return NextResponse.json(existing);
    }

    const lines = body.items as CartLine[];
    let authorizedDiscount: { code: string; discountPaise: number } | null = null;
    let dealSecurityMode: string | undefined;
    if (typeof body.dealPassport === "string" && body.dealPassport.length > 0) {
      try {
        const deal = verifyDealPassport(body.dealPassport, actionId, lines);
        authorizedDiscount = { code: deal.code, discountPaise: deal.discountPaise };
        dealSecurityMode = deal.securityMode;
      } catch (error) {
        throw new MoneyPolicyError(error instanceof Error ? error.message : "Invalid deal passport.", "INVALID_DEAL_PASSPORT");
      }
    }

    const { resolved, amountPaise, originalAmountPaise, discountPaise, voucherCode } =
      validateMoneyAction(lines, body.approved === true, authorizedDiscount);

    writeAudit({
      actionId,
      type: "money.gate_passed",
      summary: `Buyer approved a bounded ${formatInr(amountPaise)} one-time checkout${discountPaise > 0 ? ` (${formatInr(discountPaise)} signed deal applied)` : ""}`,
      detail: {
        proposedAction: "create_payment_link",
        approvalReceived: true,
        pricingSource: "server-catalog",
        lines: resolved.map((item) => ({ itemId: item.id, name: item.name, quantity: item.quantity, unitPricePaise: item.pricePaise, lineTotalPaise: item.pricePaise * item.quantity })),
        originalAmountPaise,
        discountPaise,
        voucherCode,
        dealSecurityMode,
        amountPaise,
        maxAllowedPaise: 1_000_000,
        checksPassed: ["explicit approval", "known catalog IDs", "quantity 1-3", "unique lines", "total at or below Rs. 10,000", "standard single transaction", voucherCode ? `deal ${voucherCode} verified by ${dealSecurityMode}` : "standard pricing"],
      },
      level: "success",
    });

    if (body.simulateFailure === true) throw new Error("Simulated Razorpay MCP timeout");
    const mockMode = process.env.PAYMENTS_MOCK_MODE !== "false";
    const referenceId = `agent_${actionId.replace(/-/g, "").slice(0, 18)}`;
    const result = mockMode
      ? { url: `/demo-payment?actionId=${encodeURIComponent(actionId)}&amount=${amountPaise}`, paymentLinkId: `plink_demo_${actionId.slice(0, 8)}`, provider: "mock" as const }
      : await createPaymentLinkWithMcp({ actionId, amountPaise, referenceId, description: resolved.map((item) => `${item.quantity} x ${item.name}`).join(", ") });

    const response = { ...result, amountPaise, originalAmountPaise, discountPaise, referenceId, planType: "one-time" as const };
    setCheckoutResult(actionId, response);
    writeAudit({
      actionId,
      type: "money.payment_link_created",
      summary: `${result.provider === "mock" ? "Demo" : "Razorpay MCP"} payment link created`,
      detail: { actionPerformed: "create_payment_link", planType: "one-time", razorpayOrderCreated: false, amountPaise, originalAmountPaise, discountPaise, voucherCode, referenceId, paymentLinkId: result.paymentLinkId, provider: result.provider, reason: "Created only after explicit buyer approval and all server-side policy checks passed." },
      level: "success",
    });
    if (isTelegramConfigured()) after(async () => {
      const notification = await sendTelegramMessage({ title: "Payment link created", lines: [`Amount: ${formatInr(amountPaise)}`, discountPaise > 0 ? `Signed deal: ${formatInr(discountPaise)} (${voucherCode})` : "", `Reference: ${referenceId}`, `Provider: ${result.provider}`].filter(Boolean), level: "info" });
      writeAudit({ actionId, type: notification.sent ? "telegram.sent" : "telegram.skipped", summary: notification.sent ? "Merchant notified on Telegram" : notification.reason, level: notification.sent ? "success" : "info" });
    });
    return NextResponse.json(response);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown checkout error";
    const policyBlocked = error instanceof MoneyPolicyError;
    writeAudit({ actionId, type: policyBlocked ? "money.action_blocked" : "money.action_failed", summary: policyBlocked ? "Policy blocked the money action before checkout" : "Checkout stopped safely; no payment link was issued", detail: { reason, policyCode: policyBlocked ? error.code : undefined }, level: policyBlocked ? "warning" : "error" });
    if (isTelegramConfigured()) after(async () => {
      const notification = await sendTelegramMessage({ title: "Checkout stopped safely", lines: [`Action: ${actionId}`, `Reason: ${reason}`, "No payment link was issued."], level: "error" });
      writeAudit({ actionId, type: notification.sent ? "telegram.sent" : "telegram.skipped", summary: notification.sent ? "Failure notification sent to Telegram" : notification.reason, level: notification.sent ? "success" : "info" });
    });
    return NextResponse.json({ error: policyBlocked ? `Checkout blocked by policy: ${reason}` : "Checkout is temporarily unavailable. Nothing was charged; you can retry safely.", reason }, { status: policyBlocked ? 422 : 503 });
  }
}
