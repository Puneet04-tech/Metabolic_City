import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, fetchStream } from '../api.js';

/**
 * Live cell telemetry.
 *
 * Readings arrive far faster than the UI can use them, so they are batched
 * into one state update per window and dropped when nothing changed.
 */
export function useLiveCells({ intervalMs = 600 } = {}) {
  const [cells, setCells] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);

  const latestRef = useRef(null);
  const timerRef = useRef(null);
  const signatureRef = useRef('');

  const flush = useCallback(() => {
    timerRef.current = null;
    if (latestRef.current === null) return;
    const incoming = latestRef.current;
    latestRef.current = null;
    setCells(incoming);
    setLastUpdated(new Date());
  }, []);

  const accept = useCallback(
    (incoming) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      const signature = incoming.map((cell) => `${cell.h3Index}:${cell.compositeRisk}`).join('|');
      if (signature === signatureRef.current) return;
      signatureRef.current = signature;
      latestRef.current = incoming;
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

  return { cells, connection, lastUpdated };
}

export default useLiveCells;
