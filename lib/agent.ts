import { catalog, formatInr } from "@/lib/catalog";
import { demandSignalMap, getDemandSignals, type DemandDirection } from "@/lib/demand-trends";
import { compareMarketOffers } from "@/lib/market-comparison";
import { isGroqConfigured, parseQueryWithGroq } from "@/lib/groq";
import { getQuickCommerceComparison } from "@/lib/quick-commerce";
import { calculateConsumptionForecast, type HouseholdProfile } from "@/lib/consumption-engine";

function extractBudgetPaise(message: string) {
  const match = message.replace(/,/g, "").match(/(?:under|below|budget|upto|up to)\s*(?:rs\.?|₹)?\s*(\d+)/i);
  return match ? Number(match[1]) * 100 : 250000;
}

function demandBoost(direction: DemandDirection) {
  if (direction === "rising") return 2;
  if (direction === "falling") return -1;
  return 0;
}

// Extract family size and daily usage context from natural language
function extractHouseholdContext(message: string): HouseholdProfile {
  const normalized = message.toLowerCase();

  // Match family size e.g. "2 member family", "family of 4", "3 people", "2 person"
  let familyMembers = 2;
  const memberMatch = normalized.match(/(?:family of|for)\s*(\d+)|\b(\d+)\s*(?:member|person|people|members|persons)/i);
  if (memberMatch) {
    familyMembers = parseInt(memberMatch[1] || memberMatch[2], 10);
  }

  // Match cups/servings per day e.g. "2 cups a day", "3 times daily", "1 cup per day"
  let dailyServingsPerMember = 2;
  const servingMatch = normalized.match(/(\d+)\s*(?:cups?|servings?|times?|washes?)\s*(?:a|per|\/)\s*day/i);
  if (servingMatch) {
    dailyServingsPerMember = parseInt(servingMatch[1], 10);
  }

  return {
    familyMembers: Math.max(1, Math.min(8, familyMembers)),
    dailyServingsPerMember: Math.max(1, Math.min(6, dailyServingsPerMember)),
  };
}

export async function makeRecommendation(message: string) {
  const normalized = message.toLowerCase();
  const allUniqueTags = Array.from(new Set(catalog.flatMap((item) => item.tags)));
  const householdProfile = extractHouseholdContext(message);

  // Try LLM parsing with Groq LPU (guarded with caching, throttle, and fallback)
  const groqResult = await parseQueryWithGroq(message, allUniqueTags);

  const requestedBudgetPaise =
    groqResult.budgetPaise !== null ? groqResult.budgetPaise : extractBudgetPaise(normalized);
  const budgetPaise = Math.min(requestedBudgetPaise, 1_000_000);
  const budgetWasCapped = requestedBudgetPaise > budgetPaise;

  const signals = getDemandSignals();
  const signalByItem = demandSignalMap();

  let inferredTags: string[] = [];
  if (groqResult.inferredTags.length > 0) {
    inferredTags = groqResult.inferredTags;
  } else {
    const matched = catalog
      .flatMap((item) => item.tags)
      .filter((tag, index, tags) => tags.indexOf(tag) === index && normalized.includes(tag));
    inferredTags = matched.length ? matched : ["daily", "grocery"];
  }

  const scored = catalog.map((item) => {
    const signal = signalByItem.get(item.id);
    const matchedTags = item.tags.filter((tag) => inferredTags.includes(tag));
    const relevancePoints = matchedTags.length * 4;
    const demandPoints = demandBoost(signal?.direction ?? "stable");

    return {
      item,
      signal,
      matchedTags,
      relevancePoints,
      demandPoints,
      totalScore: relevancePoints + demandPoints,
      fitsBuyerBudget: item.pricePaise <= budgetPaise,
    };
  });

  const eligible = scored
    .filter((candidate) => candidate.fitsBuyerBudget)
    .sort((a, b) => b.totalScore - a.totalScore || a.item.pricePaise - b.item.pricePaise);

  const primaryResult = eligible[0];
  if (!primaryResult) {
    throw new Error("No catalog item fits the requested budget.");
  }

  const primary = primaryResult.item;
  const remaining = budgetPaise - primary.pricePaise;
  const upsellResult = eligible.find(
    ({ item }) =>
      item.id !== primary.id &&
      item.pricePaise <= remaining &&
      item.tags.some((tag) => primary.tags.includes(tag)),
  );
  const upsell = upsellResult?.item;
  const selected = [primaryResult, ...(upsellResult ? [upsellResult] : [])];
  const totalPaise = selected.reduce((sum, result) => sum + result.item.pricePaise, 0);
  const incrementalRevenuePaise = upsell?.pricePaise ?? 0;
  const upliftPercent = Math.round((incrementalRevenuePaise / primary.pricePaise) * 100);
  const topRising = [...signals].sort((a, b) => b.changePercent - a.changePercent)[0];
  const topFalling = [...signals].sort((a, b) => a.changePercent - b.changePercent)[0];
  const withoutDemandPrimary = [...eligible].sort(
    (a, b) => b.relevancePoints - a.relevancePoints || a.item.pricePaise - b.item.pricePaise,
  )[0];

  const candidateEvidence = [...scored]
    .sort((a, b) => b.totalScore - a.totalScore || a.item.pricePaise - b.item.pricePaise)
    .map((candidate) => {
      const isPrimary = candidate.item.id === primary.id;
      const isAddOn = candidate.item.id === upsell?.id;
      const sharedTags = candidate.item.tags.filter((tag) => primary.tags.includes(tag));
      let outcome: "selected-primary" | "selected-add-on" | "not-selected" = "not-selected";
      let reason: string;

      if (isPrimary) {
        outcome = "selected-primary";
        reason = `Highest eligible score: ${candidate.relevancePoints} relevance + ${candidate.demandPoints} demand points.`;
      } else if (isAddOn) {
        outcome = "selected-add-on";
        reason = `Compatible through ${sharedTags.slice(0, 3).join(", ")} and the ${formatInr(totalPaise)} cart stays within budget.`;
      } else if (!candidate.fitsBuyerBudget) {
        reason = `Rejected because ${formatInr(candidate.item.pricePaise)} exceeds the buyer's full budget.`;
      } else if (candidate.item.pricePaise > remaining) {
        reason = `Not added because only ${formatInr(remaining)} remained after the primary item.`;
      } else if (sharedTags.length === 0) {
        reason = "Not added because it has no catalogue tag in common with the primary item.";
      } else {
        reason = "Not added because a higher-ranked compatible alternative was selected.";
      }

      return {
        itemId: candidate.item.id,
        name: candidate.item.name,
        pricePaise: candidate.item.pricePaise,
        matchedTags: candidate.matchedTags,
        relevancePoints: candidate.relevancePoints,
        demandDirection: candidate.signal?.direction ?? "stable",
        demandChangePercent: candidate.signal?.changePercent ?? 0,
        demandPoints: candidate.demandPoints,
        totalScore: candidate.totalScore,
        fitsBuyerBudget: candidate.fitsBuyerBudget,
        outcome,
        reason,
        scoreGapToWinner: primaryResult.totalScore - candidate.totalScore,
        rejectionCategory: isPrimary || isAddOn
          ? null
          : !candidate.fitsBuyerBudget
            ? "over-full-budget"
            : candidate.item.pricePaise > remaining
              ? "over-remaining-budget"
              : sharedTags.length === 0
                ? "incompatible-tags"
                : "lower-ranked",
      };
    });

  const selectedItems = selected.map(({ item, signal }) => ({
    ...item,
    quantity: 1,
    demand: signal,
    selectionEvidence: candidateEvidence.find((candidate) => candidate.itemId === item.id),
    marketComparison: compareMarketOffers(item.id),
    quickCommerce: getQuickCommerceComparison(item.id),
    consumptionForecast: calculateConsumptionForecast(item, householdProfile),
  }));
  const rejectedCandidates = candidateEvidence.filter((candidate) => candidate.outcome === "not-selected");

  // Determine explanation source & text
  const explanation =
    groqResult.source === "groq-llm" && groqResult.explanation
      ? groqResult.explanation
      : `${primary.name} ranked first because it matched ${primaryResult.matchedTags.join(", ") || "the default daily-use intent"}. Its score was ${primaryResult.relevancePoints} relevance points plus ${primaryResult.demandPoints} demand points. ${
          upsell
            ? `${upsell.name} was added because it shares catalogue context with the primary item and keeps the total within the ${formatInr(budgetPaise)} budget.`
            : "No add-on was included because the remaining budget or compatibility rule rejected the alternatives."
        }`;

  return {
    message,
    budgetPaise,
    inferredTags,
    householdProfile,
    items: selectedItems,
    totalPaise,
    primaryRevenuePaise: primary.pricePaise,
    incrementalRevenuePaise,
    upliftPercent,
    intelligenceSource: groqResult.source,
    decisionEvidence: {
      scoringFormula: "total score = 4 points per matched intent tag + demand adjustment (+2 rising, 0 stable, -1 falling)",
      inferredTags,
      buyerBudgetPaise: budgetPaise,
      remainingAfterPrimaryPaise: remaining,
      demandChangedPrimaryChoice: withoutDemandPrimary.item.id !== primary.id,
      counterfactual: withoutDemandPrimary.item.id === primary.id
        ? "Removing the demand adjustment would not change the primary recommendation."
        : `Without the demand adjustment, ${withoutDemandPrimary.item.name} would rank first.`,
      candidates: candidateEvidence,
      summary: {
        candidatesEvaluated: candidateEvidence.length,
        selectedCount: selected.length,
        rejectedCount: rejectedCandidates.length,
        overBudgetCount: rejectedCandidates.filter((candidate) =>
          candidate.rejectionCategory === "over-full-budget" || candidate.rejectionCategory === "over-remaining-budget"
        ).length,
        incompatibleCount: rejectedCandidates.filter((candidate) => candidate.rejectionCategory === "incompatible-tags").length,
        matchedTagCount: new Set(candidateEvidence.flatMap((candidate) => candidate.matchedTags)).size,
        budgetUtilizationPercent: Math.round((totalPaise / budgetPaise) * 100),
        requestedBudgetPaise,
        budgetWasCapped,
        budgetCapPaise: 1_000_000,
        scoreLeaderMargin: Math.max(0, primaryResult.totalScore - (eligible[1]?.totalScore ?? 0)),
      },
    },
    moneyAction: {
      state: "awaiting-buyer-approval" as const,
      proposedAction: "create_payment_link" as const,
      statement: "No Razorpay order, payment link or charge has been created yet.",
      afterApproval: "The server re-prices catalogue IDs, enforces policy limits, then asks Razorpay MCP to create one test-mode payment link.",
    },
    demandOverview: {
      source: "demo-snapshot" as const,
      sourceLabel: "Demo demand snapshot",
      disclaimer: "Synthetic search-interest signals for the demo; they do not represent sales forecasts or live Google Trends data.",
      topRising: {
        name: catalog.find((item) => item.id === topRising.itemId)?.name ?? topRising.query,
        changePercent: topRising.changePercent,
      },
      topFalling: {
        name: catalog.find((item) => item.id === topFalling.itemId)?.name ?? topFalling.query,
        changePercent: topFalling.changePercent,
      },
    },
    explanation,
    decisionTrace: [
      {
        step: "Understand",
        detail: `Detected ${inferredTags.slice(0, 2).join(" + ")} with a ${formatInr(budgetPaise)} ceiling for ${householdProfile.familyMembers}-member household (${householdProfile.dailyServingsPerMember} servings/day).`,
      },
      {
        step: "Rank",
        detail: `${primary.name}: ${primaryResult.relevancePoints} relevance + ${primaryResult.demandPoints} demand = ${primaryResult.totalScore} points.`,
      },
      {
        step: "Grow",
        detail: upsell
          ? `Added ${upsell.name} for ${upliftPercent}% potential basket uplift without crossing the budget.`
          : "Protected the buyer budget; no compatible add-on was safe.",
      },
      { step: "Gate", detail: "No money action has occurred; payment-link creation awaits explicit approval." },
    ],
    boundaries: [
      "Server-priced catalog only",
      "Maximum Rs. 10,000",
      "Demand signals never set prices",
      "Payment link requires explicit approval",
    ],
  };
}
