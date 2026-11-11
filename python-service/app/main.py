from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .agents import latest_runs, run_workflow
from .config import settings
from .data_quality import telemetry_quality
from .db import db, json_safe, ping, server_role
from .h3_service import all_cell_documents, cell_document, critical_hubs, graph_analysis, multi_resolution
from .memory_service import build_memory
from .rag_service import rebuild_knowledge, retrieve
from .realtime import realtime_status, start_realtime, stop_realtime


app = FastAPI(
    title="Metabolic City H3 Spatiotemporal Intelligence",
    version=settings.version,
    description=(
        "H3 cell memory, multi-resolution aggregation, graph analytics, hybrid RAG and a "
        "LangGraph incident-resolution workflow. Internal service; the Node API is the "
        "authenticated public gateway."
    ),
)

# The Node gateway is the intended caller. Permissive CORS keeps local
# FastAPI docs usable without exposing a browser-facing route.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    try:
        # spatialcells is owned by the Node backend and already has its own
        # unique h3Index index. Do not recreate it with a conflicting spec.
        db().cell_memories.create_index("h3Index", unique=True)
        db().knowledge_documents.create_index("docId", unique=True)
        db().knowledge_documents.create_index([("sourceType", 1), ("h3Index", 1)])
        db().agent_runs.create_index([("h3Index", 1), ("createdAt", -1)])
        if settings.knowledge_rebuild_on_start or db().knowledge_documents.count_documents({}) == 0:
            rebuild_knowledge()
    except Exception as error:
        # The health endpoint reports the degraded state; startup must not
        # crash so the process can recover when MongoDB becomes reachable.
        print(f"[startup] Intelligence indexes/knowledge warm-up skipped: {error}")
    try:
        start_realtime()
    except Exception as error:
        print(f"[startup] Realtime sync not started: {error}")


@app.on_event("shutdown")
def shutdown() -> None:
    stop_realtime()


@app.get("/health")
def health() -> dict[str, Any]:
    database_ready = ping()
    return {
        "status": "healthy" if database_ready else "degraded",
        "service": settings.service_name,
        "version": settings.version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": settings.db_name if database_ready else "unavailable",
        "databaseHost": settings.mongo_host,
        "databaseMode": settings.mongo_mode,
        "databaseRole": server_role() if database_ready else "unavailable",
        "realtime": realtime_status(),
        "features": {
            "cellMemory": True,
            "multiResolution": True,
            "graphAnalytics": True,
            "hybridRag": True,
            "langGraphAgents": True,
        },
        "providers": {
            "embedding": settings.embedding_provider_name,
            "embeddingModel": (
                settings.cloudflare_embedding_model
                if settings.embedding_provider_name == "cloudflare-workers-ai"
                else settings.embedding_model
                if settings.embedding_provider_name == "openai"
                else "local-hashed"
            ),
            "briefGeneration": settings.brief_provider_name,
            "briefModel": (
                settings.cloudflare_chat_model
                if settings.brief_provider_name == "cloudflare-workers-ai"
                else settings.openai_model
                if settings.brief_provider_name == "openai"
                else "deterministic-template"
            ),
            "vectorStore": "mongodb-local",
        },
    }


@app.get("/v1/realtime/status")
def realtime() -> dict[str, Any]:
    return realtime_status()


@app.get("/v1/data-quality")
def data_quality(
    h3_index: str | None = Query(None, alias="h3Index"),
    city_code: str | None = Query(None, alias="cityCode"),
) -> dict[str, Any]:
    return telemetry_quality(h3_index=h3_index, city_code=city_code)


@app.get("/v1/overview")
def overview() -> dict[str, Any]:
    if not ping():
        raise HTTPException(status_code=503, detail="MongoDB is unavailable")
    cells = all_cell_documents()
    risks = [float(cell.get("compositeRisk") or 0) for cell in cells]
    cities: dict[str, int] = {}
    for cell in cells:
        city = cell.get("cityCode") or "unknown"
        cities[city] = cities.get(city, 0) + 1
    return {
        "cells": len(cells),
        "cities": cities,
        "memoryDocuments": db().cell_memories.count_documents({}),
        "knowledgeDocuments": db().knowledge_documents.count_documents({}),
        "historicalIncidents": db().knowledge_documents.count_documents({"sourceType": "historical_incident"}),
        "playbookDocuments": db().knowledge_documents.count_documents({"sourceType": "municipal_playbook"}),
        "agentRuns": db().agent_runs.count_documents({}),
        "averageRisk": round(sum(risks) / len(risks), 2) if risks else 0,
        "peakRisk": round(max(risks), 2) if risks else 0,
        "criticalCells": sum(1 for risk in risks if risk >= 7),
        "topRiskCells": [
            {
                "h3Index": cell.get("h3Index"),
                "cityCode": cell.get("cityCode"),
                "risk": round(float(cell.get("compositeRisk") or 0), 2),
                "level": cell.get("riskLevel"),
                "streets": (cell.get("context") or {}).get("streets", [])[:2],
            }
            for cell in cells[:8]
        ],
        "criticalHubs": critical_hubs(6),
        "realtime": realtime_status(),
        "providers": {
            "embedding": settings.embedding_provider_name,
            "briefGeneration": settings.brief_provider_name,
        },
    }


@app.get("/v1/cells/{h3_index}/memory")
def cell_memory(h3_index: str, refresh: bool = True) -> dict[str, Any]:
    if refresh:
        memory = build_memory(h3_index)
    else:
        memory = json_safe(db().cell_memories.find_one({"h3Index": h3_index}))
    if not memory:
        raise HTTPException(status_code=404, detail="Cell not found")
    return memory


@app.get("/v1/cells/{h3_index}/multi-resolution")
def cell_multi_resolution(h3_index: str) -> dict[str, Any]:
    if not cell_document(h3_index):
        raise HTTPException(status_code=404, detail="Cell not found")
    return multi_resolution(h3_index)


@app.get("/v1/cells/{h3_index}/graph")
def cell_graph(h3_index: str, rings: int = Query(2, ge=1, le=4)) -> dict[str, Any]:
    if not cell_document(h3_index):
        raise HTTPException(status_code=404, detail="Cell not found")
    return graph_analysis(h3_index, rings=rings)


@app.get("/v1/cells/{h3_index}/retrieve")
def cell_retrieve(
    h3_index: str,
    q: str | None = Query(None, max_length=500),
    k: int = Query(6, ge=1, le=12),
) -> dict[str, Any]:
    if not cell_document(h3_index):
        raise HTTPException(status_code=404, detail="Cell not found")
    return retrieve(h3_index, query=q, k=k)


@app.get("/v1/cells/{h3_index}/intelligence")
def cell_intelligence(h3_index: str) -> dict[str, Any]:
    cell = cell_document(h3_index)
    if not cell:
        raise HTTPException(status_code=404, detail="Cell not found")
    memory = build_memory(h3_index)
    context = cell.get("context") or {}
    alerts = cell.get("alerts") or []
    query = " ".join(
        str(part or "")
        for part in (
            " ".join(context.get("streets") or []),
            context.get("waterway"),
            " ".join(alert.get("title") for alert in alerts[:3]),
            f"risk {cell.get('compositeRisk')}",
        )
    )
    return {
        "cell": json_safe(cell),
        "memory": memory,
        "multiResolution": multi_resolution(h3_index),
        "graph": graph_analysis(h3_index, rings=2),
        "retrieval": retrieve(h3_index, query=query, k=6),
        "dataQuality": telemetry_quality(h3_index=h3_index),
        "latestRuns": latest_runs(h3_index, 3),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/v1/cells/{h3_index}/agent-runs")
def cell_agent_runs(h3_index: str, limit: int = Query(5, ge=1, le=20)) -> dict[str, Any]:
    return {"h3Index": h3_index, "runs": latest_runs(h3_index, limit)}


@app.post("/v1/cells/{h3_index}/agents")
def run_cell_agents(h3_index: str, incident_id: str | None = Query(None)) -> dict[str, Any]:
    try:
        return run_workflow(h3_index, incident_id=incident_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/v1/incidents/{incident_id}/agents")
def run_incident_agents(incident_id: str) -> dict[str, Any]:
    from bson import ObjectId

    try:
        incident = db().incidents.find_one({"_id": ObjectId(incident_id)})
    except Exception as error:
        raise HTTPException(status_code=422, detail="Invalid incident id") from error
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return run_workflow(incident.get("h3Index"), incident_id=incident_id)


@app.get("/v1/critical-hubs")
def get_critical_hubs(limit: int = Query(8, ge=1, le=25)) -> dict[str, Any]:
    return {"hubs": critical_hubs(limit), "method": "risk spread to H3 neighbours"}


@app.post("/v1/knowledge/rebuild")
def rebuild_knowledge_base() -> dict[str, Any]:
    return rebuild_knowledge()


@app.get("/v1/knowledge/stats")
def knowledge_stats() -> dict[str, Any]:
    return {
        "documents": db().knowledge_documents.count_documents({}),
        "incidents": db().knowledge_documents.count_documents({"sourceType": "historical_incident"}),
        "playbooks": db().knowledge_documents.count_documents({"sourceType": "municipal_playbook"}),
        "embeddingProvider": settings.embedding_provider_name,
        "isOfficialSop": False,
    }