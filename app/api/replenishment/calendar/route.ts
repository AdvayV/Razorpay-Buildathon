import { NextResponse } from "next/server";
import { findCatalogItem } from "@/lib/catalog";
import { calculateConsumptionForecast } from "@/lib/consumption-engine";

const calendarDate = (iso: string) => iso.replaceAll("-", "");
const escapeIcs = (value: string) => value.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const item = findCatalogItem(url.searchParams.get("itemId") ?? "");
  if (!item) return NextResponse.json({ error: "Unknown catalog item." }, { status: 404 });
  if (item.replenishable === false) return NextResponse.json({ error: "Durable items do not need reorder reminders." }, { status: 422 });

  const familyMembers = Math.min(8, Math.max(1, Number(url.searchParams.get("familyMembers")) || 2));
  const dailyServingsPerMember = Math.min(6, Math.max(1, Number(url.searchParams.get("dailyServingsPerMember")) || 2));
  const forecast = calculateConsumptionForecast(item, { familyMembers, dailyServingsPerMember });
  const endDate = new Date(`${forecast.nextDeliveryIso}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const uid = `reorder-${item.id}-${forecast.nextDeliveryIso}@merchant-agent.demo`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Merchant Growth Agent//Reorder Reminder//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTART;VALUE=DATE:${calendarDate(forecast.nextDeliveryIso)}`, `DTEND;VALUE=DATE:${calendarDate(endDate.toISOString().slice(0, 10))}`,
    `SUMMARY:${escapeIcs(`Review reorder: ${item.name}`)}`,
    `DESCRIPTION:${escapeIcs(`Planning estimate for ${familyMembers} people at ${dailyServingsPerMember} uses per day. Review stock before purchasing; no payment is automatic.`)}`,
    "TRANSP:TRANSPARENT", "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="reorder-${item.id}.ics"`, "Cache-Control": "no-store" } });
}
