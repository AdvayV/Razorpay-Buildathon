import { NextResponse } from "next/server";
import { getQuickCommerceComparison } from "@/lib/quick-commerce";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId parameter." }, { status: 400 });
  }

  const comparison = getQuickCommerceComparison(itemId);
  if (!comparison) {
    return NextResponse.json({ error: `Item not found: ${itemId}` }, { status: 404 });
  }

  return NextResponse.json(comparison);
}
