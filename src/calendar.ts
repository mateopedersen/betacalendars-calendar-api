export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type GridMode = "natural" | "fixed-six-weeks";
export type AdjacentDays = "include" | "hide" | "placeholder";
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const MONTH_SLUGS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;
const REFERENCE_URLS = [
  "https://www.betacalendars.com/january-calendar.html", "https://www.betacalendars.com/february-calendar.html",
  "https://www.betacalendars.com/march-calendar.html", "https://www.betacalendars.com/april-calendar.html",
  "https://www.betacalendars.com/may-calendar.html", "https://www.betacalendars.com/june-calendar.html",
  "https://www.betacalendars.com/july-calendar.html", "https://www.betacalendars.com/august-calendar.html",
  "https://www.betacalendars.com/september-calendar.html", "https://www.betacalendars.com/october-calendar.html",
  "https://www.betacalendars.com/november-calendar.html", "https://www.betacalendars.com/december-calendar.html",
] as const;
export const BLANK_REFERENCE = { title: "Blank Calendar", url: "https://www.betacalendars.com/blank-calendar" } as const;

export interface CalendarDay {
  date: string | null;
  day: number | null;
  kind: "current" | "adjacent" | "hidden" | "placeholder";
  monthOffset: -1 | 0 | 1;
}
export interface CalendarMonth {
  year: number; month: number; monthName: string; daysInMonth: number;
  firstWeekday: Weekday; lastWeekday: Weekday; weekStart: Weekday; gridMode: GridMode;
  rowCount: number; leadingCellCount: number; trailingCellCount: number;
  weeks: CalendarDay[][]; reference: { title: string; url: string };
}
export function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new RangeError("year must be an integer from 1 to 9999");
}
export function assertMonth(year: number, month: number): void {
  assertYear(year);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError("month must be an integer from 1 to 12");
}
export function isLeapYear(year: number): boolean {
  assertYear(year);
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
export function daysInMonth(year: number, month: number): number {
  assertMonth(year, month);
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
export function weekdayIndex(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCDay();
}
const weekday = (index: number): Weekday => WEEKDAYS[index] as Weekday;
const dateString = (year: number, month: number, day: number): string => `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
function shiftedMonthDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
export function buildMonth(year: number, month: number, weekStart: Weekday, gridMode: GridMode, adjacentDays: AdjacentDays = "include"): CalendarMonth {
  assertMonth(year, month);
  if (!WEEKDAYS.includes(weekStart)) throw new RangeError("weekStart must be a weekday from sunday through saturday");
  if (gridMode !== "natural" && gridMode !== "fixed-six-weeks") throw new RangeError("gridMode must be natural or fixed-six-weeks");
  if (!["include", "hide", "placeholder"].includes(adjacentDays)) throw new RangeError("adjacentDays must be include, hide, or placeholder");
  const count = daysInMonth(year, month);
  const firstIndex = weekdayIndex(year, month, 1);
  const lastIndex = weekdayIndex(year, month, count);
  const leading = (firstIndex - WEEKDAYS.indexOf(weekStart) + 7) % 7;
  const rowCount = gridMode === "fixed-six-weeks" ? 6 : Math.ceil((leading + count) / 7);
  const flat: CalendarDay[] = [];
  for (let i = 0; i < rowCount * 7; i++) {
    const logicalDay = i - leading + 1;
    if (logicalDay >= 1 && logicalDay <= count) {
      flat.push({ date: dateString(year, month, logicalDay), day: logicalDay, kind: "current", monthOffset: 0 });
    } else {
      const offset: -1 | 1 = logicalDay < 1 ? -1 : 1;
      const adjacent = shiftedMonthDay(year, month, logicalDay);
      const visible = adjacentDays === "include" && adjacent.year >= 1 && adjacent.year <= 9999;
      const kind = visible ? "adjacent" : adjacentDays === "hide" ? "hidden" : "placeholder";
      flat.push({ date: visible ? dateString(adjacent.year, adjacent.month, adjacent.day) : null,
        day: visible ? adjacent.day : null, kind, monthOffset: offset });
    }
  }
  return {
    year, month, monthName: MONTHS[month - 1]!, daysInMonth: count,
    firstWeekday: weekday(firstIndex), lastWeekday: weekday(lastIndex), weekStart, gridMode,
    rowCount, leadingCellCount: leading, trailingCellCount: rowCount * 7 - leading - count,
    weeks: Array.from({ length: rowCount }, (_, row) => flat.slice(row * 7, row * 7 + 7)),
    reference: { title: `${MONTHS[month - 1]} Calendar`, url: REFERENCE_URLS[month - 1]! },
  };
}
export function buildMonthSummary(year: number, month: number, weekStart: Weekday, gridMode: GridMode) {
  const { daysInMonth: count, firstWeekday, lastWeekday, rowCount, leadingCellCount, trailingCellCount, monthName, reference } = buildMonth(year, month, weekStart, gridMode, "hide");
  return { year, month, monthName, daysInMonth: count, firstWeekday, lastWeekday, weekStart, gridMode, rowCount, leadingCellCount, trailingCellCount, reference };
}
export function getReference(slug: string) {
  const index = MONTH_SLUGS.indexOf(slug.toLowerCase() as (typeof MONTH_SLUGS)[number]);
  if (slug.toLowerCase() === "blank-calendar") return BLANK_REFERENCE;
  if (index < 0) return null;
  return { title: `${MONTHS[index]} Calendar`, url: REFERENCE_URLS[index]! };
}
export function topology(year: number, month: number) {
  assertMonth(year, month);
  const rowCounts = Object.fromEntries(WEEKDAYS.map((weekStart) => [weekStart, buildMonthSummary(year, month, weekStart, "natural").rowCount])) as Record<Weekday, number>;
  const leadByStart = Object.fromEntries(WEEKDAYS.map((weekStart) => [weekStart, (weekdayIndex(year, month, 1) - WEEKDAYS.indexOf(weekStart) + 7) % 7])) as Record<Weekday, number>;
  const days = daysInMonth(year, month);
  const signature = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}:${days}:${weekdayIndex(year, month, 1)}:${Object.values(rowCounts).join(",")}`;
  return { year, month, monthName: MONTHS[month - 1], daysInMonth: days, firstWeekday: weekday(weekdayIndex(year, month, 1)), lastWeekday: weekday(weekdayIndex(year, month, days)), naturalRowCounts: rowCounts, fixedRowCount: 6, leadingCellsByWeekStart: leadByStart, topologySignature: signature };
}
