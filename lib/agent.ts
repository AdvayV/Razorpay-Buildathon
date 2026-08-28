import { catalog } from "@/lib/catalog";

function extractBudgetPaise(message: string) {
  const match = message.replace(/,/g, "").match(/(?:under|below|budget|upto|up to)\s*(?:rs\.?|₹)?\s*(\d+)/i);
  return match ? Number(match[1]) * 100 : 250000;
}

export function makeRecommendation(message: string) {
  const normalized = message.toLowerCase();
  const budgetPaise = Math.min(extractBudgetPaise(normalized), 1_000_000);
  const intentTags = catalog
    .flatMap((item) => item.tags)
    .filter((tag, index, tags) => tags.indexOf(tag) === index && normalized.includes(tag));
  const inferredTags = intentTags.length ? intentTags : ["focus", "morning"];

  const ranked = catalog
    .map((item) => ({
      item,
      score: item.tags.reduce((score, tag) => score + (inferredTags.includes(tag) ? 2 : 0), 0),
    }))
    .filter(({ item }) => item.pricePaise <= budgetPaise && item.id !== "gift-wrap")
    .sort((a, b) => b.score - a.score || a.item.pricePaise - b.item.pricePaise);

  const primary = ranked[0]?.item ?? catalog[0];
  const remaining = budgetPaise - primary.pricePaise;
  const upsell = ranked.find(
    ({ item }) => item.id !== primary.id && item.pricePaise <= remaining && item.tags.some((tag) => primary.tags.includes(tag)),
  )?.item;
  const selected = [primary, ...(upsell ? [upsell] : [])];
  const totalPaise = selected.reduce((sum, item) => sum + item.pricePaise, 0);
  const incrementalRevenuePaise = upsell?.pricePaise ?? 0;
  const upliftPercent = Math.round((incrementalRevenuePaise / primary.pricePaise) * 100);

  return {
    message,
    budgetPaise,
    inferredTags,
    items: selected.map((item) => ({ ...item, quantity: 1 })),
    totalPaise,
    primaryRevenuePaise: primary.pricePaise,
    incrementalRevenuePaise,
    upliftPercent,
    explanation: `${primary.name} best matches ${inferredTags.slice(0, 2).join(" + ")}. ${
      upsell
        ? `${upsell.name} is a compatible add-on and keeps the cart within budget.`
        : "No add-on was included because the remaining budget was protected."
    }`,
    decisionTrace: [
      { step: "Understand", detail: `Detected ${inferredTags.slice(0, 2).join(" + ")} with a ₹${budgetPaise / 100} ceiling.` },
      { step: "Rank", detail: `${primary.name} scored highest against catalog tags.` },
      {
        step: "Grow",
        detail: upsell
          ? `Added ${upsell.name} for ${upliftPercent}% potential basket uplift.`
          : "Protected the buyer budget; no compatible add-on was safe.",
      },
      { step: "Gate", detail: "Paused before money movement for explicit buyer approval." },
    ],
    boundaries: ["Server-priced catalog only", "Maximum ₹10,000", "Payment link requires explicit approval"],
  };
}
