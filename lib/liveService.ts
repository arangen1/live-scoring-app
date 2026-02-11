import { FALLBACK_FIXTURES } from "@/data/fixtures";
import { fetchLiveTimingRaw, parseLiveTimingPayload } from "@/lib/liveTimingParser";
import { scoreRace } from "@/lib/scoring";
import { ScoredRace } from "@/lib/types";

export async function getLiveRaceScored(raceId: string): Promise<ScoredRace> {
  try {
    const raw = await fetchLiveTimingRaw(raceId);
    const parsed = parseLiveTimingPayload(raw, raceId);
    return scoreRace(parsed);
  } catch (error) {
    const fixture = FALLBACK_FIXTURES[raceId];
    if (fixture) {
      const scored = scoreRace({ ...fixture, updatedAt: new Date().toISOString() });
      scored.race.notes.push(`Live fetch failed: ${String((error as Error).message ?? error)}`);
      return scored;
    }
    throw error;
  }
}
