import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../src/app.ts";
import type { Server } from "node:http";

let server: Server;
let base: string;
before(async () => {
  server = createApiServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind a TCP port");
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
async function get(path: string) {
  const response = await fetch(base + path);
  return { response, body: await response.json() as Record<string, any> };
}
test("health is small and exposes no deployment information", async () => {
  const { response, body } = await get("/health");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(body, { status: "ok", service: "betacalendars-calendar-api" });
});
test("month endpoint returns computed January 2027 shape", async () => {
  const { response, body } = await get("/v1/month/2027/1?weekStart=monday&gridMode=fixed-six-weeks&adjacentDays=include");
  assert.equal(response.status, 200);
  assert.equal(body.monthName, "January");
  assert.equal(body.daysInMonth, 31);
  assert.equal(body.rowCount, 6);
  assert.equal(body.weeks.length, 6);
  assert.equal(body.weeks.flat().filter((cell: any) => cell.kind === "current").length, 31);
});
test("year endpoint summarizes twelve months", async () => {
  const { response, body } = await get("/v1/year/2024?weekStart=sunday&gridMode=natural");
  assert.equal(response.status, 200);
  assert.equal(body.isLeapYear, true);
  assert.equal(body.months.length, 12);
  assert.equal(body.months[1].daysInMonth, 29);
});
test("range includes both endpoints, is chronological, and is capped", async () => {
  const good = await get("/v1/range?from=2026-11&to=2027-02&weekStart=monday");
  assert.equal(good.response.status, 200);
  assert.equal(good.body.count, 4);
  assert.deepEqual(good.body.months.map((m: any) => `${m.year}-${String(m.month).padStart(2, "0")}`), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  const tooLong = await get("/v1/range?from=2000-01&to=2010-01");
  assert.equal(tooLong.response.status, 400);
  assert.equal(tooLong.body.error.code, "invalid_request");
});
test("print geometry uses physical dimensions and balances the page", async () => {
  const { response, body } = await get("/v1/print-layout/2027/1?paper=a4&orientation=portrait&weekStart=monday&gridMode=fixed-six-weeks&margin=10&headerHeight=20&weekdayHeaderHeight=10&notesHeight=0");
  assert.equal(response.status, 200);
  assert.equal(body.paper.widthMm, 210);
  assert.equal(body.paper.heightMm, 297);
  assert.equal(body.grid.columns, 7);
  assert.equal(body.grid.rows, 6);
  assert.ok(Math.abs(body.grid.heightMm + 20 + 10 + 0 - 277) < 0.001);
  assert.ok(Math.abs(body.cell.areaMm2 - body.cell.widthMm * body.cell.heightMm) < 0.001);
});
test("blank grid has no dates and supports dimensions", async () => {
  const { response, body } = await get("/v1/blank-grid?rows=6&columns=7&paper=a4&orientation=portrait");
  assert.equal(response.status, 200);
  assert.equal(body.cells.length, 6);
  assert.equal(body.cells.flat().length, 42);
  assert.equal(JSON.stringify(body).includes("date"), false);
  assert.equal(body.humanReadableReference.url, "https://www.betacalendars.com/blank-calendar");
});
test("topology, comparison, and canonical reference are useful", async () => {
  const topology = await get("/v1/topology/2027/1");
  const compare = await get("/v1/compare?months=2026-11,2026-12,2027-01,2027-02&weekStart=monday");
  const reference = await get("/v1/references/january");
  assert.equal(topology.response.status, 200);
  assert.equal(topology.body.naturalRowCounts.monday, 5);
  assert.equal(compare.body.months.length, 4);
  assert.equal(reference.body.url, "https://www.betacalendars.com/january-calendar.html");
});
test("invalid values produce structured JSON 4xx responses", async () => {
  const paths = ["/v1/month/2027/0", "/v1/month/2027/13", "/v1/month/10000/1", "/v1/month/2027/1?weekStart=funday", "/v1/print-layout/2027/1?paper=tabloid", "/v1/print-layout/2027/1?margin=-1", "/v1/range?from=2027-03&to=2027-02", "/v1/blank-grid?rows=0", "/v1/compare?months=2027-01"];
  for (const path of paths) {
    const { response, body } = await get(path);
    assert.ok(response.status >= 400 && response.status < 500, `${path}: ${response.status}`);
    assert.equal(typeof body.error.message, "string");
    assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
  }
});
test("only GET and OPTIONS are exposed and CORS stays narrow", async () => {
  const post = await fetch(base + "/v1/month/2027/1", { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, OPTIONS");
  assert.equal(post.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  const options = await fetch(base + "/v1/month/2027/1", { method: "OPTIONS" });
  assert.equal(options.status, 204);
});
test("timezone does not affect deterministic civil calendar output", async () => {
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const node = process.execPath;
  const modulePath = fileURLToPath(new URL("../src/calendar.ts", import.meta.url));
  const script = `import {buildMonth} from ${JSON.stringify(`file://${modulePath}`)}; process.stdout.write(JSON.stringify(buildMonth(2027,1,'monday','fixed-six-weeks')))`;
  const outputs = ["UTC", "Europe/Istanbul", "America/New_York", "Asia/Tokyo"].map((TZ) => {
    const result = spawnSync(node, ["--experimental-strip-types", "--input-type=module", "-e", script], { encoding: "utf8", env: { ...process.env, TZ } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  });
  assert.equal(new Set(outputs).size, 1);
});
