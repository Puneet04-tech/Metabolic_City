import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import { connectDB } from './config/db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Trust the first proxy hop (needed for correct client IP behind reverse proxy).
app.set('trust proxy', 1);

// Security headers.
app.use(
  helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Metabolic City API is running.' });
});

app.use('/api/auth', authRoutes);

// 404 for unknown API routes.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

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

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port} (${process.env.NODE_ENV || 'development'})`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error.message);
    process.exit(1);
  });
