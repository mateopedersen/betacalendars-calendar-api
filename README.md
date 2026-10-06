# BetaCalendars Printable Calendar Geometry API

A deterministic, read-only TypeScript API for Gregorian month grids, print geometry, undated planner grids, month ranges, and calendar topology.

- Project: https://www.betacalendars.com/
- Intended production base URL: `https://api.betacalendars.com`
- Authentication: none
- Personal data: none requested or stored
- Runtime: Node.js 22 or newer; no runtime dependencies
- Status: source and deployment configuration are prepared; production DNS and external hosting are not yet connected

## Quick start

```sh
npm install
npm test
npm run typecheck
npm start
```

Then request `http://localhost:8787/v1/month/2027/1?weekStart=monday&gridMode=fixed-six-weeks`.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Minimal health response |
| `GET /v1/month/{year}/{month}` | Dated 7-column Gregorian grid |
| `GET /v1/year/{year}` | Compact summary of all twelve months |
| `GET /v1/range?from=YYYY-MM&to=YYYY-MM` | Inclusive chronological summaries; at most 120 months |
| `GET /v1/print-layout/{year}/{month}` | Physical paper and cell measurements in mm |
| `GET /v1/blank-grid` | Undated row/column grid and paper geometry |
| `GET /v1/topology/{year}/{month}` | Week-start row counts and a structural signature |
| `GET /v1/compare?months=YYYY-MM,YYYY-MM` | Compare two to twelve months in chronological order |
| `GET /v1/references/{slug}` | Resolve one first-party month or blank-calendar reference |

`weekStart` accepts the seven weekday names. `gridMode` is `natural` or `fixed-six-weeks`. Month grids accept `adjacentDays=include|hide|placeholder`. Year range is 1–9999. Invalid input returns a JSON `error` object and a 4xx status. All dates are civil Gregorian dates and use UTC-only arithmetic, so host timezone and daylight-saving transitions do not affect results.

## Print geometry

`paper` supports `a4`, `letter`, `a5`, and `legal`; `orientation` supports `portrait` and `landscape`. `margin`, `headerHeight`, `weekdayHeaderHeight`, and `notesHeight` are millimetres. The service calculates printable bounds, grid and cell dimensions, and returns usability warnings when cells become short. Blank grids contain only row and column coordinates; they never fabricate dates.

## Postman

The repository includes generated collection files under [`postman/`](postman/). They use `{{baseUrl}}` and contain runnable production endpoint requests with test scripts. Set `baseUrl` to `https://api.betacalendars.com` after the domain is deployed. Until deployment, use `http://localhost:8787` only for local development and do not publish local example outputs as production responses.

## Reliability and limits

Requests are stateless and read-only. CORS permits `GET` and `OPTIONS`; other methods return 405. The application does not log request contents, fetch arbitrary URLs, use a database, or collect telemetry. Apply edge-level rate limits when deploying to a multi-instance host. A suggested public allowance is 120 requests/minute per source IP, enforced by the hosting edge rather than a process-local counter.

## Deployment

See [`deployment/README.md`](deployment/README.md). Production publishing requires a Beta Calendars-controlled host, the `api.betacalendars.com` DNS record, and successful external HTTPS checks. OpenAPI is [`openapi.yaml`](openapi.yaml).

## License

MIT. See [`LICENSE`](LICENSE).
