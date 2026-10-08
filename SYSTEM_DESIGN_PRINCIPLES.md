# Metabolic City - System Design Principles

**Project:** Urban Risk Management Platform  
**Version:** 1.0  
**Last Updated:** October 8, 2026

---

## Table of Contents

1. [Scalability Principles](#scalability-principles)
2. [Reliability Principles](#reliability-principles)
3. [Security Principles](#security-principles)
4. [Performance Principles](#performance-principles)
5. [Maintainability Principles](#maintainability-principles)
6. [Usability Principles](#usability-principles)
7. [Data Integrity Principles](#data-integrity-principles)
8. [Real-Time Processing Principles](#real-time-processing-principles)
9. [Spatial Intelligence Principles](#spatial-intelligence-principles)
10. [AI/ML Integration Principles](#aiml-integration-principles)

---

## Scalability Principles

### Horizontal Scaling
**Principle:** Stateless services with shared state in database

**Application in Metabolic City:**
- Backend services are stateless; all session data stored in MongoDB
- JWT tokens carry authentication state, removing server-side session storage
- SSE connections are stateless; clients reconnect on failure
- Future: Multiple backend instances behind load balancer

**Implementation:**
```javascript
// Current: Single instance
const server = app.listen(PORT);

// Future: Multiple instances with load balancer
// No session state in memory, all in MongoDB
```

---

### Vertical Scaling
**Principle:** Efficient resource utilization with connection pooling

**Application in Metabolic City:**
- MongoDB connection pooling configured (default pool size: 10)
- H3-js operations optimized with memoization
- Leaflet map rendering uses WebGL for GPU acceleration
- Database queries use indexes to reduce CPU load

**Implementation:**
```javascript
// MongoDB connection pooling
mongoose.connect(MONGO_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
});
```

---

### Microservices-Ready
**Principle:** Modular architecture allowing future service separation

**Application in Metabolic City:**
- Clear separation of concerns: Auth, Telemetry, Spatial, Incidents
- API routes organized by domain
- Frontend components modularized
- Services loosely coupled via REST API

**Future Microservices:**
```
metabolic-city-auth      - Authentication service
metabolic-city-telemetry - Data ingestion service
metabolic-city-spatial   - H3 cell processing service
metabolic-city-incidents - Incident management service
metabolic-city-ai        - AI/ML orchestration service
```

---

### Caching Strategy
**Principle:** Redis for hot data, CDN for static assets

**Application in Metabolic City:**
- Current: No caching layer (development)
- Future: Redis for:
  - H3 cell hotspots (frequently accessed cells)
  - User session data
  - Weather data (cached for 5 minutes)
  - GTFS static data (cached for 1 hour)
- Frontend: Vite build optimization, code splitting

**Implementation Plan:**
```javascript
// Future: Redis caching
const redis = require('redis');
const client = redis.createClient();

// Cache H3 cells
await client.setEx(`cell:${h3Index}`, 300, JSON.stringify(cellData));
```

---

### Database Sharding
**Principle:** H3 cell-based sharding for geographical distribution

**Application in Metabolic City:**
- Current: Single MongoDB Atlas cluster
- Future: Shard by cityCode (Bhopal, Indore, Sehore)
- Each city has its own shard for isolation
- Cross-city queries use distributed transactions

**Implementation Plan:**
```javascript
// Future: Sharding by cityCode
shardCollection: "spatialcells",
shardKey: { cityCode: 1 }
```

---

## Reliability Principles

### Fault Tolerance
**Principle:** Graceful degradation when components fail

**Application in Metabolic City:**
- Weather API failure: Use last known weather data with degraded flag
- Transit API failure: Use simulated delays based on historical patterns
- MongoDB connection failure: Retry with exponential backoff
- SSE connection failure: Client auto-reconnects

**Implementation:**
```javascript
// Weather service with fallback
async function fetchWeather(city) {
  try {
    return await openMeteo.getWeather(city);
  } catch (error) {
    console.error('Weather API failed, using fallback');
    return getLastKnownWeather(city);
  }
}
```

---

### Redundancy
**Principle:** Multi-region deployment for critical services

**Application in Metabolic City:**
- Current: Single MongoDB Atlas cluster (replica set)
- Future: Multi-region deployment (Mumbai, Delhi, Bangalore)
- DNS failover for critical endpoints
- Database backups across regions

**Implementation Plan:**
```javascript
// Future: Multi-region MongoDB
const connectionString = "mongodb+srv://cluster0-mumbai.../metabolic_city?replicaSet=rs0&readPreference=nearest";
```

---

### Circuit Breakers
**Principle:** Prevent cascading failures

**Application in Metabolic City:**
- Current: Basic rate limiting (300 requests/minute)
- Future: Circuit breaker for external APIs (Open-Meteo, AICTSL)
- Automatic circuit reset after cooldown period
- Fallback to degraded mode when circuit open

**Implementation Plan:**
```javascript
// Future: Circuit breaker pattern
const circuitBreaker = new CircuitBreaker(weatherAPI, {
  timeout: 5000,
  errorThreshold: 5,
  resetTimeout: 60000,
});
```

---

### Retry Logic
**Principle:** Exponential backoff for external API calls

**Application in Metabolic City:**
- Weather API: Retry 3 times with 1s, 2s, 4s backoff
- Transit API: Retry 2 times with 2s, 4s backoff
- MongoDB operations: Automatic retry on transient errors
- SSE reconnection: Exponential backoff (1s, 2s, 4s, 8s, max 30s)

**Implementation:**
```javascript
// Retry with exponential backoff
async function fetchWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

---

### Health Checks
**Principle:** Automated monitoring and self-healing

**Application in Metabolic City:**
- Current: Basic server startup check
- Future: Health check endpoint (`/health`)
  - Database connectivity
  - External API status
  - Memory/CPU usage
  - Active SSE connections
- Automated alerts on health check failure
- Kubernetes/Render health probe integration

**Implementation Plan:**
```javascript
// Future: Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    database: await checkDatabase(),
    weatherAPI: await checkWeatherAPI(),
    memory: process.memoryUsage(),
  };
  res.json(health);
});
```

---

## Security Principles

### Defense in Depth
**Principle:** Multiple security layers

**Application in Metabolic City:**
- Layer 1: Helmet.js (HTTP headers security)
- Layer 2: CORS (Cross-origin protection)
- Layer 3: Rate limiting (DDoS protection)
- Layer 4: JWT authentication (access control)
- Layer 5: Role-based authorization (permission checks)
- Layer 6: Input validation (sanitization)
- Layer 7: MongoDB schema validation (data integrity)

**Implementation:**
```javascript
// Defense in depth stack
app.use(helmet());                    // HTTP headers
app.use(cors(config));                // CORS
app.use(rateLimiter);                 // Rate limiting
app.use(authenticate);               // JWT auth
app.use(authorize);                  // Role check
app.use(validateInput);              // Input validation
```

---

### Least Privilege
**Principle:** Role-based access with minimal permissions

**Application in Metabolic City:**
- **Operator:** View cells, dispatch incidents, approve actions
- **Field Crew:** View assigned tasks, update status, upload evidence
- **Administrator:** Full system access, user management, configuration
- API endpoints check user role before action
- MongoDB query filters by jurisdiction

**Implementation:**
```javascript
// Role-based authorization
middleware.authorize(['operator', 'administrator'])((req, res, next) => {
  if (req.user.role === 'field_crew') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
});
```

---

### Data Encryption
**Principle:** TLS in transit, encryption at rest

**Application in Metabolic City:**
- Transit: MongoDB Atlas TLS connection (default)
- Transit: HTTPS for all API endpoints (production)
- At Rest: MongoDB Atlas encryption (default)
- At Rest: Passwords hashed with bcrypt (salt rounds: 10)
- Future: Field evidence encrypted at rest

**Implementation:**
```javascript
// Password hashing
const saltRounds = 10;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// MongoDB TLS connection
const uri = "mongodb+srv://user:pass@cluster.mongodb.net/metabolic_city?retryWrites=true&w=majority";
```

---

### Audit Logging
**Principle:** All actions logged with user, timestamp, and context

**Application in Metabolic City:**
- Current: Basic console logging
- Future: Structured audit logs for:
  - User authentication (login, logout)
  - Incident dispatch (who, when, which cell)
  - Field crew actions (acknowledge, arrive, resolve)
  - Configuration changes (by admin)
- Immutable log storage
- Log retention policy (90 days)

**Implementation Plan:**
```javascript
// Future: Audit logging
await AuditLog.create({
  userId: req.user._id,
  action: 'incident_dispatch',
  target: { type: 'cell', id: cell.h3Index },
  context: { risk: cell.compositeRisk, timestamp: new Date() },
});
```

---

### Secrets Management
**Principle:** Environment variables, never in code

**Application in Metabolic City:**
- All secrets in `.env` file (gitignored)
- `.env.example` template for developers
- Production: Environment variables in deployment platform
- Never commit secrets to git
- Rotate secrets regularly

**Implementation:**
```bash
# .env (gitignored)
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
GEMINI_API_KEY=...

# .env.example (committed)
MONGO_URI=mongodb+srv://<user>:<password>@...
JWT_SECRET=<your-secret>
GEMINI_API_KEY=<your-key>
```

---

## Performance Principles

### Lazy Loading
**Principle:** Load data only when needed

**Application in Metabolic City:**
- H3 cells: Paginated (50 cells per page)
- Incidents: Load on demand, not all at once
- Map tiles: On-demand loading via Leaflet
- Field evidence: Load thumbnail, full image on click
- Analytics: Calculate on demand, not pre-computed

**Implementation:**
```javascript
// Paginated H3 cells
app.get('/api/v1/cells', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const cells = await SpatialCell.find()
    .skip((page - 1) * limit)
    .limit(limit);
  res.json(cells);
});
```

---

### Pagination
**Principle:** All list endpoints paginated

**Application in Metabolic City:**
- `/api/v1/cells` - Paginated (default 50)
- `/api/v1/incidents` - Paginated (default 20)
- `/api/v1/users` - Paginated (default 20)
- Includes total count for UI pagination
- Cursor-based pagination for large datasets

**Implementation:**
```javascript
// Pagination response
{
  data: [...],
  pagination: {
    page: 1,
    limit: 50,
    total: 150,
    totalPages: 3
  }
}
```

---

### Indexing Strategy
**Principle:** Database indexes on frequently queried fields

**Application in Metabolic City:**
- SpatialCell: h3Index (unique), compositeRisk (descending), riskLevel
- TelemetryEvent: h3Index, timestamp, source
- Incident: h3Index, status, createdAt
- User: email (unique), role, cityCode

**Implementation:**
```javascript
// SpatialCell indexes
spatialCellSchema.index({ h3Index: 1 }, { unique: true });
spatialCellSchema.index({ compositeRisk: -1 });
spatialCellSchema.index({ riskLevel: 1, lastUpdated: -1 });
```

---

### Stream Processing
**Principle:** SSE for real-time updates instead of polling

**Application in Metabolic City:**
- Current: SSE for H3 cell updates
- Client subscribes to `/api/v1/stream/cells`
- Server pushes updates on cell changes
- No polling, reduces server load
- Automatic reconnection on failure

**Implementation:**
```javascript
// SSE streaming
app.get('/api/v1/stream/cells', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  
  const stream = streamManager.subscribe('cells');
  stream.on('data', (cell) => {
    res.write(`data: ${JSON.stringify(cell)}\n\n`);
  });
});
```

---

### Async Processing
**Principle:** Background jobs for heavy computations

**Application in Metabolic City:**
- Current: Data pipeline runs in main process
- Future: Move to background job queue (BullMQ)
- Heavy operations:
  - H3 cell calculation (batch processing)
  - Risk aggregation (city-level)
  - Analytics report generation
  - Evidence processing (image compression)

**Implementation Plan:**
```javascript
// Future: Background job queue
const queue = new Queue('risk-calculation');

await queue.add('calculate-cell-risk', {
  h3Index: '883d914f17fffff',
  telemetry: [...],
});
```

---

## Maintainability Principles

### DRY (Don't Repeat Yourself)
**Principle:** Shared utilities and components

**Application in Metabolic City:**
- Shared authentication middleware
- Shared error handling middleware
- Shared validation utilities
- Shared API response format
- Shared React components (Button, Card, Badge)

**Implementation:**
```javascript
// Shared middleware
export const authenticate = async (req, res, next) => { ... };
export const authorize = (roles) => async (req, res, next) => { ... };

// Shared components
export const Button = ({ children, variant, ...props }) => { ... };
export const Card = ({ children, className, ...props }) => { ... };
```

---

### SOLID Principles
**Principle:** Single responsibility, open/closed, dependency inversion

**Application in Metabolic City:**
- **Single Responsibility:** Each model/route/service has one job
- **Open/Closed:** Extensible without modification (e.g., new transit sources)
- **Liskov Substitution:** User types (operator, field_crew, admin) interchangeable
- **Interface Segregation:** Small, focused API endpoints
- **Dependency Inversion:** Depend on abstractions (services), not concretions

**Implementation:**
```javascript
// Single responsibility
class WeatherService { fetchWeather(city) { ... } }
class TransitService { generateTransit(weather) { ... } }
class RiskEngine { calculateRisk(telemetry) { ... } }

// Open/closed (extensible transit sources)
class TransitService {
  constructor(source = 'simulated') {
    this.strategy = TransitStrategies[source];
  }
}
```

---

### Code Documentation
**Principle:** JSDoc for functions, inline comments for complex logic

**Application in Metabolic City:**
- JSDoc for all exported functions
- Inline comments for complex algorithms (H3, risk calculation)
- README for each major component
- API documentation with examples

**Implementation:**
```javascript
/**
 * Calculates composite risk score for an H3 cell
 * @param {Object} telemetry - Telemetry data for the cell
 * @param {Object} weights - Risk weights (Wm, Wc, Wv)
 * @returns {number} Composite risk score (0-10)
 */
function calculateCompositeRisk(telemetry, weights) {
  // Weighted sum of mobility, climate, vulnerability scores
  // Formula: Rc = (Wm × Sm) + (Wc × Sc) + (Wv × Sv)
  return (weights.Wm * telemetry.mobility) +
         (weights.Wc * telemetry.climate) +
         (weights.Wv * telemetry.vulnerability);
}
```

---

### Version Control
**Principle:** Semantic versioning, meaningful commit messages

**Application in Metabolic City:**
- Git flow: main branch for production, feature branches
- Commit message format: `type: description`
  - `feat:` New feature
  - `fix:` Bug fix
  - `refactor:` Code refactoring
  - `docs:` Documentation
  - `test:` Tests
- Semantic versioning: v1.0.0 (major.minor.patch)

**Implementation:**
```bash
# Commit message examples
git commit -m "feat: add H3 cell memory system"
git commit -m "fix: resolve Leaflet coordinate rendering issue"
git commit -m "refactor: extract shared validation utilities"
```

---

### Testing Strategy
**Principle:** Unit, integration, and E2E tests

**Application in Metabolic City:**
- Current: No tests (development phase)
- Future:
  - Unit tests: Models, services, utilities (Jest)
  - Integration tests: API endpoints (Supertest)
  - E2E tests: User workflows (Playwright)
  - Test coverage target: 80%

**Implementation Plan:**
```javascript
// Unit test example
describe('calculateCompositeRisk', () => {
  it('should return 8.5 for high-risk telemetry', () => {
    const result = calculateCompositeRisk(telemetry, weights);
    expect(result).toBe(8.5);
  });
});

// Integration test example
describe('POST /api/v1/incidents', () => {
  it('should create incident for critical cell', async () => {
    const response = await request(app)
      .post('/api/v1/incidents')
      .set('Authorization', token)
      .send(incidentData);
    expect(response.status).toBe(201);
  });
});
```

---

## Usability Principles

### User-Centric Design
**Principle:** Intuitive interfaces based on user workflows

**Application in Metabolic City:**
- **Operator Workflow:** Monitor cells → Click cell → View action drawer → Dispatch
- **Field Crew Workflow:** View tasks → Acknowledge → Arrive → Resolve → Upload evidence
- **Admin Workflow:** Configure system → Manage users → View analytics
- UI designed around these workflows, not data models

**Implementation:**
```jsx
// Operator console follows workflow
<H3Map cells={cells} onSelect={handleCellClick} />
<ActionDrawer cell={selectedCell} onDispatch={handleDispatch} />
```

---

### Accessibility
**Principle:** WCAG 2.1 AA compliance

**Application in Metabolic City:**
- Semantic HTML (nav, main, section)
- ARIA labels for interactive elements
- Keyboard navigation support
- Color contrast ratio ≥ 4.5:1
- Screen reader compatible
- Focus indicators

**Implementation:**
```jsx
// Accessible button
<button 
  aria-label="Dispatch incident for cell 883d914f17fffff"
  onClick={handleDispatch}
>
  Dispatch
</button>
```

---

### Error Handling
**Principle:** Clear, actionable error messages

**Application in Metabolic City:**
- User-friendly error messages (not technical stack traces)
- Specific error codes for different scenarios
- Recovery suggestions where possible
- Error boundaries in React for graceful failure

**Implementation:**
```javascript
// User-friendly error response
{
  error: 'INCIDENT_ALREADY_DISPATCHED',
  message: 'This incident has already been dispatched. View the incident in the Incidents tab.',
  code: 409
}
```

---

### Loading States
**Principle:** Visual feedback for all async operations

**Application in Metabolic City:**
- Loading spinners for API calls
- Skeleton screens for data loading
- Progress indicators for long operations
- Toast notifications for success/error

**Implementation:**
```jsx
// Loading state
{loading ? (
  <Spinner />
) : (
  <H3Map cells={cells} />
)}
```

---

### Responsive Design
**Principle:** Mobile-first approach

**Application in Metabolic City:**
- Mobile-optimized field crew interface
- Tablet-optimized operator console
- Desktop-optimized analytics dashboard
- CSS Grid/Flexbox for responsive layouts
- Touch-friendly buttons (min 44px height)

**Implementation:**
```css
/* Responsive breakpoints */
@media (max-width: 768px) {
  .operator-console {
    flex-direction: column;
  }
}
```

---

## Data Integrity Principles

### ACID Transactions
**Principle:** Critical operations in database transactions

**Application in Metabolic City:**
- Incident dispatch: Create incident + update cell status (atomic)
- Field crew resolve: Update incident + mark task complete (atomic)
- User creation: Create user + assign role (atomic)
- Future: Cross-collection transactions with MongoDB 4.4+

**Implementation:**
```javascript
// Transaction for incident dispatch
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Incident.create([incidentData], { session });
  await SpatialCell.updateOne(
    { h3Index: cell.h3Index },
    { riskLevel: 'CRITICAL' },
    { session }
  );
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
}
```

---

### Validation
**Principle:** Input validation at API boundary and database level

**Application in Metabolic City:**
- API: Express-validator for request validation
- Database: Mongoose schema validation
- Types: TypeScript for frontend type safety
- Sanitization: Prevent XSS, SQL injection

**Implementation:**
```javascript
// API validation
app.post('/api/v1/incidents',
  body('h3Index').isString().matches(/^[0-9a-f]+$/),
  body('severity').isIn(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
);

// Database validation
const incidentSchema = new mongoose.Schema({
  h3Index: { type: String, required: true, match: /^[0-9a-f]+$/ },
  severity: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'], required: true },
});
```

---

### Idempotency
**Principle:** Safe retry of operations

**Application in Metabolic City:**
- Incident dispatch: Check if already dispatched before creating
- Field crew actions: Check current state before transition
- Idempotency keys for external API calls
- Retry-safe operations

**Implementation:**
```javascript
// Idempotent incident dispatch
async function dispatchIncident(h3Index) {
  const existing = await Incident.findOne({ h3Index, status: 'DISPATCHED' });
  if (existing) {
    return existing; // Return existing instead of creating duplicate
  }
  return await Incident.create({ h3Index, status: 'DISPATCHED' });
}
```

---

### Data Consistency
**Principle:** Eventual consistency for distributed operations

**Application in Metabolic City:**
- Current: Single database (strong consistency)
- Future: Eventual consistency for:
  - Cross-shard operations
  - Microservice communication
  - Cache invalidation
- Event sourcing for audit trail

**Implementation Plan:**
```javascript
// Future: Event sourcing
await EventStore.create({
  type: 'INCIDENT_DISPATCHED',
  data: { h3Index, operatorId, timestamp },
  version: 1,
});
```

---

### Backup Strategy
**Principle:** Automated backups with point-in-time recovery

**Application in Metabolic City:**
- Current: MongoDB Atlas automated backups (daily)
- Retention: 7 days (development), 30 days (production)
- Point-in-time recovery: 10-minute windows
- Backup verification: Monthly restore tests

**Implementation:**
```javascript
// MongoDB Atlas backup configuration
{
  backupPolicy: {
    retentionDays: 30,
    pointInTimeWindow: 600, // 10 minutes
    schedule: {
      daily: { hour: 2, minute: 0 },
    },
  }
}
```

---

## Real-Time Processing Principles

### Event-Driven Architecture
**Principle:** Publish-subscribe for real-time events

**Application in Metabolic City:**
- Current: SSE for cell updates
- Future: Event bus for:
  - Weather updates → Cell risk recalculation
  - Transit delays → Cell risk recalculation
  - Incident dispatch → Field crew notification
  - Field crew actions → Operator notification

**Implementation Plan:**
```javascript
// Future: Event bus
const eventBus = new EventEmitter();

eventBus.on('weather-updated', (data) => {
  recalculateCellRisk(data.h3Index);
});

eventBus.emit('weather-updated', { h3Index: '883d914f17fffff', temperature: 30 });
```

---

### Ordered Processing
**Principle:** Message queues for guaranteed order

**Application in Metabolic City:**
- Current: In-memory processing (development)
- Future: Message queue (BullMQ/RabbitMQ) for:
  - Telemetry ingestion (ordered by timestamp)
  - Incident dispatch (FIFO queue)
  - Field crew notifications (priority queue)

**Implementation Plan:**
```javascript
// Future: Message queue
const telemetryQueue = new Queue('telemetry');

await telemetryQueue.add('process-telemetry', {
  h3Index: '883d914f17fffff',
  timestamp: Date.now(),
  data: { ... },
}, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
```

---

### Backpressure Handling
**Principle:** Rate limiting to prevent system overload

**Application in Metabolic City:**
- Current: Express rate limiter (300 req/min)
- Future: Queue-based backpressure:
  - Reject new telemetry when queue full
  - Drop old events when processing lag
  - Load shedding for non-critical operations

**Implementation Plan:**
```javascript
// Future: Backpressure handling
if (queue.size > MAX_QUEUE_SIZE) {
  return res.status(429).json({ error: 'System overloaded, please retry later' });
}
```

---

### State Synchronization
**Principle:** Optimistic updates with conflict resolution

**Application in Metabolic City:**
- Current: Server-side state (MongoDB)
- Future: Optimistic UI updates:
  - Update UI immediately on user action
  - Revert on server error
  - Conflict detection with version numbers

**Implementation Plan:**
```javascript
// Future: Optimistic updates
function onCellClick(cell) {
  // Optimistic update
  setSelectedCell(cell);
  
  // Server call
  fetchCellDetails(cell.h3Index)
    .then(data => setSelectedCell(data))
    .catch(() => setSelectedCell(null)); // Revert on error
}
```

---

### Latency Awareness
**Principle:** SLA monitoring for real-time pipelines

**Application in Metabolic City:**
- Current: No SLA monitoring
- Future: Monitor and alert on:
  - Weather API latency (> 5s)
  - H3 cell calculation latency (> 1s)
  - SSE delivery latency (> 2s)
  - Database query latency (> 100ms)

**Implementation Plan:**
```javascript
// Future: Latency monitoring
const start = Date.now();
await fetchWeather(city);
const latency = Date.now() - start;
if (latency > 5000) {
  alert('Weather API latency exceeded SLA');
}
```

---

## Spatial Intelligence Principles

### H3 Hierarchical Analysis
**Principle:** Multi-resolution spatial queries

**Application in Metabolic City:**
- Current: Resolution 8 (street-level)
- Future: Multi-resolution analysis:
  - Resolution 6: Neighborhood-level aggregation
  - Resolution 4: City-level aggregation
  - Drill-down from city → neighborhood → street

**Implementation Plan:**
```javascript
// Future: Multi-resolution analysis
function getNeighborhoodRisk(h3Index) {
  const parentH3 = h3.h3ToParent(h3Index, 6);
  const children = h3.h3ToChildren(parentH3, 8);
  return aggregateRisk(children);
}
```

---

### Geospatial Indexing
**Principle:** Efficient spatial queries and joins

**Application in Metabolic City:**
- Current: H3 index in database (string field)
- Future: Geospatial indexing:
  - MongoDB 2dsphere index for coordinate queries
  - H3 index for hexagon queries
  - Spatial joins between cells and incidents

**Implementation Plan:**
```javascript
// Future: Geospatial index
spatialCellSchema.index({ location: '2dsphere' });

// Spatial query
const nearbyCells = await SpatialCell.find({
  location: {
    $near: {
      $geometry: { type: 'Point', coordinates: [lon, lat] },
      $maxDistance: 1000, // 1km
    }
  }
});
```

---

### Temporal-Spatial Correlation
**Principle:** Time-based pattern analysis

**Application in Metabolic City:**
- Current: Current risk score only
- Future: Temporal-spatial analysis:
  - Risk trends over time per cell
  - Seasonal patterns (monsoon vs dry season)
  - Time-of-day patterns (rush hour vs night)
  - Event-based patterns (festivals, holidays)

**Implementation Plan:**
```javascript
// Future: Temporal-spatial analysis
function analyzeTemporalPattern(h3Index) {
  const history = await SpatialCell.find({ h3Index })
    .sort({ lastUpdated: -1 })
    .limit(90); // 90 days of history
  
  return {
    trend: calculateTrend(history),
    seasonality: detectSeasonality(history),
    patterns: detectPatterns(history),
  };
}
```

---

### Neighbor Awareness
**Principle:** Spatial autocorrelation in risk calculations

**Application in Metabolic City:**
- Current: Independent cell risk calculation
- Future: Neighbor-aware risk:
  - Cascade risk from neighbors
  - Spatial smoothing (reduce noise)
  - Containment (isolate high-risk areas)

**Implementation Plan:**
```javascript
// Future: Neighbor-aware risk
function calculateNeighborAwareRisk(h3Index) {
  const neighbors = h3.kRing(h3Index, 1); // 1-ring neighbors
  const neighborRisks = await Promise.all(
    neighbors.map(n => SpatialCell.findOne({ h3Index: n }))
  );
  
  const avgNeighborRisk = average(neighborRisks);
  const cascadeRisk = detectCascade(neighborRisks);
  
  return compositeRisk + (cascadeRisk * 0.2);
}
```

---

### Grid Optimization
**Principle:** Dynamic resolution based on data density

**Application in Metabolic City:**
- Current: Fixed resolution 8
- Future: Dynamic resolution:
  - High-density areas: Resolution 9 (more granular)
  - Low-density areas: Resolution 7 (less granular)
  - Adaptive based on incident frequency

**Implementation Plan:**
```javascript
// Future: Dynamic resolution
function getOptimalResolution(h3Index) {
  const incidentCount = await Incident.count({ h3Index });
  if (incidentCount > 10) return 9; // High activity
  if (incidentCount > 5) return 8;  // Medium activity
  return 7;                          // Low activity
}
```

---

## AI/ML Integration Principles

### Human-in-the-Loop
**Principle:** AI assists, humans decide

**Application in Metabolic City:**
- Current: Manual decision-making
- Future: AI-assisted decisions:
  - AI suggests dispatch priority
  - AI recommends resource allocation
  - AI provides context from historical data
  - Human makes final decision

**Implementation Plan:**
```javascript
// Future: AI-assisted dispatch
const aiRecommendation = await ai.suggestDispatchPriority(cell);
return {
  ai: aiRecommendation,
  human: operatorDecision,
  final: combine(aiRecommendation, operatorDecision),
};
```

---

### Explainability
**Principle:** Transparent AI decision-making

**Application in Metabolic City:**
- Current: No AI integration
- Future: Explainable AI:
  - Risk factors breakdown (why is this cell critical?)
  - Feature importance (what factors contribute most?)
  - Similar historical incidents (why this action is recommended?)
  - Confidence scores (how certain is the AI?)

**Implementation Plan:**
```javascript
// Future: Explainable AI
const aiAnalysis = await ai.analyzeCell(cell);
return {
  risk: 8.5,
  factors: {
    mobility: { value: 9.0, importance: 0.4, reason: 'High transit delays' },
    climate: { value: 8.5, importance: 0.3, reason: 'Heavy rainfall' },
    vulnerability: { value: 7.5, importance: 0.3, reason: 'Dense population' },
  },
  similarIncidents: [...],
  confidence: 0.85,
};
```

---

### Fallback Mechanisms
**Principle:** Manual override when AI fails

**Application in Metabolic City:**
- Current: No AI integration
- Future: AI with fallback:
  - AI failure → Manual playbook
  - AI timeout → Use last known good recommendation
  - AI confidence low → Flag for human review
  - Always allow manual override

**Implementation Plan:**
```javascript
// Future: AI with fallback
let recommendation;
try {
  recommendation = await ai.suggestAction(cell);
  if (recommendation.confidence < 0.7) {
    recommendation = await fallbackPlaybook(cell);
  }
} catch (error) {
  recommendation = await fallbackPlaybook(cell);
}
```

---

### Continuous Learning
**Principle:** Feedback loops for model improvement

**Application in Metabolic City:**
- Current: No AI integration
- Future: Continuous learning:
  - Track AI recommendations vs human decisions
  - Learn from successful resolutions
  - Update models based on feedback
  - A/B test different strategies

**Implementation Plan:**
```javascript
// Future: Continuous learning
await AIFeedback.create({
  cellId: cell.h3Index,
  aiRecommendation: { priority: 'HIGH', action: 'dispatch' },
  humanDecision: { priority: 'CRITICAL', action: 'dispatch' },
  outcome: 'resolved',
  timestamp: new Date(),
});
```

---

### Ethical AI
**Principle:** Fair, unbiased, and transparent AI systems

**Application in Metabolic City:**
- Current: No AI integration
- Future: Ethical AI:
  - Fair resource allocation across neighborhoods
  - No bias in risk scoring
  - Transparent decision-making
  - Privacy-preserving data collection
  - Regular bias audits

**Implementation Plan:**
```javascript
// Future: Bias audit
function auditFairness() {
  const dispatchesByNeighborhood = groupBy(incidents, 'neighborhood');
  const fairnessScore = calculateGini(dispatchesByNeighborhood);
  if (fairnessScore > 0.3) {
    alert('Potential bias detected in resource allocation');
  }
}
```

---

## Conclusion

These system design principles guide the architectural decisions for Metabolic City. They ensure the platform is:

- **Scalable:** Handles growth in users, data, and complexity
- **Reliable:** Operates consistently even under failure
- **Secure:** Protects data and maintains trust
- **Performant:** Fast and efficient user experience
- **Maintainable:** Easy to understand, modify, and extend
- **Usable:** Intuitive and accessible to all users
- **Data-Integrity:** Accurate and consistent data
- **Real-Time:** Responsive to live events
- **Spatially-Intelligent:** Leverages H3 for spatial analysis
- **AI-Ready:** Prepared for advanced AI/ML integration

These principles will be referenced when implementing advanced features (H3 Cell Memory, RAG, LangGraph) after November 15, 2026.

---

**Document Version:** 1.0  
**Last Updated:** October 8, 2026  
**Next Review:** November 15, 2026 (before AI feature implementation)
