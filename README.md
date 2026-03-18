# FEMATA Ripoti

Jukwaa salama la kuripoti matukio ya madini kwa faragha kamili, lililoundwa kwa wachimba madini wa Tanzania.

## Muundo wa Mradi

```
FEMATA_RIPOTI/
├── backend/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   └── manifest.json
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── ReportPage.tsx
│   │   │   ├── ChatPage.tsx
│   │   │   └── DashboardPage.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
└── README.md
```

## Usanidi

### Backend
1. Nenda kwenye folda ya backend:
   ```
   cd backend
   ```
2. Weka mazingira ya Python:
   ```
   python -m venv venv
   venv\Scripts\activate  # Windows
   ```
3. Sakinisha dependencies:
   ```
   pip install -r requirements.txt
   ```

### Frontend
1. Nenda kwenye folda ya frontend:
   ```
   cd frontend
   ```
2. Sakinisha dependencies:
   ```
   npm install
   ```

## Kuendesha Mradi

### Backend
```
cd backend
venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```
cd frontend
npm run dev
```

Frontend itafungua kwenye `http://localhost:5173` na itaunganisha na backend kwenye `http://localhost:8000`.

## Teknolojia Zilizotumika

- **Frontend**: Vite + React + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python
- **Routing**: React Router
- **Styling**: Tailwind CSS
- **PWA**: Manifest.json tayari kwa usakinishaji

## Deployment

Kwa production deployment, soma [DEPLOYMENT.md](DEPLOYMENT.md).

## Release Tracking

Kwa kufuatilia mabadiliko na version:

- [VERSION.md](VERSION.md)
- [CHANGELOG.md](CHANGELOG.md)

## Android App Shell (Capacitor)

Mradi huu sasa una Android shell ya Capacitor huku web app ikibaki source of truth.

- Mwongozo: [frontend/CAPACITOR_ANDROID.md](frontend/CAPACITOR_ANDROID.md)

Windows helper scripts:

- `powershell -ExecutionPolicy Bypass -File .\scripts\build-production.ps1`
- `powershell -ExecutionPolicy Bypass -File .\scripts\start-production.ps1`
