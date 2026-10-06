import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildMonth, buildMonthSummary, daysInMonth, getReference, isLeapYear, MONTHS, topology, WEEKDAYS, type AdjacentDays, type GridMode, type Weekday } from "./calendar.ts";

const PAPERS = { a4: { name: "A4", widthMm: 210, heightMm: 297 }, letter: { name: "US Letter", widthMm: 215.9, heightMm: 279.4 }, a5: { name: "A5", widthMm: 148, heightMm: 210 }, legal: { name: "US Legal", widthMm: 215.9, heightMm: 355.6 } } as const;
type Paper = keyof typeof PAPERS;
class InputError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const enumValue = <T extends readonly string[]>(value: string | null, fallback: T[number], choices: T, label: string): T[number] => {
  if (value === null) return fallback;
  if (!choices.includes(value)) throw new InputError(400, `${label} must be one of: ${choices.join(", ")}`);
  return value as T[number];
};
function numberValue(value: string | null, fallback: number, label: string, min: number, max: number): number {
  if (value === null) return fallback;
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new InputError(400, `${label} must be a number from ${min} to ${max}`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new InputError(400, `${label} must be a number from ${min} to ${max}`);
  return n;
}
function yearMonth(yearRaw: string, monthRaw: string): [number, number] {
  if (!/^\d{1,4}$/.test(yearRaw) || !/^\d{1,2}$/.test(monthRaw)) throw new InputError(400, "year and month must be integers");
  const year = Number(yearRaw), month = Number(monthRaw);
  try { daysInMonth(year, month); } catch (error) { throw new InputError(400, (error as Error).message); }
  return [year, month];
}
function json(response: ServerResponse, status: number, payload: unknown, extra: Record<string, string> = {}): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=3600", "x-content-type-options": "nosniff", ...extra });
  response.end(JSON.stringify(payload));
}
function parseMonthPath(path: string, prefix: string): [number, number] | null {
  const match = path.match(new RegExp(`^${prefix}/([^/]+)/([^/]+)$`));
  return match ? yearMonth(match[1]!, match[2]!) : null;
}
function monthOptions(url: URL) {
  return {
    weekStart: enumValue(url.searchParams.get("weekStart"), "sunday", WEEKDAYS, "weekStart") as Weekday,
    gridMode: enumValue(url.searchParams.get("gridMode"), "natural", ["natural", "fixed-six-weeks"] as const, "gridMode") as GridMode,
  };
}
function allKeysAllowed(url: URL, allowed: string[]): void {
  for (const key of url.searchParams.keys()) if (!allowed.includes(key)) throw new InputError(400, `Unknown query parameter: ${key}`);
}
function monthEndpoint(year: number, month: number, url: URL) {
  allKeysAllowed(url, ["weekStart", "gridMode", "adjacentDays"]);
  const options = monthOptions(url);
  const adjacentDays = enumValue(url.searchParams.get("adjacentDays"), "include", ["include", "hide", "placeholder"] as const, "adjacentDays") as AdjacentDays;
  return buildMonth(year, month, options.weekStart, options.gridMode, adjacentDays);
}
function parseYearMonth(value: string | null, label: string): [number, number] {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new InputError(400, `${label} must use YYYY-MM format`);
  return [Number(value.slice(0, 4)), Number(value.slice(5, 7))];
}
function monthIndex(year: number, month: number): number { return year * 12 + month - 1; }
function formatYearMonth(index: number): [number, number] { return [Math.floor(index / 12), (index % 12) + 1]; }

function printLayout(year: number, month: number, url: URL) {
  allKeysAllowed(url, ["paper", "orientation", "weekStart", "gridMode", "margin", "headerHeight", "weekdayHeaderHeight", "notesHeight"]);
  const paper = enumValue(url.searchParams.get("paper"), "a4", ["a4", "letter", "a5", "legal"] as const, "paper") as Paper;
  const orientation = enumValue(url.searchParams.get("orientation"), "portrait", ["portrait", "landscape"] as const, "orientation");
  const weekStart = enumValue(url.searchParams.get("weekStart"), "monday", WEEKDAYS, "weekStart") as Weekday;
  const gridMode = enumValue(url.searchParams.get("gridMode"), "fixed-six-weeks", ["natural", "fixed-six-weeks"] as const, "gridMode") as GridMode;
  const margin = numberValue(url.searchParams.get("margin"), 10, "margin", 0, 100);
  let widthMm: number, heightMm: number;
  const name = PAPERS[paper].name;
  ({ widthMm, heightMm } = PAPERS[paper]);
  if (orientation === "landscape") [widthMm, heightMm] = [heightMm, widthMm];
  const printableWidth = widthMm - margin * 2, printableHeight = heightMm - margin * 2;
  if (printableWidth <= 0 || printableHeight <= 0) throw new InputError(400, "margin leaves no printable area");
  const headerHeight = numberValue(url.searchParams.get("headerHeight"), 20, "headerHeight", 0, Math.min(100, printableHeight));
  const weekdayHeaderHeight = numberValue(url.searchParams.get("weekdayHeaderHeight"), 10, "weekdayHeaderHeight", 0, Math.min(40, printableHeight));
  const notesHeight = numberValue(url.searchParams.get("notesHeight"), 0, "notesHeight", 0, Math.min(150, printableHeight));
  const gridHeight = printableHeight - headerHeight - weekdayHeaderHeight - notesHeight;
  if (gridHeight <= 0) throw new InputError(400, "header, weekday header, and notes areas leave no room for the calendar grid");
  const model = buildMonth(year, month, weekStart, gridMode, "include");
  const cellWidthMm = printableWidth / 7, cellHeightMm = gridHeight / model.rowCount;
  const warnings: string[] = [];
  if (cellHeightMm < 22) warnings.push("Each date cell is under 22 mm high; handwriting space may feel limited. This is a planning guideline, not a printer standard.");
  if (orientation === "portrait" && widthMm < 230) warnings.push("Landscape may provide more writable width per day, while portrait keeps the page taller.");
  return {
    paper: { name, widthMm, heightMm }, orientation,
    printableArea: { xMm: margin, yMm: margin, widthMm: printableWidth, heightMm: printableHeight },
    header: { heightMm: headerHeight }, weekdayHeader: { heightMm: weekdayHeaderHeight },
    notes: { heightMm: notesHeight },
    grid: { xMm: margin, yMm: margin + headerHeight + weekdayHeaderHeight, widthMm: printableWidth, heightMm: gridHeight, rows: model.rowCount, columns: 7 },
    cell: { widthMm: cellWidthMm, heightMm: cellHeightMm, areaMm2: cellWidthMm * cellHeightMm }, warnings,
  };
}
function blankGrid(url: URL) {
  allKeysAllowed(url, ["rows", "columns", "paper", "orientation", "margin"]);
  const rows = numberValue(url.searchParams.get("rows"), 6, "rows", 1, 20);
  const columns = numberValue(url.searchParams.get("columns"), 7, "columns", 1, 20);
  if (!Number.isInteger(rows) || !Number.isInteger(columns)) throw new InputError(400, "rows and columns must be integers");
  const paper = enumValue(url.searchParams.get("paper"), "a4", ["a4", "letter", "a5", "legal"] as const, "paper") as Paper;
  const orientation = enumValue(url.searchParams.get("orientation"), "portrait", ["portrait", "landscape"] as const, "orientation");
  const margin = numberValue(url.searchParams.get("margin"), 10, "margin", 0, 100);
  let widthMm: number, heightMm: number;
  const name = PAPERS[paper].name;
  ({ widthMm, heightMm } = PAPERS[paper]);
  if (orientation === "landscape") [widthMm, heightMm] = [heightMm, widthMm];
  const innerWidth = widthMm - margin * 2, innerHeight = heightMm - margin * 2;
  if (innerWidth <= 0 || innerHeight <= 0) throw new InputError(400, "margin leaves no printable area");
  const cellWidthMm = innerWidth / columns, cellHeightMm = innerHeight / rows;
  return { rows, columns, paper: { name, widthMm, heightMm }, orientation,
    printableArea: { xMm: margin, yMm: margin, widthMm: innerWidth, heightMm: innerHeight },
    cell: { widthMm: cellWidthMm, heightMm: cellHeightMm, areaMm2: cellWidthMm * cellHeightMm },
    cells: Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => ({ row: r + 1, column: c + 1 }))),
    humanReadableReference: { title: "Blank Calendar", url: "https://www.betacalendars.com/blank-calendar" },
  };
}
function comparison(url: URL) {
  allKeysAllowed(url, ["months", "weekStart", "gridMode"]);
  const parts = (url.searchParams.get("months") ?? "").split(",");
  if (parts.length < 2 || parts.length > 12 || parts.some((part) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(part))) throw new InputError(400, "months must contain 2 to 12 comma-separated YYYY-MM values");
  const monthIndexes = parts.map((part) => monthIndex(Number(part.slice(0, 4)), Number(part.slice(5, 7))));
  if (new Set(parts).size !== parts.length) throw new InputError(400, "months must not contain duplicates");
  if (monthIndexes.some((v, i) => i > 0 && v <= monthIndexes[i - 1]!)) throw new InputError(400, "months must be in chronological order");
  const { weekStart, gridMode } = monthOptions(url);
  const months = parts.map((part) => buildMonthSummary(Number(part.slice(0, 4)), Number(part.slice(5, 7)), weekStart, gridMode));
  return { weekStart, gridMode, months, differences: months.map((m, i) => i === 0 ? null : { from: months[i - 1]!.monthName, to: m.monthName, dayCountDelta: m.daysInMonth - months[i - 1]!.daysInMonth, rowCountChanged: m.rowCount !== months[i - 1]!.rowCount }) };
}

export function createApiServer() {
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? "/", "http://api.local");
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-methods", "GET, OPTIONS");
    response.setHeader("access-control-allow-headers", "accept, content-type");
    response.setHeader("access-control-max-age", "86400");
    response.setHeader("x-content-type-options", "nosniff");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    if (request.method !== "GET") { json(response, 405, { error: { code: "method_not_allowed", message: "Only GET and OPTIONS are supported." } }, { allow: "GET, OPTIONS" }); return; }
    if (url.pathname === "/health") { json(response, 200, { status: "ok", service: "betacalendars-calendar-api" }, { "cache-control": "no-store" }); return; }
    try {
      if (url.pathname === "/v1/month") throw new InputError(400, "Use /v1/month/{year}/{month}");
      let match = parseMonthPath(url.pathname, "/v1/month");
      if (match) { json(response, 200, monthEndpoint(...match, url)); return; }
      match = parseMonthPath(url.pathname, "/v1/print-layout");
      if (match) { json(response, 200, printLayout(...match, url)); return; }
      match = parseMonthPath(url.pathname, "/v1/topology");
      if (match) { allKeysAllowed(url, []); json(response, 200, topology(...match)); return; }
      const yearMatch = url.pathname.match(/^\/v1\/year\/([^/]+)$/);
      if (yearMatch) {
        allKeysAllowed(url, ["weekStart", "gridMode"]);
        const year = Number(yearMatch[1]);
        if (!/^\d{1,4}$/.test(yearMatch[1]!)) throw new InputError(400, "year must be an integer from 1 to 9999");
        try { if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError("year must be an integer from 1 to 9999"); } catch (error) { throw new InputError(400, (error as Error).message); }
        const { weekStart, gridMode } = monthOptions(url);
        json(response, 200, { year, isLeapYear: isLeapYear(year), months: MONTHS.map((_, index) => buildMonthSummary(year, index + 1, weekStart, gridMode)) }); return;
      }
      if (url.pathname === "/v1/range") {
        allKeysAllowed(url, ["from", "to", "weekStart", "gridMode"]);
        const start = parseYearMonth(url.searchParams.get("from"), "from"), end = parseYearMonth(url.searchParams.get("to"), "to");
        const startIndex = monthIndex(...start), endIndex = monthIndex(...end), length = endIndex - startIndex + 1;
        if (length < 1) throw new InputError(400, "to must be the same as or later than from");
        if (length > 120) throw new InputError(400, "range must not exceed 120 months");
        const { weekStart, gridMode } = monthOptions(url);
        json(response, 200, { from: url.searchParams.get("from"), to: url.searchParams.get("to"), count: length, weekStart, gridMode, months: Array.from({ length }, (_, i) => buildMonthSummary(...formatYearMonth(startIndex + i), weekStart, gridMode)) }); return;
      }
      if (url.pathname === "/v1/blank-grid") { json(response, 200, blankGrid(url)); return; }
      if (url.pathname === "/v1/compare") { json(response, 200, comparison(url)); return; }
      const referenceMatch = url.pathname.match(/^\/v1\/references\/([^/]+)$/);
      if (referenceMatch) {
        allKeysAllowed(url, []);
        const reference = getReference(referenceMatch[1]!);
        if (!reference) throw new InputError(404, "No printable reference exists for this name");
        json(response, 200, reference); return;
      }
      throw new InputError(404, "No endpoint exists at this path");
    } catch (error) {
      if (error instanceof InputError) { json(response, error.status, { error: { code: error.status === 404 ? "not_found" : "invalid_request", message: error.message } }); return; }
      if (error instanceof RangeError) { json(response, 400, { error: { code: "invalid_request", message: error.message } }); return; }
      json(response, 500, { error: { code: "internal_error", message: "The request could not be completed." } });
    }
  });
}
