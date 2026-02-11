"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AthleteHistoryTile } from "@/components/AthleteHistoryTile";

interface SearchEvent {
  raceId: string;
  title: string;
}

interface SearchAthlete {
  raceId: string;
  raceTitle: string;
  athleteId: string;
  athlete: string;
  team: string;
  gender: string;
  place?: number;
  run1?: string;
  run2?: string;
  time?: string;
  status: string;
}

interface SearchResponse {
  events: SearchEvent[];
  athletes: SearchAthlete[];
}

export function SearchPanel({ raceIds }: { raceIds: string[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResponse>({ events: [], athletes: [] });
  const [selectedAthleteName, setSelectedAthleteName] = useState<string | null>(null);
  const groupedAthletes = (() => {
    const map = new Map<
      string,
      {
        athlete: string;
        teams: Set<string>;
        rows: SearchAthlete[];
      }
    >();
    for (const row of results.athletes) {
      const key = row.athlete.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { athlete: row.athlete, teams: new Set<string>(), rows: [] });
      }
      const group = map.get(key)!;
      group.teams.add(row.team);
      group.rows.push(row);
    }
    return [...map.values()]
      .map((group) => ({
        ...group,
        rows: group.rows.sort((a, b) => {
          const p1 = a.place ?? Number.MAX_SAFE_INTEGER;
          const p2 = b.place ?? Number.MAX_SAFE_INTEGER;
          return p1 - p2;
        })
      }))
      .sort((a, b) => a.athlete.localeCompare(b.athlete));
  })();

  useEffect(() => {
    if (!q.trim()) {
      setResults({ events: [], athletes: [] });
      return;
    }

    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const stored = localStorage.getItem("custom_race_ids");
        const custom = stored ? ((JSON.parse(stored) as string[]) ?? []) : [];
        const ids = [...new Set([...raceIds, ...custom])].join(",");
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}&ids=${encodeURIComponent(ids)}`, { signal: controller.signal });
        if (response.ok) {
          const data = (await response.json()) as SearchResponse;
          setResults(data);
        }
      } catch {
        setResults({ events: [], athletes: [] });
      }
    }, 220);

    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [q, raceIds]);

  return (
    <section className="search-panel-inline">
      <h3 className="section-title" style={{ marginBottom: 8 }}>Search Athletes or Events</h3>
      <input className="search-box" placeholder="Search athletes or events" value={q} onChange={(e) => setQ(e.target.value)} />
      {q.trim() && (
        <>
          <h3 className="section-title" style={{ marginTop: 0, marginBottom: 8 }}>Matches</h3>
          <div className="meta" style={{ marginBottom: 10 }}>
            {results.events.length} events • {groupedAthletes.length} athletes
          </div>
          <div className="search-block" style={{ marginBottom: 8 }}>
            {results.events.map((event) => (
              <div key={`event-${event.raceId}`} className="search-item">
                <Link href={`/event/${event.raceId}`}>{event.title}</Link>
              </div>
            ))}
          </div>
          <div className="search-athlete-grid">
            {groupedAthletes.slice(0, 12).map((group) => (
              <div key={group.athlete} className="athlete-result-card">
                <div style={{ fontWeight: 700 }}>{group.athlete}</div>
                <div className="meta">
                  {group.rows.length} results • {group.teams.size} teams
                </div>
                <div className="meta">Teams: {[...group.teams].join(", ")}</div>
                <button className="ghost-btn" onClick={() => setSelectedAthleteName(group.athlete)}>
                  View Results
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {!q.trim() && (
        <p className="meta" style={{ margin: 0 }}>
          Search by athlete, team, event title, or race ID.
        </p>
      )}

      {selectedAthleteName && (
        <AthleteHistoryTile
          athleteName={selectedAthleteName}
          onClose={() => setSelectedAthleteName(null)}
          seedRaceIds={raceIds}
        />
      )}
    </section>
  );
}
