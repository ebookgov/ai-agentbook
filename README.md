# Engage Book Govern - MVP Monorepo

## 🏗️ Architecture
- **Visual ISA (Frontend):** Next.js 14, Tailwind CSS, Framer Motion.
- **HVAC Dispatcher (Backend):** Python FastAPI, Triage Logic.

## 🚀 Quick Start (Local)

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+

### Run Locally
```bash
docker-compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8080](http://localhost:8080)

## ☁️ Deployment (Google Cloud Run)

### Prerequisites
1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. Initialize and login:
   ```bash
   gcloud init
   gcloud auth application-default login
   ```

### One-Click Deploy (Windows)
Run the PowerShell script to deploy both services:
```powershell
.\deploy.ps1
```

### Manual Deployment
**Frontend:**
```bash
gcloud run deploy visual-isa-web --source ./visual-isa-web --platform managed --region us-central1 --allow-unauthenticated --port 3000
```

**Backend:**
```bash
gcloud run deploy hvac-triage-api --source ./hvac-triage-api --platform managed --region us-central1 --allow-unauthenticated --port 8080
```

## 🧪 Verification
To verify the triage logic locally:
```bash
cd hvac-triage-api
venv\Scripts\python tests\verify_triage.py
```
