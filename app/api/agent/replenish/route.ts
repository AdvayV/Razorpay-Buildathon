import { NextResponse } from "next/server";
import { findCatalogItem } from "@/lib/catalog";
import { calculateConsumptionForecast, type HouseholdProfile } from "@/lib/consumption-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      itemId?: string;
      profile?: HouseholdProfile;
    };

    if (!body.itemId) {
      return NextResponse.json({ error: "Missing itemId." }, { status: 400 });
    }

    const item = findCatalogItem(body.itemId);
    if (!item) {
      return NextResponse.json({ error: `Item not found: ${body.itemId}` }, { status: 404 });
    }
    if (item.replenishable === false) {
      return NextResponse.json({ error: `${item.name} is durable and does not support replenishment forecasts.` }, { status: 422 });
    }

    const profile: HouseholdProfile = {
      familyMembers: body.profile?.familyMembers ? Math.max(1, Number(body.profile.familyMembers)) : 2,
      dailyServingsPerMember: body.profile?.dailyServingsPerMember ? Math.max(1, Number(body.profile.dailyServingsPerMember)) : 2,
    };

    const forecast = calculateConsumptionForecast(item, profile);
    return NextResponse.json(forecast);
  } catch (err) {
    console.error("Consumption calculation error:", err);
    return NextResponse.json({ error: "Failed to calculate consumption forecast." }, { status: 500 });
  }
}
