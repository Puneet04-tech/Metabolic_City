import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, fetchStream } from '../api.js';

/**
 * Live cell telemetry.
 *
 * The stream opens with a full snapshot of the cells and then sends the
 * single cell that was recalculated, so a payload is merged into what is
 * already held rather than replacing it.
 *
 * The server only writes a new observation when the pipeline runs, so the gap
 * between two advances of the newest observation is the refresh cadence. The
 * staleness threshold is derived from it, because a fixed threshold of a
 * minute would call a feed that refreshes every ten minutes stale for nine
 * minutes out of ten.
 */
export function useLiveCells({ intervalMs = 600 } = {}) {
  const [cells, setCells] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [serverUpdated, setServerUpdated] = useState(null);
  const [cadence, setCadence] = useState(null);

  const cellsRef = useRef([]);
  const latestRef = useRef(null);
  const timerRef = useRef(null);
  const signatureRef = useRef('');
  const lastPayloadAtRef = useRef(0);
  const lastServerStampRef = useRef(0);
  const gapsRef = useRef([]);

  const flush = useCallback(() => {
    timerRef.current = null;
    if (latestRef.current === null) return;
    const incoming = latestRef.current;
    latestRef.current = null;
    cellsRef.current = incoming;
    setCells(incoming);
    setLastUpdated(new Date());
  }, []);

  const accept = useCallback(
    (incoming) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;

      const now = Date.now();
      const previous = lastPayloadAtRef.current;
      if (previous) {
        const gap = now - previous;
        // The last few gaps, so one pause does not move the threshold much.
        const gaps = [...gapsRef.current, gap].slice(-3).sort((a, b) => a - b);
        gapsRef.current = gaps;
        setCadence(gaps[Math.floor(gaps.length / 2)]);
      }
      lastPayloadAtRef.current = now;

      // The newest observation the server has written. It only moves when the
      // pipeline runs, so the gap between two moves is the refresh cadence.
      const newest = incoming.reduce((latest, cell) => {
        const stamp = new Date(cell.lastUpdated || 0).getTime();
        return stamp > latest ? stamp : latest;
      }, 0);
      if (newest && newest > lastServerStampRef.current) {
        const previousStamp = lastServerStampRef.current;
        lastServerStampRef.current = newest;
        if (previousStamp) setCadence(newest - previousStamp);
        setServerUpdated(new Date(newest));
      }

      // A payload is merged into the cells already held: the stream sends a
      // whole snapshot when it opens and one cell when that cell is
      // recalculated. The merge is against the pending set when there is
      // one, so a payload that arrives inside the batching window does not
      // throw the previous one away.
      const base = latestRef.current ?? cellsRef.current;
      const merged = new Map(base.map((cell) => [cell.h3Index, cell]));
      for (const cell of incoming) merged.set(cell.h3Index, cell);
      const next = [...merged.values()];

      const signature = next
        .map((cell) => `${cell.h3Index}:${cell.compositeRisk}:${cell.lastUpdated}`)
        .join('|');
      if (signature === signatureRef.current) return;
      signatureRef.current = signature;

      latestRef.current = next;
      if (timerRef.current === null) {
        timerRef.current = setTimeout(flush, intervalMs);
      }
    },
    [flush, intervalMs]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await apiRequest('/v1/spatial-cells');
        if (!cancelled && response?.cells?.length) accept(response.cells);
      } catch {
        /* the stream below is the source of truth */
      }
    })();

    const controller = new AbortController();

    (async () => {
      try {
        await fetchStream('/v1/stream/h3', {
          signal: controller.signal,
          onMessage: (data) => {
            if (data?.cells) {
              accept(data.cells);
              setConnection((current) => (current === 'live' ? current : 'live'));
            }
          },
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setConnection('degraded');
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [accept]);

  return { cells, connection, lastUpdated, serverUpdated, cadence };
}

export default useLiveCells;
