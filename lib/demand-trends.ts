import { catalog } from "@/lib/catalog";

export type DemandDirection = "rising" | "stable" | "falling";

export type DemandSignal = {
  itemId: string;
  query: string;
  direction: DemandDirection;
  changePercent: number;
  interestScore: number;
  source: "demo-snapshot";
  sourceLabel: string;
  asOf: string;
  geo: "IN";
  exploreUrl: string;
};

type DemoPoint = { current: number; previous: number };

// Synthetic values keep the buildathon demo deterministic. They are never
// represented as live Google data and can be replaced by an approved provider.
const demoInterest: Record<string, DemoPoint> = {
  "nescafe-classic-100g": { current: 72, previous: 63 },
  "gentle-face-wash-100ml": { current: 68, previous: 57 },
  "steel-utensil-set": { current: 43, previous: 47 },
  "anti-dandruff-shampoo-340ml": { current: 59, previous: 57 },
  "spf50-sunscreen-50g": { current: 82, previous: 64 },
  "fresh-vegetable-box": { current: 61, previous: 59 },
  "seasonal-fruit-basket": { current: 66, previous: 59 },
  "tomatoes-1kg": { current: 48, previous: 52 },
  "bananas-dozen": { current: 55, previous: 54 },
  "basmati-rice-5kg": { current: 64, previous: 63 },
  "laundry-detergent-1kg": { current: 58, previous: 54 },
};

function directionFor(changePercent: number): DemandDirection {
  if (changePercent >= 5) return "rising";
  if (changePercent <= -5) return "falling";
  return "stable";
}

export function getDemandSignals(): DemandSignal[] {
  return catalog.map((item) => {
    const point = demoInterest[item.id] ?? { current: 50, previous: 50 };
    const changePercent = Math.round(((point.current - point.previous) / point.previous) * 100);
    const params = new URLSearchParams({
      date: "today 3-m",
      geo: "IN",
      q: item.trendQuery,
    });

    return {
      itemId: item.id,
      query: item.trendQuery,
      direction: directionFor(changePercent),
      changePercent,
      interestScore: point.current,
      source: "demo-snapshot",
      sourceLabel: "Demo demand snapshot",
      asOf: "2026-08-30",
      geo: "IN",
      exploreUrl: `https://trends.google.com/trends/explore?${params.toString()}`,
    };
  });
}

export function demandSignalMap() {
  return new Map(getDemandSignals().map((signal) => [signal.itemId, signal]));
}
