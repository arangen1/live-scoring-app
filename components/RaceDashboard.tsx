"use client";

import { POLL_INTERVAL_MS } from "@/lib/config";
import { AthleteResult, ScoredRace, TeamScoreRow } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AthleteHistoryTile } from "@/components/AthleteHistoryTile";

type GenderView = "boys" | "girls" | "unknown";
type EventView = "team" | "individual";
type SortKey = "place" | "athlete" | "team" | "run1" | "run2" | "total" | "status";

interface RunInfo {
  raw?: string;
  ms?: number;
}

function scoreLabel(total: number): string {
  return Number.isFinite(total) ? String(total) : "Incomplete";
}

function preferredGender(data: ScoredRace): GenderView {
  const set = new Set<GenderView>(data.individuals.map((row) => row.gender).filter((g): g is GenderView => g !== "unknown"));
  if (set.has("girls")) return "girls";
  if (set.has("boys")) return "boys";
  return "unknown";
}

function timeToMs(value: string): number | undefined {
  const clean = value.replace(/[^0-9:.]/g, "").trim();
  if (!clean) return undefined;
  const parts = clean.split(":");
  if (parts.length > 2) return undefined;

  const secondsPart = parts.pop();
  const minutesPart = parts.pop();
  if (!secondsPart) return undefined;

  const seconds = Number(secondsPart);
  const minutes = minutesPart ? Number(minutesPart) : 0;
  if (!Number.isFinite(seconds) || !Number.isFinite(minutes)) return undefined;
  return Math.round((minutes * 60 + seconds) * 1000);
}

function parseRunParts(value: unknown): string[] {
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function runDisplay(value: unknown): RunInfo {
  const part = parseRunParts(value)[0];
  if (!part) return {};
  return { raw: part, ms: timeToMs(part) };
}

function hasVarsityDesignation(row: AthleteResult): boolean {
  if (row.source.rosterType !== undefined || row.source.varsity !== undefined || row.source.isVarsity !== undefined) return true;
  const c = String(row.source.c ?? row.source.class ?? row.source.L ?? "").trim().toLowerCase();
  return ["jv", "jvm", "jvf", "mjv", "fjv", "v", "vm", "vf", "varsity", "junior varsity"].includes(c);
}

function runRankMap(rows: AthleteResult[], runKey: "run0" | "run1"): Map<string, number> {
  const valid = rows
    .map((row) => ({ id: row.athleteId, ...runDisplay(row.source[runKey]) }))
    .filter((row): row is { id: string; ms: number } => row.ms !== undefined)
    .sort((a, b) => a.ms - b.ms);

  const map = new Map<string, number>();
  valid.forEach((row, index) => map.set(row.id, index + 1));
  return map;
}

function statusClass(status: string): string {
  if (status === "ok") return "roster-ok";
  return "roster-out";
}

function hasStarted(athlete: AthleteResult): boolean {
  if (athlete.status === "dns") return false;
  return Boolean(athlete.timeRaw || athlete.source.run0 || athlete.source.run1 || athlete.source.runSeq);
}

function athleteRacePoints(athlete: AthleteResult, startedCount: number): number {
  if (athlete.status !== "ok" || !athlete.place) return 0;
  return Math.max(startedCount - athlete.place + 1, 0);
}

function teamRosterForRow(row: TeamScoreRow, individualRows: AthleteResult[]): AthleteResult[] {
  const designated = individualRows.some(hasVarsityDesignation);
  const base = individualRows.filter((athlete) => athlete.team === row.team);
  const filtered = designated ? base.filter((athlete) => athlete.isVarsity) : base;
  return filtered.sort((a, b) => (a.place ?? Number.MAX_SAFE_INTEGER) - (b.place ?? Number.MAX_SAFE_INTEGER));
}

export function RaceDashboard({ raceId, initialData }: { raceId: string; initialData: ScoredRace }) {
  const searchParams = useSearchParams();
  const [gender, setGender] = useState<GenderView>(() => preferredGender(initialData));
  const [view, setView] = useState<EventView>("team");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("place");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedAthleteName, setSelectedAthleteName] = useState<string | null>(null);
  const [data, setData] = useState<ScoredRace>(initialData);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const response = await fetch(`/api/live/${raceId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Failed to refresh (${response.status})`);
        const next = (await response.json()) as ScoredRace;
        if (mounted) {
          setData(next);
          setLastError(null);
        }
      } catch (error) {
        if (mounted) setLastError(String((error as Error).message ?? error));
      }
    };

    const timer = setInterval(run, POLL_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [raceId]);

  const availableGenders = useMemo(() => {
    const present = new Set<GenderView>(data.individuals.map((row) => row.gender).filter((g): g is GenderView => Boolean(g)));
    return (["girls", "boys", "unknown"] as GenderView[]).filter((g) => present.has(g));
  }, [data.individuals]);

  useEffect(() => {
    if (!availableGenders.includes(gender) && availableGenders.length > 0) {
      setGender(availableGenders[0]);
    }
  }, [availableGenders, gender]);

  const teamRows = useMemo(() => data.teamScores.filter((row) => row.gender === gender), [data.teamScores, gender]);
  const allGenderIndividuals = useMemo(() => data.individuals.filter((row) => row.gender === gender), [data.individuals, gender]);

  const teamsForFilter = useMemo(
    () => [...new Set(allGenderIndividuals.map((row) => row.team))].sort((a, b) => a.localeCompare(b)),
    [allGenderIndividuals]
  );

  useEffect(() => {
    if (selectedTeam !== "all" && !teamsForFilter.includes(selectedTeam)) {
      setSelectedTeam("all");
    }
  }, [teamsForFilter, selectedTeam]);

  const individualRows = useMemo(() => {
    if (selectedTeam === "all") return allGenderIndividuals;
    return allGenderIndividuals.filter((row) => row.team === selectedTeam);
  }, [allGenderIndividuals, selectedTeam]);

  const sortedIndividualRows = useMemo(() => {
    const rows = [...individualRows];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortKey === "place") return ((a.place ?? Number.MAX_SAFE_INTEGER) - (b.place ?? Number.MAX_SAFE_INTEGER)) * dir;
      if (sortKey === "athlete") return a.fullName.localeCompare(b.fullName) * dir;
      if (sortKey === "team") return a.team.localeCompare(b.team) * dir;
      if (sortKey === "run1") return ((runDisplay(a.source.run0).ms ?? Number.MAX_SAFE_INTEGER) - (runDisplay(b.source.run0).ms ?? Number.MAX_SAFE_INTEGER)) * dir;
      if (sortKey === "run2") return ((runDisplay(a.source.run1).ms ?? Number.MAX_SAFE_INTEGER) - (runDisplay(b.source.run1).ms ?? Number.MAX_SAFE_INTEGER)) * dir;
      if (sortKey === "total") return ((a.timeMs ?? Number.MAX_SAFE_INTEGER) - (b.timeMs ?? Number.MAX_SAFE_INTEGER)) * dir;
      return a.status.localeCompare(b.status) * dir;
    });
    return rows;
  }, [individualRows, sortDir, sortKey]);

  const startedCount = useMemo(() => allGenderIndividuals.filter(hasStarted).length, [allGenderIndividuals]);

  const run1Ranks = useMemo(() => runRankMap(allGenderIndividuals, "run0"), [allGenderIndividuals]);
  const run2Ranks = useMemo(() => runRankMap(allGenderIndividuals, "run1"), [allGenderIndividuals]);

  const teamCount = new Set(data.individuals.map((row) => `${row.gender}:${row.team}`)).size;

  const focusedAthlete = searchParams.get("athlete");

  useEffect(() => {
    const requestedView = searchParams.get("view");
    if (requestedView === "individual") setView("individual");
    if (requestedView === "team") setView("team");

    const requestedTeam = searchParams.get("team");
    if (requestedTeam) setSelectedTeam(requestedTeam);
  }, [searchParams]);

  useEffect(() => {
    if (view !== "individual" || !focusedAthlete) return;
    const id = `athlete-row-${focusedAthlete}`;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedAthlete, view, sortedIndividualRows]);

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <Link className="meta" href="/">
            Back to events
          </Link>
          <h1 className="title" style={{ marginTop: 4 }}>
            {data.race.title}
          </h1>
          <div className="meta">
            Race {data.race.raceId}
            {data.race.date ? ` • ${new Date(data.race.date).toLocaleDateString()}` : ""}
            {data.race.venue ? ` • ${data.race.venue}` : ""}
          </div>
        </div>
        <div className="badge">Polling {Math.round(POLL_INTERVAL_MS / 1000)}s</div>
      </div>

      <div className="status-row">
        <div className="kpi">
          <span className="meta">Athletes</span>
          <strong>{data.individuals.length}</strong>
        </div>
        <div className="kpi">
          <span className="meta">Teams</span>
          <strong>{teamCount}</strong>
        </div>
        <div className="kpi">
          <span className="meta">Updated</span>
          <strong style={{ fontSize: "0.95rem" }}>{new Date(data.race.updatedAt).toLocaleTimeString()}</strong>
        </div>
      </div>

      <div className="controls-row">
        <div className="tabs" role="tablist" aria-label="Event View">
          <button className={`tab ${view === "team" ? "active" : ""}`} onClick={() => setView("team")}>
            Team Scores
          </button>
          <button className={`tab ${view === "individual" ? "active" : ""}`} onClick={() => setView("individual")}>
            Individual Results
          </button>
        </div>

        <div className="tabs" role="tablist" aria-label="Gender Mode">
          {availableGenders.map((g) => (
            <button key={g} className={`tab ${gender === g ? "active" : ""}`} onClick={() => setGender(g)}>
              {g[0].toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {lastError && <p className="warn">Refresh warning: {lastError}</p>}
      {data.race.notes.length > 0 && (
        <p className="meta" style={{ marginTop: 6 }}>
          {data.race.notes.join(" ")}
        </p>
      )}

      {view === "team" && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2 className="section-title">Team Scores Breakdown</h2>
          <div className="team-card-grid">
            {teamRows.map((row, index) => {
              const scorerIds = new Set(row.scorers.map((s) => s.athleteId));
              const displacerIds = new Set(row.displacers.map((s) => s.athleteId));
              const roster = teamRosterForRow(row, allGenderIndividuals);
              const teamFinishers = roster.filter((athlete) => athlete.status === "ok").length;

              return (
                <article key={`${row.gender}-${row.team}`} className="team-card premium">
                  <div className="team-card-head">
                    <div>
                      <div className="meta">Rank #{index + 1}</div>
                      <h3 style={{ margin: "2px 0 0" }}>{row.team}</h3>
                    </div>
                    <div className="team-points">{scoreLabel(row.totalPoints)}</div>
                  </div>

                  <div className="team-stats">
                    <span>{roster.length} roster</span>
                    <span>{teamFinishers} finishers</span>
                    <span>{row.scorers.length} scorers</span>
                  </div>

                  <div className="team-roster">
                    {roster.map((athlete) => {
                      const marker = scorerIds.has(athlete.athleteId)
                        ? "scorer"
                        : displacerIds.has(athlete.athleteId)
                          ? "displacer"
                          : "roster";

                      return (
                        <div key={`${row.team}-${athlete.athleteId}`} className={`athlete-chip ${marker} ${statusClass(athlete.status)}`}>
                          <span>{athlete.fullName}</span>
                          <span className="chip-meta">
                            P{athlete.place ?? "-"} • Pts {athleteRacePoints(athlete, startedCount)} • R1 {runDisplay(athlete.source.run0).raw ?? "-"} • R2 {runDisplay(athlete.source.run1).raw ?? "-"} • T {athlete.timeRaw ?? "-"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {view === "individual" && (
        <section className="card" style={{ marginTop: 12 }}>
          <div className="section-header">
            <h2 className="section-title">Individual Results</h2>
            <div className="filter-group">
              <label htmlFor="team-filter" className="meta">Team</label>
              <select
                id="team-filter"
                className="team-select"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                <option value="all">All Teams</option>
                {teamsForFilter.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><button className="th-btn" onClick={() => toggleSort("place")}>Place</button></th>
                  <th><button className="th-btn" onClick={() => toggleSort("athlete")}>Athlete</button></th>
                  <th><button className="th-btn" onClick={() => toggleSort("team")}>Team</button></th>
                  <th><button className="th-btn" onClick={() => toggleSort("run1")}>Run 1</button></th>
                  <th><button className="th-btn" onClick={() => toggleSort("run2")}>Run 2</button></th>
                  <th><button className="th-btn" onClick={() => toggleSort("total")}>Total</button></th>
                  <th><button className="th-btn" onClick={() => toggleSort("status")}>Status</button></th>
                </tr>
              </thead>
              <tbody>
                {sortedIndividualRows.map((row) => {
                  const run1 = runDisplay(row.source.run0);
                  const run2 = runDisplay(row.source.run1);
                  const run1Rank = run1Ranks.get(row.athleteId);
                  const run2Rank = run2Ranks.get(row.athleteId);

                  return (
                    <tr
                      key={`${row.athleteId}-${row.timeRaw ?? ""}`}
                      id={`athlete-row-${row.athleteId}`}
                      className={focusedAthlete === row.athleteId ? "row-focus" : ""}
                    >
                      <td>{row.place ?? "-"}</td>
                      <td>
                        <button className="name-link" onClick={() => setSelectedAthleteName(row.fullName)}>
                          {row.fullName}
                        </button>
                      </td>
                      <td>{row.team}</td>
                      <td>
                        <div>{run1.raw ?? "-"}</div>
                        <div className="run-meta">{run1Rank ? `Run place #${run1Rank}` : ""}</div>
                      </td>
                      <td>
                        <div>{run2.raw ?? "-"}</div>
                        <div className="run-meta">{run2Rank ? `Run place #${run2Rank}` : ""}</div>
                      </td>
                      <td>{row.timeRaw ?? "-"}</td>
                      <td>{row.status.toUpperCase()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedAthleteName && (
        <AthleteHistoryTile
          athleteName={selectedAthleteName}
          onClose={() => setSelectedAthleteName(null)}
          seedRaceIds={[data.race.raceId]}
        />
      )}
    </div>
  );
}
