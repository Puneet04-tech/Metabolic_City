import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { listActiveCells } from '../engine/risk.js';
import { addStreamClient } from '../engine/stream.js';

const router = express.Router();

router.get('/h3', protect, authorize('operator', 'field', 'admin'), async (req, res, next) => {
  try {
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(`event: snapshot\ndata: ${JSON.stringify({ cells: await listActiveCells() })}\n\n`);
    addStreamClient(res);
  } catch (error) {
    next(error);
  }
});

export default router;