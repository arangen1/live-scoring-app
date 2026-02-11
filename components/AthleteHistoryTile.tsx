"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AthleteHistoryRow {
  raceId: string;
  raceTitle: string;
  raceDate?: string;
  athleteId: string;
  athlete: string;
  team: string;
  gender: string;
  place?: number;
  run1?: string;
  run2?: string;
  total?: string;
  status: string;
}

export function AthleteHistoryTile({
  athleteName,
  onClose,
  seedRaceIds = []
}: {
  athleteName: string;
  onClose: () => void;
  seedRaceIds?: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AthleteHistoryRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        setLoading(true);
        const eventsResp = await fetch("/api/events", { cache: "no-store" });
        const eventsData = eventsResp.ok ? ((await eventsResp.json()) as { events: { raceId: string }[] }) : { events: [] };
        const eventIds = eventsData.events.map((e) => e.raceId);

        const localRaw = localStorage.getItem("custom_race_ids");
        const localIds = localRaw ? ((JSON.parse(localRaw) as string[]) ?? []) : [];
        const ids = [...new Set([...eventIds, ...localIds, ...seedRaceIds])].join(",");

        const response = await fetch(
          `/api/athlete?name=${encodeURIComponent(athleteName)}&ids=${encodeURIComponent(ids)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { results: AthleteHistoryRow[] };
        if (!cancelled) setRows(payload.results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [athleteName, seedRaceIds]);

  return (
    <div className="overlay-shell" onClick={onClose}>
      <div className="overlay-tile" onClick={(e) => e.stopPropagation()}>
        <div className="section-header">
          <h3 className="section-title">{athleteName}</h3>
          <button className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </div>

        {loading && <p className="meta">Loading athlete history...</p>}
        {!loading && rows.length === 0 && <p className="meta">No results found for this athlete.</p>}

        {!loading && rows.length > 0 && (
          <div className="search-athlete-grid">
            {rows.map((row, idx) => (
              <div key={`${row.raceId}-${row.athleteId}-${idx}`} className="athlete-result-card">
                <div style={{ fontWeight: 700 }}>{row.athlete}</div>
                <div className="meta">{row.raceTitle}</div>
                <div className="meta">
                  {row.raceDate ? new Date(row.raceDate).toLocaleDateString() : "Date unknown"} • {row.team}
                </div>
                <div className="meta">
                  Place {row.place ?? "-"} • R1 {row.run1 ?? "-"} • R2 {row.run2 ?? "-"} • T {row.total ?? "-"}
                </div>
                <div className="meta">Status: {row.status.toUpperCase()}</div>
                <Link
                  className="meta"
                  href={`/event/${row.raceId}?view=individual&team=${encodeURIComponent(row.team)}&athlete=${encodeURIComponent(row.athleteId)}`}
                >
                  Open event result
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
