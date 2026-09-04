// Intelligent Household Consumption Forecasting & Autonomous Replenishment Engine
// Internet-calibrated benchmarks for Indian household staples and personal care

export type HouseholdProfile = {
  familyMembers: number;
  dailyServingsPerMember: number; // e.g., 2 cups of coffee/tea, 2 face washes, 2 meals
};

export type ConsumptionBenchmark = {
  unitServingSize: number; // in grams or ml per serving
  servingUnit: "g" | "ml" | "pieces";
  defaultServingsPerDay: number;
  industryBenchmarkNotes: string;
};

// Standard research-calibrated consumption benchmarks
export const CONSUMPTION_BENCHMARKS: Record<string, ConsumptionBenchmark> = {
  coffee: {
    unitServingSize: 10, // 10g ground coffee per standard 150-180ml cup (SCA standard)
    servingUnit: "g",
    defaultServingsPerDay: 2,
    industryBenchmarkNotes: "Standard 1:16 brew ratio = 10g coffee per cup",
  },
  tea: {
    unitServingSize: 2.5, // 2.5g tea leaves per cup
    servingUnit: "g",
    defaultServingsPerDay: 2,
    industryBenchmarkNotes: "Standard Indian CTC/Masala Chai = 2.5g per cup",
  },
  cleanser: {
    unitServingSize: 1.2, // 1.2ml per pump
    servingUnit: "ml",
    defaultServingsPerDay: 2,
    industryBenchmarkNotes: "Dermatologist standard: 1 pump (1.2ml) twice daily",
  },
  sunscreen: {
    unitServingSize: 1.5, // 1.5ml (1/3 teaspoon, 2-finger rule for face + neck)
    servingUnit: "ml",
    defaultServingsPerDay: 1,
    industryBenchmarkNotes: "Dermatological 2-finger rule = 1.5ml per application",
  },
  rice: {
    unitServingSize: 85, // 85g raw rice per meal per adult
    servingUnit: "g",
    defaultServingsPerDay: 2,
    industryBenchmarkNotes: "ICMR dietary guideline = 80-90g raw cereal per meal",
  },
  oil: {
    unitServingSize: 25, // 25ml cooking oil per adult daily
    servingUnit: "ml",
    defaultServingsPerDay: 1,
    industryBenchmarkNotes: "ICMR recommendation = 25-30g visible fats per day",
  },
  milk: {
    unitServingSize: 200, // 200ml per serving
    servingUnit: "ml",
    defaultServingsPerDay: 2,
    industryBenchmarkNotes: "Standard glass / tea addition = 200ml per member/day",
  },
};

export type ConsumptionForecast = {
  itemId: string;
  itemName: string;
  packQuantityNum: number;
  packUnit: string;
  familyMembers: number;
  dailyServingsPerMember: number;
  servingSize: number;
  dailyBurnRate: number; // total units consumed per day across family
  daysLifespan: number; // total days until pack runs out
  reorderBufferDays: number; // trigger auto-order when 2-3 days remain
  recommendedAutopayCadenceDays: number; // rounded cadence for Razorpay Autopay
  nextDeliveryDate: string; // ISO date or formatted string
  formulaExplanation: string;
  benchmarkSource: string;
};

// Parse pack size like "500g", "150ml", "1kg", "5L", "250g"
export function parsePackSize(packSizeStr: string): { quantity: number; unit: string } {
  const normalized = packSizeStr.toLowerCase().trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pieces|pack)?/);
  if (!match) return { quantity: 500, unit: "g" };

  let val = parseFloat(match[1]);
  let unit = match[2] || "g";

  if (unit === "kg") {
    val = val * 1000;
    unit = "g";
  } else if (unit === "l") {
    val = val * 1000;
    unit = "ml";
  }

  return { quantity: val, unit };
}

// Find matching benchmark for item by checking category/tags/name
export function getBenchmarkForItem(name: string, category: string, tags: string[]): ConsumptionBenchmark {
  const combined = `${name} ${category} ${tags.join(" ")}`.toLowerCase();

  for (const [key, benchmark] of Object.entries(CONSUMPTION_BENCHMARKS)) {
    if (combined.includes(key)) return benchmark;
  }

  // Fallback benchmark: 20 units/day default
  return {
    unitServingSize: 15,
    servingUnit: "g",
    defaultServingsPerDay: 2,
    industryBenchmarkNotes: "Standard daily consumable average",
  };
}

export function calculateConsumptionForecast(
  item: { id: string; name: string; packSize: string; category: string; tags: string[] },
  profile: HouseholdProfile = { familyMembers: 2, dailyServingsPerMember: 2 },
): ConsumptionForecast {
  const { quantity: packQuantity, unit } = parsePackSize(item.packSize);
  const benchmark = getBenchmarkForItem(item.name, item.category, item.tags);

  const servingSize = benchmark.unitServingSize;
  const members = Math.max(1, profile.familyMembers);
  const servingsPerDay = Math.max(1, profile.dailyServingsPerMember);

  // Daily burn rate = Serving size × Servings/day × Family members
  const dailyBurnRate = servingSize * servingsPerDay * members;

  // Days lifespan = Pack quantity / Daily burn rate
  const exactDays = packQuantity / dailyBurnRate;
  const daysLifespan = Math.max(3, Math.floor(exactDays));

  // Buffer: reorder 2 days before pack empties (or 1 day if short cycle)
  const reorderBufferDays = daysLifespan <= 7 ? 1 : 2;
  const recommendedAutopayCadenceDays = Math.max(3, daysLifespan - reorderBufferDays);

  const nextDelivery = new Date();
  nextDelivery.setDate(nextDelivery.getDate() + recommendedAutopayCadenceDays);
  const nextDeliveryDate = nextDelivery.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formulaExplanation = `${servingSize}${benchmark.servingUnit}/cup × ${servingsPerDay} cups/day × ${members} members = ${dailyBurnRate}${unit}/day. ${packQuantity}${unit} pack lasts ~${daysLifespan} days. Auto-replenish triggered on Day ${recommendedAutopayCadenceDays} (2-day buffer).`;

  return {
    itemId: item.id,
    itemName: item.name,
    packQuantityNum: packQuantity,
    packUnit: unit,
    familyMembers: members,
    dailyServingsPerMember: servingsPerDay,
    servingSize,
    dailyBurnRate,
    daysLifespan,
    reorderBufferDays,
    recommendedAutopayCadenceDays,
    nextDeliveryDate,
    formulaExplanation,
    benchmarkSource: benchmark.industryBenchmarkNotes,
  };
}
