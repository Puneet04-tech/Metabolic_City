from __future__ import annotations

import logging
import queue
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId

from .config import settings
from .db import db
from .memory_service import build_memory
from .rag_service import delete_incident_knowledge, upsert_incident_knowledge

logger = logging.getLogger("metabolic.intelligence.realtime")

WATCHED_COLLECTIONS = ("spatialcells", "incidents", "alerts")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _utcnow_naive() -> datetime:
    """Mongo is opened tz_aware=False, so compare against naive UTC values."""
    return _utcnow().replace(tzinfo=None)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


class RealtimeSync:
    """Keep derived intelligence current against the live MongoDB.

    MongoDB change streams are the primary path. They need a replica set or a
    sharded cluster, so an ordinary standalone mongod falls back to a short
    polling loop. Both paths feed the same coalescing worker, which rebuilds
    cell memory and refreshes incident retrieval documents.
    """

    def __init__(self) -> None:
        self._stop = threading.Event()
        self._watch_thread: threading.Thread | None = None
        self._memory_thread: threading.Thread | None = None
        self._queue: queue.Queue[str | None] = queue.Queue()
        self._pending: set[str] = set()
        self._pending_lock = threading.Lock()
        self._state_lock = threading.Lock()

        self.mode = "disabled" if not settings.realtime_enabled else "starting"
        self.started_at: datetime | None = None
        self.last_event_at: datetime | None = None
        self.last_error: str | None = None
        self.processed_events = 0
        self.memory_updates = 0
        self.knowledge_updates = 0
        self.reconnects = 0

    # ---- lifecycle -----------------------------------------------------

    def start(self) -> None:
        if not settings.realtime_enabled:
            self.mode = "disabled"
            return
        if self._watch_thread and self._watch_thread.is_alive():
            return
        self._stop.clear()
        self.started_at = _utcnow()
        self._memory_thread = threading.Thread(
            target=self._memory_worker, name="intelligence-memory-sync", daemon=True
        )
        self._memory_thread.start()
        self._watch_thread = threading.Thread(
            target=self._run, name="intelligence-change-stream", daemon=True
        )
        self._watch_thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._queue.put(None)
        for thread in (self._watch_thread, self._memory_thread):
            if thread and thread.is_alive():
                thread.join(timeout=2)
        self.mode = "stopped"

    def status(self) -> dict[str, Any]:
        with self._state_lock:
            return {
                "enabled": settings.realtime_enabled,
                "running": bool(
                    self._watch_thread and self._watch_thread.is_alive() and not self._stop.is_set()
                ),
                "mode": self.mode,
                "watchedCollections": list(WATCHED_COLLECTIONS),
                "pollSeconds": settings.realtime_poll_seconds,
                "startedAt": _iso(self.started_at),
                "lastEventAt": _iso(self.last_event_at),
                "processedEvents": self.processed_events,
                "memoryUpdates": self.memory_updates,
                "knowledgeUpdates": self.knowledge_updates,
                "reconnects": self.reconnects,
                "lastError": self.last_error,
            }

    # ---- workers -------------------------------------------------------

    def _record(self, *, memory: int = 0, knowledge: int = 0, events: int = 0) -> None:
        with self._state_lock:
            self.memory_updates += memory
            self.knowledge_updates += knowledge
            self.processed_events += events
            if memory or knowledge or events:
                self.last_event_at = _utcnow()

    def _record_error(self, error: Exception) -> None:
        with self._state_lock:
            self.last_error = f"{type(error).__name__}: {str(error)[:240]}"

    def _queue_memory(self, h3_index: str | None) -> None:
        if not h3_index:
            return
        with self._pending_lock:
            if h3_index in self._pending:
                return
            self._pending.add(h3_index)
        self._queue.put(h3_index)

    def _memory_worker(self) -> None:
        while not self._stop.is_set():
            try:
                h3_index = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                if h3_index is None:
                    break
                build_memory(h3_index)
                self._record(memory=1)
            except Exception as error:  # a single bad cell must not kill the worker
                self._record_error(error)
            finally:
                if h3_index:
                    with self._pending_lock:
                        self._pending.discard(h3_index)
                self._queue.task_done()

    def _run(self) -> None:
        try:
            self._watch_changes()
        except Exception as error:
            if self._stop.is_set():
                return
            self._record_error(error)
            with self._state_lock:
                self.reconnects += 1
            logger.warning(
                "Change stream unavailable (%s); falling back to %ss polling.",
                type(error).__name__,
                settings.realtime_poll_seconds,
            )
            self._poll_loop()

    def _watch_changes(self) -> None:
        self.mode = "change-stream"
        pipeline = [{"$match": {"ns.coll": {"$in": list(WATCHED_COLLECTIONS)}}}]
        with db().watch(pipeline, full_document="updateLookup", max_await_time_ms=1000) as stream:
            logger.info("MongoDB change stream active for %s", ", ".join(WATCHED_COLLECTIONS))
            while not self._stop.is_set():
                change = stream.try_next()
                if change is None:
                    time.sleep(0.2)
                    continue
                self._handle_change(change)

    def _handle_change(self, change: dict[str, Any]) -> None:
        collection = (change.get("ns") or {}).get("coll")
        operation = change.get("operationType")
        document = change.get("fullDocument") or {}
        document_key = change.get("documentKey") or {}

        if collection == "incidents":
            incident_id = document.get("_id") or document_key.get("_id")
            if operation == "delete":
                delete_incident_knowledge(incident_id)
                self._record(knowledge=1, events=1)
            else:
                upsert_incident_knowledge(document)
                self._queue_memory(document.get("h3Index"))
                self._record(knowledge=1, events=1)
            return

        h3_index = document.get("h3Index") or document_key.get("h3Index")
        if collection == "spatialcells" and operation == "delete":
            if h3_index:
                db().cell_memories.delete_one({"h3Index": h3_index})
            self._record(events=1)
            return
        if collection in ("spatialcells", "alerts"):
            self._queue_memory(h3_index)
            self._record(events=1)

    def _poll_loop(self) -> None:
        self.mode = "polling"
        spatial_watermark = _utcnow_naive() - timedelta(seconds=settings.realtime_poll_seconds)
        incident_watermark = _utcnow_naive() - timedelta(seconds=settings.realtime_poll_seconds)
        alert_watermark = _utcnow_naive() - timedelta(seconds=settings.realtime_poll_seconds)
        last_reconcile = 0.0

        while not self._stop.is_set():
            try:
                cells = list(
                    db()
                    .spatialcells.find(
                        {"lastUpdated": {"$gt": spatial_watermark}},
                        {"h3Index": 1, "lastUpdated": 1},
                    )
                    .sort("lastUpdated", 1)
                    .limit(500)
                )
                for cell in cells:
                    self._queue_memory(cell.get("h3Index"))
                    if cell.get("lastUpdated"):
                        spatial_watermark = max(spatial_watermark, cell["lastUpdated"])
                self._record(events=len(cells))

                incidents = list(
                    db()
                    .incidents.find(
                        {"updatedAt": {"$gt": incident_watermark}},
                        {"_id": 1, "h3Index": 1, "updatedAt": 1},
                    )
                    .sort("updatedAt", 1)
                    .limit(200)
                )
                for incident in incidents:
                    document = db().incidents.find_one({"_id": incident["_id"]})
                    if document:
                        upsert_incident_knowledge(document)
                        self._queue_memory(document.get("h3Index"))
                    if incident.get("updatedAt"):
                        incident_watermark = max(incident_watermark, incident["updatedAt"])
                self._record(knowledge=len(incidents), events=len(incidents))

                alerts = list(
                    db()
                    .alerts.find(
                        {"lastSeenAt": {"$gt": alert_watermark}},
                        {"h3Index": 1, "lastSeenAt": 1},
                    )
                    .sort("lastSeenAt", 1)
                    .limit(500)
                )
                for alert in alerts:
                    self._queue_memory(alert.get("h3Index"))
                    if alert.get("lastSeenAt"):
                        alert_watermark = max(alert_watermark, alert["lastSeenAt"])
                self._record(events=len(alerts))

                if time.monotonic() - last_reconcile > settings.realtime_reconcile_seconds:
                    self._reconcile_incident_knowledge()
                    last_reconcile = time.monotonic()
            except Exception as error:
                self._record_error(error)

            self._stop.wait(settings.realtime_poll_seconds)

    def _reconcile_incident_knowledge(self) -> None:
        """Remove retrieval documents for incidents that no longer exist."""
        try:
            documents = list(
                db()
                .knowledge_documents.find(
                    {"sourceType": "historical_incident"}, {"docId": 1}
                )
                .limit(5000)
            )
            incident_ids = []
            for document in documents:
                doc_id = str(document.get("docId") or "")
                if doc_id.startswith("incident-"):
                    try:
                        incident_ids.append(ObjectId(doc_id.removeprefix("incident-")))
                    except Exception:
                        continue
            if not incident_ids:
                return
            existing = {
                str(item["_id"])
                for item in db().incidents.find({"_id": {"$in": incident_ids}}, {"_id": 1})
            }
            stale = [
                f"incident-{item}"
                for item in (str(incident_id) for incident_id in incident_ids)
                if item not in existing
            ]
            if stale:
                db().knowledge_documents.delete_many({"docId": {"$in": stale}})
                logger.info("Removed %s stale incident knowledge documents.", len(stale))
        except Exception as error:
            self._record_error(error)


_sync = RealtimeSync()


def start_realtime() -> None:
    _sync.start()


def stop_realtime() -> None:
    _sync.stop()


def realtime_status() -> dict[str, Any]:
    return _sync.status()
