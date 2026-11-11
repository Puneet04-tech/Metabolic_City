# H3 Spatiotemporal Intelligence Service

FastAPI microservice for the advanced intelligence layer. The Node backend owns
authentication and proxies these routes under `/api/v1/intelligence`; the
browser never calls this process directly.

## What it implements

- **H3 cell memory**: risk history, incident history, resource history, neighbour
  correlations, recurrence, volatility, seasonality and a cell personality profile.
- **Multi-resolution H3**: the same cell aggregated at street (res 8),
  neighbourhood (res 6) and city (res 4) by real parent membership.
- **H3 graph analytics**: adjacency graph, degree/betweenness/closeness
  centrality, critical hub, cascade direction, higher-risk neighbours and a
  weighted response route.
- **Hybrid RAG**: spatial + semantic + temporal retrieval over historical
  incidents and a municipal playbook knowledge base. Cloudflare Workers AI
  embeddings and brief generation are the hosted path; deterministic local
  hashed vectors remain the no-account fallback.
- **Live data quality**: `GET /v1/data-quality` (and the Node proxy
  `/api/v1/intelligence/data-quality`) reports source counts, freshness,
  synthetic/simulated flags, weather interpolation method and nearest-station
  distance. The cell intelligence response carries the same `dataQuality` block.
- **Realtime derived state**: MongoDB change streams keep cell memory and
  incident retrieval documents current as the Node pipeline writes. Standalone
  MongoDB automatically falls back to short polling, and the sync mode is
  exposed at `/v1/realtime/status`.
- **LangGraph multi-agent workflow**: detection, risk assessment, context
  retrieval, resource allocation, communication, execution, escalation and
  learning nodes. Runs are advisory only and recorded in `agent_runs`.

The playbook documents are templates authored for this project, not official
municipal SOPs. Every retrieval response carries `isOfficial: false`.

## Run

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

On macOS/Linux use `.venv/bin/python`. `MONGO_URI` is required: the service
loads `backend/.env` when available, and a service-local `python-service/.env`
takes precedence. There is no localhost fallback. In production, set
`INTELLIGENCE_ENV=production`; a localhost URI is rejected. OpenAPI docs are at
`http://127.0.0.1:8001/docs`.

## Cloudflare Workers AI

The service calls the Workers AI REST API directly; no OpenAI key is needed.
Set both values in `python-service/.env` (or `backend/.env`):

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-workers-ai-token
INTELLIGENCE_EMBEDDING_PROVIDER=cloudflare
INTELLIGENCE_BRIEF_PROVIDER=cloudflare
```

- Account ID: https://dash.cloudflare.com/?to=/:account/ai/workers-ai (the
  account ID is also in the dashboard URL or account settings).
- API token: https://dash.cloudflare.com/profile/api-tokens with **Workers AI
  Read** and **Workers AI Edit** permissions for the account.
- Embeddings default to `@cf/baai/bge-small-en-v1.5`, which returns 384
  dimensions and therefore matches the existing knowledge vectors. A model
  with different dimensions requires rebuilding the collection.
- Briefs default to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Override with
  `CLOUDFLARE_CHAT_MODEL`.
- After changing the embedding provider, rebuild once:
  `curl -X POST http://127.0.0.1:8001/v1/knowledge/rebuild`.
- If a Workers AI call fails, the request degrades to the local hashed vector
  or the deterministic brief and logs a warning; `/health` reports the provider
  it can actually use.

## Main routes

- `GET /health`
- `GET /v1/realtime/status`
- `GET /v1/overview`
- `GET /v1/data-quality?h3Index=&cityCode=`
- `GET /v1/cells/{h3Index}/intelligence`
- `GET /v1/cells/{h3Index}/memory`
- `GET /v1/cells/{h3Index}/multi-resolution`
- `GET /v1/cells/{h3Index}/graph?rings=2`
- `GET /v1/cells/{h3Index}/retrieve?q=flood`
- `POST /v1/cells/{h3Index}/agents`
- `POST /v1/incidents/{incidentId}/agents`
- `POST /v1/knowledge/rebuild`

## Honest boundaries

- The RAG default without credentials is lexical hashed vectors, not a
  transformer. Set `INTELLIGENCE_EMBEDDING_PROVIDER=cloudflare` with a valid
  account ID and token to use hosted Workers AI embeddings.
- The agent workflow reads live MongoDB state and produces recommendations. It
  does not dispatch crews, send SMS, or change incident status; `dryRun: true`
  means advisory execution, not a simulated data source.
- Change streams require a replica set or sharded cluster. A standalone mongod
  uses the polling fallback, so the service still works but with a short delay.
- The learning node stores outcome samples in cell memory. Prediction-model
  retraining is explicitly deferred to an offline batch job.
- The graph is built from stored res-8 cells; missing cells are not invented.