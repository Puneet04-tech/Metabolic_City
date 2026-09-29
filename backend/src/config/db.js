import mongoose from 'mongoose';
import { ensureUserIndexes } from '../models/User.js';

const DEFAULT_MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;

function parsePoolSize() {
  const raw = Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10);
  if (!Number.isFinite(raw) || raw < 1) return 10;
  return Math.floor(raw);
}

function validateAndSanitizeUri(mongoUri, dbName) {
  const cleanUri = mongoUri.replace(/#.*$/, '').trim();
  const isSrv = /^mongodb\+srv:/i.test(cleanUri);
  const isStandard = /^mongodb:/i.test(cleanUri);

  if (!isSrv && !isStandard) {
    throw new Error('[db] MONGO_URI must be a valid mongodb:// or mongodb+srv:// connection string.');
  }

  const isProd = process.env.NODE_ENV === 'production';

  if (!isSrv && isProd) {
    // In production, ensure TLS is enabled
    try {
      const parsed = new URL(cleanUri.replace(/^mongodb:\/\//i, 'http://'));
      const tlsVal = (parsed.searchParams.get('tls') ?? parsed.searchParams.get('ssl') ?? '').toLowerCase();
      if (!['true', '1'].includes(tlsVal)) {
        console.warn(`[db] Warning: Production MongoDB connection should have TLS enabled (tls=true).`);
      }
    } catch {
      // Allow connection attempt to proceed
    }
  }

  if (!dbName) {
    throw new Error('[db] MONGODB_DB_NAME is required so the application never writes to an unintended default database.');
  }

  return cleanUri;
}

export async function connectDB({ retries = DEFAULT_MAX_RETRIES } = {}) {
  const mongoUri = process.env.MONGO_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'metabolic_city';

  if (!mongoUri) {
    throw new Error('[db] MONGO_URI is not defined in environment variables. Please check your .env configuration.');
  }

  const cleanUri = validateAndSanitizeUri(mongoUri, dbName);

  const options = {
    dbName,
    maxPoolSize: parsePoolSize(),
    minPoolSize: 2,
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 30000),
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS ?? 45000),
    connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 20000),
    autoIndex: process.env.NODE_ENV !== 'production', // Build indexes automatically in dev
  };

  mongoose.connection.on('connected', () => console.log(`[db] MongoDB connected successfully (${dbName})`));
  mongoose.connection.on('error', (error) => {
    console.error(`[db] MongoDB connection error (${dbName}):`, error.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn(`[db] MongoDB disconnected (${dbName})`);
  });
  mongoose.connection.on('reconnected', () => {
    console.log(`[db] MongoDB reconnected (${dbName})`);
  });

  try {
    await mongoose.connect(cleanUri, options);
    try {
      await ensureUserIndexes();
    } catch (idxError) {
      console.warn('[db] Index synchronization warning:', idxError.message);
    }
    return mongoose.connection;
  } catch (error) {
    if (retries > 0) {
      const attempt = DEFAULT_MAX_RETRIES - retries + 1;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(1.5, attempt - 1) + Math.random() * 500;
      console.warn(`[db] Retrying MongoDB connection (attempt ${attempt}/${DEFAULT_MAX_RETRIES}) in ${Math.round(delay)}ms... Error: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDB({ retries: retries - 1 });
    }
    throw error;
  }
}
