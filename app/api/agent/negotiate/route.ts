import { NextResponse } from "next/server";
import { negotiateDeal, type NegotiationRequest } from "@/lib/negotiation";
import { formatInr } from "@/lib/catalog";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<NegotiationRequest>;
    if (!body.actionId || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Invalid negotiation request: missing items or actionId." }, { status: 400 });
    }

    const offerText = typeof body.userOfferText === "string" && body.userOfferText.trim().length > 0
      ? body.userOfferText.trim()
      : "10% bundle discount";

    const result = await negotiateDeal({
      actionId: body.actionId,
      items: body.items,
      userOfferText: offerText,
    });

    writeAudit({
      actionId: body.actionId,
      type: "agent.negotiation",
      summary: `Negotiation ${result.status}: ${result.discountPercent}% discount (${formatInr(result.discountPaise)} saved)`,
      detail: {
        status: result.status,
        buyerOfferText: offerText,
        originalTotalPaise: result.originalTotalPaise,
        finalTotalPaise: result.finalTotalPaise,
        discountPaise: result.discountPaise,
        discountPercent: result.discountPercent,
        voucherCode: result.voucher?.code,
        merchantRationale: result.merchantRationale,
        dialogue: result.agentDialogue,
      },
      level: result.status === "rejected" ? "warning" : "success",
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Negotiation error:", err);
    return NextResponse.json({ error: "Failed to process negotiation offer." }, { status: 500 });
  }
}
