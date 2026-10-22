# Metabolic City - Deployment Guide

This guide explains how to deploy the Metabolic City application with:
- **Frontend:** Vercel
- **Backend:** Render
- **Database:** MongoDB Atlas
- **Local Development:** Localhost

---

## 📋 Prerequisites

1. **MongoDB Atlas Account** - Free tier available
2. **Render Account** - Free tier available
3. **Vercel Account** - Free tier available
4. **GitHub Account** - For deployment from git

---

## 🚀 Deployment Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Vercel        │         │   Render        │
│   (Frontend)    │◄────────┤   (Backend)     │
│   React/Vite    │         │   Node/Express  │
└─────────────────┘         └────────┬────────┘
                                     │
                                     ▼
                              ┌─────────────────┐
                              │  MongoDB Atlas  │
                              │  (Database)     │
                              └─────────────────┘
```

---

## 🔧 Step 1: Backend Deployment (Render)

### 1.1 Push Code to GitHub

Ensure your code is pushed to GitHub:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 1.2 Create Render Service

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:

**Basic Settings:**
- **Name:** `metabolic-city-api`
- **Branch:** `main`
- **Root Directory:** `backend`
- **Runtime:** `Node`
- **Build Command:** `npm ci`
- **Start Command:** `npm start`

**Environment Variables:**

Add these environment variables in Render:

```bash
# Server Configuration
NODE_ENV=production
PORT=5000

# MongoDB Configuration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/metabolic_city?retryWrites=true&w=majority
MONGODB_DB_NAME=metabolic_city

# JWT Configuration
JWT_SECRET=your-strong-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS Configuration
# IMPORTANT: Add your Vercel URL here after deploying frontend
CORS_ORIGINS=http://localhost:5173,https://your-vercel-app.vercel.app

# Frontend URL for QR Code Generation
FRONTEND_URL=https://your-vercel-app.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300

# Risk Configuration
DEFAULT_RISK_THRESHOLD=7.0

# Weather API Configuration (Open-Meteo - FREE)
WEATHER_API_PROVIDER=openmeteo
OPENMETEO_BASE_URL=https://api.open-meteo.com/v1
WEATHER_SYNTHETIC_FALLBACK_ENABLED=false

# Cities Configuration
PRIMARY_CITY=bhopal
CITIES=bhopal,indore,sehore

# City Coordinates
BHOPAL_LAT=23.2599
BHOPAL_LON=77.4126
INDORE_LAT=22.7196
INDORE_LON=75.8577
SEHORE_LAT=23.2080
SEHORE_LON=77.0816

# Transit Configuration
TRANSIT_SIMULATION_ENABLED=false
TOMTOM_API_KEY=your-tomtom-key
TOMTOM_SERVICE_KEY=your-tomtom-service-key
TOMTOM_FLOW_MONTHLY_LIMIT=20000
TOMTOM_INCIDENT_MONTHLY_LIMIT=2500
TRAFFIC_PROBES_PER_CITY=20
TRAFFIC_POLL_MINUTES=60
OPENMETEO_MONTHLY_LIMIT=8000

# OSM Configuration
OSM_USER_AGENT=MetabolicCity/1.0 (urban risk operations; contact you@example.org)
OSM_NETWORK_RADIUS_DEG=0.08
OSM_NETWORK_REFRESH_DAYS=30

# Pipeline Configuration
PIPELINE_CYCLE_MINUTES=10
PIPELINE_ENABLED=true

# H3 Configuration
H3_RESOLUTION=8

# Risk Weights (must sum to 1.0)
WEIGHT_MOBILITY=0.4
WEIGHT_CLIMATE=0.3
WEIGHT_VULNERABILITY=0.3

# Redis (Optional - set to false for free tier)
REDIS_ENABLED=false
REDIS_URL=redis://localhost:6379
```

### 1.3 Deploy

Click **"Create Web Service"** and wait for deployment.

After deployment, Render will provide a URL like:
```
https://metabolic-city-api.onrender.com
```

**Copy this URL** - you'll need it for the frontend deployment.

---

## 🎨 Step 2: Frontend Deployment (Vercel)

### 2.1 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure the project:

**Framework Preset:** Vite
**Root Directory:** `frontend`
**Build Command:** `npm run build`
**Output Directory:** `dist`

### 2.2 Add Environment Variables

In Vercel, add this environment variable:

```bash
# IMPORTANT: Use your Render backend URL here
VITE_API_URL=https://metabolic-city-api.onrender.com/api
```

### 2.3 Deploy

Click **"Deploy"** and wait for deployment.

After deployment, Vercel will provide a URL like:
```
https://metabolic-city.vercel.app
```

### 2.4 Update Backend CORS

**IMPORTANT:** After getting your Vercel URL, go back to Render and update:

1. Go to your Render service
2. Click **"Environment"**
3. Update `CORS_ORIGINS` to include your Vercel URL:
   ```
   CORS_ORIGINS=http://localhost:5173,https://metabolic-city.vercel.app
   ```
4. Update `FRONTEND_URL`:
   ```
   FRONTEND_URL=https://metabolic-city.vercel.app
   ```
5. Click **"Save Changes"** (this will trigger a redeploy)

---

## 💻 Step 3: Local Development Setup

### 3.1 Backend Local Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. Update `.env` for local development:
   ```bash
   # MongoDB Configuration
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/metabolic_city?retryWrites=true&w=majority
   MONGODB_DB_NAME=metabolic_city

   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # CORS Configuration - for local development
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000

   # Frontend URL for QR Code generation
   FRONTEND_URL=http://localhost:5173

   # ... rest of the configuration from .env.example
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start backend server:
   ```bash
   npm run dev
   ```

Backend will run at: `http://localhost:5000`

### 3.2 Frontend Local Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

3. Update `.env` for local development:
   ```bash
   # For local development - use localhost backend
   VITE_API_URL=http://localhost:5000/api
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start frontend dev server:
   ```bash
   npm run dev
   ```

Frontend will run at: `http://localhost:5173`

---

## 🔄 Switching Between Local and Production

### Using Local Development

**Backend (.env):**
```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:5000/api
```

### Using Production (Vercel + Render)

**Backend (Render Environment Variables):**
```bash
CORS_ORIGINS=http://localhost:5173,https://your-vercel-app.vercel.app
FRONTEND_URL=https://your-vercel-app.vercel.app
```

**Frontend (Vercel Environment Variables):**
```bash
VITE_API_URL=https://your-render-service.onrender.com/api
```

---

## 📝 Environment Variables Summary

### Backend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `MONGO_URI` | ✅ | MongoDB connection string | `mongodb+srv://...` |
| `MONGODB_DB_NAME` | ✅ | Database name | `metabolic_city` |
| `PORT` | ✅ | Server port | `5000` |
| `NODE_ENV` | ✅ | Environment | `production` |
| `JWT_SECRET` | ✅ | JWT secret key | `your-secret-key` |
| `JWT_EXPIRES_IN` | ✅ | JWT expiration | `7d` |
| `CORS_ORIGINS` | ✅ | Allowed origins | `http://localhost:5173,https://your-app.vercel.app` |
| `FRONTEND_URL` | ✅ | Frontend URL for QR codes | `https://your-app.vercel.app` |
| `WEATHER_SYNTHETIC_FALLBACK_ENABLED` | ✅ | Use synthetic weather fallback | `false` |
| `REDIS_ENABLED` | ❌ | Enable Redis | `false` |

### Frontend Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | ✅ | Backend API URL | `http://localhost:5000/api` (local) or `https://your-api.onrender.com/api` (prod) |

---

## 🔍 Important Notes

### CORS Configuration

The CORS configuration in `backend/src/server.js` uses the `CORS_ORIGINS` environment variable to allow requests from specific origins:

```javascript
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
```

**Always include both localhost and production URLs in `CORS_ORIGINS`** if you want to test locally while deployed.

### API URL Configuration

The frontend uses `VITE_API_URL` from `frontend/src/api.js`:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
```

**Key points:**
- Vite automatically exposes variables starting with `VITE_` to the client
- The variable must include the full URL with `/api` suffix
- Changes to `.env` require restarting the dev server

### QR Code Generation

The backend uses `FRONTEND_URL` to generate QR codes that open the citizen report form. Ensure this is set correctly for your environment.

---

## 🛠️ Troubleshooting

### Issue: CORS Errors

**Solution:** Check that your frontend URL is included in the backend's `CORS_ORIGINS` environment variable.

### Issue: API 404 Errors

**Solution:** Ensure `VITE_API_URL` in the frontend includes the `/api` suffix and matches your backend URL.

### Issue: QR Codes Don't Work

**Solution:** Check that `FRONTEND_URL` in the backend matches your deployed frontend URL.

### Issue: MongoDB Connection Errors

**Solution:** Ensure your MongoDB Atlas IP whitelist includes:
- Your local IP (for development)
- Render's IP ranges (for production)

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] MongoDB Atlas cluster created
- [ ] Backend deployed to Render with all environment variables
- [ ] Frontend deployed to Vercel with `VITE_API_URL` set
- [ ] Backend `CORS_ORIGINS` updated with Vercel URL
- [ ] Backend `FRONTEND_URL` updated with Vercel URL
- [ ] Test deployed application
- [ ] Test local development with different `.env` files

---

**Happy Deploying! 🚀**
