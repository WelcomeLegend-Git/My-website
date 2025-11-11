# Vercel Environment Variables Setup Script
# This script will set all required environment variables for your JEE Study Companion app

Write-Host "🚀 Setting up Vercel Environment Variables..." -ForegroundColor Cyan
Write-Host ""

# Server Environment Variables
$serverEnvVars = @{
    "DATABASE_URL" = "postgresql://postgres.mgehxznfluazziszbqsj:8rj4oiSoFPVnafg2@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    "DIRECT_DATABASE_URL" = "postgresql://postgres.mgehxznfluazziszbqsj:8rj4oiSoFPVnafg2@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
    "SUPABASE_URL" = "https://mgehxznfluazziszbqsj.supabase.co"
    "SUPABASE_SERVICE_ROLE_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWh4em5mbHVhenppc3picXNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjQ3MzU1NywiZXhwIjoyMDc4MDQ5NTU3fQ.1HAOW6XocYnJIuuaraVSCwL279if3LeT7ajDzu_S7IQ"
    "JWT_ACCESS_SECRET" = "jee-study-companion-access-secret-2024-production-32chars-min"
    "JWT_REFRESH_SECRET" = "jee-study-companion-refresh-secret-2024-production-32chars-min"
    "GEMINI_API_KEYS" = "AIzaSyB0yaE9pqcdhxb5ygQNETgzJNytqVnZxqE"
    "GEMINI_MODEL_PRIMARY" = "gemini-2.0-flash-exp"
    "GEMINI_MODEL_FALLBACK" = "gemini-1.5-flash,gemini-1.5-pro"
    "AI_ACCESS_CODE" = "JeeMaster2024"
    "NODE_ENV" = "production"
}

# Web Environment Variables
$webEnvVars = @{
    "VITE_SUPABASE_URL" = "https://mgehxznfluazziszbqsj.supabase.co"
    "VITE_SUPABASE_ANON_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZWh4em5mbHVhenppc3picXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NzM1NTcsImV4cCI6MjA3ODA0OTU1N30.mWB28Wy5ksk-4L3MEF4E94c95LIynsH2ydGRfJ_9GYU"
}

# Note: VITE_API_URL will be set after first deployment

Write-Host "📝 Environment Variables to be set:" -ForegroundColor Yellow
Write-Host "   - $($serverEnvVars.Count) server variables" -ForegroundColor Green
Write-Host "   - $($webEnvVars.Count) web variables" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  AI Access Code: JeeMaster2024 (share this with friends)" -ForegroundColor Magenta
Write-Host ""

# Combine all vars
$allVars = $serverEnvVars + $webEnvVars

Write-Host "🔧 Setting variables in Vercel..." -ForegroundColor Cyan
$count = 0
$total = $allVars.Count

foreach ($key in $allVars.Keys) {
    $count++
    $value = $allVars[$key]
    Write-Host "[$count/$total] Setting $key..." -ForegroundColor Gray
    
    # Use echo to pipe the value to vercel env add
    $value | vercel env add $key production --force 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ $key set successfully" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to set $key" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Environment variables setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Run: vercel --prod" -ForegroundColor White
Write-Host "   2. Get your deployment URL" -ForegroundColor White
Write-Host "   3. Set VITE_API_URL to your deployment URL" -ForegroundColor White
Write-Host ""
