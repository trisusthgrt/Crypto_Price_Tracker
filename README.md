# Crypto Price Tracker with Alerts

Real-time-ish crypto dashboard (React) + backend poller (Node/Express) with MongoDB caching and in-app alert notifications.

## Run locally

### Backend
1. Go to `backend/`
2. Create `backend/.env` (copy keys from `backend/env.example`)
3. Start:
   - `npm run dev`
4. Health check:
   - `GET /api/health`

### Frontend
1. Go to `frontend/`
2. (Optional) Create `frontend/.env` (copy from `frontend/env.example`)
3. Start:
   - `npm run dev`
4. Open the Vite URL (usually `http://localhost:5173`)

## Sample alert configuration (deliverable)

You can create these from the **Alerts** page:
- **Bitcoin** crosses above `100000` (cooldown 10 min)
- **Ethereum** crosses below `3000` (cooldown 15 min)

### Optional: seed sample alerts automatically

If your database has **no** alerts yet:
- From `backend/` run: `npm run seed:sample`

This creates “near-current-price” alerts (above and below) so they’re likely to trigger soon.

## Sample data (deliverable)

### Chosen strategy: auto-populate on first run (recommended)

No manual seeding is required for price data.

- **On first run**, the backend poller fetches prices and writes:
  - `LatestPrice` (cached latest values)
  - `PricePoint` (bucketed history points for charts)
- Expect data to appear within **1–2 polling intervals** (example: if `POLL_INTERVAL_SECONDS=20`, then ~20–40 seconds).
- Charts need multiple points, so leave the backend running for a few minutes for the chart to look “filled”.

You can verify cache population via:
- `GET /api/prices/latest`
- `GET /api/prices/history?coin=bitcoin&range=24h&bucket=1m`

### Retention notes
- `PricePoint` uses TTL + cleanup to keep MongoDB small (defaults to **7 days** retention).
- `PricePoint` writes are bucketed (defaults to **60s buckets**) to reduce DB growth.

## Deployment (final deliverables)

### 1) MongoDB (Atlas)
- Create an Atlas cluster and DB user.
- Add your backend host to **Network Access** (IP allowlist).
- Copy the `mongodb+srv://...` connection string.

### 2) Deploy backend (Render / Railway / Fly.io)
- Set environment variables (at minimum):
  - `PORT` (platform-specific; some platforms provide it automatically)
  - `MONGODB_URI`
  - `MONGODB_DB_NAME` (optional; recommended if URI has no `/dbName`)
  - `COIN_WATCHLIST=bitcoin,ethereum` (or your preferred ids)
  - `VS_CURRENCY=usd`
  - `POLL_ENABLED=true`
  - `POLL_INTERVAL_SECONDS=20`
  - `CORS_ORIGINS=<your deployed frontend origin>`
- Verify backend after deploy:
  - `GET /api/health` shows `mongoConnected: true` and poller timestamps updating.

### 3) Deploy frontend (Vercel / Netlify)
- Set env var:
  - `VITE_API_BASE_URL=<your deployed backend base url>`
  - (optional) `VITE_NOTIFICATIONS_MODE=sse` if you want realtime toasts from `/api/stream`
- Ensure the backend `CORS_ORIGINS` includes your frontend origin.

### 4) Final verification checklist
- Dashboard shows prices (not “API down”)
- Chart loads history after a few minutes
- Create an alert, then wait for a cross → notification toast + event appears in Notifications
- Mark events read; unread badge updates

