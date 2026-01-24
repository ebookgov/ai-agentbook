# FastAPI State Manager: Production Deployment Guide

**Target Architecture:**

* **Service:** FastAPI (Python 3.11+)
* **Database:** Supabase (postgres://) - *Managed externally*
* **Cache:** Redis (redis://) - *Managed externally*
* **Secrets:** Google Service Account (JSON), API Keys

---

## 1. Containerization (Docker)

Ensure your `Dockerfile` in `webhook/vapi_fastapi/` is optimized for production.

### `Dockerfile`

```dockerfile
# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set env variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies (if needed for postgres/redis drivers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Command to run (Uvicorn with 4 workers)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### `requirements.txt` Check

Ensure these are present:

```text
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
pydantic-settings
asyncpg>=0.29.0  # Supabase/Postgres
redis>=5.0.1     # Slot locking
aiohttp>=3.9.1   # Google Calendar Async
google-auth>=2.26.2
google-auth-oauthlib>=1.2.0
python-dotenv>=1.0.0
```

---

## 2. Environment Variables (`.env`)

Configure these on your PaaS provider (Railway, Render, AWS).

| Variable | Description | Example / Format |
|----------|-------------|------------------|
| `PORT` | Service port | `8000` |
| `DATABASE_URL` | Supabase Connection String | `postgres://user:pass@host:5432/postgres?sslmode=require` |
| `REDIS_URL` | Redis Connection String | `redis://default:pass@host:6379/0` |
| `AGENT_EMAIL` | Google Calender Account | `agent@your-company.com` |
| `GOOGLE_CREDS_JSON` | **CRITICAL:** Base64 encoded JSON | (See section 3) |
| `VAPI_AUTH_TOKEN` | (Optional) Verification | `your-secret-token` |

---

## 3. Handling Google Credentials Securely

**NEVER** commit `google-creds.json` to Git. Use the Base64 method for PaaS deployment.

### Step A: Encode your JSON

Run this locally:

```bash
# Linux/Mac
base64 -i google-creds.json -o -

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-creds.json"))
```

### Step B: Update Code to Read from Env

Modify `calendar_client.py` to handle raw JSON from env if file is missing.

*We will update valid code in a separate step if not already present, but the deployment pattern is:*

1. Set `GOOGLE_CREDS_JSON` env var with the Base64 string.
2. App decodes it to a temporary file or dictionary at startup.

---

## 4. Deployment: Railway (Recommended)

Railway is easiest for this stack because it provides Redis natively.

1. **Init:** `railway init`
2. **Add Redis:** `railway add` → Select Redis.
3. **Link Repo:** Connect your GitHub repo.
4. **Set Vars:** Copy the variables from Section 2.
5. **Start Command:** Update the start command to decode credentials first:

    ```bash
    echo $GOOGLE_CREDS_JSON | base64 -d > google-creds.json && uvicorn main:app --host 0.0.0.0 --port $PORT
    ```

6. **Deploy:** `railway up`

### Health Check

Verify deployment is successful:
`https://your-app-url.up.railway.app/health`
Expected: `{"status": "ok", "redis": "connected", "database": "connected"}`

---

## 5. Deployment: Render / AWS App Runner

If using Render or AWS, you need a separate Redis provider (e.g., Upstash or AWS ElastiCache).

1. **Build Command:** `pip install -r requirements.txt`
2. **Start Command:** `echo $GOOGLE_CREDS_JSON | base64 -d > google-creds.json && uvicorn main:app --host 0.0.0.0 --port 8000`
3. **Env Vars:** Same as above.

---

## 6. Vapi Configuration

Once deployed, update your Vapi Assistant to point to the live URL.

1. **Tool: checkAvailability**
    * URL: `https://your-app.com/check-availability`
2. **Tool: bookAppointment**
    * URL: `https://your-app.com/book-appointment`

**Important:** Ensure your Vapi server IP is whitelisted if you use strict firewall rules (typically allows all `0.0.0.0` for public webhooks).
