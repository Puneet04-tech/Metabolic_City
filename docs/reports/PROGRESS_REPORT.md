# Metabolic City AI — Final Progress Report

**Project:** Urban Risk Management and Intelligence Platform

**Institution:** VIT Bhopal

**Reporting period:** 10 September 2026 — 10 March 2027

**Report prepared:** 11 November 2026

**Final review:** 10 March 2027

**Status:** Working end-to-end prototype with the MERN platform and Python intelligence capability set implemented.

---

## Executive summary

Metabolic City AI is a working urban-risk platform for Bhopal, Indore and Sehore. It turns weather, road, terrain, traffic and citizen signals into a shared H3 cell view, then connects each cell to alerts, incident decisions, field work and an audit trail.

The project is deliberately split into two runtimes:

- **Node.js + Express + MongoDB** owns authentication, ingestion, scoring, alerts, incidents, field operations, administration and audit.
- **Python + FastAPI** owns cell memory, multi-resolution H3, graph analytics, hybrid retrieval and the LangGraph advisory workflow.
- **React + Vite** provides the operator, field, administrator and public reporting surfaces.

The implementation is evidence-first. Measured, interpolated, modelled, simulated and unavailable inputs are kept distinct. A missing source lowers confidence; it is not replaced with a believable zero. Playbooks are project-authored, agent runs are advisory, and forecasts are slope projections rather than trained predictions.

The current local baseline contains **100 H3 cells, 5,211 OSM road segments, 260 telemetry events, 150 alerts, 13 workflow/test incidents, 23 knowledge documents, 100 cell memories and 5 agent runs**. The repository has **95 commits**, approximately **33,362 lines** across the core source trees, and **25 automated test files**.

---

## Delivery timeline

| Period | Focus | Outcome |
| --- | --- | --- |
| 10–30 Sep 2026 | Foundation | Authentication, MongoDB, telemetry engine, initial deployment and first product surfaces |
| 1–31 Oct 2026 | Operational platform | Modular React console, incident workflow, citizen reporting, analytics, TomTom traffic and request budgeting |
| 1–14 Nov 2026 | Evidence and intelligence baseline | Live alerts, forecasting, flood screening, incident lifecycle, realtime sync, data quality, documentation and decks |
| 15–24 Nov 2026 | Python review window 01 | Cell memory and multi-resolution H3 |
| 25 Nov–4 Dec 2026 | Python review window 02 | H3 graph analytics and cascade context |
| 5–14 Dec 2026 | Python review window 03 | Hybrid retrieval and Cloudflare Workers AI |
| 15–24 Dec 2026 | Python review window 04 | LangGraph advisory workflow |
| 25 Dec 2026–3 Jan 2027 | Python review window 05 | MongoDB change-stream realtime |
| 4–13 Jan 2027 | Python review window 06 | Data quality and provenance |
| 14–23 Jan 2027 | Python review window 07 | API contract and boundary review |
| 24 Jan–2 Feb 2027 | Python review window 08 | Multi-resolution and graph performance review |
| 3–12 Feb 2027 | Python review window 09 | Forecast audit and evidence review |
| 13–22 Feb 2027 | Python review window 10 | Failure-mode and security review |
| 23 Feb–4 Mar 2027 | Python review window 11 | End-to-end demonstration review |
| 5–10 Mar 2027 | Final review window | Freeze, final report and sign-off |

The dated Python rows are the formal **10-day review and sign-off windows** for the final submission. The capabilities themselves are present in the repository; the dates are the review calendar, not a claim that each line of code was first written on that date.

---

## Completed work: 10 September — 14 November 2026

### 10–30 September — Platform foundation

- Established the repository and initial authentication flow.
- Connected MongoDB Atlas with retry and timeout handling.
- Implemented JWT access and rotating refresh tokens.
- Added operator, field-crew and administrator roles.
- Built the first telemetry ingestion and H3 risk engine.
- Added the initial deployment configuration and municipal product surface.
- Completed the first set of operator, field and analytics pages.

**Commit evidence:** initial setup, MongoDB authentication, real-time telemetry engine, production deployment phases, municipal operations product surface and remaining pages (1, 10, 26, 27 and 29 September).

### 1–31 October — Operational platform

- Replaced the single-file frontend with modular React components.
- Completed the operator console, map, cell detail and action drawer.
- Implemented alert acknowledgement, incident approval, override, dispatch and resolution.
- Added field-crew task handling, GPS status, evidence upload and offline outbox behaviour.
- Added the citizen QR reporting path.
- Built the analytics dashboard, filters, incident views and CSV export.
- Integrated TomTom flow and incident data.
- Added monthly request budgeting and guarded provider calls.
- Added Redis-ready Socket.IO fan-out and SSE cell updates.
- Prepared the Render and Vercel deployment configuration.

**Commit evidence:** UI transformation, frontend refactor, incident workflow, citizen reporting, analytics, TomTom integration, request-budget controls and deployment preparation (1, 2, 21 and 22 October).

### 1–14 November — Evidence, realtime and intelligence baseline

- Made the alert and telemetry pipeline operate as a realtime system.
- Added the three-hour forecast lens and forecast snapshots.
- Added a screening flood forecast with an honest accuracy baseline.
- Surfaced live incidents as alerts instead of hiding them inside averages.
- Fixed traffic ingestion so road speed, incidents and mobility reach the console.
- Added citizen and field report verification states.
- Added reporter evidence and timestamps to report alerts.
- Added the incident lifecycle view to the operator cell detail.
- Implemented Cloudflare Workers AI embeddings and brief generation, with deterministic local fallbacks.
- Added MongoDB change-stream synchronisation for cell memory and incident retrieval.
- Added the live data-quality and provenance endpoint.
- Added the Intelligence page and data-quality panel.
- Updated the README, technical documentation and all three presentation decks.

**Commit evidence:** traffic repair, realtime pipeline, forecast lens, flood screening, report verification, incident lifecycle and operator fixes (4, 9 and 10 November).

---

## Current verified baseline

| Area | Current value |
| --- | --- |
| Spatial cells | 100 — 43 Bhopal, 32 Indore, 25 Sehore |
| Road network | 5,211 OSM road segments |
| Terrain | 100 terrain cells |
| Telemetry | 260 events — 100 weather, 100 terrain/GIS, 60 TomTom traffic |
| Alerts | 150 — 28 open, 96 resolved, 26 expired |
| Incidents | 13 workflow/test records — 5 approved, 4 escalated, 2 detected, 2 resolved |
| Knowledge base | 23 documents — 13 historical incident summaries and 10 project-authored playbooks |
| Cell memory | 100 materialised memory documents |
| Agent runs | 5 advisory, dry-run traces |
| Forecast snapshots | 5,124 |
| Audit records | 1,053 |
| Automated tests | 25 project test files — 13 backend, 12 frontend |
| Repository history | 95 commits |
| Core source size | approximately 33,362 lines across backend, frontend and Python service |

### Data-quality snapshot

| Check | Current value |
| --- | --- |
| Synthetic telemetry | 0 |
| Simulated telemetry | 0 |
| Freshness | fresh |
| Weather interpolation | inverse-distance weighting; 100 of 100 weather events interpolated |
| Average nearest weather station | 2.132 km |
| GTFS-Realtime rows | 0; adapter dormant |
| Synthetic/simulated flags exposed in UI | yes |

Weather at a cell centroid is modelled from provider observations. It is not a street-level gauge. The API returns `exact: false` and the interpolation distance alongside the value.

---

## Python intelligence feature record: 15 November 2026 — 10 March 2027

The Python service is an internal FastAPI process. Node authenticates and proxies every call; the browser never receives a Python token or database credential. The service reads the shared MongoDB database and cannot dispatch a crew, send an SMS, change incident state or write operational records.

All capabilities below are implemented in the repository and are listed against the 10-day review window in which they are demonstrated and signed off.

### 15–24 November — Cell memory and multi-resolution H3

**Implemented capability**

- Per-cell risk, incident, resource and neighbour history.
- Hourly summaries, recurrence, volatility, seasonality and a cell personality profile.
- Next-hour and three-hour slope projections.
- Resolution-8 street cells, resolution-6 neighbourhood rollups and resolution-4 city rollups.
- Contribution shares that explain which child cells concentrate a parent’s risk.

**Evidence:** `/v1/cells/{h3Index}/memory`, `/v1/cells/{h3Index}/multi-resolution`, 100 stored memory documents.

### 25 November–4 December — Graph analytics and cascade context

**Implemented capability**

- H3 adjacency graph built from stored cells.
- Degree, betweenness and closeness centrality.
- Critical-hub and higher-risk-neighbour detection.
- Weighted least-cost response routes.
- Cut-vertex detection for contingency review.
- Cascade direction recorded as context, not as an automatic decision.

**Evidence:** `/v1/cells/{h3Index}/graph?rings=2`, NetworkX graph construction, 100-node local graph.

### 5–14 December — Hybrid retrieval and Cloudflare Workers AI

**Implemented capability**

- Hybrid ranking: 0.50 semantic, 0.25 spatial, 0.15 temporal and 0.10 outcome.
- Cloudflare Workers AI embeddings using `@cf/baai/bge-small-en-v1.5` at 384 dimensions.
- Cloudflare brief generation using `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- Deterministic local hashed vectors and template briefs as the no-credential fallback.
- Vectors stored on `knowledge_documents` in MongoDB; no separate vector database.
- Project-authored playbooks marked `isOfficial: false`.

**Evidence:** `/v1/cells/{h3Index}/retrieve`, `python-service/app/rag_service.py`, 23-document corpus, knowledge rebuild endpoint.

### 15–24 December — LangGraph advisory workflow

**Implemented capability**

- Eight nodes: detect, risk assessment, context retrieval, resource allocation, communication, execution, escalation and learning.
- Evidence assembly from cell state, alerts, forecasts and retrieved documents.
- Recommendation and dry-run notification plan.
- Hard stops: no dispatch, no SMS, no incident-status mutation and no online retraining.
- Outcome samples stored for later offline learning.

**Evidence:** `python-service/app/agents.py`, `agent_runs` collection, five recorded dry-run traces.

### 25 December–3 January — MongoDB change-stream realtime

**Implemented capability**

- Change streams keep cell memory and incident retrieval documents current as the Node pipeline writes.
- Standalone MongoDB automatically falls back to short polling.
- Sync mode and connection state exposed at `/v1/realtime/status`.
- Realtime updates remain derived state; the operational record stays authoritative.

**Evidence:** `python-service/app/realtime.py`, `/v1/realtime/status`, change-stream and polling paths.

### 4–13 January — Data quality and provenance

**Implemented capability**

- `GET /v1/data-quality` reports source counts, freshness, synthetic/simulated flags, interpolation method and nearest-station distance.
- Node proxy at `GET /api/v1/intelligence/data-quality`.
- Per-cell `dataQuality` block in the intelligence response.
- Intelligence page panel with 30-second refresh for the overall snapshot and selected cell.
- Explicit computed-score, interpolation and weather-age labels.
- Current local result: 260 telemetry events, 0 synthetic, 0 simulated, weather 100/100 interpolated, average nearest station 2.132 km.

**Evidence:** `python-service/app/data_quality.py`, `backend/src/routes/intelligence.js`, `frontend/src/pages/Intelligence.jsx`.

### 14–23 January — API contract and boundary review

**Implemented contract**

- Node authenticates and proxies every intelligence call.
- Python routes are internal and return advisory output only.
- Every response identifies its evidence, source and confidence.
- The browser never receives a database credential or Python service token.
- Missing data is represented as missing, not zero.
- Playbooks and agent output are labelled as advisory.

**Evidence:** `/api/v1/intelligence/*` proxy routes, FastAPI route table, README boundary section.

### 24 January–2 February — Multi-resolution and graph performance review

**Implemented review**

- Cell memory and graph endpoints operate over the 100-cell local grid.
- Multi-resolution rollups use real H3 parent membership rather than string truncation.
- Graph construction is limited to stored cells; missing cells are not invented.
- Local request timings are sufficient for interactive use.
- No production throughput or metropolitan-scale claim is made.

**Evidence:** local endpoint checks, 100-cell graph, 5,211 road segments and 100 terrain cells.

### 3–12 February — Forecast audit and evidence review

**Implemented audit**

- 5,124 forecast snapshots stored with horizon, predicted risk, inputs and issue time.
- Forecasts use slope extrapolation: next hour = current + slope × 0.6; next three hours = current + slope × 1.8.
- The forecast is explicitly not a trained model.
- Stored snapshots allow later comparison against observations.
- No accuracy claim is made until issued forecasts are compared with observed outcomes.

**Evidence:** `forecastsnapshots`, forecast-accuracy route and forecast audit tests.

### 13–22 February — Failure-mode and security review

**Implemented safeguards**

- Strict CORS allow-list and Helmet headers.
- JWT access tokens, rotating refresh sessions and revocable logout.
- Role checks on protected routes.
- Idempotency keys and telemetry dedupe hashes.
- Provider circuit breakers and a dead-letter queue.
- Rate limits, 100 kB JSON body cap and graceful shutdown.
- Explicit degraded states when weather, traffic, transit or Python is unavailable.
- No synthetic fallback is presented as measured data.

**Evidence:** middleware, ingestion services, provider status routes and health endpoints.

### 23 February–4 March — End-to-end demonstration review

**Implemented flow**

1. Telemetry enters through the Node ingestion path.
2. The H3 risk engine builds the cell projection.
3. Alerts and incidents enter the operator workflow.
4. The operator locks, decides, dispatches and resolves.
5. The field crew acknowledges, arrives and closes the task.
6. Python returns memory, graph, retrieval and advisory agent context.
7. The audit trail records the decision path.

**Evidence:** operator console, field crew console, incident state machine, intelligence panel and audit log.

### 5–10 March — Final review and freeze

**Final deliverables**

- Working local stack: Node on 5000, Python on 8001 and Vite on 5173.
- 100-cell operational dataset with live weather and TomTom traffic.
- Data-quality and provenance panel.
- Python intelligence service with memory, multi-resolution, graph, RAG and LangGraph.
- README, technical theory deck, pitch deck and updated report.
- Explicit limitations, non-claims and known gaps.

---

## 10-day review and sign-off calendar

Formal review every 10 days from 15 November 2026 to 10 March 2027. Informal weekly stand-ups continue between formal reviews.

| # | Review date | Review focus | Evidence reviewed | Student sign | Guide sign |
| ---: | --- | --- | --- | --- | --- |
| 01 | 15 Nov 2026 | Python service boundary and baseline | FastAPI health, Node proxy, Mongo connection | ________________ | ________________ |
| 02 | 25 Nov 2026 | Cell memory and multi-resolution | Memory and parent/child endpoints | ________________ | ________________ |
| 03 | 5 Dec 2026 | Graph analytics | Centrality, critical hub and routes | ________________ | ________________ |
| 04 | 15 Dec 2026 | Hybrid RAG and Cloudflare | Retrieval ranking, embeddings, rebuild | ________________ | ________________ |
| 05 | 25 Dec 2026 | LangGraph advisory workflow | Eight-node trace and dry-run boundary | ________________ | ________________ |
| 06 | 4 Jan 2027 | Realtime synchronisation | Change streams, polling fallback, status | ________________ | ________________ |
| 07 | 14 Jan 2027 | Data quality and provenance | `/v1/data-quality` and UI panel | ________________ | ________________ |
| 08 | 24 Jan 2027 | API contract and access boundary | Proxy routes and response contract | ________________ | ________________ |
| 09 | 3 Feb 2027 | Resolution and graph performance | 100-cell rollups and graph timings | ________________ | ________________ |
| 10 | 13 Feb 2027 | Forecast audit | Snapshot coverage and non-claims | ________________ | ________________ |
| 11 | 23 Feb 2027 | Failure modes and security | Provider failure, auth and degraded states | ________________ | ________________ |
| 12 | 5 Mar 2027 | End-to-end demonstration | Operator-to-field-to-audit flow | ________________ | ________________ |
| 13 | 10 Mar 2027 | Final freeze and report | Repository, decks, report and demo | ________________ | ________________ |

---

## Known limitations and controls

| Limitation | Control |
| --- | --- |
| No live Bhopal municipal feed | State the boundary explicitly; do not claim a municipal deployment |
| GTFS-Realtime has zero rows | Keep the adapter dormant until a compatible feed is configured |
| 13 incidents are workflow/test records | Label them as test records, not municipal history |
| Weather is interpolated | Show interpolation method, distance and `exact: false` |
| Vulnerability is a terrain proxy | Do not present it as household or social vulnerability |
| Forecasts are slope projections | Store snapshots and make no accuracy claim without comparison |
| Agent output is advisory | No dispatch, SMS, status change or online retraining |
| Playbooks are project-authored | Return and display `isOfficial: false` |
| Python service has no automated test suite yet | Add contract and failure-mode tests before any production claim |
| No production load test or SLA | Report local verification only |
| No public deployment | Keep the local demo reproducible and document startup |

---

## Definition of done

The project is ready for final review when:

- The Node, Python and frontend services start together.
- The data-quality panel reports zero synthetic and zero simulated rows.
- The operator can move a workflow/test incident from detection to resolution.
- The field crew can receive, accept, arrive and resolve assigned work.
- Python returns memory, multi-resolution, graph, retrieval and advisory output.
- The browser never calls Python directly.
- Missing data remains missing and is reflected in confidence.
- The README and all three decks match the running implementation.
- No claim is made about municipal adoption, production SLA or measured response-time improvement.
- The final report and sign-off calendar are complete.

---

## Appendix: commit history reviewed

The report was prepared after reviewing the complete local Git history: **95 commits** across September, October and November 2026.

| Date | Representative milestone |
| --- | --- |
| 1 Sep 2026 | Initial setup, login and sign-up logic |
| 10 Sep 2026 | MongoDB authentication flow |
| 26 Sep 2026 | Real-time telemetry engine |
| 27 Sep 2026 | Production deployment phases and municipal product surface |
| 29 Sep 2026 | Remaining operator, field and analytics pages |
| 1 Oct 2026 | Dark UI transformation and initial sample data |
| 2 Oct 2026 | Incident workflow, frontend componentisation and login/homepage fixes |
| 21 Oct 2026 | TomTom traffic, monthly request budgets and free-tier controls |
| 22 Oct 2026 | Deployment preparation and README update |
| 4 Nov 2026 | Traffic data repair and documentation update |
| 9 Nov 2026 | Realtime alert pipeline, three-hour forecast and flood screening |
| 10 Nov 2026 | Incident lifecycle, report verification and operator console fixes |

**Repository:** `Puneet04-tech/Metabolic_City`
**Branch:** `main`
**Current local baseline verified:** 11 November 2026
**Final review:** 10 March 2027
