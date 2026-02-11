import { TEAM_SCORING_CONFIG } from "@/lib/config";
import { AthleteResult, ScoredRace, TeamAthleteScore, TeamScoreRow } from "@/lib/types";

function isEligibleFinisher(item: AthleteResult): boolean {
  return item.status === "ok" && Number.isFinite(item.place) && (item.place ?? 0) > 0;
}

function compareFinishers(a: AthleteResult, b: AthleteResult): number {
  const aPlace = a.place ?? Number.MAX_SAFE_INTEGER;
  const bPlace = b.place ?? Number.MAX_SAFE_INTEGER;
  if (aPlace !== bPlace) return aPlace - bPlace;
  return (a.timeMs ?? Number.MAX_SAFE_INTEGER) - (b.timeMs ?? Number.MAX_SAFE_INTEGER);
}

function splitByGender(list: AthleteResult[]): AthleteResult[][] {
  const boys = list.filter((row) => row.gender === "boys");
  const girls = list.filter((row) => row.gender === "girls");
  const unknown = list.filter((row) => row.gender === "unknown");

  if (!boys.length && !girls.length) return [unknown];
  return [boys, girls, unknown].filter((group) => group.length > 0);
}

function hasVarsityDesignation(row: AthleteResult): boolean {
  if (row.source.varsity !== undefined || row.source.isVarsity !== undefined || row.source.rosterType !== undefined) return true;
  const c = String(row.source.c ?? row.source.class ?? row.source.L ?? "").trim().toLowerCase();
  return ["jv", "jvm", "jvf", "v", "vm", "vf", "varsity", "junior varsity"].includes(c);
}

function normalizeVarsity(list: AthleteResult[]): AthleteResult[] {
  const hasDesignation = list.some(hasVarsityDesignation);
  if (hasDesignation) {
    return list.filter((row) => row.isVarsity);
  }
  return list.map((row) => ({ ...row, isVarsity: true }));
}

function hasStarted(item: AthleteResult): boolean {
  if (item.status === "dns") return false;
  const run0 = String(item.source.run0 ?? "").trim();
  const run1 = String(item.source.run1 ?? "").trim();
  const runRaw = String(item.source.runRaw ?? "").trim();
  return Boolean(item.timeRaw || run0 || run1 || runRaw);
}

function scoreGenderGroup(group: AthleteResult[]): TeamScoreRow[] {
  const varsity = normalizeVarsity(group);
  const finishers = varsity.filter(isEligibleFinisher).sort(compareFinishers);
  if (!finishers.length) return [];
  const startedCount = varsity.filter(hasStarted).length;

  const teamOrder = new Map<string, AthleteResult[]>();
  for (const athlete of finishers) {
    if (!teamOrder.has(athlete.team)) teamOrder.set(athlete.team, []);
    teamOrder.get(athlete.team)?.push(athlete);
  }

  const eligibleScorers: TeamAthleteScore[] = [];
  const placementPool = new Set<string>();

  for (const [team, athletes] of teamOrder.entries()) {
    const maxRoster = TEAM_SCORING_CONFIG.enforceTeamSizeCap ? TEAM_SCORING_CONFIG.maxTeamRoster : Number.MAX_SAFE_INTEGER;
    for (const athlete of athletes.slice(0, maxRoster)) {
      placementPool.add(`${team}::${athlete.athleteId}`);
    }
  }

  const poolFinishers = finishers.filter((athlete) => placementPool.has(`${athlete.team}::${athlete.athleteId}`));
  poolFinishers.forEach((athlete, index) => {
    eligibleScorers.push({
      athleteId: athlete.athleteId,
      fullName: athlete.fullName,
      team: athlete.team,
      place: athlete.place ?? index + 1,
      points: Math.max(startedCount - index, 0),
      gender: athlete.gender,
      timeRaw: athlete.timeRaw
    });
  });

  const teamRows = new Map<string, TeamScoreRow>();

  for (const entry of eligibleScorers) {
    if (!teamRows.has(entry.team)) {
      teamRows.set(entry.team, {
        team: entry.team,
        gender: entry.gender,
        totalPoints: 0,
        scorers: [],
        displacers: [],
        completeTeam: false
      });
    }

    const row = teamRows.get(entry.team);
    if (!row) continue;
    if (row.scorers.length < TEAM_SCORING_CONFIG.countingFinishers) {
      row.scorers.push(entry);
    } else {
      row.displacers.push(entry);
    }
  }

  const scoredRows = [...teamRows.values()].map((row) => {
    const completeTeam = row.scorers.length === TEAM_SCORING_CONFIG.countingFinishers;
    const totalPoints = completeTeam ? row.scorers.reduce((sum, scorer) => sum + scorer.points, 0) : Number.NEGATIVE_INFINITY;
    return { ...row, completeTeam, totalPoints };
  });

  return scoredRows.sort((a, b) => {
    if (a.completeTeam !== b.completeTeam) return Number(b.completeTeam) - Number(a.completeTeam);
    if (a.totalPoints !== b.totalPoints) return b.totalPoints - a.totalPoints;

    const aFifth = a.displacers[0]?.points ?? Number.NEGATIVE_INFINITY;
    const bFifth = b.displacers[0]?.points ?? Number.NEGATIVE_INFINITY;
    if (aFifth !== bFifth) return bFifth - aFifth;

    return a.team.localeCompare(b.team);
  });
}

export function scoreRace(race: ScoredRace["race"]): ScoredRace {
  const groups = splitByGender(race.participants);
  const teamScores = groups.flatMap(scoreGenderGroup);
  const individuals = [...race.participants].sort(compareFinishers);

  return {
    race,
    teamScores,
    individuals
  };
}
