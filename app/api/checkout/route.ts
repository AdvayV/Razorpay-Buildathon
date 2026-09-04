import { after, NextResponse } from "next/server";
import { writeAudit, getCheckoutResult, setCheckoutResult } from "@/lib/audit";
import { formatInr } from "@/lib/catalog";
import { MoneyPolicyError, validateMoneyAction, type CartLine, type VoucherInput, type PlanType } from "@/lib/policy";
import { createPaymentLinkWithMcp } from "@/lib/razorpay-mcp";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";

type CheckoutBody = {
  actionId?: unknown;
  approved?: unknown;
  items?: unknown;
  simulateFailure?: unknown;
  voucher?: unknown;
  planType?: unknown;
  recurringCadenceDays?: unknown;
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

    const voucher = body.voucher as VoucherInput | undefined;
    const planType: PlanType = body.planType === "autopay-replenishment" ? "autopay-replenishment" : "one-time";
    const cadenceDays = typeof body.recurringCadenceDays === "number" ? body.recurringCadenceDays : undefined;

    const { resolved, amountPaise, originalAmountPaise, discountPaise, voucherCode, recurringCadenceDays } = validateMoneyAction(
      body.items as CartLine[],
      body.approved === true,
      voucher,
      planType,
      cadenceDays,
    );

    const isAutopay = planType === "autopay-replenishment";

    writeAudit({
      actionId,
      type: "money.gate_passed",
      summary: `Buyer approved a bounded ${formatInr(amountPaise)} checkout${isAutopay ? ` (UPI Autopay every ${recurringCadenceDays} days)` : ""}${discountPaise > 0 ? ` (${formatInr(discountPaise)} total discount applied)` : ""}`,
      detail: {
        proposedAction: isAutopay ? "create_autopay_subscription" : "create_payment_link",
        planType,
        recurringCadenceDays,
        approvalReceived: true,
        pricingSource: "server-catalog",
        lines: resolved.map((item) => ({
          itemId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPricePaise: item.pricePaise,
          lineTotalPaise: item.pricePaise * item.quantity,
        })),
        originalAmountPaise,
        discountPaise,
        voucherCode,
        amountPaise,
        maxAllowedPaise: 1_000_000,
        checksPassed: [
          "explicit approval",
          "known catalog IDs",
          "quantity 1-3",
          "unique lines",
          "total at or below Rs. 10,000",
          isAutopay ? `UPI Autopay mandate schedule: every ${recurringCadenceDays} days` : "standard single transaction",
          voucherCode ? `voucher ${voucherCode} verified within 35% margin limit` : "standard pricing",
        ],
      },
      level: "success",
    });

    if (body.simulateFailure === true) throw new Error("Simulated Razorpay MCP timeout");

    const mockMode = process.env.PAYMENTS_MOCK_MODE !== "false";
    const referenceId = `agent_${actionId.replace(/-/g, "").slice(0, 18)}`;
    const result = mockMode
      ? {
          url: `/demo-payment?actionId=${encodeURIComponent(actionId)}&amount=${amountPaise}`,
          paymentLinkId: `plink_demo_${actionId.slice(0, 8)}`,
          provider: "mock" as const,
        }
      : await createPaymentLinkWithMcp({
          actionId,
          amountPaise,
          referenceId,
          description: `${isAutopay ? `[Autopay: ${recurringCadenceDays}d] ` : ""}${resolved.map((item) => `${item.quantity}× ${item.name}`).join(", ")}`,
        });

    const response = {
      ...result,
      amountPaise,
      originalAmountPaise,
      discountPaise,
      referenceId,
      planType,
      recurringCadenceDays,
    };
    setCheckoutResult(actionId, response);
    writeAudit({
      actionId,
      type: isAutopay ? "money.autopay_mandate_created" : "money.payment_link_created",
      summary: `${result.provider === "mock" ? "Demo" : "Razorpay MCP"} ${isAutopay ? "Autopay Mandate" : "payment link"} created`,
      detail: {
        actionPerformed: isAutopay ? "create_autopay_mandate" : "create_payment_link",
        planType,
        recurringCadenceDays,
        razorpayOrderCreated: false,
        amountPaise,
        originalAmountPaise,
        discountPaise,
        voucherCode,
        referenceId,
        paymentLinkId: result.paymentLinkId,
        provider: result.provider,
        reason: isAutopay
          ? `Autonomous recurring restock scheduled every ${recurringCadenceDays} days with 5% subscriber discount.`
          : "Created only after explicit buyer approval and all server-side policy checks passed.",
      },
      level: "success",
    });
    if (isTelegramConfigured()) after(async () => {
      const notification = await sendTelegramMessage({
        title: isAutopay ? "UPI Autopay Mandate created" : "Payment link created",
        lines: [
          `Amount: ${formatInr(amountPaise)}`,
          isAutopay ? `Schedule: Recurring every ${recurringCadenceDays} days` : "",
          discountPaise > 0 ? `Discount: ${formatInr(discountPaise)} (${voucherCode || "Autopay 5%"})` : "",
          `Reference: ${referenceId}`,
          `Provider: ${result.provider}`,
        ].filter(Boolean),
        level: "info",
      });
      writeAudit({
        actionId,
        type: notification.sent ? "telegram.sent" : "telegram.skipped",
        summary: notification.sent ? "Merchant notified on Telegram" : notification.reason,
        level: notification.sent ? "success" : "info",
      });
    });
    return NextResponse.json(response);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown checkout error";
    const policyBlocked = error instanceof MoneyPolicyError;
    writeAudit({
      actionId,
      type: policyBlocked ? "money.action_blocked" : "money.action_failed",
      summary: policyBlocked ? "Policy blocked the money action before checkout" : "Checkout stopped safely; no payment link was issued",
      detail: { reason, policyCode: policyBlocked ? error.code : undefined },
      level: policyBlocked ? "warning" : "error",
    });
    if (isTelegramConfigured()) after(async () => {
      const notification = await sendTelegramMessage({
        title: "Checkout stopped safely",
        lines: [`Action: ${actionId}`, `Reason: ${reason}`, "No payment link was issued."],
        level: "error",
      });
      writeAudit({
        actionId,
        type: notification.sent ? "telegram.sent" : "telegram.skipped",
        summary: notification.sent ? "Failure notification sent to Telegram" : notification.reason,
        level: notification.sent ? "success" : "info",
      });
    });
    return NextResponse.json(
      {
        error: policyBlocked
          ? `Checkout blocked by policy: ${reason}`
          : "Checkout is temporarily unavailable. Nothing was charged; you can retry safely.",
        reason,
      },
      { status: policyBlocked ? 422 : 503 },
    );
  }
}
