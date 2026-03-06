# job-scraper - Windows bootstrap

$MIN_NODE_VERSION = 18

Write-Host ""
Write-Host "  job-scraper - setup" -ForegroundColor Cyan
Write-Host "  -------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# --- Step 1: Check for Node ---

$nodeInstalled = $false
$nodeVersion = $null
$nodeMajor = 0

try {
    $nodeVersionRaw = & node --version 2>$null
    if ($nodeVersionRaw -match "v(\d+)") {
        $nodeMajor = [int]$Matches[1]
        $nodeVersion = $nodeVersionRaw
        $nodeInstalled = $true
    }
} catch {
    $nodeInstalled = $false
}

if (-not $nodeInstalled) {
    Write-Host "  Node.js not found. Attempting to install via winget..." -ForegroundColor Yellow
    Write-Host ""

    try {
        winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        Write-Host ""
        Write-Host "  Node.js installed. Please close and reopen this terminal, then run this script again." -ForegroundColor Green
        Write-Host ""
        exit 0
    } catch {
        Write-Host "  Could not install Node.js automatically." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Please install it manually from:" -ForegroundColor White
        Write-Host ""
        Write-Host "      https://nodejs.org" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Then reopen this terminal and run this script again." -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

# --- Step 2: Check Node version ---

if ($nodeMajor -lt $MIN_NODE_VERSION) {
    Write-Host "  WARNING: Node.js $nodeVersion detected, but version $MIN_NODE_VERSION or higher is required." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Please update Node.js by running:" -ForegroundColor White
    Write-Host ""
    Write-Host "      winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Then reopen this terminal and run this script again." -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "  OK  Node.js $nodeVersion detected" -ForegroundColor Green

# --- Step 3: Install npm dependencies ---

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Yellow
    Write-Host ""
    npm install playwright-extra puppeteer-extra-plugin-stealth tsx typescript @types/node
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  FAILED: npm install failed. Please check the output above." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
    Write-Host "  OK  Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  OK  Dependencies already installed" -ForegroundColor Green
}

# --- Step 4: Install Playwright browser ---

$chromiumPath = Join-Path $env:LOCALAPPDATA "ms-playwright"
if (-not (Test-Path $chromiumPath)) {
    Write-Host "  Installing Playwright browser..." -ForegroundColor Yellow
    Write-Host ""
    npx playwright install chromium
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  FAILED: Playwright browser installation failed. Please check the output above." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
    Write-Host "  OK  Playwright browser installed" -ForegroundColor Green
} else {
    Write-Host "  OK  Playwright browser already installed" -ForegroundColor Green
}

# --- Step 5: Launch ---

Write-Host ""
Write-Host "  -------------------------------------" -ForegroundColor DarkGray
Write-Host "  Launching job-scraper..." -ForegroundColor Cyan
Write-Host "  -------------------------------------" -ForegroundColor DarkGray
Write-Host ""

npx tsx job-scraper.ts
