export type Gender = "boys" | "girls" | "unknown";

export type ResultStatus = "ok" | "dnf" | "dq" | "dns" | "dsq" | "unknown";

export interface AthleteResult {
  athleteId: string;
  bib?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  team: string;
  teamCode?: string;
  gender: Gender;
  isVarsity: boolean;
  place?: number;
  timeRaw?: string;
  timeMs?: number;
  status: ResultStatus;
  source: Record<string, unknown>;
}

export interface ParsedRace {
  raceId: string;
  title: string;
  venue?: string;
  date?: string;
  updatedAt: string;
  participants: AthleteResult[];
  sourceFormat: string;
  notes: string[];
}

export interface TeamScoringConfig {
  countingFinishers: number;
  enforceTeamSizeCap: boolean;
  maxTeamRoster: number;
}

export interface TeamAthleteScore {
  athleteId: string;
  fullName: string;
  team: string;
  place: number;
  points: number;
  gender: Gender;
  timeRaw?: string;
}

export interface TeamScoreRow {
  team: string;
  gender: Gender;
  totalPoints: number;
  scorers: TeamAthleteScore[];
  displacers: TeamAthleteScore[];
  completeTeam: boolean;
}

export interface ScoredRace {
  race: ParsedRace;
  teamScores: TeamScoreRow[];
  individuals: AthleteResult[];
}

export interface EventReference {
  raceId: string;
  label: string;
  eventDate?: string;
}

export type GenderRuleMode = "none" | "bib-threshold";

export interface RaceGenderRule {
  mode: GenderRuleMode;
  bibThreshold?: number;
  highBibGender?: Exclude<Gender, "unknown">;
}
