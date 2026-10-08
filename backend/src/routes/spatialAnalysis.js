import express from 'express';
import {
  getMultiResolutionRisk,
  getNeighborAwareRisk,
  getTemporalSpatialPattern,
  findNearbyCells,
  calculateSpatialAutocorrelation,
} from '../services/spatialAnalysis.js';

const router = express.Router();

/**
 * Get multi-resolution risk analysis
 * GET /api/v1/spatial/multi-resolution/:h3Index
 */
router.get('/multi-resolution/:h3Index', async (req, res) => {
  try {
    const { h3Index } = req.params;
    const result = await getMultiResolutionRisk(h3Index);
    res.json(result);
  } catch (error) {
    console.error('[Spatial Analysis] Multi-resolution error:', error.message);
    res.status(500).json({ error: 'Failed to get multi-resolution risk' });
  }
});

/**
 * Get neighbor-aware risk analysis
 * GET /api/v1/spatial/neighbor-aware/:h3Index
 */
router.get('/neighbor-aware/:h3Index', async (req, res) => {
  try {
    const { h3Index } = req.params;
    const result = await getNeighborAwareRisk(h3Index);
    res.json(result);
  } catch (error) {
    console.error('[Spatial Analysis] Neighbor-aware error:', error.message);
    res.status(500).json({ error: 'Failed to get neighbor-aware risk' });
  }
});

/**
 * Get temporal-spatial pattern analysis
 * GET /api/v1/spatial/temporal-pattern/:h3Index
 * Query params: days (default: 30)
 */
router.get('/temporal-pattern/:h3Index', async (req, res) => {
  try {
    const { h3Index } = req.params;
    const { days = 30 } = req.query;
    const result = await getTemporalSpatialPattern(h3Index, Number(days));
    res.json(result);
  } catch (error) {
    console.error('[Spatial Analysis] Temporal-spatial error:', error.message);
    res.status(500).json({ error: 'Failed to get temporal-spatial pattern' });
  }
});

/**
 * Find nearby cells within radius
 * GET /api/v1/spatial/nearby/:h3Index
 * Query params: radiusKm (default: 5)
 */
router.get('/nearby/:h3Index', async (req, res) => {
  try {
    const { h3Index } = req.params;
    const { radiusKm = 5 } = req.query;
    const result = await findNearbyCells(h3Index, Number(radiusKm));
    res.json({ h3Index, radiusKm: Number(radiusKm), count: result.length, cells: result });
  } catch (error) {
    console.error('[Spatial Analysis] Nearby cells error:', error.message);
    res.status(500).json({ error: 'Failed to find nearby cells' });
  }
});

/**
 * Calculate spatial autocorrelation (Moran's I)
 * GET /api/v1/spatial/autocorrelation/:h3Index
 */
router.get('/autocorrelation/:h3Index', async (req, res) => {
  try {
    const { h3Index } = req.params;
    const result = await calculateSpatialAutocorrelation(h3Index);
    res.json(result);
  } catch (error) {
    console.error('[Spatial Analysis] Autocorrelation error:', error.message);
    res.status(500).json({ error: 'Failed to calculate spatial autocorrelation' });
  }
});

export default router;
