import { EVENT_REFERENCES } from "@/lib/config";
import { getLiveRaceScored } from "@/lib/liveService";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function matchesQuery(haystack: string, query: string): boolean {
  const normalized = haystack.toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => normalized.includes(token));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!query) return NextResponse.json({ events: [], athletes: [] });

  const idsParam = request.nextUrl.searchParams.get("ids")?.trim() ?? "";
  const explicitIds = idsParam
    ? idsParam
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d{5,8}$/.test(id))
    : [];
  const directIds = [...new Set((query.match(/\d{5,8}/g) ?? []))];
  const raceIdList = [...new Set([...EVENT_REFERENCES.map((e) => e.raceId), ...explicitIds, ...directIds])];

  const races = await Promise.all(
    raceIdList.map(async (raceId) => {
      try {
        const scored = await getLiveRaceScored(raceId);
        return scored;
      } catch {
        return null;
      }
    })
  );

  const events = races
    .filter(Boolean)
    .map((race) => ({ raceId: race!.race.raceId, title: race!.race.title }))
    .filter((row) => matchesQuery(`${row.title} ${row.raceId}`, query));

  const athletes = races
    .filter(Boolean)
    .flatMap((race) =>
      race!.individuals
        .filter((a) =>
          matchesQuery([a.fullName, a.team, String(a.bib ?? ""), race!.race.title, race!.race.raceId].join(" "), query)
        )
        .slice(0, 30)
        .map((a) => ({
          raceId: race!.race.raceId,
          raceTitle: race!.race.title,
          athleteId: a.athleteId,
          athlete: a.fullName,
          team: a.team,
          gender: a.gender,
          place: a.place,
          run1: String(a.source.run0 ?? "").split(",").map((v) => v.trim()).filter(Boolean)[0] ?? undefined,
          run2: String(a.source.run1 ?? "").split(",").map((v) => v.trim()).filter(Boolean)[0] ?? undefined,
          time: a.timeRaw,
          status: a.status
        }))
    )
    .slice(0, 100);

  return NextResponse.json({ events, athletes }, { headers: { "cache-control": "no-store" } });
}
