import test from "node:test";
import assert from "node:assert/strict";
import { buildMonth, buildMonthSummary, daysInMonth, isLeapYear, topology, WEEKDAYS } from "../src/calendar.ts";

test("Gregorian leap-year century rules", () => {
  for (const [year, expected] of [[1900, false], [2000, true], [2024, true], [2027, false], [2100, false], [2400, true]] as const) assert.equal(isLeapYear(year), expected, String(year));
});
test("month lengths are correct at leap and common February", () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2027, 2), 28);
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => daysInMonth(2027, i + 1)), [31,28,31,30,31,30,31,31,30,31,30,31]);
});
test("each month has exactly its dated current-month cells", () => {
  for (let year = 1; year <= 9999; year += 37) for (let month = 1; month <= 12; month++) {
    const result = buildMonth(year, month, "monday", "natural");
    const current = result.weeks.flat().filter((cell) => cell.kind === "current");
    assert.equal(current.length, daysInMonth(year, month));
    assert.equal(new Set(current.map((cell) => cell.date)).size, current.length);
    assert.ok(result.rowCount >= 4 && result.rowCount <= 6);
  }
});
test("fixed grids always have 42 cells and natural grids fit the month", () => {
  for (const weekStart of WEEKDAYS) for (let month = 1; month <= 12; month++) {
    const fixed = buildMonth(2027, month, weekStart, "fixed-six-weeks");
    const natural = buildMonth(2027, month, weekStart, "natural");
    assert.equal(fixed.weeks.flat().length, 42);
    assert.equal(fixed.rowCount, 6);
    assert.equal(natural.weeks.flat().length, natural.rowCount * 7);
    assert.equal(natural.rowCount, Math.ceil((natural.leadingCellCount + natural.daysInMonth) / 7));
  }
});
test("known 2027 reference months have stable weekdays and URL", () => {
  const jan = buildMonth(2027, 1, "monday", "fixed-six-weeks");
  assert.equal(jan.monthName, "January");
  assert.equal(jan.daysInMonth, 31);
  assert.equal(jan.firstWeekday, "friday");
  assert.equal(jan.lastWeekday, "sunday");
  assert.equal(jan.reference.url, "https://www.betacalendars.com/january-calendar.html");
  assert.equal(buildMonth(2027, 2, "monday", "natural").daysInMonth, 28);
});
test("adjacent cells obey include and hide modes without changing calendar shape", () => {
  const included = buildMonth(2027, 1, "monday", "natural", "include");
  const hidden = buildMonth(2027, 1, "monday", "natural", "hide");
  assert.equal(included.weeks.flat().length, hidden.weeks.flat().length);
  assert.ok(included.weeks.flat().some((cell) => cell.kind === "adjacent"));
  assert.ok(hidden.weeks.flat().some((cell) => cell.kind === "hidden" && cell.date === null));
  const placeholders = buildMonth(2027, 1, "monday", "natural", "placeholder");
  assert.ok(placeholders.weeks.flat().some((cell) => cell.kind === "placeholder" && cell.date === null));
});
test("years at the supported edges do not emit out-of-range adjacent dates", () => {
  for (const [year, month] of [[1, 1], [9999, 12]] as const) {
    const result = buildMonth(year, month, "sunday", "natural", "include");
    assert.ok(result.weeks.flat().every((cell) => !cell.date || Number(cell.date.slice(0, 4)) >= 1 && Number(cell.date.slice(0, 4)) <= 9999));
  }
});
test("topology signature and start-day row counts are stable", () => {
  const value = topology(2027, 1);
  assert.equal(value.daysInMonth, 31);
  assert.equal(value.fixedRowCount, 6);
  assert.equal(value.naturalRowCounts.monday, buildMonthSummary(2027, 1, "monday", "natural").rowCount);
  assert.match(value.topologySignature, /^2027-01:31:/);
});
test("invalid civil dates are rejected", () => {
  assert.throws(() => daysInMonth(0, 1), /year/);
  assert.throws(() => daysInMonth(10000, 1), /year/);
  assert.throws(() => daysInMonth(2027, 0), /month/);
  assert.throws(() => daysInMonth(2027, 13), /month/);
});
