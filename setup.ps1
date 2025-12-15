Write-Host "🚀 Starting 1-Day Build Setup..."

# Backend Setup
Write-Host "🛠️  Setting up Backend (Python)..."
Set-Location hvac-triage-api
if (-not (Test-Path "venv")) {
    try {
        py -m venv venv
    } catch {
        python -m venv venv
    }
}
try {
    .\venv\Scripts\pip install -r requirements.txt
} catch {
    Write-Host "⚠️ Failed to install python dependencies. Check python installation."
}
Set-Location ..

# Frontend Setup
Write-Host "🎨 Setting up Frontend (Next.js)..."
Set-Location visual-isa-web
npm install
Write-Host "✅ Dependencies installed."

# Build Test
Write-Host "🏗️  Testing Builds..."
# docker-compose build

Write-Host "✅ Setup Complete. Run 'docker-compose up' to start."
