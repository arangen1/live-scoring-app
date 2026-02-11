import { getEventSummaries } from "@/lib/eventService";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await getEventSummaries();
  return NextResponse.json({ events }, { headers: { "cache-control": "no-store" } });
}
