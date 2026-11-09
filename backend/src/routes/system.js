import express from 'express';
import mongoose from 'mongoose';
import { protect, authorize } from '../middleware/auth.js';
import { getSourceHealth } from '../services/sourceHealth.js';
import { getAlertSummary } from '../services/alertService.js';
import { getForecastAccuracy } from '../services/forecastAudit.js';
import { getConnectionStats } from '../services/streamManager.js';
import { streamClientCount } from '../engine/stream.js';
import { getCityCodeVariants } from '../services/cityConfig.js';

const router = express.Router();

router.get('/sources', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    return res.json(await getSourceHealth());
  } catch (error) {
    return next(error);
  }
});

router.get('/status', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const cityCodes =
      req.user.role === 'admin' || req.user.role === 'administrator' || !req.user.cityCode
        ? null
        : getCityCodeVariants(req.user.cityCode);

    const [sources, alerts, queue] = await Promise.all([
      getSourceHealth(),
      getAlertSummary(cityCodes),
      import('../queues/telemetryQueue.js')
        .then((module) => module.getQueueStats())
        .catch(() => ({ mode: 'unavailable' })),
    ]);

    return res.json({
      generatedAt: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'ready' : 'unavailable',
      stream: {
        ...getConnectionStats(),
        sseClients: streamClientCount(),
      },
      queue,
      alerts,
      sources,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/forecast-accuracy', protect, authorize('operator', 'admin'), async (req, res, next) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24 * 30);
    const cityCode = req.query.cityCode || null;
    return res.json(await getForecastAccuracy({ hours, cityCode }));
  } catch (error) {
    return next(error);
  }
});

export default router;
