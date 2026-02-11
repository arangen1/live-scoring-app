import { RACE_GENDER_RULES } from "@/lib/config";
import { normalizeAthleteRecord } from "@/lib/normalizers";
import { AthleteResult, Gender, ParsedRace } from "@/lib/types";

const RAW_ENDPOINT = "https://live-timing.com/includes/aj_club2020.php";

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function tokenizePipeFormat(raw: string): string[] {
  return raw
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parsePipeKeyValue(token: string): { key: string; value: string } | null {
  const index = token.indexOf("=");
  if (index <= 0) return null;
  const key = token.slice(0, index).trim();
  const value = token.slice(index + 1).trim();
  if (!key) return null;
  return { key, value };
}

function parseRunValue(value: string): { runIndex: string; runTime: string } | null {
  const idx = value.indexOf("=");
  if (idx <= 0) return null;
  return {
    runIndex: value.slice(0, idx).trim(),
    runTime: value.slice(idx + 1).trim()
  };
}

function classifyCField(value: string | undefined): { gender?: string; rosterType?: string } {
  const text = String(value ?? "").trim();
  const upper = text.toUpperCase();

  if (upper === "JVM") return { gender: "M", rosterType: "JV" };
  if (upper === "JVF") return { gender: "F", rosterType: "JV" };
  if (upper === "MJV") return { gender: "M", rosterType: "JV" };
  if (upper === "FJV") return { gender: "F", rosterType: "JV" };
  if (upper === "VM") return { gender: "M", rosterType: "VARSITY" };
  if (upper === "VF") return { gender: "F", rosterType: "VARSITY" };
  if (["M", "MALE", "MEN", "BOYS"].includes(upper)) return { gender: "M" };
  if (["F", "FEMALE", "WOMEN", "GIRLS", "L"].includes(upper)) return { gender: "F" };
  if (["V", "VARSITY", "JV", "JUNIOR VARSITY"].includes(upper)) return { rosterType: text };

  return text ? { gender: text } : {};
}

function parsePipeStructured(raw: string): {
  metadata: Record<string, string>;
  competitors: Record<string, unknown>[];
  results: Record<string, unknown>[];
} | null {
  if (!raw.includes("*=C") || !raw.includes("*=R")) return null;

  const metadata: Record<string, string> = {};
  const competitors: Record<string, unknown>[] = [];
  const results: Record<string, unknown>[] = [];

  const tokens = tokenizePipeFormat(raw);
  let mode: "header" | "competitor" | "result" | "other" = "header";
  let currentCompetitor: Record<string, unknown> | null = null;
  let currentResult: Record<string, unknown> | null = null;

  const flushCompetitor = (): void => {
    if (currentCompetitor && currentCompetitor.I) competitors.push(currentCompetitor);
    currentCompetitor = null;
  };

  const flushResult = (): void => {
    if (currentResult && currentResult.I) results.push(currentResult);
    currentResult = null;
  };

  for (const token of tokens) {
    if (token === "*=CD" || token === "*=C" || token === "*=OC" || token === "*=Photos") {
      if (token === "*=CD") {
        mode = "header";
      } else if (token === "*=C") {
        flushCompetitor();
        mode = "competitor";
      } else {
        mode = "other";
      }
      continue;
    }

    if (token === "*=R") {
      flushCompetitor();
      flushResult();
      mode = "result";
      currentResult = {};
      continue;
    }

    if (token === "endC") {
      flushCompetitor();
      mode = "other";
      continue;
    }

    if (token === "endR") {
      flushResult();
      mode = "other";
      continue;
    }

    const kv = parsePipeKeyValue(token);
    if (!kv) continue;

    if (mode === "header") {
      if (/^h[A-Za-z]+$/.test(kv.key)) metadata[kv.key] = kv.value;
      continue;
    }

    if (mode === "competitor") {
      if (kv.key === "I") {
        flushCompetitor();
        currentCompetitor = { I: kv.value };
      } else if (currentCompetitor) {
        currentCompetitor[kv.key] = kv.value;
      }
      continue;
    }

    if (mode === "result") {
      if (kv.key === "I") {
        flushResult();
        currentResult = { I: kv.value };
        continue;
      }

      if (!currentResult) currentResult = {};

      if (kv.key === "r") {
        const run = parseRunValue(kv.value);
        if (run) {
          const existingSeq = String(currentResult.runSeq ?? "").trim();
          currentResult.runSeq = existingSeq ? `${existingSeq},${run.runTime}` : run.runTime;

          const runKey = `run${run.runIndex}`;
          const existing = String(currentResult[runKey] ?? "").trim();
          currentResult[runKey] = existing ? `${existing},${run.runTime}` : run.runTime;

          const existingRaw = String(currentResult.runRaw ?? "").trim();
          currentResult.runRaw = existingRaw ? `${existingRaw},${run.runTime}` : run.runTime;
        }
        continue;
      }

      currentResult[kv.key] = kv.value;
    }
  }

  flushCompetitor();
  flushResult();

  return { metadata, competitors, results };
}

function toPipeRows(raw: string): { rows: Record<string, unknown>[]; metadata: Record<string, string> } | null {
  const parsed = parsePipeStructured(raw);
  if (!parsed) return null;

  const byId = new Map<string, Record<string, unknown>>();
  for (const c of parsed.competitors) {
    const id = String(c.I ?? "").trim();
    if (id) byId.set(id, c);
  }

  const resultById = new Map<string, Record<string, unknown>>();
  for (const result of parsed.results) {
    const id = String(result.I ?? "").trim();
    if (id) resultById.set(id, result);
  }

  const allIds = new Set<string>([...byId.keys(), ...resultById.keys()]);

  const rows = [...allIds].map((athleteId) => {
    const result = resultById.get(athleteId) ?? {};
    const base = byId.get(athleteId) ?? {};
    const cField = classifyCField(String(base.c ?? ""));
    const runSeq = String(result.runSeq ?? "").trim();
    const runSeqTokens = runSeq
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const indexedRun0 = String(result.run0 ?? "").trim();
    const indexedRun1 = String(result.run1 ?? "").trim();

    let run0 = indexedRun0;
    let run1 = indexedRun1;

    if (runSeqTokens.length >= 2) {
      // Some feeds repeat r=0 twice; preserve order as run1/run2.
      run0 = runSeqTokens[0];
      run1 = runSeqTokens[1];
    } else if (runSeqTokens.length === 1) {
      // Keep the run in its indexed slot if provided (r=0 or r=1 only).
      if (indexedRun0 && !indexedRun1) {
        run0 = runSeqTokens[0];
        run1 = "";
      } else if (indexedRun1 && !indexedRun0) {
        run0 = "";
        run1 = runSeqTokens[0];
      } else if (!indexedRun0 && !indexedRun1) {
        run0 = runSeqTokens[0];
        run1 = "";
      }
    }
    const runRaw = String(result.runRaw ?? "").trim();
    const final = String(result.f ?? "").trim();
    const fallbackTotal = final || run0 || run1 || runSeqTokens[0] || "";
    const runStatusSource = [run0, run1, runRaw].find((v) => /\b(DNF|DNS|DSQ|DQ)\b/i.test(v));
    const runStatusMatch = runStatusSource?.match(/\b(DNF|DNS|DSQ|DQ)\b/i)?.[1]?.toLowerCase();
    const status = runStatusMatch ?? (final ? "ok" : "unknown");

    return {
      athleteId,
      I: athleteId,
      bib: base.b ?? base.bib,
      b: base.b,
      name: base.n,
      n: base.n,
      gender: cField.gender,
      rosterType: cField.rosterType,
      c: base.c,
      team: base.t,
      t: base.t,
      class: base.L,
      L: base.L,
      run0,
      run1,
      runSeq,
      runRaw,
      f: final,
      time: fallbackTotal || undefined,
      status
    } satisfies Record<string, unknown>;
  });

  return { rows, metadata: parsed.metadata };
}

function stripJsonp(input: string): string {
  const match = input.match(/^[^(]+\((.*)\);?$/s);
  return match?.[1] ?? input;
}

function safeJsonParse(input: string): unknown | null {
  try {
    return JSON.parse(stripJsonp(input));
  } catch {
    return null;
  }
}

function csvLineToRecord(header: string[], line: string): Record<string, unknown> {
  const cols = line.split(",").map((part) => part.trim());
  return header.reduce<Record<string, unknown>>((acc, key, index) => {
    acc[key] = cols[index] ?? "";
    return acc;
  }, {});
}

function parseCsvLike(raw: string): Record<string, unknown>[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((part) => part.trim());
  if (header.length < 3) return [];

  return lines.slice(1).map((line) => csvLineToRecord(header, line));
}

function parseHtmlTable(raw: string): Record<string, unknown>[] {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const stripTags = (value: string) => value.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

  const rows: string[][] = [];
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(raw))) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }

  if (rows.length < 2) return [];

  const header = rows[0];
  return rows.slice(1).map((values) =>
    header.reduce<Record<string, unknown>>((acc, key, index) => {
      acc[key] = values[index] ?? "";
      return acc;
    }, {})
  );
}

function objectArrayCandidates(node: unknown, bag: Record<string, unknown>[][]): void {
  if (Array.isArray(node)) {
    if (node.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      bag.push(node as Record<string, unknown>[]);
    }
    for (const item of node) objectArrayCandidates(item, bag);
    return;
  }

  if (node && typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      objectArrayCandidates(value, bag);
    }
  }
}

function parseFromJsonPayload(payload: unknown): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[][] = [];
  objectArrayCandidates(payload, candidates);

  if (!candidates.length) return [];

  const scored = candidates
    .map((array) => {
      const signal = array.reduce((count, row) => {
        const keys = Object.keys(row).join("|").toLowerCase();
        return count + Number(/name|team|time|place|rank|bib/.test(keys));
      }, 0);
      return { array, signal };
    })
    .sort((a, b) => b.signal - a.signal);

  return scored[0].array;
}

function parseInlineJsObject(raw: string): Record<string, unknown>[] {
  const matches = raw.match(/\[[\s\S]*\]/g);
  if (!matches) return [];

  for (const candidate of matches) {
    const parsed = safeJsonParse(candidate);
    if (Array.isArray(parsed) && parsed.every((row) => row && typeof row === "object")) {
      return parsed as Record<string, unknown>[];
    }
  }

  return [];
}

function toAthleteResults(rows: Record<string, unknown>[]): AthleteResult[] {
  const list = rows.map(normalizeAthleteRecord).filter((item): item is AthleteResult => Boolean(item));

  const deduped = new Map<string, AthleteResult>();
  for (const item of list) {
    const key = `${item.athleteId}|${item.timeRaw}|${item.status}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }

  return [...deduped.values()];
}

function assignPlaces(rows: AthleteResult[]): AthleteResult[] {
  const groups = new Map<string, AthleteResult[]>();

  for (const row of rows) {
    const key = row.gender;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(row);
  }

  for (const group of groups.values()) {
    const valid = group
      .filter((row) => row.status === "ok" && typeof row.timeMs === "number")
      .sort((a, b) => (a.timeMs ?? Number.MAX_SAFE_INTEGER) - (b.timeMs ?? Number.MAX_SAFE_INTEGER));

    valid.forEach((athlete, index) => {
      athlete.place = index + 1;
    });
  }

  return rows;
}

function parseBibNumber(bib?: string): number | undefined {
  if (!bib) return undefined;
  const match = bib.match(/^(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function applyRaceGenderRule(rows: AthleteResult[], raceId: string): AthleteResult[] {
  const rule = RACE_GENDER_RULES[raceId];
  if (!rule || rule.mode === "none") return rows;

  if (rule.mode === "bib-threshold") {
    const threshold = rule.bibThreshold ?? 100;
    const highGender = rule.highBibGender ?? "girls";
    const lowGender = highGender === "girls" ? "boys" : "girls";

    return rows.map((row) => {
      if (row.gender !== "unknown") return row;
      const bibNum = parseBibNumber(row.bib);
      if (bibNum === undefined) return row;
      return { ...row, gender: bibNum >= threshold ? highGender : lowGender };
    });
  }

  return rows;
}

function sanitizeRaceTitle(value: string): string {
  return value.replace(/^C\d+=/i, "").trim();
}

function inferGenderFromTitle(title: string): Gender | undefined {
  const lower = title.toLowerCase();
  const hasBoys = /\b(men|boys|male)\b/.test(lower);
  const hasGirls = /\b(women|girls|female|ladies)\b/.test(lower);
  if (hasBoys && !hasGirls) return "boys";
  if (hasGirls && !hasBoys) return "girls";
  return undefined;
}

function applyTitleGenderHint(rows: AthleteResult[], title: string): AthleteResult[] {
  const hint = inferGenderFromTitle(title);
  if (!hint) return rows;
  return rows.map((row) => (row.gender === "unknown" ? { ...row, gender: hint } : row));
}

function deriveMetadata(
  rows: Record<string, unknown>[],
  header?: Record<string, string>
): { title: string; venue?: string; date?: string } {
  const first = rows[0] ?? {};
  const rawTitle = String(header?.hN ?? first.event ?? first.race ?? first.raceName ?? first.name ?? "Live Timing Event");
  return {
    title: sanitizeRaceTitle(rawTitle),
    venue: String(header?.hR ?? first.venue ?? first.location ?? "").trim() || undefined,
    date:
      parseDate(String(header?.hST ?? "").trim()) ||
      String(first.date ?? first.raceDate ?? "").trim() ||
      undefined
  };
}

export async function fetchLiveTimingRaw(raceId: string): Promise<string> {
  const url = `${RAW_ENDPOINT}?r=${encodeURIComponent(raceId)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Live feed request failed (${response.status})`);
  }
  return response.text();
}

export function parseLiveTimingPayload(raw: string, raceId: string): ParsedRace {
  const notes: string[] = [];
  let rows: Record<string, unknown>[] = [];
  let sourceFormat = "unknown";
  let headerMeta: Record<string, string> | undefined;

  const pipeData = toPipeRows(raw);
  if (pipeData?.rows.length) {
    rows = pipeData.rows;
    headerMeta = pipeData.metadata;
    sourceFormat = "pipe-live-timing";
    notes.push("Parsed from live-timing pipe feed format.");
  }

  if (!rows.length) {
    const jsonPayload = safeJsonParse(raw);
    if (jsonPayload) {
      rows = parseFromJsonPayload(jsonPayload);
      sourceFormat = "json";
    }
  }

  if (!rows.length) {
    rows = parseInlineJsObject(raw);
    if (rows.length) {
      sourceFormat = "inline-js-array";
      notes.push("Parsed from embedded JavaScript array.");
    }
  }

  if (!rows.length && /<table/i.test(raw)) {
    rows = parseHtmlTable(raw);
    if (rows.length) {
      sourceFormat = "html-table";
      notes.push("Parsed from HTML table.");
    }
  }

  if (!rows.length && raw.includes(",")) {
    rows = parseCsvLike(raw);
    if (rows.length) {
      sourceFormat = "csv";
      notes.push("Parsed as CSV-like payload.");
    }
  }

  const metadata = deriveMetadata(rows, headerMeta);
  const participants = assignPlaces(applyTitleGenderHint(applyRaceGenderRule(toAthleteResults(rows), raceId), metadata.title));

  if (!participants.length) {
    notes.push("No participants recognized; feed mapping may need adjustment for this race format.");
  }

  return {
    raceId,
    title: metadata.title,
    venue: metadata.venue,
    date: metadata.date,
    updatedAt: new Date().toISOString(),
    participants,
    sourceFormat,
    notes
  };
}
