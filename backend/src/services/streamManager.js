import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import { listActiveCells } from '../engine/risk.js';

/**
 * Distributed WebSocket Stream Manager
 * Reliability Principle: Distributed WebSocket - Redis Pub/Sub for multi-pod support
 * 
 * Replaces local SSE with Socket.IO + Redis adapter for distributed streaming
 * Addresses: In-memory socket pool failure in multi-pod environments
 */

let io = null;
let pubClient = null;
let subClient = null;
let heartbeatTimer = null;
let cellRefreshTimer = null;

/**
 * Initialize distributed WebSocket server with Redis Adapter
 */
export async function initializeStreamServer(server) {
  const redisEnabled = process.env.REDIS_ENABLED === 'true' && Boolean(process.env.REDIS_URL);
  const adapterOptions = {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
    },
  };

  if (redisEnabled) {
    const redisUrl = process.env.REDIS_URL;
    pubClient = new Redis(redisUrl, { maxRetriesPerRequest: 3, enableOfflineQueue: false, lazyConnect: true });
    subClient = pubClient.duplicate({ lazyConnect: true });

    pubClient.on('error', (err) => console.error('[REDIS_PUB_ERROR] Upstream Redis Publisher error:', err.message));
    subClient.on('error', (err) => console.error('[REDIS_SUB_ERROR] Upstream Redis Subscriber error:', err.message));

    try {
      await Promise.all([pubClient.connect(), subClient.connect()]);
      const info = await pubClient.info('server');
      const version = info.match(/redis_version:(\d+)\.(\d+)\.(\d+)/);
      const majorVersion = version ? Number(version[1]) : 0;
      if (majorVersion < 5) throw new Error(`Redis ${version?.[0] || 'unknown'} is below the required version 5.`);
      adapterOptions.adapter = createAdapter(pubClient, subClient);
    } catch (error) {
      console.warn(`[STREAM] Redis adapter disabled: ${error.message}`);
      await closeRedisClients();
    }
  } else {
    console.log('[STREAM] Redis adapter disabled; using single-process Socket.IO mode. Set REDIS_ENABLED=true for multi-pod streaming.');
  }

  io = new Server(server, adapterOptions);

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      const err = new Error('ERR_NIL_AUTH_TOKEN: Connection missing authentication payload');
      err.data = { code: 4001 };
      return next(err);
    }
    
    // Verify JWT token
    try {
      const { verifyToken } = await import('../middleware/auth.js');
      const decoded = verifyToken(token);
      socket.user = decoded;
      next();
    } catch (error) {
      const err = new Error('ERR_INVALID_AUTH_TOKEN: Invalid authentication token');
      err.data = { code: 4002 };
      return next(err);
    }
  });

  io.on('connection', (socket) => {
    console.info(`[STREAM] Client connected: ${socket.id}, User: ${socket.user?.email || 'unknown'}`);

    // Join user-specific room for targeted updates
    if (socket.user?.role) {
      socket.join(`role:${socket.user.role}`);
    }

    socket.on('disconnect', (reason) => {
      console.info(`[STREAM] Client disconnected: ${socket.id}, Reason: ${reason}`);
    });
  });

  // Heartbeat loop for idle feed states
  heartbeatTimer = setInterval(() => {
    if (io) {
      io.emit('heartbeat', {
        timestamp: new Date().toISOString(),
        status: 'HEALTHY',
        connectedClients: io.sockets.sockets.size,
      });
    }
  }, 30000);

  // Periodic cell refresh for real-time updates (even without new telemetry)
  cellRefreshTimer = setInterval(async () => {
    try {
      // Check if MongoDB is connected before attempting refresh
      if (mongoose.connection.readyState !== 1) {
        console.warn('[STREAM] MongoDB not connected, skipping cell refresh');
        return;
      }
      
      console.log('[STREAM] Periodic cell refresh - fetching active cells');
      const cells = await listActiveCells({ limit: 50 });
      if (cells.length > 0) {
        io.emit('cells:update', cells);
        console.log(`[STREAM] Broadcasted ${cells.length} cells to connected clients`);
      } else {
        console.log('[STREAM] No active cells found to broadcast');
      }
    } catch (error) {
      // Don't crash the entire stream on MongoDB errors
      if (error.message.includes('ENOTFOUND') || error.message.includes('Mongo')) {
        console.error('[STREAM] MongoDB connection error during cell refresh:', error.message);
        console.warn('[STREAM] Will retry in next cycle (60s)');
      } else {
        console.error('[STREAM] Error during periodic cell refresh:', error.message);
      }
    }
  }, 60000); // Refresh every 60 seconds

  console.log(`[STREAM] WebSocket server initialized (${adapterOptions.adapter ? 'Redis adapter' : 'local mode'})`);
  return io;
}

async function closeRedisClients() {
  for (const client of [pubClient, subClient]) {
    if (!client) continue;
    try { if (client.status !== 'end') await client.quit(); } catch { client.disconnect(); }
  }
  pubClient = null;
  subClient = null;
}

/**
 * Broadcast risk update to all connected clients
 * Distributed across all server instances via Redis Pub/Sub
 */
export function broadcastRiskUpdate(h3Index, riskData) {
  if (!io) {
    console.warn('[STREAM_WARN] WebSocket server not initialized');
    return;
  }
  
  if (!h3Index || !riskData) {
    console.warn('[STREAM_WARN] Nil or empty payload passed to broadcastRiskUpdate');
    return;
  }
  
  io.emit('cell:update', { h3Index, ...riskData });
  console.log(`[STREAM] Broadcasted update for cell ${h3Index}`);
}

/**
 * Broadcast to specific role (e.g., operators only)
 */
export function broadcastToRole(role, event, data) {
  if (!io) {
    console.warn('[STREAM_WARN] WebSocket server not initialized');
    return;
  }
  
  io.to(`role:${role}`).emit(event, data);
  console.log(`[STREAM] Broadcasted to role ${role}: ${event}`);
}

/**
 * Broadcast incident update
 */
export function broadcastIncidentUpdate(incidentId, incidentData) {
  if (!io) {
    console.warn('[STREAM_WARN] WebSocket server not initialized');
    return;
  }
  
  io.emit('incident:update', { incidentId, ...incidentData });
  console.log(`[STREAM] Broadcasted incident update: ${incidentId}`);
}

/**
 * Get WebSocket server instance
 */
export function getIO() {
  return io;
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  if (!io) {
    return { connected: false, clients: 0 };
  }
  
  return {
    connected: true,
    clients: io.sockets.sockets.size,
    rooms: Object.keys(io.sockets.adapter.rooms),
  };
}

/**
 * Close WebSocket server
 */
export async function closeStreamServer() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (cellRefreshTimer) {
    clearInterval(cellRefreshTimer);
    cellRefreshTimer = null;
  }
  if (io) {
    await io.close();
    io = null;
  }
  
  await closeRedisClients();
  
  console.log('[STREAM] Distributed WebSocket server closed');
}
