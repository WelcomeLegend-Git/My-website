Write-Host "Deploying JEE Study Companion..." -ForegroundColor Cyan
Write-Host ""

if (Test-Path .git) {
    Write-Host "Moving .git temporarily..." -ForegroundColor Yellow
    Move-Item .git .git-backup -Force
    $gitMoved = $true
} else {
    $gitMoved = $false
}

Write-Host "Deploying to Vercel..." -ForegroundColor Cyan
vercel --prod --yes

if ($gitMoved) {
    Write-Host "Restoring .git..." -ForegroundColor Yellow
    Move-Item .git-backup .git -Force
}

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "AI Access Code: JeeMaster2024" -ForegroundColor Magenta
