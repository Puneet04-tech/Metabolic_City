import CircuitBreaker from 'opossum';

/**
 * Circuit Breaker Configuration
 * Reliability Principle: Circuit Breakers prevent cascading failures
 */
const circuitOptions = {
  timeout: 5000, // 5 second timeout
  errorThreshold: 5, // Open circuit after 5 failures
  resetTimeout: 60000, // Reset after 60 seconds
  rollingCountTimeout: 10000, // Consider last 10 seconds
  rollingCountBuckets: 10, // 10 buckets for statistics
};

// Initialize circuit breakers lazily to prevent startup errors
let weatherCircuitInstance = null;
let transitCircuitInstance = null;

/**
 * Circuit Breaker for Weather API
 * Prevents cascading failures when Open-Meteo API is down
 */
export function getWeatherCircuit() {
  if (!weatherCircuitInstance) {
    weatherCircuitInstance = new CircuitBreaker(
      async (city) => {
        // This will be wrapped around the actual weather fetch function
        const { fetchWeatherForCity } = await import('../services/weatherService.js');
        return await fetchWeatherForCity(city);
      },
      circuitOptions
    );

    // Fallback when circuit is open
    weatherCircuitInstance.fallback(() => {
      console.error('[Circuit Breaker] Weather API circuit open, using fallback');
      return {
        error: 'CIRCUIT_OPEN',
        message: 'Weather API temporarily unavailable, using cached data',
        fallback: true,
      };
    });

    // Log circuit state changes
    weatherCircuitInstance.on('open', () => {
      console.error('[Circuit Breaker] Weather API circuit OPEN');
    });

    weatherCircuitInstance.on('halfOpen', () => {
      console.warn('[Circuit Breaker] Weather API circuit HALF-OPEN, testing...');
    });

    weatherCircuitInstance.on('close', () => {
      console.log('[Circuit Breaker] Weather API circuit CLOSED, normal operation');
    });
  }
  return weatherCircuitInstance;
}

// Export a proxy that lazily initializes the circuit breaker
export const weatherCircuit = new Proxy({}, {
  get(target, prop) {
    const circuit = getWeatherCircuit();
    return circuit[prop];
  },
});

// Fallback when circuit is open
weatherCircuit.fallback(() => {
  console.error('[Circuit Breaker] Weather API circuit open, using fallback');
  return {
    error: 'CIRCUIT_OPEN',
    message: 'Weather API temporarily unavailable, using cached data',
    fallback: true,
  };
});

// Log circuit state changes
weatherCircuit.on('open', () => {
  console.error('[Circuit Breaker] Weather API circuit OPEN');
});

weatherCircuit.on('halfOpen', () => {
  console.warn('[Circuit Breaker] Weather API circuit HALF-OPEN, testing...');
});

weatherCircuit.on('close', () => {
  console.log('[Circuit Breaker] Weather API circuit CLOSED, normal operation');
});

/**
 * Circuit Breaker for Transit API
 * Prevents cascading failures when transit APIs are down
 */
export function getTransitCircuit() {
  if (!transitCircuitInstance) {
    transitCircuitInstance = new CircuitBreaker(
      async (weather) => {
        const { generateTransitData } = await import('../services/transitService.js');
        return await generateTransitData(weather);
      },
      circuitOptions
    );

    transitCircuitInstance.fallback(() => {
      console.error('[Circuit Breaker] Transit API circuit open, using fallback');
      return {
        error: 'CIRCUIT_OPEN',
        message: 'Transit API temporarily unavailable, using cached data',
        fallback: true,
      };
    });

    transitCircuitInstance.on('open', () => {
      console.error('[Circuit Breaker] Transit API circuit OPEN');
    });

    transitCircuitInstance.on('halfOpen', () => {
      console.warn('[Circuit Breaker] Transit API circuit HALF-OPEN, testing...');
    });

    transitCircuitInstance.on('close', () => {
      console.log('[Circuit Breaker] Transit API circuit CLOSED, normal operation');
    });
  }
  return transitCircuitInstance;
}

// Export a proxy that lazily initializes the circuit breaker
export const transitCircuit = new Proxy({}, {
  get(target, prop) {
    const circuit = getTransitCircuit();
    return circuit[prop];
  },
});

/**
 * Get circuit breaker status for monitoring
 */
export function getCircuitStatus() {
  const weather = getWeatherCircuit();
  const transit = getTransitCircuit();
  
  return {
    weather: {
      state: weather.opened ? 'OPEN' : weather.halfOpen ? 'HALF-OPEN' : 'CLOSED',
      stats: weather.stats,
    },
    transit: {
      state: transit.opened ? 'OPEN' : transit.halfOpen ? 'HALF-OPEN' : 'CLOSED',
      stats: transit.stats,
    },
  };
}
