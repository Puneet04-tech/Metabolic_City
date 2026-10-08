import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import telemetryRoutes from './routes/telemetry.js';
import streamRoutes from './routes/stream.js';
import spatialCellRoutes from './routes/spatialCells.js';
import { startTelemetryPollers } from './services/pollers.js';
import incidentRoutes from './routes/incidents.js';
import fieldRoutes from './routes/field.js';
import adminRoutes from './routes/admin.js';
import { startEscalationMonitor, stopEscalationMonitor } from './services/escalation.js';
import analyticsRoutes from './routes/analytics.js';
import { connectDB } from './config/db.js';
import { startScheduledPipeline, stopScheduledPipeline } from './services/dataPipeline.js';
import { auditLogMiddleware } from './middleware/auditLog.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import { getCircuitStatus } from './middleware/circuitBreaker.js';
import spatialAnalysisRoutes from './routes/spatialAnalysis.js';
import { latencyMonitor, getLatencyStats } from './middleware/latencyMonitor.js';

dotenv.config();

// PRINCIPLE: Scalability - Stateless service configuration
// All session data stored in MongoDB, JWT tokens carry auth state

const app = express();
const port = Number(process.env.PORT) || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Trust the first proxy hop (needed for correct client IP behind reverse proxy).
app.set('trust proxy', 1);

// PRINCIPLE: Security - Defense in Depth (Layer 1: HTTP Headers)
// Helmet.js for security headers, CSP, HSTS
app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// PRINCIPLE: Security - Defense in Depth (Layer 2: CORS)
// Strict CORS allow-list. Never allow '*' with credentials.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // Allow non-browser (curl, server-to-server)
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

// PRINCIPLE: Security - Defense in Depth (Layer 3: Rate Limiting)
// PRINCIPLE: Reliability - Backpressure Handling
// Global API rate limit: protect against DDoS / abuse on the whole API.
app.use(
  '/api',
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60000),
    limit: Number(process.env.RATE_LIMIT_MAX ?? 300),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again later.' },
  })
);

// PRINCIPLE: Real-Time Processing - Latency Awareness
// Apply latency monitoring to all API routes
app.use('/api', latencyMonitor);

// PRINCIPLE: Security - Audit Logging
// PRINCIPLE: Data Integrity - Idempotency
// Apply audit logging and idempotency to all API routes
app.use('/api', auditLogMiddleware);
app.use('/api', idempotencyMiddleware);

// PRINCIPLE: Reliability - Health Checks
// Health check endpoint for monitoring and auto-healing
const healthHandler = (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const status = dbReady ? 'healthy' : 'degraded';
  const circuitStatus = getCircuitStatus();
  const latencyStats = getLatencyStats();
  
  res.status(dbReady ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    version: '5.0',
    services: {
      mongodb: dbReady ? 'ready' : 'unavailable',
      authentication: 'ready',
      h3: 'ready',
      circuitBreakers: circuitStatus,
    },
    performance: {
      latency: latencyStats,
    },
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use('/api/auth', authRoutes);
app.use('/api/v1/telemetry', telemetryRoutes);
app.use('/api/v1/stream', streamRoutes);
app.use('/api/v1/spatial-cells', spatialCellRoutes);
app.use('/api/v1/incidents', incidentRoutes);
app.use('/api/v1/field', fieldRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/spatial', spatialAnalysisRoutes);

// PRINCIPLE: Usability - Error Handling
// 404 for unknown API routes.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// PRINCIPLE: Security - Defense in Depth (Layer 7: Error Handling)
// PRINCIPLE: Maintainability - Centralized Error Handler
// Centralized error handler (do not leak internals in production).
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body too large.' });
  }
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed.' });
  }
  if (isProd) {
    console.error('[error]', err.message);
  } else {
    console.error(err.stack);
  }
  return res.status(500).json({ message: 'Internal server error' });
});

let server;
let pollersStarted = false;
let escalationStarted = false;

const shutdown = async (signal) => {
  console.log(`[server] ${signal} received; initiating graceful shutdown.`);
  stopEscalationMonitor();
  stopScheduledPipeline();
  if (server) {
    await new Promise((resolve) => server.close((err) => (err ? resolve() : resolve())));
  }
  await mongoose.connection.close(false);
  console.log('[server] Graceful shutdown complete.');
  process.exit(0);
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

connectDB()
  .then(() => {
    startTelemetryPollers();
    pollersStarted = true;
    startEscalationMonitor();
    escalationStarted = true;
    
    // Start the scheduled data pipeline (Open-Meteo + Simulated Transit)
    startScheduledPipeline();
    
    server = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port} (${process.env.NODE_ENV || 'development'})`);
    });
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error.message);
    process.exit(1);
  });
