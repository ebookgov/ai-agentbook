# Deploy Visual ISA (Frontend)
Write-Host "Deploying Visual ISA (Frontend) to ebookgov..."
gcloud run deploy visual-isa-web `
    --source .\visual-isa-web `
    --project ebookgov `
    --platform managed `
    --region us-central1 `
    --allow-unauthenticated `
    --port 3000

# Deploy HVAC Dispatcher (Backend)
Write-Host "Deploying HVAC Dispatcher (Backend) to ebookgov..."
gcloud run deploy hvac-triage-api `
    --source .\hvac-triage-api `
    --project ebookgov `
    --platform managed `
    --region us-central1 `
    --allow-unauthenticated `
    --port 8080

Write-Host "Deployment Complete!"
