# deploy_function.ps1
Write-Host "Starting Supabase Deployment for vapi-handler..." -ForegroundColor Cyan

# 1. Link the project (Force to ensure connection)
Write-Host "Linking project rxutdpcbzwmpombmbkkq..."
supabase link --project-ref rxutdpcbzwmpombmbkkq

# 2. Deploy the function
Write-Host "Deploying vapi-handler (No JWT Verification)..."
supabase functions deploy vapi-handler --no-verify-jwt

if ($?) {
    Write-Host "Deployment Successful!" -ForegroundColor Green
} else {
    Write-Host "Deployment Failed. Ensure Supabase CLI is installed and you are logged in." -ForegroundColor Red
}

Pause
