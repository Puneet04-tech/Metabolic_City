# Metabolic City AI - Urban Intelligence Platform

A software-first urban intelligence command system for municipal operations, field survey management, and real-time incident response. Built for Bhopal, Sehore, and Ashta municipalities in Madhya Pradesh, India.

**Latest Commit:** `9c263d4 preparation for deployment` (2026-10-22)

## 🎯 Project Overview

Metabolic City AI is an integrated platform that enables:
- **Municipal Staff Management** - Role-based access for operators, field crews, and administrators
- **Field Survey Operations** - Structured data collection for municipal and public surveys
- **Real-time Incident Response** - GPS-tagged reporting with photo evidence
- **Cross-jurisdiction Data Sharing** - Coordinated operations across municipal boundaries
- **AI-powered Risk Assessment** - Dynamic risk weights and guardrails for urban infrastructure
- **Live H3 Telemetry** - Transit, weather, and citizen events mapped to resolution-8 cells
- **Distributed WebSocket Streaming** - Multi-pod real-time updates across all connected server instances
- **Async Telemetry Ingestion** - O(1) API response with background job processing
- **Citizen QR Code Reporting** - Public QR code reporting system for community engagement

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js + Express.js
- MongoDB Atlas (with TLS encryption)
- JWT Authentication
- Redis Pub/Sub for distributed WebSocket
- BullMQ for async job processing
- Helmet, CORS, rate limiting middleware
- bcryptjs for password hashing

**Frontend:**
- React 18 + Vite
- React Router DOM
- H3-js for geospatial processing
- Custom CSS styling with design tokens

**Development:**
- Concurrently for multi-process management
- Jest for testing
- ES Modules throughout

### Project Structure

```
Metabolic_City/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js              # MongoDB connection with retry logic
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT auth & role-based authorization
│   │   │   ├── auditLog.js        # Comprehensive audit logging
│   │   │   ├── idempotency.js     # Idempotency middleware
│   │   │   ├── latencyMonitor.js  # Performance monitoring
│   │   │   └── circuitBreaker.js  # External API circuit breaker
│   │   ├── models/
│   │   │   ├── User.js            # User schema with role-specific fields
│   │   │   ├── TelemetryEvent.js  # Raw telemetry time-series events
│   │   │   ├── SpatialCell.js     # H3 risk grid state with cityCode
│   │   │   └── DeadLetterMessage.js # Invalid telemetry retention
│   │   ├── engine/
│   │   │   ├── risk.js            # H3 normalization and deterministic scoring
│   │   │   └── stream.js           # SSE broadcaster
│   │   ├── routes/
│   │   │   ├── auth.js            # Authentication endpoints
│   │   │   ├── telemetry.js       # Transit, weather, citizen ingestion
│   │   │   ├── stream.js          # H3 SSE stream
│   │   │   ├── spatialCells.js    # Live risk-cell snapshots
│   │   │   └── spatialAnalysis.js # Multi-resolution spatial analysis
│   │   ├── services/
│   │   │   ├── cacheService.js     # Redis caching service
│   │   │   ├── dataPipeline.js     # Open-Meteo + Simulated Transit pipeline
│   │   │   ├── streamManager.js    # Distributed WebSocket server
│   │   │   └── spatialAnalysis.js # Spatial intelligence service
│   │   ├── queues/
│   │   │   ├── jobQueue.js        # BullMQ job queue
│   │   │   └── telemetryQueue.js  # Telemetry processing queue
│   │   ├── workers/
│   │   │   └── telemetryWorker.js # Background telemetry processor
│   │   ├── utils/
│   │   │   ├── transactions.js    # ACID transaction utilities
│   │   │   └── dataConsistency.js # Event sourcing, Saga, CQRS
│   │   └── scripts/
│   │       ├── seedSyntheticTelemetry.js
│   │       └── purgeSimulatedTelemetry.js
│   ├── .env                       # Environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main React application with route guards
│   │   ├── RequireAuth.jsx        # Route protection component
│   │   ├── api.js                 # API client with session management
│   │   ├── main.jsx               # React entry point
│   │   ├── lib/
│   │   │   ├── useOptimisticUpdate.js # Optimistic UI updates
│   │   │   ├── useLiveCells.js    # Live cell data management
│   │   │   └── routes.js          # Route configuration
│   │   ├── components/
│   │   │   ├── system/           # System components
│   │   │   ├── shared/           # Shared components
│   │   │   ├── Operator/         # Operator console components
│   │   │   ├── Field/            # Field crew components
│   │   │   └── Admin/            # Admin components
│   │   ├── pages/                # Page components
│   │   └── styles/              # CSS styles
│   ├── index.html
│   └── package.json
├── metabolic_city_documents/     # Project documentation
├── *.xlsx                         # Survey data files
├── package.json                   # Root package.json
├── render.yaml                    # Render deployment configuration
├── DEPLOYMENT.md                  # Detailed deployment guide
└── .env.example                   # Environment template
```

## 🔐 Authentication & Authorization

### User Roles

1. **Operator** (`operator`)
   - Console-based municipal staff
   - Authenticated via Staff ID + Password
   - Manages dispatch operations

2. **Field Crew** (`field_crew`)
   - Mobile field personnel
   - Authenticated via Phone + SMS Passcode
   - Submits field reports with GPS/photos

3. **Administrator** (`administrator`)
   - System administrators
   - Authenticated via Admin ID + Hardware Token
   - Full system access and configuration

### Security Features (7-Layer Defense)

- **Layer 1: HTTP Headers (Helmet.js)** - CSP, HSTS, X-Frame-Options
- **Layer 2: CORS Configuration** - Strict origin allow-list
- **Layer 3: Rate Limiting** - Global API protection
- **Layer 4: JWT Authentication** - Token-based auth with refresh tokens
- **Layer 5: Role-Based Authorization** - Role-specific access control
- **Layer 6: Input Validation** - Express-validator middleware
- **Layer 7: Error Handling** - Centralized error handler with sanitization

### Additional Security

- **Audit Logging** - Comprehensive API call logging
- **Idempotency** - Safe retry of operations
- **Circuit Breakers** - External API failure protection
- **Secrets Management** - Environment variable-based configuration
- **Sanitization** - Sensitive data redaction in logs

## 📊 Survey Data Structure

### Municipal Survey

**File:** `MetabolicCity_AI_Municipal_Survey_FILLED.xlsx`

**Sheets:**
- **Municipal Survey Form** - Staff responses covering:
  - Department (Drainage, Traffic, Water Supply)
  - Communication channels & frequency
  - Operational blind spots
  - Reporting methods & response times
  - Risk assessment & AI guardrails
  - Resolution preferences

- **Municipal Evidence Summary** - Cross-city comparison (Bhopal, Sehore, Ashta)
- **Official Source Register** - Government data sources and references

### Public & Corridor Survey

**File:** `MetabolicCity_AI_Public_and_Corridor_Survey_FILLED.xlsx`

**Sheets:**
- **Public Survey** - Citizen responses including:
  - Transport patterns & delays
  - Flood routing & diversion data
  - Emergency access observations
  - Infrastructure risk assessments
  - Cross-jurisdiction data sharing needs

- **Public Survey Insights** - Aggregated metrics by location
- **Location Summary** - City-specific averages and focus areas

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (with TLS enabled)
- Redis 6+ (for distributed WebSocket)
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Metabolic_City
```

2. **Install dependencies**
```bash
npm install
npm run build --prefix frontend
cd backend && npm install
```

3. **Configure environment variables**

Copy `.env.example` to `backend/.env` and configure:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB (Required - must use TLS)
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/metabolic_city?retryWrites=true&w=majority
MONGODB_DB_NAME=metabolic_city
MONGODB_MAX_POOL_SIZE=10
MONGODB_SERVER_SELECTION_TIMEOUT_MS=30000
MONGODB_SOCKET_TIMEOUT_MS=45000
MONGODB_CONNECT_TIMEOUT_MS=20000

# JWT (Required - generate strong secret)
JWT_SECRET=<generate-with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=7d

# CORS (Update after deployment)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300

# Redis (Required for distributed WebSocket)
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379

# Security
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=your-twilio-phone-number

# Optional integrations
OPENWEATHER_API_KEY=your-openweather-key
GTFS_RT_URL=https://your-transit-feed.com/gtfs-rt
```

4. **Generate JWT Secret**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

5. **Start development servers**
```bash
npm run dev
```

This starts both backend (port 5000) and frontend (port 5173) concurrently.

### Available Scripts

- `npm run dev` - Start both backend and frontend in development mode
- `npm run build` - Build frontend for production
- `npm start` - Start backend server only
- `npm run seed:synthetic --prefix backend` - Seed the permitted survey workbooks as marked calibration telemetry
- `npm run test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:watch` - Watch mode for tests
- `npm run test:coverage` - Generate test coverage report

## 📡 API Endpoints

### Core Telemetry API

#### POST `/api/v1/telemetry/citizen`
Public citizen report ingestion. Requires `latitude`, `longitude`, and an ISO timestamp. Optional fields include `reportText`, `senderId`, and `imageUrls`.

#### POST `/api/v1/telemetry/weather`
Authenticated weather ingestion. Accepts rainfall in `rainMmHr`, visibility, and wind data.

#### POST `/api/v1/telemetry/transit`
Authenticated transit ingestion. Accepts vehicle coordinates, route/vehicle IDs, and delay minutes or seconds.

#### POST `/api/v1/telemetry/ingest`
Async telemetry ingestion endpoint (O(1) response time for high-throughput scenarios).

#### GET `/api/v1/spatial-cells`
Returns current resolution-8 H3 cells and their Mobility, Climate, Vulnerability, and composite risk scores.

#### GET `/api/v1/stream/h3`
Authenticated Server-Sent Events stream. Sends an initial snapshot and cell updates whenever telemetry changes a cell.

#### GET `/api/v1/spatial/multi-resolution/:h3Index`
Multi-resolution risk analysis (street-level res 8, neighborhood res 6, city res 4).

#### GET `/api/v1/spatial/neighbor-aware/:h3Index`
Neighbor-aware risk analysis with cascade detection from neighboring cells.

#### GET `/api/v1/spatial/temporal-pattern/:h3Index`
Temporal-spatial pattern analysis (trends, volatility, seasonality, recommendations).

#### GET `/api/v1/spatial/nearby/:h3Index`
Find nearby cells within specified radius (geospatial search with 2dsphere index).

#### GET `/api/v1/spatial/autocorrelation/:h3Index`
Spatial autocorrelation analysis (Moran's I).

### Critical Response API

Critical cells (`R_c >= 7`) expose action synthesis and operator decision APIs:

```text
GET  /api/v1/incidents/:h3Index/action
POST /api/v1/incidents/:h3Index/lock
POST /api/v1/incidents/:h3Index/decision
GET  /api/v1/incidents
```

Locks are stored in MongoDB with a 60-second TTL and prevent duplicate operator decisions. Action narratives, priorities, recommended resources, and dispatch text are generated by the deterministic municipal playbook from the three risk scores. Operators must claim the cell lock before approving or overriding an alert; every decision is persisted as an incident audit record.

### Field and Administration API

Field crew endpoints:

```text
GET  /api/v1/field/tasks
POST /api/v1/field/sync
```

Administrator weight endpoints:

```text
GET  /api/v1/admin/weights
POST /api/v1/admin/weights/dry-run
PUT  /api/v1/admin/weights
```

### Authentication API

#### POST `/api/auth/signup`
Register a new user account.

#### POST `/api/auth/login`
Authenticate existing user.

#### GET `/api/auth/me`
Get current user profile (requires authentication).

#### POST `/api/auth/logout`
Logout and revoke token (requires authentication).

#### GET `/api/auth/admin/status`
Administrator-only endpoint for system status.

### Health Check

#### GET `/health`
System health check with performance metrics and circuit breaker status.

#### GET `/api/health`
API health check with MongoDB, Redis, and service status.

## 🎨 Frontend Routes

- `/` - Authentication page (login/signup)
- `/dashboard` - Protected dashboard (requires authentication)
- `/operator` - Operator console with H3 map and live telemetry
- `/field` - Field crew task management and offline sync
- `/admin` - Administrative controls and risk weight management
- `/analytics` - Analytics dashboard with real-time charts
- `/citizen-report` - Citizen QR code reporting interface

## 🔧 Development Workflow

### Adding New Features

1. **Backend:**
   - Add models in `backend/src/models/`
   - Create routes in `backend/src/routes/`
   - Register routes in `backend/src/server.js`
   - Implement services in `backend/src/services/`
   - Add middleware in `backend/src/middleware/`

2. **Frontend:**
   - Add components in `frontend/src/components/`
   - Update routing in `frontend/src/App.jsx`
   - Add API calls in `frontend/src/api.js`
   - Create hooks in `frontend/src/lib/`

### Database Schema

Current schema includes:

**User Model:**
- Basic fields: name, email, cityCode, role, password
- Role-specific fields: staffId (operator), phone (field_crew), adminId (administrator)
- Timestamps: createdAt, updatedAt
- Active status and jurisdiction support

**SpatialCell Model:**
- H3 index, coordinates, risk scores (Mobility, Climate, Vulnerability, composite)
- CityCode field for organizing cells by municipality
- Geospatial 2dsphere index for efficient spatial queries
- History tracking and temporal-spatial correlation

**TelemetryEvent Model:**
- Raw telemetry time-series data
- H3 cell updates and risk scoring
- Dead Letter Queue integration for failed processing

## 📝 Project Documentation

Detailed documentation available in `metabolic_city_documents/`:

- **PRD** — Product Requirements Document
- **TRD** — Technical Requirements Document  
- **Implementation Plan** — Deployment roadmap
- **Field Survey Blueprint** — Survey methodology for Bhopal, Sehore, Ashta
- **MongoDB Data Architecture** — Database design specifications
- **Production System Workflow** — Operational architecture

## 🌐 Deployment

### Production Deployment

#### Render (Backend)

Create a **Web Service** using `render.yaml`. Render reads the configuration, runs `npm ci` in `backend/`, starts `npm start`, and checks `/health`.

**Environment Variables to Set in Render Dashboard:**

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Already set in `render.yaml` |
| `MONGO_URI` | Your MongoDB Atlas connection string | Must include TLS/SSL and auth source |
| `MONGODB_DB_NAME` | `metabolic_city` | Database name |
| `JWT_SECRET` | 32+ character random string | Generate with Node.js crypto |
| `CORS_ORIGINS` | `https://your-vercel-domain.vercel.app` | Update after Vercel deployment |
| `REDIS_ENABLED` | `true` | Required for distributed WebSocket |
| `REDIS_URL` | Your Redis connection URL | e.g., `redis://your-redis-url` |

**Optional:** Twilio, OpenWeather, GTFS-RT keys

#### Vercel (Frontend)

Create a Vercel project with `frontend/` as the Root Directory. Vercel auto-detects Vite.

**Environment Variable:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-render-service.onrender.com/api` |

### Deployment Checklist

1. ✅ Deploy backend to Render first
2. ✅ Set required environment variables in Render dashboard
3. ✅ Deploy frontend to Vercel
4. ✅ Set `VITE_API_URL` in Vercel dashboard
5. ✅ Update Render's `CORS_ORIGINS` to Vercel URL
6. ✅ Configure Redis for distributed WebSocket
7. ✅ Test health endpoints
8. ✅ Create initial admin and operator accounts
9. ✅ Run synthetic seed in non-production database
10. ✅ Configure monitoring and alerts

### Running Locally

```bash
cd backend
npm install
npm run seed:synthetic  # for synthetic data (development only)
```

```bash
cd ../frontend
npm install
```

```bash
npm run dev  # Starts both backend and frontend
```

## 🔒 Security Considerations

- **Secrets Management:** All secrets in environment variables, never commit `.env` files
- **Authentication:** JWT with refresh tokens and session management
- **Authorization:** Role-based access control (RBAC)
- **Encryption:** TLS for all database connections
- **CORS:** Strict origin allow-list
- **Rate Limiting:** Global and auth endpoint protection
- **Input Validation:** Express-validator middleware
- **Audit Logging:** Comprehensive API call logging
- **Idempotency:** Safe retry of operations
- **Circuit Breakers:** External API failure protection
- **Error Handling:** Centralized error handler without internal leakage
- **Dependency Management:** Regular security updates

## 🤝 Contributing

1. Follow existing code style and SOLID principles
2. Add appropriate error handling with try-catch blocks
3. Include security validation for all user inputs
4. Test authentication flows thoroughly
5. Document new API endpoints with examples
6. Add unit tests for critical functions
7. Include JSDoc documentation

## 📄 License

[Specify your license here]

## 📞 Support

For technical support or questions:
- Review project documentation in `metabolic_city_documents/`
- Check API endpoint documentation
- Verify environment configuration
- Review deployment guide in `DEPLOYMENT.md`
- Check `CITIZEN_QR_REPORTING.md` for QR code reporting system

---

**Metabolic City AI v2.0.0**  
System Engine - MongoDB Atlas Session Cluster  
Distributed WebSocket - BullMQ Background Processing  
Optimized for Production Deployment  
**Latest Update:** 2026-10-22
