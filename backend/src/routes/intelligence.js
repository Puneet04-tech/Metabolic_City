import express from 'express';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

const SERVICE_URL = (process.env.INTELLIGENCE_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');

/**
 * The intelligence service is internal. The browser only reaches it through
 * this authenticated gateway, so the Python process never needs a public
 * origin or its own user/session implementation.
 */
async function callService(path, { method = 'GET', body, query } = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else search.set(key, String(value));
  }
  const url = `${SERVICE_URL}${path}${search.size ? `?${search}` : ''}`;
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.INTELLIGENCE_TIMEOUT_MS || 20000)),
    });
  } catch (error) {
    const unavailable = new Error('H3 intelligence service is unavailable.');
    unavailable.status = 503;
    unavailable.cause = error;
    throw unavailable;
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(payload?.detail || payload?.message || `Intelligence service returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const forward = (handler) => async (req, res, next) => {
  try {
    const payload = await handler(req);
    return res.json(payload);
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ message: error.message, status: 'INTELLIGENCE_UNAVAILABLE' });
    }
    if (error.status && error.status < 500) {
      return res.status(error.status).json({ message: error.message });
    }
    return next(error);
  }
};

router.use(protect, authorize('operator', 'field', 'admin'));

router.get(
  '/health',
  forward(async () => callService('/health'))
);

router.get(
  '/realtime/status',
  forward(async () => callService('/v1/realtime/status'))
);

router.get(
  '/overview',
  forward(async () => callService('/v1/overview'))
);

router.get(
  '/data-quality',
  forward(async (req) =>
    callService('/v1/data-quality', {
      query: { h3Index: req.query.h3Index, cityCode: req.query.cityCode },
    })
  )
);

router.get(
  '/critical-hubs',
  forward(async (req) => callService('/v1/critical-hubs', { query: { limit: req.query.limit } }))
);

router.get(
  '/cells/:h3Index/intelligence',
  forward(async (req) => callService(`/v1/cells/${encodeURIComponent(req.params.h3Index)}/intelligence`))
);

router.get(
  '/cells/:h3Index/memory',
  forward(async (req) =>
    callService(`/v1/cells/${encodeURIComponent(req.params.h3Index)}/memory`, {
      query: { refresh: req.query.refresh },
    })
  )
);

router.get(
  '/cells/:h3Index/multi-resolution',
  forward(async (req) => callService(`/v1/cells/${encodeURIComponent(req.params.h3Index)}/multi-resolution`))
);

router.get(
  '/cells/:h3Index/graph',
  forward(async (req) =>
    callService(`/v1/cells/${encodeURIComponent(req.params.h3Index)}/graph`, { query: { rings: req.query.rings } })
  )
);

router.get(
  '/cells/:h3Index/retrieve',
  forward(async (req) =>
    callService(`/v1/cells/${encodeURIComponent(req.params.h3Index)}/retrieve`, {
      query: { q: req.query.q, k: req.query.k },
    })
  )
);

router.get(
  '/cells/:h3Index/agent-runs',
  forward(async (req) =>
    callService(`/v1/cells/${encodeURIComponent(req.params.h3Index)}/agent-runs`, { query: { limit: req.query.limit } })
  )
);

router.post(
  '/cells/:h3Index/agents',
  forward(async (req) =>
    callService(`/v1/cells/${encodeURIComponent(req.params.h3Index)}/agents`, {
      method: 'POST',
      query: { incident_id: req.body?.incidentId },
    })
  )
);

router.post(
  '/incidents/:incidentId/agents',
  forward(async (req) => callService(`/v1/incidents/${encodeURIComponent(req.params.incidentId)}/agents`, { method: 'POST' }))
);

router.get(
  '/knowledge/stats',
  forward(async () => callService('/v1/knowledge/stats'))
);

router.post(
  '/knowledge/rebuild',
  authorize('admin'),
  forward(async () => callService('/v1/knowledge/rebuild', { method: 'POST' }))
);

export default router;