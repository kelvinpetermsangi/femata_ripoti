# FEMATA Ripoti Deployment Guide

This app can be deployed as a single FastAPI service because the backend already serves the built frontend from `frontend/dist`.

## Production checklist

1. Install Python 3.11+ and Node.js 18+ on the target machine.
2. Clone the repository.
3. Copy `backend/.env.example` to `backend/.env` and set real values.
4. Build the production bundle.
5. Start the backend service.
6. Put the app behind HTTPS if it will be exposed publicly.

## Environment variables

Create `backend/.env` with at least these values:

```env
FEMATA_ADMIN_USERNAME=admin
FEMATA_ADMIN_PASSWORD=change-this-password
FEMATA_ADMIN_SESSION_IDLE_MINUTES=30
FEMATA_ADMIN_COOKIE_SECURE=1
FEMATA_APP_TIMEZONE=Africa/Dar_es_Salaam
FEMATA_MICHELLE_PROVIDER=local
DEEPSEEK_API_KEY=
DEEPSEEK_CHAT_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_TIMEOUT_SECONDS=45
```

Notes:

- Set `FEMATA_ADMIN_COOKIE_SECURE=1` in production when the app is served over HTTPS.
- Leave `DEEPSEEK_API_KEY` empty only if you do not need the AI-backed features.
- The backend loads both `backend/.env` and `backend/.env.local`.

## Windows deployment

Build everything:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-production.ps1
```

Start the app:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-production.ps1
```

Optional parameters:

- `-BindHost 127.0.0.1`
- `-Port 8000`
- `-EnableSecureAdminCookie`

## Linux or macOS deployment

If you are deploying on Linux or macOS, run the equivalent commands manually:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

cd ../frontend
npm ci
npm run build

cd ../backend
. .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Health check

After the service starts, verify it with:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Reverse proxy

For public deployment, place the app behind Nginx, Caddy, IIS, or another reverse proxy that terminates HTTPS and forwards traffic to the FastAPI process on port `8000`.

Recommended setup:

- Public HTTPS endpoint -> reverse proxy
- Reverse proxy -> `http://127.0.0.1:8000`
- `FEMATA_ADMIN_COOKIE_SECURE=1`

## Updating after a new Git push

```powershell
git pull
powershell -ExecutionPolicy Bypass -File .\scripts\build-production.ps1
```

Then restart the FastAPI service or process manager.
