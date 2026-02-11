# Ski Live Scoreboard

Modern, mobile-first frontend for live alpine race results with real-time team scoring.

## What it does

- Polls live timing feed every `30s` by default (configurable).
- Parses multiple raw feed shapes (`json`, `jsonp`, `inline js`, `html table`, `csv-like`).
- Scores teams using MSHSL-style best-4 scoring.
- Uses all varsity-designated athletes when varsity is provided; if not provided, all athletes are treated as varsity.
- Splits scoring by gender and keeps boys/girls separate.
- Provides event directory, event search, and athlete search.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript

## Config

Environment variables:

- `NEXT_PUBLIC_POLL_INTERVAL_MS` (default: `30000`)
- `COUNTING_FINISHERS` (default: `4`)
- `ENFORCE_TEAM_SIZE_CAP` (default: `false`)
- `MAX_TEAM_ROSTER` (default: `6`, only used if cap is enforced)

## Event IDs

Edit `lib/config.ts` and update `EVENT_REFERENCES` to control which races appear on the home page.

## Gender inference overrides

Some feeds do not provide explicit gender in competitor records. For those races, configure
`RACE_GENDER_RULES` in `lib/config.ts`.

Current supported override:

- `bib-threshold`: infer gender from bib number range
  - `bib >= threshold` -> `highBibGender`
  - `bib < threshold` -> opposite gender

## Running

```bash
npm install
npm run dev
```

## Important note

This environment could not directly reach `live-timing.com`, so parser heuristics were implemented without inspecting your exact live payloads. To finalize robust mapping, provide one raw response body from:

- `https://live-timing.com/includes/aj_club2020.php?r=302794`

and one from the special format race:

- `https://live-timing.com/includes/aj_club2020.php?r=288245`

With those two raw payload samples, we can lock parser mappings and validate edge cases.
