import { EVENT_REFERENCES } from "@/lib/config";
import { getLiveRaceScored } from "@/lib/liveService";

export interface EventSummary {
  raceId: string;
  label: string;
  date?: string;
  updatedAt?: string | null;
  athletes: number;
  teams: number;
}

export async function getEventSummaries(): Promise<EventSummary[]> {
  const events = await Promise.all(
    EVENT_REFERENCES.map(async (event) => {
      try {
        const scored = await getLiveRaceScored(event.raceId);
        return {
          raceId: event.raceId,
          label: scored.race.title || event.label,
          date: scored.race.date,
          updatedAt: scored.race.updatedAt,
          athletes: scored.race.participants.length,
          teams: new Set(scored.race.participants.map((p) => `${p.gender}:${p.team}`)).size
        } satisfies EventSummary;
      } catch {
        return {
          raceId: event.raceId,
          label: event.label,
          date: event.eventDate,
          updatedAt: null,
          athletes: 0,
          teams: 0
        } satisfies EventSummary;
      }
    })
  );

  events.sort((a, b) => {
    const d1 = a.date ? Date.parse(a.date) : 0;
    const d2 = b.date ? Date.parse(b.date) : 0;
    return d2 - d1;
  });

  return events;
}
