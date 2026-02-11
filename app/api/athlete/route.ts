import { EVENT_REFERENCES } from "@/lib/config";
import { getLiveRaceScored } from "@/lib/liveService";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!name) return NextResponse.json({ athlete: null, results: [] });

  const idsParam = request.nextUrl.searchParams.get("ids")?.trim() ?? "";
  const explicitIds = idsParam
    ? idsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d{5,8}$/.test(id))
    : [];
  const raceIdList = [...new Set([...EVENT_REFERENCES.map((e) => e.raceId), ...explicitIds])];
  const target = normalizeName(name);

  const races = await Promise.all(
    raceIdList.map(async (raceId) => {
      try {
        return await getLiveRaceScored(raceId);
      } catch {
        return null;
      }
    })
  );

  const results = races
    .filter(Boolean)
    .flatMap((race) =>
      race!.individuals
        .filter((a) => normalizeName(a.fullName) === target)
        .map((a) => ({
          raceId: race!.race.raceId,
          raceTitle: race!.race.title,
          raceDate: race!.race.date,
          athleteId: a.athleteId,
          athlete: a.fullName,
          team: a.team,
          gender: a.gender,
          place: a.place,
          run1: String(a.source.run0 ?? "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)[0] ?? undefined,
          run2: String(a.source.run1 ?? "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)[0] ?? undefined,
          total: a.timeRaw,
          status: a.status
        }))
    );

  results.sort((a, b) => {
    const d1 = a.raceDate ? Date.parse(a.raceDate) : 0;
    const d2 = b.raceDate ? Date.parse(b.raceDate) : 0;
    return d2 - d1;
  });

  return NextResponse.json(
    {
      athlete: results[0]?.athlete ?? name,
      results
    },
    { headers: { "cache-control": "no-store" } }
  );
}
