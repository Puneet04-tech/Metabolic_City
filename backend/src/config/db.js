import mongoose from 'mongoose';
import { ensureUserIndexes } from '../models/User.js';

const DEFAULT_MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;

function parsePoolSize() {
  const raw = Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10);
  if (!Number.isFinite(raw) || raw < 1) return 10;
  return Math.floor(raw);
}

function assertTlsAndDb(mongoUri, dbName) {
  const cleanUri = mongoUri.replace('#.*$', '');
  const isSrv = /^mongodb\+srv:/i.test(cleanUri);

  // +srv URIs (Atlas) always use TLS and include a /db? path suffix.
  if (!isSrv && !/^mongodb:/i.test(cleanUri)) {
    throw new Error('[db] MONGO_URI must be a mongodb:// or mongodb+srv:// connection string.');
  }

  if (!isSrv) {
    // For a direct mongodb:// URI, require TLS explicitly (fail closed).
    const opts = new URL(cleanUri.replace('mongodb://', 'http://').replace('mongodb+srv://', 'http://')).searchParams;
    const tlsVal = opts.get('tls') ?? opts.get('ssl');
    if (!['true', '1'].includes((tlsVal || '').toLowerCase())) {
      throw new Error(
        `[db] Refusing unencrypted connection to "${dbName}". Set tls=true&ssl=true&retryWrites=true in MONGO_URI.`
      );
    }
  }

  if (!dbName) {
    throw new Error('[db] MONGODB_DB_NAME is required so the app never writes to a default database.');
  }
}

export async function connectDB({ retries = DEFAULT_MAX_RETRIES } = {}) {
  const mongoUri = process.env.MONGO_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'metabolic_city';

  if (!mongoUri) {
    throw new Error('[db] MONGO_URI is not defined in environment variables');
  }

  assertTlsAndDb(mongoUri, dbName);

  const options = {
    dbName,
    maxPoolSize: parsePoolSize(),
    minPoolSize: 1,
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 30000),
    socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS ?? 45000),
    connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS ?? 20000),
  };

  mongoose.connection.on('connected', () => console.log(`[db] MongoDB Atlas connected (${dbName})`));
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
    await mongoose.connect(mongoUri, options);
    await ensureUserIndexes();
    return mongoose.connection;
  } catch (error) {
    if (retries > 0) {
      const attempt = DEFAULT_MAX_RETRIES - retries + 1;
      const delay = RETRY_BASE_DELAY_MS * attempt;
      if (attempt === 1) {
        console.error(`[db] First connection attempt failed: ${error.message}`);
      }
      console.warn(`[db] Retrying connection ${attempt}/${DEFAULT_MAX_RETRIES} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectDB({ retries: retries - 1 });
    }
    throw error;
  }
}
