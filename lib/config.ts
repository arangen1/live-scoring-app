import { EventReference, RaceGenderRule, TeamScoringConfig } from "@/lib/types";

export const POLL_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 30_000);

export const TEAM_SCORING_CONFIG: TeamScoringConfig = {
  countingFinishers: Number(process.env.COUNTING_FINISHERS ?? 4),
  enforceTeamSizeCap: process.env.ENFORCE_TEAM_SIZE_CAP === "true",
  maxTeamRoster: Number(process.env.MAX_TEAM_ROSTER ?? 6)
};

export const EVENT_REFERENCES: EventReference[] = [
  { raceId: "302794", label: "Sample Mixed Feed" },
  { raceId: "301974", label: "Race 301974" },
  { raceId: "301975", label: "Race 301975" },
  { raceId: "301965", label: "Race 301965" },
  { raceId: "301835", label: "Race 301835" },
  { raceId: "288086", label: "Race 288086" },
  { raceId: "288245", label: "Race 288245" }
];

export const RACE_GENDER_RULES: Record<string, RaceGenderRule> = {
  // This feed uses c=VARSITY/JV instead of M/F. Bib ranges are split by gender.
  // Adjust this threshold if a provider changes bib assignment conventions.
  "288245": {
    mode: "bib-threshold",
    bibThreshold: 100,
    highBibGender: "girls"
  }
};
