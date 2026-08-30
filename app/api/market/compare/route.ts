import { NextResponse } from "next/server";

import { writeAudit } from "@/lib/audit";
import { compareMarketOffers } from "@/lib/market-comparison";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const itemId = new URL(request.url).searchParams.get("itemId")?.trim();
  if (!itemId) {
    return NextResponse.json({ error: "Provide a catalog itemId." }, { status: 400 });
  }

  const comparison = compareMarketOffers(itemId);
  if (!comparison) {
    return NextResponse.json({ error: "Unknown catalog item." }, { status: 404 });
  }

  const cheapest = comparison.offers.find((offer) => offer.id === comparison.cheapestOfferId);
  writeAudit({
    actionId: `market:${itemId}`,
    type: "market.comparison_viewed",
    summary: `Compared ${comparison.offers.length} offers for ${comparison.productName}`,
    detail: {
      itemId,
      snapshotAsOf: comparison.asOf,
      cheapestSeller: cheapest?.seller,
      cheapestLandedPricePaise: cheapest?.landedPricePaise,
      localDifferencePaise: comparison.localDifferencePaise,
      externalOffersCheckoutEligible: false,
    },
    level: "info",
  });

  return NextResponse.json(comparison, {
    headers: { "Cache-Control": "no-store" },
  });
}
