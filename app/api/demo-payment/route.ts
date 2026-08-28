import { after, NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = (await request.json()) as { actionId?: string; status?: string };
  if (!body.actionId || !["paid", "failed"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Invalid demo payment event." }, { status: 400 });
  }
  const paid = body.status === "paid";
  writeAudit({
    actionId: body.actionId,
    type: paid ? "webhook.payment_link.paid" : "webhook.payment.failed",
    summary: paid ? "Demo payment confirmed" : "Demo payment failed; cart remains retryable",
    detail: { source: "local-demo" },
    level: paid ? "success" : "warning",
  });
  if (isTelegramConfigured()) after(async () => {
    const notification = await sendTelegramMessage({
      title: paid ? "Demo payment confirmed" : "Demo payment failed",
      lines: [`Action: ${body.actionId}`, "Source: Revenue Pilot local checkout"],
      level: paid ? "success" : "warning",
    });
    writeAudit({
      actionId: body.actionId!,
      type: notification.sent ? "telegram.sent" : "telegram.skipped",
      summary: notification.sent ? "Demo result sent to Telegram" : notification.reason,
      level: notification.sent ? "success" : "info",
    });
  });
  return NextResponse.json({ ok: true });
}
