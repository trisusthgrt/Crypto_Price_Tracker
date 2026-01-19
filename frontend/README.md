# Frontend (React)

Dashboard UI for:
- live prices (cache-first backend)
- charts
- alert configuration
- in-app notifications

## Run
1. Install deps: `npm install`
2. Start: `npm run dev`

## Backend URL
- In dev, this project proxies `/api` → `http://localhost:5000` (see `vite.config.ts`)
- For deployment, set `VITE_API_BASE_URL` (see `env.example`)
