/**
 * Latency Monitoring Middleware
 * Real-Time Processing Principle: Latency Awareness - SLA monitoring
 */

const latencyThresholds = {
  warning: 1000, // 1 second
  critical: 5000, // 5 seconds
};

const latencyStats = {
  totalRequests: 0,
  totalLatency: 0,
  slowRequests: 0,
  criticalRequests: 0,
  p50: 0,
  p95: 0,
  p99: 0,
  latencies: [],
};

/**
 * Latency monitoring middleware
 * Tracks API response times and alerts on SLA violations
 */
export function latencyMonitor(req, res, next) {
  const startTime = Date.now();
  const path = req.path;
  const method = req.method;

  // Capture original send
  const originalSend = res.send;
  const originalJson = res.json;

  // Override json to measure latency
  res.json = function(data) {
    const latency = Date.now() - startTime;
    
    // Update stats
    updateLatencyStats(latency, path, method);
    
    // Log slow requests
    if (latency > latencyThresholds.critical) {
      console.error(`[Latency] CRITICAL: ${method} ${path} took ${latency}ms`);
    } else if (latency > latencyThresholds.warning) {
      console.warn(`[Latency] WARNING: ${method} ${path} took ${latency}ms`);
    }
    
    // Add latency header
    res.setHeader('X-Response-Time', `${latency}ms`);
    
    originalJson.call(this, data);
  };

  // Override send to measure latency
  res.send = function(data) {
    const latency = Date.now() - startTime;
    
    // Update stats
    updateLatencyStats(latency, path, method);
    
    // Log slow requests
    if (latency > latencyThresholds.critical) {
      console.error(`[Latency] CRITICAL: ${method} ${path} took ${latency}ms`);
    } else if (latency > latencyThresholds.warning) {
      console.warn(`[Latency] WARNING: ${method} ${path} took ${latency}ms`);
    }
    
    // Add latency header
    res.setHeader('X-Response-Time', `${latency}ms`);
    
    originalSend.call(this, data);
  };

  next();
}

/**
 * Update latency statistics
 */
function updateLatencyStats(latency, path, method) {
  latencyStats.totalRequests++;
  latencyStats.totalLatency += latency;
  
  if (latency > latencyThresholds.warning) {
    latencyStats.slowRequests++;
  }
  if (latency > latencyThresholds.critical) {
    latencyStats.criticalRequests++;
  }
  
  // Keep last 1000 latencies for percentile calculation
  latencyStats.latencies.push(latency);
  if (latencyStats.latencies.length > 1000) {
    latencyStats.latencies.shift();
  }
  
  // Calculate percentiles
  calculatePercentiles();
}

/**
 * Calculate latency percentiles (p50, p95, p99)
 */
function calculatePercentiles() {
  if (latencyStats.latencies.length === 0) return;
  
  const sorted = [...latencyStats.latencies].sort((a, b) => a - b);
  const len = sorted.length;
  
  latencyStats.p50 = sorted[Math.floor(len * 0.5)];
  latencyStats.p95 = sorted[Math.floor(len * 0.95)];
  latencyStats.p99 = sorted[Math.floor(len * 0.99)];
}

/**
 * Get latency statistics
 */
export function getLatencyStats() {
  const avgLatency = latencyStats.totalRequests > 0 
    ? latencyStats.totalLatency / latencyStats.totalRequests 
    : 0;
  
  return {
    totalRequests: latencyStats.totalRequests,
    averageLatency: Math.round(avgLatency),
    slowRequests: latencyStats.slowRequests,
    criticalRequests: latencyStats.criticalRequests,
    slowRequestRate: latencyStats.totalRequests > 0 
      ? (latencyStats.slowRequests / latencyStats.totalRequests * 100).toFixed(2) + '%'
      : '0%',
    p50: latencyStats.p50,
    p95: latencyStats.p95,
    p99: latencyStats.p99,
    thresholds: latencyThresholds,
  };
}

/**
 * Reset latency statistics
 */
export function resetLatencyStats() {
  latencyStats.totalRequests = 0;
  latencyStats.totalLatency = 0;
  latencyStats.slowRequests = 0;
  latencyStats.criticalRequests = 0;
  latencyStats.p50 = 0;
  latencyStats.p95 = 0;
  latencyStats.p99 = 0;
  latencyStats.latencies = [];
}

/**
 * Get endpoint-specific latency stats
 */
const endpointStats = {};

export function getEndpointLatencyStats(endpoint) {
  return endpointStats[endpoint] || {
    count: 0,
    totalLatency: 0,
    average: 0,
    max: 0,
    min: Infinity,
  };
}

export function trackEndpointLatency(endpoint, latency) {
  if (!endpointStats[endpoint]) {
    endpointStats[endpoint] = {
      count: 0,
      totalLatency: 0,
      average: 0,
      max: 0,
      min: Infinity,
    };
  }
  
  const stats = endpointStats[endpoint];
  stats.count++;
  stats.totalLatency += latency;
  stats.average = stats.totalLatency / stats.count;
  stats.max = Math.max(stats.max, latency);
  stats.min = Math.min(stats.min, latency);
}
