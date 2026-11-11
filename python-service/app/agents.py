from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from .config import settings
from .db import db, json_safe
from .h3_service import cell_document, graph_analysis, now_iso, risk_level
from .memory_service import build_memory
from .rag_service import build_brief, retrieve


def _number(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
        return parsed if parsed == parsed else default
    except (TypeError, ValueError):
        return default


def _dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


class IncidentState(TypedDict, total=False):
    runId: str
    h3Index: str
    startedAt: str
    cell: dict[str, Any]
    incident: dict[str, Any] | None
    memory: dict[str, Any]
    category: str
    severity: str
    urgency: str
    riskAssessment: dict[str, Any]
    graph: dict[str, Any]
    retrieval: dict[str, Any]
    similarIncidents: list[dict[str, Any]]
    relevantSops: list[dict[str, Any]]
    assignedCrews: list[dict[str, Any]]
    estimatedResolutionMinutes: int | None
    dispatchMessage: str
    brief: dict[str, Any]
    notifications: list[dict[str, Any]]
    progress: dict[str, Any]
    escalation: dict[str, Any]
    learning: dict[str, Any]
    trace: list[dict[str, Any]]


def _trace(state: IncidentState, node: str, summary: str, started: float, detail: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    entry = {
        "node": node,
        "status": "complete",
        "at": now_iso(),
        "durationMs": round((time.perf_counter() - started) * 1000, 1),
        "summary": summary,
    }
    if detail:
        entry["detail"] = detail
    return [*(state.get("trace") or []), entry]


def _incident_category(cell: dict[str, Any], incident: dict[str, Any] | None) -> str:
    text = " ".join(
        str(part or "")
        for part in (
            (cell.get("context") or {}).get("streets"),
            (cell.get("context") or {}).get("waterway"),
            [alert.get("title") for alert in cell.get("alerts") or []],
            (incident or {}).get("action", {}).get("actionNarrative") if incident else "",
        )
    ).lower()
    if any(word in text for word in ("flood", "water", "drain", "rain", "ponding", "nallah")):
        return "flood"
    if any(word in text for word in ("traffic", "road", "closure", "congestion", "diversion")):
        return "traffic"
    if any(word in text for word in ("medical", "injury", "health")):
        return "medical"
    return "municipal-hazard"


def detect_incident(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    cell = state.get("cell") or {}
    incident = state.get("incident")
    category = _incident_category(cell, incident)
    return {
        **state,
        "category": category,
        "trace": _trace(
            state,
            "detect_incident",
            f"Detected {category} context in {cell.get('h3Index')}.",
            started,
            {"incidentId": (incident or {}).get("_id"), "status": (incident or {}).get("status", "dry-run")},
        ),
    }


def risk_assessment(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    cell = state.get("cell") or {}
    scores = cell.get("scores") or {}
    current = _number(cell.get("compositeRisk"))
    alert = _number(cell.get("alertScore"))
    forecast_peak = _number((cell.get("forecast") or {}).get("peakMinutes") and cell.get("forecastRisk"))
    effective = max(current, alert, forecast_peak)
    severity = risk_level(effective)
    if str(cell.get("alertLevel") or "").upper() == "CRITICAL":
        severity = "CRITICAL"
    forecast_points = (cell.get("forecast") or {}).get("points") or []
    rising = bool(forecast_points) and _number(forecast_points[-1].get("risk")) > current + 0.5
    urgency = "immediate" if severity == "CRITICAL" else "urgent" if severity == "HIGH" or rising else "scheduled" if severity == "MODERATE" else "monitor"
    graph = graph_analysis(cell.get("h3Index", ""), rings=2)
    assessment = {
        "currentRisk": round(current, 2),
        "alertRisk": round(alert, 2),
        "forecastRisk": round(forecast_peak, 2),
        "effectiveRisk": round(effective, 2),
        "scores": {
            "mobility": round(_number(scores.get("mobility")), 2),
            "climate": round(_number(scores.get("climate")), 2),
            "vulnerability": round(_number(scores.get("vulnerability")), 2),
        },
        "rising": rising,
        "cascadeDelta": graph.get("cascadeDelta", 0),
        "cascadeDirection": graph.get("cascadeDirection", "stable"),
        "criticalHub": graph.get("criticalHub"),
        "method": "deterministic risk assessment over the live cell score, alert score and forecast",
    }
    return {
        **state,
        "severity": severity,
        "urgency": urgency,
        "riskAssessment": assessment,
        "graph": graph,
        "trace": _trace(
            state,
            "risk_assessment",
            f"{severity} severity, {urgency} urgency, cascade {assessment['cascadeDirection']}.",
            started,
            assessment,
        ),
    }


def context_retrieval(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    cell = state.get("cell") or {}
    context = cell.get("context") or {}
    alerts = cell.get("alerts") or []
    query = " ".join(
        str(part or "")
        for part in (
            state.get("category"),
            " ".join(context.get("streets") or []),
            context.get("waterway"),
            " ".join(alert.get("title") for alert in alerts[:3]),
            f"risk {cell.get('compositeRisk')}",
        )
    )
    retrieval = retrieve(cell.get("h3Index", ""), query=query, k=6)
    return {
        **state,
        "retrieval": retrieval,
        "similarIncidents": retrieval.get("incidents", []),
        "relevantSops": retrieval.get("sops", []),
        "trace": _trace(
            state,
            "context_retrieval",
            f"Retrieved {len(retrieval.get('results', []))} evidence documents across spatial, semantic and temporal channels.",
            started,
            {"query": retrieval.get("query"), "results": len(retrieval.get("results", []))},
        ),
    }


CITY_ALIASES = {
    "CITY-MP-BPL": ["CITY-MP-BPL", "CITY-IND-BPL8"],
    "CITY-MP-IDR": ["CITY-MP-IDR", "CITY-IND-INR6"],
    "CITY-MP-SHR": ["CITY-MP-SHR", "CITY-IND-SHR4"],
    "CITY-MP-AST": ["CITY-MP-AST", "CITY-IND-AST4"],
}


def _city_variants(city: str | None) -> list[str]:
    if not city:
        return []
    if city in CITY_ALIASES:
        return CITY_ALIASES[city]
    for canonical, variants in CITY_ALIASES.items():
        if city in variants:
            return [canonical, *variants]
    return [city]


def _playbook_resources(cell: dict[str, Any], category: str) -> list[str]:
    resources: list[str] = []
    risk = _number(cell.get("compositeRisk"))
    alert = _number(cell.get("alertScore"))
    scores = cell.get("scores") or {}
    if risk < 3 and alert < 3:
        # A low cell with no separate alert does not justify a field
        # deployment. Inspection is the proportionate response.
        return ["Municipal Quick Response Inspection Crew"]
    if risk >= 8.5:
        resources.extend(["SDRF Emergency Rescue Unit", "High-Capacity Dewatering Pump (100 HP)", "Traffic Diversion & Police Control Unit"])
    if category == "flood" or _number(scores.get("climate")) >= 7:
        resources.extend(["Municipal Dewatering Pump Truck", "Nagar Nigam Stormwater Drainage Squad"])
    if category == "traffic" or _number(scores.get("mobility")) >= 7:
        resources.extend(["Traffic Management & Diverter Crew", "Heavy Road Clearing & Recovery Vehicle"])
    if _number(scores.get("vulnerability")) >= 7:
        resources.extend(["Civil Defense & Slum Relief Team", "Emergency Medical First Responder Unit"])
    if not resources:
        resources.append("Municipal Quick Response Inspection Crew")
    seen = set()
    return [resource for resource in resources if not (resource in seen or seen.add(resource))]


def resource_allocation(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    cell = state.get("cell") or {}
    city = cell.get("cityCode")
    city_variants = _city_variants(city)
    resources = _playbook_resources(cell, state.get("category", "municipal-hazard"))
    crews = list(
        db()
        .users.find(
            {"role": "field_crew", "active": True, **(({"cityCode": {"$in": city_variants}}) if city_variants else {})},
            {"name": 1, "role": 1, "cityCode": 1, "staffId": 1},
        )
        .limit(5)
    )
    if not crews:
        crews = list(db().users.find({"role": "field_crew", "active": True}, {"name": 1, "role": 1, "cityCode": 1, "staffId": 1}).limit(3))
    assigned = [
        {
            "id": str(crew.get("_id")),
            "name": crew.get("name"),
            "staffId": crew.get("staffId"),
            "cityCode": crew.get("cityCode"),
            "match": "same-city" if crew.get("cityCode") in city_variants else "cross-city backup",
        }
        for crew in crews[:2]
    ]
    memory = state.get("memory") or {}
    historical = (memory.get("personality") or {}).get("averageResolutionMinutes")
    base = {"CRITICAL": 90, "HIGH": 150, "MODERATE": 240, "LOW": 360}.get(state.get("severity", "LOW"), 240)
    estimated = round(historical) if historical else base
    if not assigned:
        estimated = base
    return {
        **state,
        "assignedCrews": assigned,
        "estimatedResolutionMinutes": estimated,
        "trace": _trace(
            state,
            "resource_allocation",
            f"Prepared {len(resources)} resource types and {len(assigned)} crew options; estimated {estimated} minutes.",
            started,
            {"resources": resources, "crews": assigned},
        ),
    }


def communication(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    cell = state.get("cell") or {}
    resources = _playbook_resources(cell, state.get("category", "municipal-hazard"))
    sops = state.get("relevantSops") or []
    effective = (state.get("riskAssessment") or {}).get("effectiveRisk", _number(cell.get("compositeRisk")))
    action_word = "Monitor; inspect" if state.get("severity") == "LOW" else "Deploy"
    dispatch = (
        f"[METABOLIC CITY {state.get('severity')}] H3 {cell.get('h3Index')} | "
        f"Effective risk {_number(effective):.1f}/10 (cell {_number(cell.get('compositeRisk')):.1f}, "
        f"alert {_number(cell.get('alertScore')):.1f}) | {state.get('category')} | "
        f"{action_word}: {', '.join(resources[:3])}. Operator confirmation required."
    )
    fallback = (
        f"{state.get('severity')} priority in {cell.get('h3Index')}. "
        f"The effective risk is {_number(effective):.1f}/10: cell composite "
        f"{_number(cell.get('compositeRisk')):.1f}, strongest alert {_number(cell.get('alertScore')):.1f}. "
        f"Recommended resources: {', '.join(resources)}. "
        f"Reference: {sops[0]['title'] if sops else 'municipal playbook'}. "
        "Verify the site before committing the dispatch; this brief is decision support, not a field measurement."
    )
    brief = build_brief(cell, state.get("retrieval") or {}, fallback)
    return {
        **state,
        "dispatchMessage": dispatch,
        "brief": brief,
        "notifications": [
            {"channel": "operator", "status": "queued-in-advisory", "message": "Incident brief attached to the cell."},
            {"channel": "field-crew", "status": "not-sent", "message": f"{len(state.get('assignedCrews') or [])} crew options prepared; dispatch remains an operator action."},
            {"channel": "emergency-services", "status": "not-sent", "message": "Only a critical operator-approved incident should page emergency services."},
        ],
        "trace": _trace(
            state,
            "communication",
            "Generated a grounded dispatch brief and a dry-run notification plan.",
            started,
            {"briefProvider": brief.get("provider"), "dispatch": dispatch},
        ),
    }


def execution(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    incident = state.get("incident") or {}
    status = str(incident.get("status") or "DRY_RUN").upper()
    stage = {
        "DETECTED": "awaiting-approval",
        "APPROVED": "awaiting-crew",
        "DISPATCHED": "crew-assigned",
        "ACKNOWLEDGED": "crew-accepted",
        "ARRIVED": "on-site",
        "RESOLVED": "closed",
        "ESCALATED": "escalated",
        "OVERRIDDEN": "operator-override",
        "DRY_RUN": "advisory-only",
    }.get(status, "unknown")
    detected = _dt(incident.get("detectedAt"))
    elapsed = round((datetime.now(timezone.utc) - detected).total_seconds() / 60) if detected else None
    deviation = status == "ESCALATED" or (elapsed is not None and elapsed > settings.escalation_minutes * 2 and status not in ("RESOLVED", "OVERRIDDEN"))
    progress = {
        "status": status,
        "stage": stage,
        "elapsedMinutes": elapsed,
        "deviationDetected": deviation,
        "resolved": status == "RESOLVED",
        "note": "The execution agent reads the persisted incident; it does not move crews or change status.",
    }
    return {
        **state,
        "progress": progress,
        "trace": _trace(
            state,
            "execution",
            f"Incident is {stage}; deviation {'detected' if deviation else 'not detected'}.",
            started,
            progress,
        ),
    }


def escalation(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    progress = state.get("progress") or {}
    elapsed = progress.get("elapsedMinutes")
    threshold = settings.escalation_minutes
    should_escalate = (
        not progress.get("resolved")
        and state.get("severity") in ("CRITICAL", "HIGH")
        and ((elapsed is not None and elapsed >= threshold) or progress.get("deviationDetected") or progress.get("stage") == "escalated")
    )
    result = {
        "recommended": should_escalate,
        "thresholdMinutes": threshold,
        "reason": (
            f"Unacknowledged for {elapsed} minutes"
            if should_escalate and elapsed is not None
            else "No escalation threshold crossed"
        ),
        "action": "notify-administrator-and-request-backup" if should_escalate else "continue-monitoring",
        "executed": False,
        "note": "Advisory only. The Node escalation monitor owns the persisted escalation state.",
    }
    return {
        **state,
        "escalation": result,
        "trace": _trace(
            state,
            "escalation",
            "Escalation recommended." if should_escalate else "No escalation recommended.",
            started,
            result,
        ),
    }


def learning(state: IncidentState) -> IncidentState:
    started = time.perf_counter()
    cell = state.get("cell") or {}
    incident = state.get("incident") or {}
    memory = state.get("memory") or {}
    sample = {
        "runId": state.get("runId"),
        "h3Index": cell.get("h3Index"),
        "incidentId": incident.get("_id"),
        "category": state.get("category"),
        "severity": state.get("severity"),
        "resolved": (state.get("progress") or {}).get("resolved", False),
        "resolutionMinutes": (state.get("progress") or {}).get("elapsedMinutes"),
        "outcome": "resolved" if (state.get("progress") or {}).get("resolved") else "open",
        "createdAt": datetime.now(timezone.utc),
    }
    db().cell_memories.update_one(
        {"h3Index": cell.get("h3Index")},
        {
            "$push": {"learningSamples": {"$each": [sample], "$slice": -100}},
            "$set": {"lastAgentRunAt": datetime.now(timezone.utc)},
            "$inc": {"agentRunCount": 1},
        },
        upsert=True,
    )
    result = {
        "cellMemoryUpdated": True,
        "sampleRecorded": True,
        "modelRetraining": "deferred-offline",
        "reason": "Online learning stores the outcome sample; retraining a predictive model is an offline batch job, not a request-time action.",
        "personalityBefore": (memory.get("personality") or {}).get("label"),
    }
    return {
        **state,
        "learning": result,
        "trace": _trace(
            state,
            "learning",
            "Stored the outcome sample in cell memory; model retraining is scheduled offline.",
            started,
            result,
        ),
    }


workflow = StateGraph(IncidentState)
workflow.add_node("detect_incident", detect_incident)
workflow.add_node("risk_assessment", risk_assessment)
workflow.add_node("context_retrieval", context_retrieval)
workflow.add_node("resource_allocation", resource_allocation)
workflow.add_node("communication", communication)
workflow.add_node("execution", execution)
workflow.add_node("escalation_agent", escalation)
workflow.add_node("learning_agent", learning)
workflow.set_entry_point("detect_incident")
workflow.add_edge("detect_incident", "risk_assessment")
workflow.add_edge("risk_assessment", "context_retrieval")
workflow.add_edge("context_retrieval", "resource_allocation")
workflow.add_edge("resource_allocation", "communication")
workflow.add_edge("communication", "execution")
workflow.add_edge("execution", "escalation_agent")
workflow.add_edge("escalation_agent", "learning_agent")
workflow.add_edge("learning_agent", END)
incident_graph = workflow.compile()


def run_workflow(h3_index: str, incident_id: str | None = None) -> dict[str, Any]:
    cell = cell_document(h3_index)
    if not cell:
        raise ValueError("cell-not-found")
    incident = None
    if incident_id:
        from bson import ObjectId

        try:
            incident = db().incidents.find_one({"_id": ObjectId(incident_id)})
        except Exception:
            incident = None
    if not incident:
        incident = db().incidents.find_one({"h3Index": h3_index}, sort=[("detectedAt", -1)])
    incident = json_safe(incident) if incident else None
    memory = build_memory(h3_index)
    run_id = str(uuid.uuid4())
    initial: IncidentState = {
        "runId": run_id,
        "h3Index": h3_index,
        "startedAt": now_iso(),
        "cell": json_safe(cell),
        "incident": incident,
        "memory": memory,
        "trace": [],
    }
    result = incident_graph.invoke(initial)
    run = {
        "runId": run_id,
        "h3Index": h3_index,
        "incidentId": (incident or {}).get("_id"),
        "category": result.get("category"),
        "severity": result.get("severity"),
        "urgency": result.get("urgency"),
        "riskAssessment": result.get("riskAssessment"),
        "assignedCrews": result.get("assignedCrews"),
        "estimatedResolutionMinutes": result.get("estimatedResolutionMinutes"),
        "dispatchMessage": result.get("dispatchMessage"),
        "brief": result.get("brief"),
        "notifications": result.get("notifications"),
        "progress": result.get("progress"),
        "escalation": result.get("escalation"),
        "learning": result.get("learning"),
        "evidence": {
            "similarIncidents": result.get("similarIncidents"),
            "relevantSops": result.get("relevantSops"),
        },
        "trace": result.get("trace"),
        "completedAt": now_iso(),
        "dryRun": True,
    }
    db().agent_runs.insert_one({**json_safe(run), "createdAt": datetime.now(timezone.utc)})
    return json_safe(run)


def latest_runs(h3_index: str, limit: int = 5) -> list[dict[str, Any]]:
    return [json_safe(run) for run in db().agent_runs.find({"h3Index": h3_index}).sort("createdAt", -1).limit(limit)]