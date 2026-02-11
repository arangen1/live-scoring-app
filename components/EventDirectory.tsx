"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchPanel } from "@/components/SearchPanel";

interface EventSummary {
  raceId: string;
  label: string;
  date?: string;
  updatedAt?: string | null;
  athletes: number;
  teams: number;
}

const CUSTOM_IDS_KEY = "custom_race_ids";
const HIDDEN_IDS_KEY = "hidden_race_ids";

type TimelineGroup = {
  key: string;
  label: string;
  events: EventSummary[];
};

function sortEvents(list: EventSummary[]): EventSummary[] {
  return [...list].sort((a, b) => {
    const d1 = a.date ? Date.parse(a.date) : 0;
    const d2 = b.date ? Date.parse(b.date) : 0;
    return d2 - d1;
  });
}

function dedupeEvents(list: EventSummary[]): EventSummary[] {
  const map = new Map<string, EventSummary>();
  for (const event of list) map.set(event.raceId, event);
  return sortEvents([...map.values()]);
}

function timelineLabel(value?: string): { key: string; label: string } {
  if (!value) return { key: "unknown", label: "Date Unknown" };
  const parsed = new Date(value);
  const key = parsed.toISOString().slice(0, 10);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.floor((eventDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return { key, label: `Today • ${parsed.toLocaleDateString()}` };
  if (diffDays === 1) return { key, label: `Tomorrow • ${parsed.toLocaleDateString()}` };
  if (diffDays === -1) return { key, label: `Yesterday • ${parsed.toLocaleDateString()}` };

  return {
    key,
    label: parsed.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  };
}

async function fetchEventSummary(raceId: string): Promise<EventSummary> {
  const response = await fetch(`/api/live/${encodeURIComponent(raceId)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Event could not be loaded from live-timing feed.");

  const payload = (await response.json()) as {
    race: { title: string; date?: string; updatedAt?: string };
    individuals: { team: string; gender: string }[];
  };

  return {
    raceId,
    label: payload.race.title || `Race ${raceId}`,
    date: payload.race.date,
    updatedAt: payload.race.updatedAt,
    athletes: payload.individuals.length,
    teams: new Set(payload.individuals.map((p) => `${p.gender}:${p.team}`)).size
  };
}

export function EventDirectory({ events }: { events: EventSummary[] }) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState<EventSummary[]>(() => sortEvents(events));
  const [addRaceId, setAddRaceId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setList(sortEvents(events));
  }, [events]);

  useEffect(() => {
    const hiddenRaw = localStorage.getItem(HIDDEN_IDS_KEY);
    if (hiddenRaw) {
      try {
        setHiddenIds((JSON.parse(hiddenRaw) as string[]) ?? []);
      } catch {
        setHiddenIds([]);
      }
    }

    const raw = localStorage.getItem(CUSTOM_IDS_KEY);
    if (!raw) return;

    let ids: string[] = [];
    try {
      ids = JSON.parse(raw) as string[];
    } catch {
      ids = [];
    }

    const missing = ids.filter((id) => !events.some((event) => event.raceId === id));
    if (!missing.length) return;

    Promise.all(missing.map((id) => fetchEventSummary(id).catch(() => null))).then((loaded) => {
      const valid = loaded.filter((item): item is EventSummary => Boolean(item));
      if (valid.length) {
        setList((prev) => dedupeEvents([...prev, ...valid]));
      }
    });
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const queryFiltered = q
      ? list.filter((e) => [e.label, e.raceId, e.date ?? ""].join(" ").toLowerCase().includes(q))
      : list;

    if (showHidden) return queryFiltered;
    return queryFiltered.filter((e) => !hiddenIds.includes(e.raceId));
  }, [hiddenIds, list, query, showHidden]);

  const hiddenCount = useMemo(() => list.filter((e) => hiddenIds.includes(e.raceId)).length, [hiddenIds, list]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineGroup>();

    for (const event of filtered) {
      const stamp = timelineLabel(event.date);
      if (!map.has(stamp.key)) {
        map.set(stamp.key, { key: stamp.key, label: stamp.label, events: [] });
      }
      map.get(stamp.key)?.events.push(event);
    }

    const groups = [...map.values()];
    groups.sort((a, b) => {
      if (a.key === "unknown") return 1;
      if (b.key === "unknown") return -1;
      return Date.parse(b.key) - Date.parse(a.key);
    });

    for (const group of groups) {
      group.events.sort((a, b) => a.label.localeCompare(b.label));
    }

    return groups;
  }, [filtered]);

  const persistHidden = (next: string[]): void => {
    setHiddenIds(next);
    localStorage.setItem(HIDDEN_IDS_KEY, JSON.stringify(next));
  };

  const toggleHidden = (raceId: string): void => {
    if (hiddenIds.includes(raceId)) {
      persistHidden(hiddenIds.filter((id) => id !== raceId));
      return;
    }
    persistHidden([...hiddenIds, raceId]);
  };

  const addEvent = async (): Promise<void> => {
    const raceId = addRaceId.trim();
    if (!raceId) return;

    if (list.some((event) => event.raceId === raceId)) {
      setAddError("This event is already in your list.");
      return;
    }

    try {
      setAdding(true);
      setAddError(null);
      const event = await fetchEventSummary(raceId);
      setList((prev) => dedupeEvents([...prev, event]));

      const raw = localStorage.getItem(CUSTOM_IDS_KEY);
      const ids = raw ? ((JSON.parse(raw) as string[]) ?? []) : [];
      if (!ids.includes(raceId)) {
        localStorage.setItem(CUSTOM_IDS_KEY, JSON.stringify([...ids, raceId]));
      }

      setAddRaceId("");
    } catch (error) {
      setAddError(String((error as Error).message ?? error));
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="card">
      <div className="event-controls">
        <input
          className="search-box"
          placeholder="Search events by name, id, or date"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="event-add-row">
          <input
            className="search-box"
            placeholder="Add event ID (example: 302794)"
            value={addRaceId}
            onChange={(e) => setAddRaceId(e.target.value)}
          />
          <button className="btn" onClick={addEvent} disabled={adding}>
            {adding ? "Adding..." : "Add Event"}
          </button>
        </div>

        <div className="event-options">
          <label className="meta event-check">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden races ({hiddenCount})
          </label>
        </div>

        {addError && (
          <p className="warn" style={{ marginTop: 0 }}>
            {addError}
          </p>
        )}

        <SearchPanel raceIds={list.map((event) => event.raceId)} />
      </div>

      <div className="timeline-list">
        {grouped.map((group) => (
          <div key={group.key} className="timeline-group">
            <div className="timeline-date">{group.label}</div>
            {group.events.map((event) => {
              const hidden = hiddenIds.includes(event.raceId);
              return (
                <div key={event.raceId} className={`timeline-item ${hidden ? "is-hidden" : ""}`}>
                  <Link className="event-link" href={`/event/${event.raceId}`}>
                    <div>
                      <div className="badge">Race {event.raceId}</div>
                      <h3 style={{ margin: "8px 0 4px", fontFamily: "Gill Sans, Avenir Next Condensed, Trebuchet MS, sans-serif", fontSize: "1.04rem" }}>
                        {event.label}
                      </h3>
                      <div className="meta">
                        {event.teams} teams • {event.athletes} athletes
                      </div>
                    </div>
                    <div className="meta">Open</div>
                  </Link>
                  <button className="ghost-btn" onClick={() => toggleHidden(event.raceId)}>
                    {hidden ? "Unhide" : "Hide"}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
