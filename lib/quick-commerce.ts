// Simulated landed-cost scenarios for a panel demo. No retailer API is queried.

import { findCatalogItem } from "@/lib/catalog";

export type QuickCommercePlatform = "local-store" | "bigbasket" | "blinkit" | "zepto" | "amazon-fresh";

export type PlatformOffer = {
  platformId: QuickCommercePlatform;
  platformName: string;
  itemPricePaise: number;
  deliveryFeePaise: number;
  surgeAndHandlingPaise: number;
  totalLandedCostPaise: number;
  deliveryTimeDisplay: string;
  deliveryMinutesEst: number;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock";
  isCheapestLandedCost: boolean;
  isFastestDelivery: boolean;
  notes: string;
};

export type QuickCommerceComparison = {
  itemId: string;
  itemName: string;
  packSize: string;
  category: string;
  asOf: string;
  sourceLabel: string;
  disclaimer: string;
  offers: PlatformOffer[];
  lowestLandedCostPlatform: string;
  lowestLandedCostPaise: number;
  localStoreLandedCostPaise: number;
  localStoreDiffPaise: number; // positive = local is cheaper, negative = competitor is cheaper
  priceMatchApplied: boolean; // historical field name: means available, never applied to checkout
  priceMatchDiscountPaise: number;
  priceMatchAdjustedPricePaise: number;
  arbitrageSummary: string;
};

// In-memory cache for quick-commerce snapshot queries (15 min TTL)
const qcCache = new Map<string, { result: QuickCommerceComparison; timestamp: number }>();
const QC_CACHE_TTL = 15 * 60 * 1000;

export function getQuickCommerceComparison(itemId: string): QuickCommerceComparison | null {
  const cached = qcCache.get(itemId);
  if (cached && Date.now() - cached.timestamp < QC_CACHE_TTL) {
    return cached.result;
  }

  const item = findCatalogItem(itemId);
  if (!item) return null;

  const basePrice = item.pricePaise;

  // Real-world variance benchmarks across Quick Commerce platforms in Indian metros:
  // BigBasket: Often 2-5% cheaper on base price, but standard delivery is ₹30-40 (or free above ₹500)
  // Blinkit: Base price at MRP (+0-3%), ₹25 delivery + ₹10 handling, 12-min delivery
  // Zepto: Base price at MRP (+2-4%), ₹35 delivery + ₹12 handling + rain/surge, 10-min delivery
  // Amazon Fresh: Base price ~equal, ₹40 delivery under ₹499, 2-4 hour slot

  const offers: PlatformOffer[] = [
    {
      platformId: "local-store",
      platformName: "Local Merchant (Our Store)",
      itemPricePaise: basePrice,
      deliveryFeePaise: 0,
      surgeAndHandlingPaise: 0,
      totalLandedCostPaise: basePrice,
      deliveryTimeDisplay: "1 Day (Free)",
      deliveryMinutesEst: 1440,
      stockStatus: "in-stock",
      isCheapestLandedCost: false,
      isFastestDelivery: false,
      notes: "Server-catalog verified • 0 surge fee • Razorpay 1-click checkout",
    },
    {
      platformId: "bigbasket",
      platformName: "BigBasket",
      itemPricePaise: Math.round(basePrice * 0.96), // 4% off MRP
      deliveryFeePaise: 3500, // ₹35
      surgeAndHandlingPaise: 0,
      totalLandedCostPaise: Math.round(basePrice * 0.96) + 3500,
      deliveryTimeDisplay: "Next Day / 4 Hours",
      deliveryMinutesEst: 360,
      stockStatus: "in-stock",
      isCheapestLandedCost: false,
      isFastestDelivery: false,
      notes: "Lower base price but ₹35 delivery fee applies below ₹500 order",
    },
    {
      platformId: "blinkit",
      platformName: "Blinkit",
      itemPricePaise: Math.round(basePrice * 1.02), // slight premium
      deliveryFeePaise: 2500, // ₹25
      surgeAndHandlingPaise: 1000, // ₹10 handling fee
      totalLandedCostPaise: Math.round(basePrice * 1.02) + 3500,
      deliveryTimeDisplay: "12-15 Mins",
      deliveryMinutesEst: 14,
      stockStatus: "in-stock",
      isCheapestLandedCost: false,
      isFastestDelivery: true,
      notes: "Fastest delivery • ₹35 combined delivery + platform handling",
    },
    {
      platformId: "zepto",
      platformName: "Zepto",
      itemPricePaise: Math.round(basePrice * 1.03),
      deliveryFeePaise: 3000, // ₹30
      surgeAndHandlingPaise: 1200, // ₹12 surge/packaging fee
      totalLandedCostPaise: Math.round(basePrice * 1.03) + 4200,
      deliveryTimeDisplay: "10 Mins",
      deliveryMinutesEst: 10,
      stockStatus: "in-stock",
      isCheapestLandedCost: false,
      isFastestDelivery: true,
      notes: "10-minute quick delivery • ₹42 delivery & surge charges",
    },
    {
      platformId: "amazon-fresh",
      platformName: "Amazon Fresh",
      itemPricePaise: basePrice,
      deliveryFeePaise: 4000, // ₹40
      surgeAndHandlingPaise: 0,
      totalLandedCostPaise: basePrice + 4000,
      deliveryTimeDisplay: "2-4 Hours",
      deliveryMinutesEst: 180,
      stockStatus: "in-stock",
      isCheapestLandedCost: false,
      isFastestDelivery: false,
      notes: "Standard slot delivery • Free only with Prime/order > ₹499",
    },
  ];

  // Find cheapest landed cost
  let lowestLandedCost = offers[0].totalLandedCostPaise;
  let lowestPlatform = offers[0].platformName;

  for (const offer of offers) {
    if (offer.totalLandedCostPaise < lowestLandedCost) {
      lowestLandedCost = offer.totalLandedCostPaise;
      lowestPlatform = offer.platformName;
    }
  }

  // Mark flags
  for (const offer of offers) {
    offer.isCheapestLandedCost = offer.totalLandedCostPaise === lowestLandedCost;
    offer.isFastestDelivery = offer.deliveryMinutesEst <= 15;
  }

  // Check if competitor base price is lower (e.g. BigBasket base item price)
  const lowestCompetitorBasePrice = Math.min(
    ...offers.filter((o) => o.platformId !== "local-store").map((o) => o.itemPricePaise),
  );

  const priceMatchApplied = lowestCompetitorBasePrice < basePrice;
  const priceMatchDiscountPaise = priceMatchApplied ? basePrice - lowestCompetitorBasePrice : 0;
  const priceMatchAdjustedPricePaise = basePrice - priceMatchDiscountPaise;

  const localDiffPaise = lowestLandedCost - basePrice; // if > 0, local is cheaper on landed cost!

  const arbitrageSummary =
    localDiffPaise >= 0
      ? `Local store offers the best true landed cost (₹${(basePrice / 100).toFixed(0)}) because Quick-Commerce apps add ₹35-₹42 in delivery/surge fees.`
      : `In this simulated scenario, BigBasket has a lower base price. A merchant could review a price-match opportunity at ₹${(priceMatchAdjustedPricePaise / 100).toFixed(0)}; checkout pricing is unchanged.`;

  const result: QuickCommerceComparison = {
    itemId: item.id,
    itemName: item.name,
    packSize: item.packSize,
    category: item.category,
    asOf: "Demo assumptions v1",
    sourceLabel: "Simulated retailer benchmark",
    disclaimer: "Illustrative prices, fees, stock and delivery times; not fetched from retailer APIs and never used to set checkout price.",
    offers,
    lowestLandedCostPlatform: lowestPlatform,
    lowestLandedCostPaise: lowestLandedCost,
    localStoreLandedCostPaise: priceMatchAdjustedPricePaise,
    localStoreDiffPaise: localDiffPaise,
    priceMatchApplied,
    priceMatchDiscountPaise,
    priceMatchAdjustedPricePaise,
    arbitrageSummary,
  };

  qcCache.set(itemId, { result, timestamp: Date.now() });
  return result;
}
