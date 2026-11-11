from __future__ import annotations

import hashlib
import logging
import math
import re
from datetime import datetime, timezone
from typing import Any

import h3
import httpx
import numpy as np

from .config import settings
from .db import db, json_safe


logger = logging.getLogger("metabolic.intelligence.rag")
DIMENSIONS = 384
TOKEN_RE = re.compile(r"[a-z0-9]+")


MUNICIPAL_SOPS = [
    {
        "docId": "sop-flood-response-v1",
        "title": "Flood and waterlogging response",
        "category": "flood",
        "text": "For rainfall-driven waterlogging, prioritise cells with low elevation, flat slope and proximity to a mapped watercourse. Dispatch dewatering pumps and a drainage squad. Protect underpasses and arterial roads first. Keep traffic diversions away from the flooded cell. Confirm ponding depth and drain condition on site before closing the incident.",
    },
    {
        "docId": "sop-traffic-incident-v1",
        "title": "Road incident and congestion response",
        "category": "traffic",
        "text": "For a road closure, collision or severe congestion, separate the traffic-management action from the average cell risk. Dispatch a traffic diverter crew and a recovery vehicle. Keep a route open for emergency access. Use the alert severity and the measured travel-time delay, not the composite average alone.",
    },
    {
        "docId": "sop-escalation-v1",
        "title": "Incident escalation protocol",
        "category": "escalation",
        "text": "Escalate when a critical incident is unacknowledged beyond the configured threshold, when a crew reports a deviation, or when the incident crosses a municipal boundary. Notify the administrator and the duty officer. Request backup resources by capability, not by department name. Record the reason and time in the audit trail.",
    },
    {
        "docId": "sop-citizen-report-v1",
        "title": "Citizen report verification",
        "category": "citizen-report",
        "text": "A single citizen report is unverified. Two independent reporters in the same cell corroborate the report. A field crew confirms it on site. Do not dispatch a high-cost resource on a single unverified report unless the alert severity or a live road incident independently supports it.",
    },
    {
        "docId": "sop-field-safety-v1",
        "title": "Field crew safety and evidence",
        "category": "field",
        "text": "Field crews must record arrival, work status, a resolution note and a photo where safe. Do not enter moving water or a live traffic lane without protection. Use the offline queue when connectivity is lost. GPS and photo evidence are attached to the incident record.",
    },
    {
        "docId": "sop-resource-matrix-v1",
        "title": "Municipal resource matrix",
        "category": "resources",
        "text": "Match resources to the dominant hazard. Flood: dewatering pump, drainage squad, suction jetting tanker. Traffic: diverter crew, recovery vehicle, police control. Vulnerability: civil defence relief team and medical first responder. Critical compound hazard: SDRF rescue unit, high-capacity pump and traffic control.",
    },
    {
        "docId": "sop-monsoon-prep-v1",
        "title": "Monsoon preparedness",
        "category": "seasonal",
        "text": "Before monsoon, inspect drains and known waterlogging cells, pre-position pumps, clear culverts and verify emergency contacts. During monsoon, increase monitoring of low-lying cells and cells near watercourses. Reassess the flood screening model against observed ponding after each event.",
    },
    {
        "docId": "sop-data-quality-v1",
        "title": "Data quality and provenance",
        "category": "data-quality",
        "text": "Do not treat an interpolated weather value as a gauge measurement. Do not treat a sampled traffic probe as every road. Do not treat a terrain vulnerability proxy as social vulnerability. Mark modelled, simulated and measured data separately in every operational brief.",
    },
    {
        "docId": "sop-rag-use-v1",
        "title": "Using retrieved incident context",
        "category": "decision-support",
        "text": "Retrieved incidents are evidence, not instructions. Check the cell, season, severity and outcome before reusing a past action. A successful resolution in a different city or season may not transfer. The operator remains accountable for the final decision.",
    },
    {
        "docId": "sop-critical-hub-v1",
        "title": "Cascade and critical-hub response",
        "category": "cascade",
        "text": "A cell with high betweenness centrality can pass disruption to several neighbours. Intervene at the hub before the risk spreads. Inspect the highest-risk neighbour and keep the response route open. Recheck the graph after the intervention.",
    },
]


def current_season() -> str:
    month = datetime.now(timezone.utc).month
    if 6 <= month <= 9:
        return "monsoon"
    if month in (10, 11):
        return "post-monsoon"
    if month in (12, 1, 2):
        return "winter"
    return "summer"


def _tokens(text: str) -> list[str]:
    words = TOKEN_RE.findall((text or "").lower())
    unigrams = words
    bigrams = [f"{words[index]}_{words[index + 1]}" for index in range(len(words) - 1)]
    return unigrams + bigrams


def local_embedding(text: str) -> list[float]:
    """A deterministic hashed embedding that works with no external account.

    It is not a transformer embedding. It is a lexical vector with signed
    hashing, which makes local semantic retrieval reproducible and lets the
    service run in a demo or an air-gapped environment. Set the embedding
    provider to Cloudflare or OpenAI when credentials are available.
    """
    vector = np.zeros(DIMENSIONS, dtype=np.float32)
    counts: dict[str, int] = {}
    for token in _tokens(text):
        counts[token] = counts.get(token, 0) + 1
    for token, count in counts.items():
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        bucket = int.from_bytes(digest[:4], "little") % DIMENSIONS
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[bucket] += sign * (1.0 + math.log(count))
    norm = float(np.linalg.norm(vector))
    if norm:
        vector /= norm
    return [round(float(value), 6) for value in vector]


def _cloudflare_run(model: str, payload: dict[str, Any], timeout: float) -> Any:
    if not settings.cloudflare_ready:
        raise RuntimeError("Cloudflare Workers AI credentials are not configured.")
    url = (
        f"{settings.cloudflare_ai_base_url}/accounts/{settings.cloudflare_account_id}"
        f"/ai/run/{model}"
    )
    response = httpx.post(
        url,
        headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
        json=payload,
        timeout=timeout,
    )
    response.raise_for_status()
    body = response.json()
    if not body.get("success", True):
        errors = body.get("errors") or []
        raise RuntimeError(f"Workers AI rejected the request: {str(errors)[:200]}")
    return body.get("result")


def cloudflare_embedding(text: str) -> list[float]:
    """Call Workers AI with the 384-dimension BGE small embedding model."""
    result = _cloudflare_run(
        settings.cloudflare_embedding_model,
        {"text": [text[:8000]]},
        timeout=20,
    )
    data = result.get("data") if isinstance(result, dict) else result
    if not data or not isinstance(data[0], (list, tuple)):
        raise ValueError("Unexpected Workers AI embedding response shape.")
    vector = [float(value) for value in data[0]]
    if len(vector) != DIMENSIONS:
        raise ValueError(
            f"Workers AI returned {len(vector)} dimensions; this collection expects {DIMENSIONS}. "
            "Use @cf/baai/bge-small-en-v1.5 or rebuild the collection for another model."
        )
    norm = float(np.linalg.norm(vector))
    if norm:
        vector = [value / norm for value in vector]
    return [round(value, 6) for value in vector]


def embedding(text: str) -> list[float]:
    provider = settings.embedding_provider_name
    if provider == "cloudflare-workers-ai":
        try:
            return cloudflare_embedding(text)
        except Exception as error:
            # An outage must not take retrieval down; keep the 384-dimension
            # local vector so the query remains comparable.
            logger.warning("Cloudflare embedding failed (%s); using local hashed vector.", type(error).__name__)
    if provider == "openai":
        try:
            response = httpx.post(
                f"{settings.openai_base_url.rstrip('/')}/embeddings",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={"model": settings.embedding_model, "input": text[:8000]},
                timeout=15,
            )
            response.raise_for_status()
            return response.json()["data"][0]["embedding"]
        except Exception as error:
            logger.warning("OpenAI embedding failed (%s); using local hashed vector.", type(error).__name__)
    return local_embedding(text)


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or not right:
        return 0.0
    size = min(len(left), len(right))
    a = np.asarray(left[:size], dtype=np.float32)
    b = np.asarray(right[:size], dtype=np.float32)
    denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
    return float(np.dot(a, b) / denominator) if denominator else 0.0


def _incident_document(incident: dict[str, Any]) -> dict[str, Any]:
    action = incident.get("action") or {}
    detected = incident.get("detectedAt") or incident.get("createdAt")
    month = 1
    hour = 12
    if isinstance(detected, datetime):
        month = detected.month
        hour = detected.hour
    season = (
        "monsoon" if 6 <= month <= 9 else "post-monsoon" if month in (10, 11) else "winter" if month in (12, 1, 2) else "summer"
    )
    text = " ".join(
        str(part or "")
        for part in (
            incident.get("h3Index"),
            incident.get("status"),
            action.get("priority"),
            action.get("actionNarrative"),
            action.get("dispatchText"),
            " ".join(action.get("recommendedResources") or []),
            incident.get("resolutionNote"),
        )
    )
    return {
        "docId": f"incident-{incident.get('_id')}",
        "sourceType": "historical_incident",
        "title": f"{str(action.get('priority') or 'Municipal').title()} incident in {incident.get('h3Index')}",
        "text": text,
        "h3Index": incident.get("h3Index"),
        "cityCode": incident.get("cityCode"),
        "season": season,
        "hour": hour,
        "outcome": "resolved" if incident.get("status") == "RESOLVED" else "open",
        "success": incident.get("status") == "RESOLVED",
        "metadata": {
            "status": incident.get("status"),
            "riskScore": incident.get("riskScore"),
            "priority": action.get("priority"),
            "resources": action.get("recommendedResources") or [],
            "detectedAt": json_safe(detected),
        },
    }


def _sop_document(sop: dict[str, Any]) -> dict[str, Any]:
    return {
        **sop,
        "sourceType": "municipal_playbook",
        "h3Index": None,
        "cityCode": None,
        "season": "all",
        "hour": None,
        "outcome": "guidance",
        "success": None,
        "isOfficial": False,
        "source": "Metabolic City municipal playbook template",
        "metadata": {"category": sop.get("category"), "isOfficial": False},
    }


def _persist_document(document: dict[str, Any]) -> str:
    vector = embedding(f"{document.get('title', '')}\n{document.get('text', '')}")
    document["embedding"] = vector
    document["embeddingProvider"] = settings.embedding_provider_name
    document["embeddingDimensions"] = len(vector)
    document["updatedAt"] = datetime.now(timezone.utc)
    db().knowledge_documents.update_one(
        {"docId": document["docId"]},
        {"$set": document, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return document["docId"]


def upsert_incident_knowledge(incident: dict[str, Any]) -> str | None:
    """Refresh one retrieval document without rebuilding the whole corpus."""
    if not incident or not incident.get("_id"):
        return None
    return _persist_document(_incident_document(incident))


def delete_incident_knowledge(incident_id: Any) -> int:
    if incident_id is None:
        return 0
    result = db().knowledge_documents.delete_one({"docId": f"incident-{incident_id}"})
    return int(result.deleted_count)


def rebuild_knowledge() -> dict[str, Any]:
    documents: list[dict[str, Any]] = []
    for incident in db().incidents.find({}).limit(1000):
        documents.append(_incident_document(incident))
    for sop in MUNICIPAL_SOPS:
        documents.append(_sop_document(sop))

    for document in documents:
        _persist_document(document)

    # Remove stale incident documents that no longer exist.
    current_ids = [document["docId"] for document in documents]
    db().knowledge_documents.delete_many({"docId": {"$nin": current_ids}})
    return {
        "documents": len(documents),
        "incidents": sum(1 for document in documents if document["sourceType"] == "historical_incident"),
        "sops": sum(1 for document in documents if document["sourceType"] == "municipal_playbook"),
        "embeddingProvider": settings.embedding_provider_name,
        "isOfficialSop": False,
    }


def _spatial_score(query_h3: str, document_h3: str | None) -> float:
    if not document_h3:
        return 0.45
    if query_h3 == document_h3:
        return 1.0
    try:
        distance = h3.grid_distance(query_h3, document_h3)
    except Exception:
        return 0.1
    if distance <= 1:
        return 0.85
    if distance <= 2:
        return 0.65
    if distance <= 4:
        return 0.35
    try:
        if h3.cell_to_parent(query_h3, 6) == h3.cell_to_parent(document_h3, 6):
            return 0.25
    except Exception:
        pass
    return 0.05


def _temporal_score(document: dict[str, Any]) -> float:
    season = document.get("season")
    if season == "all":
        return 0.5
    score = 0.7 if season == current_season() else 0.2
    hour = document.get("hour")
    if hour is not None:
        current = datetime.now(timezone.utc).hour
        difference = min((current - int(hour)) % 24, (int(hour) - current) % 24)
        score += 0.3 if difference <= 2 else 0.15 if difference <= 5 else 0.0
    return min(1.0, score)


def retrieve(h3_index: str, query: str | None = None, k: int = 6) -> dict[str, Any]:
    if db().knowledge_documents.count_documents({}) == 0:
        rebuild_knowledge()
    query_text = query or f"municipal risk incident in cell {h3_index}"
    query_vector = embedding(query_text)
    documents = list(db().knowledge_documents.find({}).limit(1000))
    scored = []
    for document in documents:
        semantic = max(0.0, _cosine(query_vector, document.get("embedding") or []))
        spatial = _spatial_score(h3_index, document.get("h3Index"))
        temporal = _temporal_score(document)
        outcome = 1.0 if document.get("success") else 0.55 if document.get("success") is False else 0.5
        # Semantic similarity dominates, but an incident in the same cell and
        # season can outrank a marginally closer wording elsewhere.
        score = semantic * 0.5 + spatial * 0.25 + temporal * 0.15 + outcome * 0.1
        scored.append(
            {
                "docId": document.get("docId"),
                "sourceType": document.get("sourceType"),
                "title": document.get("title"),
                "text": document.get("text"),
                "snippet": (document.get("text") or "")[:260],
                "h3Index": document.get("h3Index"),
                "cityCode": document.get("cityCode"),
                "season": document.get("season"),
                "outcome": document.get("outcome"),
                "isOfficial": document.get("isOfficial"),
                "source": document.get("source"),
                "metadata": document.get("metadata") or {},
                "score": round(score, 4),
                "semanticScore": round(semantic, 4),
                "spatialScore": round(spatial, 4),
                "temporalScore": round(temporal, 4),
            }
        )
    scored.sort(key=lambda item: item["score"], reverse=True)
    top = scored[: max(1, min(k, 12))]
    return {
        "h3Index": h3_index,
        "query": query_text,
        "season": current_season(),
        "results": top,
        "incidents": [item for item in top if item["sourceType"] == "historical_incident"],
        "sops": [item for item in top if item["sourceType"] == "municipal_playbook"],
        "method": "hybrid spatial + semantic + temporal retrieval",
        "embeddingProvider": settings.embedding_provider_name,
    }


def build_brief(cell: dict[str, Any], retrieval: dict[str, Any], fallback: str) -> dict[str, Any]:
    """Optionally let Cloudflare or OpenAI rewrite the evidence.

    The deterministic fallback is the default and always available.
    """
    provider = settings.brief_provider_name
    if provider == "deterministic-template":
        return {"text": fallback, "provider": "deterministic-template", "grounded": True}
    context = "\n".join(
        f"- [{item['sourceType']}] {item['title']}: {item['snippet']}" for item in retrieval.get("results", [])[:5]
    )
    prompt = (
        "You are a municipal incident decision-support assistant. Use only the evidence below. "
        "Do not invent sensor readings. Separate measured facts from model outputs. "
        "Write a concise action brief with priority, resources and one caution.\n\n"
        f"Cell: {cell.get('h3Index')}\nRisk: {cell.get('compositeRisk')}/10\n"
        f"Scores: {cell.get('scores')}\n"
        f"Evidence:\n{context}\n\nFallback brief:\n{fallback}"
    )
    if provider == "cloudflare-workers-ai":
        try:
            result = _cloudflare_run(
                settings.cloudflare_chat_model,
                {
                    "messages": [
                        {"role": "system", "content": "Be terse, operational and evidence-bound."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 700,
                },
                timeout=30,
            )
            text = result.get("response") if isinstance(result, dict) else result
            if not text:
                raise ValueError("Workers AI returned an empty brief.")
            return {"text": str(text).strip(), "provider": "cloudflare-workers-ai", "grounded": True}
        except Exception as error:
            return {
                "text": fallback,
                "provider": "deterministic-template",
                "grounded": True,
                "error": type(error).__name__,
            }
    if provider == "openai":
        try:
            response = httpx.post(
                f"{settings.openai_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.openai_model,
                    "temperature": 0.1,
                    "messages": [
                        {"role": "system", "content": "Be terse, operational and evidence-bound."},
                        {"role": "user", "content": prompt},
                    ],
                },
                timeout=20,
            )
            response.raise_for_status()
            text = response.json()["choices"][0]["message"]["content"].strip()
            return {"text": text, "provider": "openai", "grounded": True}
        except Exception as error:
            return {
                "text": fallback,
                "provider": "deterministic-template",
                "grounded": True,
                "error": type(error).__name__,
            }
    return {"text": fallback, "provider": "deterministic-template", "grounded": True}