# Production Deployment

This project deploys without Docker:

- Backend: Render Node web service from `render.yaml`
- Frontend: Vercel project rooted at `frontend/`
- Database: MongoDB Atlas

## Render backend

Create the service from the repository. Render reads `render.yaml`, runs `npm ci` in `backend/`, starts `npm start`, and checks `/health`.

Set these required variables in Render:

```text
MONGO_URI
MONGODB_DB_NAME
JWT_SECRET
CORS_ORIGINS=https://your-vercel-domain.vercel.app
```

Set optional variables only when the corresponding integrations are configured:

```text
OPENWEATHER_API_KEY
OPENWEATHER_POINTS
GTFS_RT_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

Render terminates HTTPS before forwarding to Node. The backend trusts one proxy hop, emits HSTS in production, and refuses non-TLS MongoDB connections.

## Vercel frontend

Create a Vercel project with `frontend` as the Root Directory. Vercel detects Vite automatically. Set:

```text
VITE_API_URL=https://your-render-service.onrender.com/api
```

The same setting is documented in `frontend/.env.example`.

`frontend/vercel.json` keeps client-side React routes working on refresh and adds browser security headers.

After deployment, update Render's `CORS_ORIGINS` to the final Vercel URL and verify:

```text
https://your-render-service.onrender.com/health
https://your-vercel-domain.vercel.app/
```

## Monitoring

Render should alert on elevated HTTP 5xx responses, restart loops, and sustained memory/CPU pressure. The repository also includes `monitoring/cloud-monitoring-policy.yaml` as a reference for a five-minute 1% 5xx alert; Cloud Run-specific metrics do not apply to Render.

## Phase 6 handoff checklist

1. Add production secrets only in Render and Vercel dashboards.
2. Set the final Vercel origin in `CORS_ORIGINS`.
3. Confirm MongoDB Atlas network access allows Render outbound connections.
4. Call `/health` and confirm `status: healthy`.
5. Create one operator, field crew, and administrator account.
6. Run the synthetic seed only in a non-production database.
7. Test telemetry ingestion, SSE, critical-cell approval, field sync, and admin weight dry-run.
8. Configure Render alerts and an email/pager notification channel.

## Application routes

After authentication, the completed role experiences are available at:

```text
/operator   H3 map console, live stream, critical action drawer
/field      Offline-capable field task console and status sync
/admin      Risk weights, dry-run simulation, and municipal users
/analytics  Incident history and audit trail for operators/admins
```

The frontend uses OpenStreetMap tiles without a map token. Replace the tile provider only if your deployment requires a different tile service or usage policy.