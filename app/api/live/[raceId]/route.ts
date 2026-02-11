import { getLiveRaceScored } from "@/lib/liveService";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, context: { params: Promise<{ raceId: string }> }) {
  try {
    const { raceId } = await context.params;
    const data = await getLiveRaceScored(raceId);
    return NextResponse.json(data, {
      headers: {
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to parse live timing feed",
        detail: String((error as Error).message ?? error)
      },
      { status: 502 }
    );
  }
}
