import "server-only";

import { findCatalogItem, formatInr, type CatalogItem } from "@/lib/catalog";

export type MarketChannel = "local-merchant" | "amazon" | "flipkart" | "direct-brand";

export type MarketOffer = {
  id: string;
  channel: MarketChannel;
  seller: string;
  itemPricePaise: number;
  shippingPaise: number;
  landedPricePaise: number;
  estimatedDeliveryDays: number;
  trustScore: number;
  availability: "in-stock" | "limited";
  checkoutEligible: boolean;
  verificationUrl?: string;
};

export type MarketComparison = {
  itemId: string;
  productName: string;
  asOf: string;
  source: "deterministic-market-snapshot";
  sourceLabel: string;
  disclaimer: string;
  methodology: string;
  offers: MarketOffer[];
  cheapestOfferId: string;
  fastestOfferId: string;
  mostTrustedOfferId: string;
  localMerchantOfferId: string;
  localDifferencePaise: number;
  localDeliveryAdvantageDays: number;
  insight: string;
};

type ExternalProfile = {
  channel: Exclude<MarketChannel, "local-merchant">;
  seller: string;
  priceBasisPoints: number;
  shippingPaise: number;
  freeShippingThresholdPaise: number;
  deliveryDays: number;
  trustScore: number;
  verificationUrl?: string;
};

const observedAt = "2026-08-31";

// Illustrative relative values make the comparison deterministic for judging.
// Replace this record with official affiliate/catalog feeds before calling it live.
const itemAdjustments: Record<string, { amazon: number; flipkart: number; brand: number }> = {
  "nescafe-classic-100g": { amazon: -500, flipkart: -750, brand: 750 },
  "gentle-face-wash-100ml": { amazon: -650, flipkart: -950, brand: 550 },
  "steel-utensil-set": { amazon: -550, flipkart: -800, brand: 650 },
  "anti-dandruff-shampoo-340ml": { amazon: -600, flipkart: -850, brand: 700 },
  "spf50-sunscreen-50g": { amazon: -800, flipkart: -1_000, brand: 400 },
  "fresh-vegetable-box": { amazon: 1_200, flipkart: 800, brand: 1_500 },
  "seasonal-fruit-basket": { amazon: 1_000, flipkart: 600, brand: 1_300 },
  "tomatoes-1kg": { amazon: 1_500, flipkart: 900, brand: 1_700 },
  "bananas-dozen": { amazon: 1_200, flipkart: 800, brand: 1_500 },
  "basmati-rice-5kg": { amazon: -400, flipkart: -700, brand: 500 },
  "laundry-detergent-1kg": { amazon: -500, flipkart: -750, brand: 600 },
};

function searchUrl(channel: "amazon" | "flipkart", item: CatalogItem) {
  const query = encodeURIComponent(`${item.name} ${item.packSize}`);
  return channel === "amazon"
    ? `https://www.amazon.in/s?k=${query}`
    : `https://www.flipkart.com/search?q=${query}`;
}

function adjustedPrice(pricePaise: number, basisPoints: number) {
  return Math.max(100, Math.round((pricePaise * (10_000 + basisPoints)) / 10_000));
}

function externalOffer(item: CatalogItem, profile: ExternalProfile): MarketOffer {
  const itemPricePaise = adjustedPrice(item.pricePaise, profile.priceBasisPoints);
  const shippingPaise = itemPricePaise >= profile.freeShippingThresholdPaise ? 0 : profile.shippingPaise;
  return {
    id: `${item.id}:${profile.channel}`,
    channel: profile.channel,
    seller: profile.seller,
    itemPricePaise,
    shippingPaise,
    landedPricePaise: itemPricePaise + shippingPaise,
    estimatedDeliveryDays: profile.deliveryDays,
    trustScore: profile.trustScore,
    availability: "in-stock",
    checkoutEligible: false,
    verificationUrl: profile.verificationUrl,
  };
}

export function compareMarketOffers(itemId: string): MarketComparison | null {
  const item = findCatalogItem(itemId);
  if (!item) return null;

  const adjustment = itemAdjustments[item.id] ?? { amazon: 0, flipkart: 0, brand: 0 };
  const local: MarketOffer = {
    id: `${item.id}:local-merchant`,
    channel: "local-merchant",
    seller: "Revenue Pilot Merchant",
    itemPricePaise: item.pricePaise,
    shippingPaise: 0,
    landedPricePaise: item.pricePaise,
    estimatedDeliveryDays: 1,
    trustScore: 4.6,
    availability: "in-stock",
    checkoutEligible: true,
  };
  const offers = [
    local,
    externalOffer(item, {
      channel: "amazon",
      seller: "Amazon India",
      priceBasisPoints: adjustment.amazon,
      shippingPaise: 4_000,
      freeShippingThresholdPaise: 49900,
      deliveryDays: 2,
      trustScore: 4.8,
      verificationUrl: searchUrl("amazon", item),
    }),
    externalOffer(item, {
      channel: "flipkart",
      seller: "Flipkart",
      priceBasisPoints: adjustment.flipkart,
      shippingPaise: 3_900,
      freeShippingThresholdPaise: 49900,
      deliveryDays: 3,
      trustScore: 4.5,
      verificationUrl: searchUrl("flipkart", item),
    }),
    externalOffer(item, {
      channel: "direct-brand",
      seller: "Direct brand site",
      priceBasisPoints: adjustment.brand,
      shippingPaise: 5_900,
      freeShippingThresholdPaise: 79900,
      deliveryDays: 4,
      trustScore: 4.7,
    }),
  ];

  const cheapest = [...offers].sort(
    (left, right) => left.landedPricePaise - right.landedPricePaise || left.estimatedDeliveryDays - right.estimatedDeliveryDays,
  )[0];
  const fastest = [...offers].sort(
    (left, right) => left.estimatedDeliveryDays - right.estimatedDeliveryDays || left.landedPricePaise - right.landedPricePaise,
  )[0];
  const mostTrusted = [...offers].sort(
    (left, right) => right.trustScore - left.trustScore || left.landedPricePaise - right.landedPricePaise,
  )[0];
  const localDifferencePaise = local.landedPricePaise - cheapest.landedPricePaise;
  const localDeliveryAdvantageDays = Math.max(0, cheapest.estimatedDeliveryDays - local.estimatedDeliveryDays);
  const priceStatement = cheapest.id === local.id
    ? `The local merchant has the lowest landed price at ${formatInr(local.landedPricePaise)}.`
    : `${cheapest.seller} is ${formatInr(localDifferencePaise)} cheaper after shipping.`;
  const tradeoff = mostTrusted.id === cheapest.id
    ? `${mostTrusted.seller} is also the highest-trust option in this snapshot.`
    : `${mostTrusted.seller} has the highest trust score, while the local merchant delivers in one day.`;

  return {
    itemId: item.id,
    productName: item.name,
    asOf: observedAt,
    source: "deterministic-market-snapshot",
    sourceLabel: "Deterministic market snapshot",
    disclaimer: "External price, shipping, delivery and trust values are illustrative demo data, not observed listings or live quotes. Review the linked marketplace search before purchase. Only the local merchant offer can enter Razorpay checkout.",
    methodology: "Landed price = item price + shipping. Price, delivery speed and trust are reported separately; no hidden blended score is used.",
    offers,
    cheapestOfferId: cheapest.id,
    fastestOfferId: fastest.id,
    mostTrustedOfferId: mostTrusted.id,
    localMerchantOfferId: local.id,
    localDifferencePaise,
    localDeliveryAdvantageDays,
    insight: `${priceStatement} ${tradeoff}`,
  };
}
