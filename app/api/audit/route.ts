import { NextResponse } from "next/server";
import { listAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ events: listAudit() });
}
