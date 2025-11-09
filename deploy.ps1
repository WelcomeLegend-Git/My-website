# Deploy script for JEE Companion App
Write-Host "🚀 Starting deployment process..." -ForegroundColor Green

# Build the web app
Write-Host "📦 Building web application..." -ForegroundColor Yellow
Set-Location "apps\web"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Go back to root
Set-Location "..\..\"

# Create a deployment trigger commit
Write-Host "🔄 Creating deployment trigger..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit --allow-empty -m "Deploy: Premium UI with glassmorphism - $timestamp"
git push origin master

Write-Host "✅ Deployment triggered! Check Vercel dashboard in 2-3 minutes." -ForegroundColor Green
Write-Host "Your premium UI with glassmorphism effects will be live soon!" -ForegroundColor Cyan
