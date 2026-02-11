import { ParsedRace } from "@/lib/types";

export const FALLBACK_FIXTURES: Record<string, ParsedRace> = {
  "302794": {
    raceId: "302794",
    title: "Demo Alpine Invite",
    venue: "Demo Hill",
    date: "2026-02-11",
    updatedAt: new Date().toISOString(),
    sourceFormat: "fixture",
    notes: ["Using fixture data because live feed is unavailable in this environment."],
    participants: [
      {
        athleteId: "1",
        bib: "101",
        fullName: "Alex Reed",
        team: "North",
        gender: "boys",
        isVarsity: true,
        place: 1,
        timeRaw: "43.20 R",
        timeMs: 43200,
        status: "ok",
        source: {}
      },
      {
        athleteId: "2",
        bib: "102",
        fullName: "Sam Lee",
        team: "North",
        gender: "boys",
        isVarsity: true,
        place: 4,
        timeRaw: "44.10 R",
        timeMs: 44100,
        status: "ok",
        source: {}
      },
      {
        athleteId: "3",
        bib: "103",
        fullName: "Chris Hall",
        team: "North",
        gender: "boys",
        isVarsity: true,
        place: 6,
        timeRaw: "44.88 R",
        timeMs: 44880,
        status: "ok",
        source: {}
      },
      {
        athleteId: "4",
        bib: "104",
        fullName: "Ryan Fox",
        team: "North",
        gender: "boys",
        isVarsity: true,
        place: 8,
        timeRaw: "45.30 R",
        timeMs: 45300,
        status: "ok",
        source: {}
      },
      {
        athleteId: "5",
        bib: "201",
        fullName: "Mia Stone",
        team: "South",
        gender: "girls",
        isVarsity: true,
        place: 1,
        timeRaw: "46.10 L",
        timeMs: 46100,
        status: "ok",
        source: {}
      },
      {
        athleteId: "6",
        bib: "202",
        fullName: "Eve Lane",
        team: "South",
        gender: "girls",
        isVarsity: true,
        place: 3,
        timeRaw: "47.01 L",
        timeMs: 47010,
        status: "ok",
        source: {}
      },
      {
        athleteId: "7",
        bib: "203",
        fullName: "Nora Kay",
        team: "South",
        gender: "girls",
        isVarsity: true,
        place: 4,
        timeRaw: "47.44 L",
        timeMs: 47440,
        status: "ok",
        source: {}
      },
      {
        athleteId: "8",
        bib: "204",
        fullName: "Ivy Marsh",
        team: "South",
        gender: "girls",
        isVarsity: true,
        place: 7,
        timeRaw: "48.93 L",
        timeMs: 48930,
        status: "ok",
        source: {}
      }
    ]
  }
};
