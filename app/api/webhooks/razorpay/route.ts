import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { hasProcessedWebhook, markWebhookProcessed, writeAudit } from "@/lib/audit";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function safeEqual(received: string, expected: string) {
  const left = Buffer.from(received, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!safeEqual(signature, expected)) {
    writeAudit({
      actionId: "webhook",
      type: "webhook.rejected",
      summary: "Rejected a webhook with an invalid signature",
      detail: { reason: "signature-mismatch", signaturePresent: signature.length > 0 },
      level: "error",
    });
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const eventId = request.headers.get("x-razorpay-event-id") ?? expected;
  if (hasProcessedWebhook(eventId)) {
    writeAudit({
      actionId: eventId,
      type: "webhook.duplicate_ignored",
      summary: "Ignored a duplicate Razorpay webhook safely",
      detail: { eventId, reason: "event-id-already-processed" },
      level: "warning",
    });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  let payload: { event?: string; payload?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    writeAudit({
      actionId: eventId,
      type: "webhook.rejected",
      summary: "Rejected a signed webhook with malformed JSON",
      detail: { eventId, reason: "malformed-json" },
      level: "error",
    });
    return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
  }

  markWebhookProcessed(eventId);
  const eventName = payload.event ?? "unknown";
  writeAudit({
    actionId: eventId,
    type: `webhook.${eventName}`,
    summary: `Verified and accepted Razorpay event: ${eventName}`,
    detail: { eventId },
    level: eventName.includes("failed") ? "warning" : "success",
  });
  if (isTelegramConfigured()) after(async () => {
    const failed = eventName.includes("failed");
    const notification = await sendTelegramMessage({
      title: failed ? "Razorpay payment event needs attention" : "Razorpay payment confirmed",
      lines: [`Event: ${eventName}`, `Event ID: ${eventId}`],
      level: failed ? "warning" : "success",
    });
    writeAudit({
      actionId: eventId,
      type: notification.sent ? "telegram.sent" : "telegram.skipped",
      summary: notification.sent ? "Razorpay event sent to Telegram" : notification.reason,
      level: notification.sent ? "success" : "info",
    });
  });

  return NextResponse.json({ ok: true });
}
