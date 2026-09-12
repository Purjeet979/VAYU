# QA Report

## Overall Status

READY WITH WARNINGS

Production build, backend tests, linting, API probes, route probes, and runtime smoke checks passed after fixes. Remaining warnings are listed below because a full headless browser interaction suite was not available in the installed dependencies.

## Bugs Found

| ID | Component | Severity | Problem | Root Cause | Fix | Status |
| -- | --------- | -------- | ------- | ---------- | --- | ------ |
| BUG-001 | Frontend build | HIGH | `npm run build` failed in restricted/offline environments. | `next/font/google` tried to fetch Inter from Google Fonts during build. | Switched to bundled local Geist font via `next/font/local`. | Fixed |
| BUG-002 | Forecast API | HIGH | `/api/forecast` and `/api/forecast/grid` returned HTTP 500 in live mode. | Forecast and live weather NetCDF files had matching shapes but different coordinate labels; xarray outer merge produced NaN values that JSON serialization rejected. | Aligned weather coordinates positionally to the forecast grid and used `join="exact"`. | Fixed |
| BUG-003 | Station components/API | MEDIUM | Station ranking and heatmap called `/api/cpcb`, but the backend did not expose the endpoint. | Existing CPCB CSV artifacts were not surfaced through FastAPI. | Added file-backed `/api/cpcb` endpoint using live, cache, then bundled CPCB CSV fallback. | Fixed |
| BUG-004 | Dashboard metrics | MEDIUM | KPI cards and correlation matrix rendered incorrect zero-biased values. | Frontend used old field names such as `pm25`, `temperature`, and `wind_speed` against the current API schema. | Updated components to use `pm25_ug_m3`, `pm10_ug_m3`, `temperature_c`, and `wind_speed_mps`. | Fixed |
| BUG-005 | Deployment config | MEDIUM | Frontend API URL was hardcoded to `http://localhost:8000`. | Components duplicated localhost API constants. | Added shared `fetchJson` helper and `NEXT_PUBLIC_API_BASE_URL` documentation. | Fixed |
| BUG-006 | Navigation | LOW | `/about` navigation existed but the route was missing; footer links pointed to `#`. | App route was not implemented. | Added `/about` page and corrected footer links. | Fixed |
| BUG-007 | Responsive layout | LOW | Navigation and footer could crowd on small screens. | Header/footer used single-row flex layouts. | Added wrapping and mobile column layout. | Fixed |
| BUG-008 | Station table | LOW | Missing PM2.5 values could render as a runtime error. | `row.pm25.toFixed(1)` assumed every row had a number. | Added numeric guard and fallback display. | Fixed |
| BUG-009 | Live map | HIGH | Map showed no fire markers and looked blank in live mode. | Sparse live FIRMS data did not meet DBSCAN `min_samples=3`, so `/api/sources` returned `sources: []`; map also depended on external tile visibility for context. | Added singleton fire-marker fallback for sparse live data, local fallback basemap, visible layer stats, and HTML fallback markers/heat overlay. | Fixed |

## Component Test Matrix

| Component | Tested | Working | Issues | Status |
| --------- | ------ | ------- | ------ | ------ |
| Landing page | Yes | Yes | Browser interaction not automated; route and API smoke passed. | Pass |
| NavBar | Yes | Yes | Handles backend health failure as `unknown`. | Pass |
| Dashboard page | Yes | Yes | Route smoke passed; chart data schema fixed. | Pass |
| KPI cards | Yes | Yes | Field-name mismatch fixed. | Pass |
| Forecast trajectory chart | Yes | Yes | Data endpoint now returns JSON-safe values. | Pass |
| Source attribution panel | Yes | Yes | API smoke passed. | Pass |
| Inversion panel | Yes | Yes | API smoke passed. | Pass |
| Explanation panel | Yes | Yes | API smoke passed. | Pass |
| Station heatmap | Yes | Yes | Uses new `/api/cpcb`; shows fallback on data failure. | Pass |
| Station ranking table | Yes | Yes | Uses new `/api/cpcb`; null PM2.5 guard added. | Pass |
| Live map page | Yes | Yes | Sparse live source fallback added; map tile/Nominatim live browser behavior not automated. | Pass with warning |
| Location search | Partial | Unknown | Requires browser/geolocation and external Nominatim availability. | Warning |
| About page | Yes | Yes | New route added and route smoke passed. | Pass |

## API Test Matrix

| API | Tested | Success | Error Handling | Status |
| --- | ------ | ------- | -------------- | ------ |
| `GET /api/health` | Yes | 200 | Reports service failure as 503 in code path. | Pass |
| `GET /api/forecast?hours=2` | Yes | 200 | Query validation covers invalid range. | Pass |
| `GET /api/forecast/grid?hour=24&variable=pm25` | Yes | 200 | Invalid variable returns 422. | Pass |
| `GET /api/cpcb` | Yes | 200 | Missing/malformed file returns empty list or 503. | Pass |
| `GET /api/sources?hour=24` | Yes | 200 | Invalid hour handled by ValueError to 422. | Pass |
| `GET /api/inversion?hour=24` | Yes | 200 | Invalid hour handled by ValueError to 422. | Pass |
| `GET /api/explanation?hour=24` | Yes | 200 | Depends on forecast/sources/inversion health. | Pass |
| `POST /api/scenario` | Yes | 200 | Invalid stubble reduction returns 422. | Pass |

## Security Findings

- No database was added or configured.
- `.env` is ignored by git, and `.env.example` documents required variables without real secrets.
- Frontend API URL is configurable through `NEXT_PUBLIC_API_BASE_URL`.
- CORS currently allows all origins. This is acceptable for a demo prototype but should be restricted to deployed frontend domains for production public hosting.
- No `dangerouslySetInnerHTML` usage was found in the app code.

## Deployment Findings

- `npm run build` passes.
- `npm run lint` passes.
- `python -m pytest` passes from the repository root after adding `pytest.ini`.
- Production route probes passed for `/`, `/dashboard`, `/map`, and `/about`.
- API runtime probes passed on alternate port `8010`.
- Default ports `3000` and `8000` were already occupied in the local environment, so runtime verification used `3010` and `8010`.
- Runtime log files are now ignored with `*runtime*.log`.

## Remaining Issues

- Full browser automation was not possible because Playwright or an equivalent browser testing dependency is not installed.
- External browser-only behaviors were not fully automated: Leaflet tile loading, Nominatim search, geolocation permission flow, and browser back/forward navigation.
- Existing environment has a NumPy binary compatibility warning during tests; tests pass, but dependency versions should be pinned/verified before long-term deployment.
- CORS should be narrowed before public production deployment.

## Final Deployment Checklist

- [x] Application starts successfully
- [x] Production build succeeds
- [x] No critical runtime errors
- [x] No broken routes found in route probes
- [x] Major buttons/links covered by route and component review
- [x] Major forms/API inputs covered by API probes
- [x] APIs work
- [x] External services fail gracefully where code paths were inspected
- [x] Loading states present
- [x] Error states present
- [x] Empty states present
- [x] Authentication not present
- [x] No secrets exposed in committed config
- [x] Environment variables documented
- [x] No production-breaking hardcoded frontend localhost dependency
- [x] Responsive layout issues fixed for nav/footer
- [x] Major user flows smoke tested
- [x] Regression testing completed
- [x] Deployment configuration verified
- [x] `QA_REPORT.md` created
