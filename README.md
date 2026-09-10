# Metabolic City AI - Urban Intelligence Platform

A software-first urban intelligence command system for municipal operations, field survey management, and real-time incident response. Built for Bhopal, Sehore, and Ashta municipalities in Madhya Pradesh, India.

## 🎯 Project Overview

Metabolic City AI is an integrated platform that enables:
- **Municipal Staff Management** - Role-based access for operators, field crews, and administrators
- **Field Survey Operations** - Structured data collection for municipal and public surveys
- **Real-time Incident Response** - GPS-tagged reporting with photo evidence
- **Cross-jurisdiction Data Sharing** - Coordinated operations across municipal boundaries
- **AI-powered Risk Assessment** - Dynamic risk weights and guardrails for urban infrastructure

## 🏗️ Architecture

### Tech Stack

**Backend:**
- Node.js + Express.js
- MongoDB Atlas (with TLS encryption)
- JWT Authentication
- Rate limiting & security middleware (Helmet, CORS)
- bcryptjs for password hashing

**Frontend:**
- React 18
- Vite (build tool)
- React Router DOM
- Custom CSS styling

**Development:**
- Concurrently for multi-process management
- ES Modules throughout

### Project Structure

```
Metabolic_City/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js              # MongoDB connection with retry logic
│   │   ├── middleware/
│   │   │   └── auth.js            # JWT auth & role-based authorization
│   │   ├── models/
│   │   │   └── User.js            # User schema with role-specific fields
│   │   ├── routes/
│   │   │   └── auth.js            # Authentication endpoints
│   │   ├── data/
│   │   │   └── users.json         # Local development data
│   │   └── server.js              # Express server setup
│   ├── .env                       # Environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Main React application
│   │   ├── RequireAuth.jsx        # Route protection component
│   │   ├── api.js                 # API client with session management
│   │   ├── main.jsx               # React entry point
│   │   └── styles.css             # Application styles
│   ├── index.html
│   └── package.json
├── metabolic_city_documents/     # Project documentation
├── *.xlsx                         # Survey data files
├── package.json                   # Root package.json
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

### Security Features

- **JWT-based authentication** with configurable expiration
- **Token revocation** for logout sessions
- **Role-based access control** (RBAC)
- **Rate limiting** (30 requests/15min for auth endpoints)
- **Password requirements**: 8+ chars, 1 letter, 1 number
- **TLS-only MongoDB connections** (enforced)
- **CORS whitelist** for allowed origins
- **Helmet security headers**

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

**Note:** Current data is synthetic calibration/template data. Replace with actual Google Form or field responses before production use.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- MongoDB Atlas account (or local MongoDB with TLS)
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
cd backend && npm install
cd ../frontend && npm install
cd ..
```

3. **Configure environment variables**

Copy `.env.example` to `backend/.env` and configure:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB (Required - must use TLS)
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?tls=true&ssl=true&retryWrites=true
MONGODB_DB_NAME=metabolic_city
MONGODB_MAX_POOL_SIZE=10
MONGODB_SERVER_SELECTION_TIMEOUT_MS=30000
MONGODB_SOCKET_TIMEOUT_MS=45000
MONGODB_CONNECT_TIMEOUT_MS=20000

# JWT (Required - generate strong secret)
JWT_SECRET=<generate-with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
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

## 📡 API Endpoints

### Authentication

#### POST `/api/auth/signup`
Register a new user account.

**Request Body:**
```json
{
  "name": "Full Name",
  "email": "email@example.com",
  "cityCode": "CITY-IND-BPL8",
  "role": "operator|field_crew|administrator",
  "password": "password123",
  "staffId": "OP-8842",        // For operator
  "phone": "+91 9876543210",   // For field_crew
  "adminId": "ADM-SYS-01"      // For administrator
}
```

#### POST `/api/auth/login`
Authenticate existing user.

**Request Body:**
```json
{
  "cityCode": "CITY-IND-BPL8",
  "role": "operator",
  "staffId": "OP-8842",        // Role-specific identifier
  "password": "password123"
}
```

#### GET `/api/auth/me`
Get current user profile (requires authentication).

#### POST `/api/auth/logout`
Logout and revoke token (requires authentication).

#### GET `/api/auth/admin/status`
Administrator-only endpoint example.

### Health Check

#### GET `/api/health`
Check API status.

**Response:**
```json
{
  "status": "ok",
  "message": "Metabolic City API is running."
}
```

## 🎨 Frontend Routes

- `/` - Authentication page (login/signup)
- `/dashboard` - Protected dashboard (requires authentication)

## 🔧 Development Workflow

### Adding New Features

1. **Backend:**
   - Add models in `backend/src/models/`
   - Create routes in `backend/src/routes/`
   - Register routes in `backend/src/server.js`

2. **Frontend:**
   - Add components in `frontend/src/`
   - Update routing in `frontend/src/App.jsx`
   - Add API calls in `frontend/src/api.js`

### Database Schema

Current schema includes User model with:
- Basic fields: name, email, cityCode, role, password
- Role-specific fields: staffId (operator), phone (field_crew), adminId (administrator)
- Timestamps: createdAt, updatedAt

Future schemas will include:
- Municipal Survey responses
- Public Survey responses
- Incident reports
- Risk assessments

## 📝 Project Documentation

Detailed documentation available in `metabolic_city_documents/`:

- **PRD** — Product Requirements Document
- **TRD** — Technical Requirements Document  
- **Implementation Plan** — Deployment roadmap
- **Field Survey Blueprint** — Survey methodology for Bhopal, Sehore, Ashta
- **MongoDB Data Architecture** — Database design specifications
- **Production System Workflow** — Operational architecture

## 🌐 Deployment

### Production Build

1. **Build frontend:**
```bash
npm run build
```

2. **Set production environment:**
```bash
NODE_ENV=production
```

3. **Start backend:**
```bash
npm start
```

### MongoDB Atlas Setup

1. Create MongoDB Atlas cluster
2. Configure IP whitelist
3. Create database user with read/write permissions
4. Copy connection string with TLS enabled
5. Set `MONGO_URI` in environment variables

## 🔒 Security Considerations

- Never commit `.env` files or sensitive credentials
- Use strong, unique JWT secrets (min 32 characters)
- Enable TLS for all database connections
- Configure CORS origins appropriately
- Use rate limiting to prevent abuse
- Implement proper input validation
- Keep dependencies updated

## 🤝 Contributing

1. Follow existing code style and patterns
2. Add appropriate error handling
3. Include security validation for user inputs
4. Test authentication flows thoroughly
5. Document new API endpoints

## 📄 License

[Specify your license here]

## 📞 Support

For technical support or questions:
- Review project documentation in `metabolic_city_documents/`
- Check API endpoint documentation
- Verify environment configuration

---

**Metabolic City AI v1.0.4**  
System Engine - MongoDB Atlas Session Cluster  
Deterministic Safety Logic & Audit Log Enabled
