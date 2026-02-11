import { AthleteResult, Gender, ResultStatus } from "@/lib/types";

const DNF_PATTERN = /(dnf|dsq|dq|dns|did not finish|did not start|disqualified)/i;

export function normalizeGender(value: unknown, timeField?: string): Gender {
  const text = String(value ?? "").trim().toLowerCase();
  if (["mjv"].includes(text)) return "boys";
  if (["fjv"].includes(text)) return "girls";
  if (["vm", "jvm"].includes(text)) return "boys";
  if (["vf", "jvf"].includes(text)) return "girls";
  if (["m", "male", "men", "boys", "r", "red"].includes(text)) return "boys";
  if (["f", "female", "women", "girls", "l", "lady"].includes(text)) return "girls";

  if (timeField) {
    if (/\bR\b/.test(timeField)) return "boys";
    if (/\bL\b/.test(timeField)) return "girls";
  }

  return "unknown";
}

export function normalizeStatus(value: unknown, timeValue?: string): ResultStatus {
  const text = String(value ?? "").trim().toLowerCase();
  const timeText = String(timeValue ?? "").trim();

  if (["ok", "finished", "valid"].includes(text)) return "ok";
  if (["dnf"].includes(text)) return "dnf";
  if (["dq", "dsq", "disqualified"].includes(text)) return "dq";
  if (["dns"].includes(text)) return "dns";
  if (!text && !timeText) return "unknown";
  if (DNF_PATTERN.test(text) || DNF_PATTERN.test(timeText)) {
    if (/dns/i.test(text) || /dns/i.test(timeText)) return "dns";
    if (/dq|dsq|disqualified/i.test(text) || /dq|dsq|disqualified/i.test(timeText)) return "dq";
    return "dnf";
  }
  return "ok";
}

export function parseRaceTimeToMs(value: unknown): number | undefined {
  const timeText = String(value ?? "").trim();
  if (!timeText) return undefined;

  const clean = timeText
    .replace(/\b[RL]\b/g, "")
    .replace(/[^0-9:.]/g, "")
    .trim();

  if (!clean) return undefined;

  const minuteSplit = clean.split(":");
  if (minuteSplit.length > 2) return undefined;

  const secondsPart = minuteSplit.pop();
  const minutesPart = minuteSplit.pop();
  if (!secondsPart) return undefined;

  const seconds = Number(secondsPart);
  if (!Number.isFinite(seconds)) return undefined;

  const minutes = minutesPart ? Number(minutesPart) : 0;
  if (!Number.isFinite(minutes)) return undefined;

  return Math.round((minutes * 60 + seconds) * 1000);
}

export function toAthleteId(record: Record<string, unknown>): string {
  const idValue =
    record.athleteId ??
    record.athlete_id ??
    record.competitorId ??
    record.competitor_id ??
    record.I ??
    record.bib ??
    record.BIB ??
    record.b ??
    record.id;

  return String(idValue ?? `${record.lastName ?? ""}-${record.firstName ?? ""}`).trim();
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["mjv", "fjv"].includes(text)) return false;
  if (["vm", "vf", "varsity", "v"].includes(text)) return true;
  if (["jvm", "jvf", "jv", "junior varsity"].includes(text)) return false;
  if (["1", "true", "yes", "y", "varsity", "v"].includes(text)) return true;
  if (["0", "false", "no", "n", "jv"].includes(text)) return false;
  return undefined;
}

function readName(record: Record<string, unknown>): { firstName?: string; lastName?: string; fullName: string } {
  const firstName = String(record.firstName ?? record.first_name ?? record.fname ?? "").trim() || undefined;
  const lastName = String(record.lastName ?? record.last_name ?? record.lname ?? "").trim() || undefined;
  const fullNameFromRow = String(record.name ?? record.fullName ?? record.full_name ?? record.n ?? "").trim();
  const fullName = fullNameFromRow || [firstName, lastName].filter(Boolean).join(" ").trim() || "Unknown Athlete";
  return { firstName, lastName, fullName };
}

export function normalizeAthleteRecord(record: Record<string, unknown>): AthleteResult | null {
  const team = String(record.team ?? record.teamName ?? record.school ?? record.club ?? record.t ?? "").trim() || "Unassigned";
  const teamCode = String(record.teamCode ?? record.schoolCode ?? record.team_code ?? "").trim() || undefined;
  const run0First = String(record.run0 ?? "").split(",").map((x) => x.trim()).filter(Boolean)[0];
  const run1First = String(record.run1 ?? "").split(",").map((x) => x.trim()).filter(Boolean)[0];
  const timeRaw =
    String(record.time ?? record.timeRaw ?? record.total ?? record.runTotal ?? record.f ?? run0First ?? run1First ?? "").trim() ||
    undefined;
  const status = normalizeStatus(record.status ?? record.resultStatus, timeRaw);
  const placeRaw = Number(record.place ?? record.rank ?? record.position ?? record.order ?? NaN);
  const place = Number.isFinite(placeRaw) && placeRaw > 0 ? placeRaw : undefined;
  const gender = normalizeGender(
    record.gender ?? record.sex ?? record.group ?? record.c ?? record.class ?? record.L,
    timeRaw
  );
  const varsityValue = parseBoolean(
    record.isVarsity ?? record.varsity ?? record.rosterType ?? record.teamLevel ?? record.c ?? record.class ?? record.L
  );
  const { firstName, lastName, fullName } = readName(record);
  const athleteId = toAthleteId(record);

  if (!athleteId || fullName === "Unknown Athlete") return null;

  return {
    athleteId,
    bib: String(record.bib ?? record.BIB ?? record.b ?? "").trim() || undefined,
    firstName,
    lastName,
    fullName,
    team,
    teamCode,
    gender,
    isVarsity: varsityValue ?? true,
    place,
    timeRaw,
    timeMs: parseRaceTimeToMs(timeRaw),
    status,
    source: record
  };
}
