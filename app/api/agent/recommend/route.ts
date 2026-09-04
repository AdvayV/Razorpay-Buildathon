import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { makeRecommendation } from "@/lib/agent";
import { formatInr } from "@/lib/catalog";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown };
    if (typeof body.message !== "string" || body.message.trim().length < 3) {
      return NextResponse.json({ error: "Tell the agent what you are shopping for." }, { status: 400 });
    }

    const actionId = randomUUID();
    const recommendation = await makeRecommendation(body.message.trim());
    writeAudit({
      actionId,
      type: "agent.recommendation",
      summary: `Proposed ${recommendation.items.length} items (${recommendation.intelligenceSource === "groq-llm" ? "Groq LLM" : "Local engine"}) with ${formatInr(recommendation.incrementalRevenuePaise)} uplift`,
      detail: {
        buyerIntent: body.message.trim(),
        intelligenceSource: recommendation.intelligenceSource,
        inferredTags: recommendation.inferredTags,
        budgetPaise: recommendation.budgetPaise,
        selectedItemIds: recommendation.items.map((item) => item.id),
        incrementalRevenuePaise: recommendation.incrementalRevenuePaise,
        upliftPercent: recommendation.upliftPercent,
        demandSource: recommendation.demandOverview.source,
        demandSignals: recommendation.items.map((item) => ({
          itemId: item.id,
          direction: item.demand?.direction,
          changePercent: item.demand?.changePercent,
        })),
        scoringFormula: recommendation.decisionEvidence.scoringFormula,
        candidateEvidence: recommendation.decisionEvidence.candidates,
        decisionSummary: recommendation.decisionEvidence.summary,
        counterfactual: recommendation.decisionEvidence.counterfactual,
        marketComparisons: recommendation.items.map((item) => ({
          itemId: item.id,
          snapshotAsOf: item.marketComparison?.asOf,
          cheapestOfferId: item.marketComparison?.cheapestOfferId,
          localDifferencePaise: item.marketComparison?.localDifferencePaise,
          localOfferCheckoutEligible: true,
          externalOffersCheckoutEligible: false,
        })),
        explanationSource: recommendation.intelligenceSource,
        moneyActionState: recommendation.moneyAction.state,
      },
      level: "info",
    });

    return NextResponse.json({ actionId, ...recommendation });
  } catch (err) {
    console.error("Agent recommendation error:", err);
    return NextResponse.json({ error: "The agent could not form a recommendation." }, { status: 500 });
  }
}
