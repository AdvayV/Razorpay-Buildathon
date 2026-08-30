import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { makeRecommendation } from "@/lib/agent";
import { formatInr } from "@/lib/catalog";
import { writeAudit } from "@/lib/audit";
import { buildOptionalNarrative } from "@/lib/ai-explainer";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown };
    if (typeof body.message !== "string" || body.message.trim().length < 3) {
      return NextResponse.json({ error: "Tell the agent what you are shopping for." }, { status: 400 });
    }

    const actionId = randomUUID();
    const recommendation = makeRecommendation(body.message.trim());
    const narrative = await buildOptionalNarrative({
      deterministicText: recommendation.explanation,
      facts: {
        inferredTags: recommendation.inferredTags,
        buyerBudgetPaise: recommendation.budgetPaise,
        totalPaise: recommendation.totalPaise,
        selectedItems: recommendation.items.map((item) => ({
          name: item.name,
          pricePaise: item.pricePaise,
          evidence: item.selectionEvidence,
        })),
        counterfactual: recommendation.decisionEvidence.counterfactual,
        moneyActionState: recommendation.moneyAction,
      },
    });
    writeAudit({
      actionId,
      type: "agent.recommendation",
      summary: `Proposed ${recommendation.items.length} items with ${formatInr(recommendation.incrementalRevenuePaise)} growth uplift`,
      detail: {
        buyerIntent: body.message.trim(),
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
        counterfactual: recommendation.decisionEvidence.counterfactual,
        explanationSource: narrative.source,
        explanationModel: narrative.model,
        moneyActionState: recommendation.moneyAction.state,
      },
      level: "info",
    });

    return NextResponse.json({ actionId, ...recommendation, narrative });
  } catch {
    return NextResponse.json({ error: "The agent could not form a recommendation." }, { status: 500 });
  }
}
