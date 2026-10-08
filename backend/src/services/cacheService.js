import Redis from 'ioredis';

/**
 * Cache Service
 * Performance Principle: Caching Strategy - Redis for hot data
 */

let redisClient = null;

/**
 * Initialize Redis connection
 */
export function initCache() {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redisClient.on('connect', () => {
    console.log('[Cache] Redis connected');
  });

  redisClient.on('error', (err) => {
    console.error('[Cache] Redis error:', err.message);
  });

  return redisClient;
}

/**
 * Get cached value
 */
export async function getCached(key) {
  try {
    if (!redisClient) initCache();
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('[Cache] Error getting cache:', error.message);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached(key, value, ttl = 300) {
  try {
    if (!redisClient) initCache();
    await redisClient.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('[Cache] Error setting cache:', error.message);
    return false;
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key) {
  try {
    if (!redisClient) initCache();
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('[Cache] Error deleting cache:', error.message);
    return false;
  }
}

/**
 * Clear all cache matching pattern
 */
export async function clearCachePattern(pattern) {
  try {
    if (!redisClient) initCache();
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error('[Cache] Error clearing cache pattern:', error.message);
    return 0;
  }
}

/**
 * Cache H3 cell data
 */
export async function cacheCell(h3Index, cellData, ttl = 300) {
  const key = `cell:${h3Index}`;
  return await setCached(key, cellData, ttl);
}

/**
 * Get cached H3 cell
 */
export async function getCachedCell(h3Index) {
  const key = `cell:${h3Index}`;
  return await getCached(key);
}

/**
 * Cache weather data
 */
export async function cacheWeather(cityName, weatherData, ttl = 300) {
  const key = `weather:${cityName}`;
  return await setCached(key, weatherData, ttl);
}

/**
 * Get cached weather
 */
export async function getCachedWeather(cityName) {
  const key = `weather:${cityName}`;
  return await getCached(key);
}

/**
 * Cache user session
 */
export async function cacheUserSession(userId, sessionData, ttl = 3600) {
  const key = `session:${userId}`;
  return await setCached(key, sessionData, ttl);
}

/**
 * Get cached user session
 */
export async function getCachedUserSession(userId) {
  const key = `session:${userId}`;
  return await getCached(key);
}

/**
 * Invalidate cell cache
 */
export async function invalidateCellCache(h3Index) {
  return await deleteCached(`cell:${h3Index}`);
}

/**
 * Invalidate all cell caches
 */
export async function invalidateAllCellCaches() {
  return await clearCachePattern('cell:*');
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    if (!redisClient) initCache();
    const info = await redisClient.info('stats');
    const keyspace = await redisClient.info('keyspace');
    
    return {
      connected: redisClient.status === 'ready',
      stats: info,
      keyspace,
    };
  } catch (error) {
    console.error('[Cache] Error getting stats:', error.message);
    return { connected: false, error: error.message };
  }
}

/**
 * Close Redis connection
 */
export async function closeCache() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
