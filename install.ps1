# ==============================================================================
# SLR Magic - Automated Cross-Platform Dependency Installer (Windows PowerShell)
# ==============================================================================
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Set Console Output Encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootDir

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "         SLR Magic - Environment & Dependency Setup Wizard         " -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

$PrereqFailed = $false

# ------------------------------------------------------------------------------
# 1. System Prerequisite Diagnostics
# ------------------------------------------------------------------------------
Write-Host "[1/5] Checking System Prerequisites..." -ForegroundColor Blue

# Check Node.js
try {
    $nodeVer = & node -v 2>$null
    if ($LASTEXITCODE -eq 0 -and $nodeVer) {
        Write-Host "  [OK] Node.js detected: " -ForegroundColor Green -NoNewline
        Write-Host "$nodeVer" -ForegroundColor White
    } else {
        throw "Node not found"
    }
} catch {
    Write-Host "  [FAIL] Node.js is NOT installed or not found in PATH." -ForegroundColor Red
    Write-Host "    Manual action required: Install Node.js LTS (v18+ recommended):" -ForegroundColor Yellow
    Write-Host "    → Official Website: https://nodejs.org/"
    Write-Host "    → Via NVM for Windows: https://github.com/coreybutler/nvm-windows"
    $PrereqFailed = $true
}

# Check npm
try {
    $npmVer = & npm -v 2>$null
    if ($LASTEXITCODE -eq 0 -and $npmVer) {
        Write-Host "  [OK] npm detected:     " -ForegroundColor Green -NoNewline
        Write-Host "v$npmVer" -ForegroundColor White
    } else {
        throw "npm not found"
    }
} catch {
    Write-Host "  [FAIL] npm is NOT installed or not found in PATH." -ForegroundColor Red
    Write-Host "    Manual action required: Install npm (bundled with Node.js)." -ForegroundColor Yellow
    $PrereqFailed = $true
}

# Check NVM for Windows (Informational)
$nvmCmd = Get-Command nvm -ErrorAction SilentlyContinue
if ($nvmCmd -or (Test-Path env:NVM_HOME) -or (Test-Path env:NVM_SYMLINK)) {
    Write-Host "  [OK] NVM for Windows detected." -ForegroundColor Green
} else {
    Write-Host "  [INFO] NVM for Windows is not detected (optional, but recommended for managing Node.js versions)." -ForegroundColor Yellow
    Write-Host "    → Guide: https://github.com/coreybutler/nvm-windows" -ForegroundColor DarkGray
}

# Check Python 3
$pythonExe = $null
$candidatePythons = @("python", "py", "python3")

foreach ($cand in $candidatePythons) {
    try {
        $candVer = & $cand --version 2>&1
        if ($LASTEXITCODE -eq 0 -and $candVer -like "*Python 3*") {
            $pythonExe = $cand
            Write-Host "  [OK] Python detected:  " -ForegroundColor Green -NoNewline
            Write-Host "$candVer ($cand)" -ForegroundColor White
            break
        }
    } catch {
        # Continue searching
    }
}

if (-not $pythonExe) {
    Write-Host "  [FAIL] Python 3 is NOT installed or not found in PATH." -ForegroundColor Red
    Write-Host "    Manual action required: Install Python 3.9+ from https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host "    IMPORTANT: Check the box '[x] Add python.exe to PATH' during installation!" -ForegroundColor Yellow
    $PrereqFailed = $true
} else {
    # Check Python 'venv' standard module
    try {
        $venvCheck = & $pythonExe -c "import venv; print('VENV_OK')" 2>$null
        if ($LASTEXITCODE -eq 0 -and $venvCheck -like "*VENV_OK*") {
            Write-Host "  [OK] Python 'venv' module is functional." -ForegroundColor Green
        } else {
            throw "venv test failed"
        }
    } catch {
        Write-Host "  [FAIL] Python 'venv' module is missing or non-functional." -ForegroundColor Red
        Write-Host "    Manual action required: Re-run Python installer and ensure standard libraries are included." -ForegroundColor Yellow
        $PrereqFailed = $true
    }
}

if ($PrereqFailed) {
    Write-Host ""
    Write-Host "====================================================================" -ForegroundColor Red
    Write-Host " [ERROR] Missing prerequisites detected. Please install them above " -ForegroundColor Red
    Write-Host "         and re-run this setup script.                              " -ForegroundColor Red
    Write-Host "====================================================================" -ForegroundColor Red
    exit 1
}

Write-Host "  All prerequisite tools are satisfied!`n" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 2. Root Workspace Dependencies
# ------------------------------------------------------------------------------
Write-Host "[2/5] Installing Root Workspace Dependencies..." -ForegroundColor Blue
& npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install root workspace dependencies." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "  [OK] Root workspace ready.`n" -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. Submodule Node Dependencies (slr-ide, inter-rater, slr-viewer)
# ------------------------------------------------------------------------------
Write-Host "[3/5] Installing Submodule Node Dependencies..." -ForegroundColor Blue

# slr-ide
if (Test-Path "slr-ide") {
    Write-Host "  → Installing dependencies for slr-ide..." -ForegroundColor Gray
    Push-Location "slr-ide"
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed in slr-ide" }
        Write-Host "  [OK] slr-ide dependencies installed." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# inter-rater
if (Test-Path "inter-rater") {
    Write-Host "  → Installing dependencies for inter-rater..." -ForegroundColor Gray
    Push-Location "inter-rater"
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed in inter-rater" }
        Write-Host "  [OK] inter-rater dependencies installed." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# slr-viewer
if (Test-Path "slr-viewer") {
    Write-Host "  → Installing dependencies for slr-viewer..." -ForegroundColor Gray
    Push-Location "slr-viewer"
    try {
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed in slr-viewer" }
        Write-Host "  [OK] slr-viewer dependencies installed." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}
Write-Host ""

# ------------------------------------------------------------------------------
# 4. Python Virtual Environment & Dependencies (slr-ide/python_engine)
# ------------------------------------------------------------------------------
Write-Host "[4/5] Setting Up Python Engine Virtual Environment..." -ForegroundColor Blue
$VenvDir = Join-Path $RootDir "slr-ide\python_engine\venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"
$RequirementsFile = Join-Path $RootDir "slr-ide\python_engine\requirements.txt"

if (Test-Path $VenvPython) {
    Write-Host "  [INFO] Existing virtual environment detected at:" -ForegroundColor Green
    Write-Host "    $VenvDir" -ForegroundColor White
    Write-Host "  → Updating pip and installing/verifying requirements..." -ForegroundColor Gray
} else {
    Write-Host "  → Creating new virtual environment at $VenvDir..." -ForegroundColor Gray
    $EngineDir = Split-Path -Parent $VenvDir
    if (-not (Test-Path $EngineDir)) { New-Item -ItemType Directory -Path $EngineDir -Force | Out-Null }
    
    & $pythonExe -m venv $VenvDir
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VenvPython)) {
        Write-Host "Failed to create Python virtual environment." -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Virtual environment created successfully." -ForegroundColor Green
}

# Upgrade pip inside venv
Write-Host "  → Upgrading pip inside virtual environment..." -ForegroundColor Gray
& $VenvPython -m pip install --upgrade pip --quiet

# Install requirements
if (Test-Path $RequirementsFile) {
    Write-Host "  → Installing python packages from requirements.txt..." -ForegroundColor Gray
    & $VenvPip install -r $RequirementsFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: Some python packages failed to install. Please check network/build tools." -ForegroundColor Yellow
    } else {
        Write-Host "  [OK] Python engine dependencies installed successfully." -ForegroundColor Green
    }
} else {
    Write-Host "  Warning: requirements.txt not found at $RequirementsFile." -ForegroundColor Yellow
}
Write-Host ""

# ------------------------------------------------------------------------------
# 5. Post-Installation Workspace Sync
# ------------------------------------------------------------------------------
Write-Host "[5/5] Performing Post-Installation Workspace Synchronization..." -ForegroundColor Blue
if (Test-Path "scripts\mirror-to-viewer.mjs") {
    Write-Host "  → Mirroring shared components to slr-viewer..." -ForegroundColor Gray
    & node scripts/mirror-to-viewer.mjs
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Viewer synchronization complete." -ForegroundColor Green
    }
}
Write-Host ""

# ------------------------------------------------------------------------------
# Completion Summary
# ------------------------------------------------------------------------------
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "           * SLR Magic Workspace Setup Completed! *                 " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now launch any of the SLR Magic submodules:`n"
Write-Host "  1. SLR IDE (Main Desktop Hub):" -ForegroundColor White
Write-Host "     npm run dev:ide   (or: cd slr-ide; npm run dev)" -ForegroundColor Cyan
Write-Host "     → http://localhost:3000`n" -ForegroundColor DarkGray
Write-Host "  2. Inter-Rater Review SPA:" -ForegroundColor White
Write-Host "     cd inter-rater; npm run dev" -ForegroundColor Cyan
Write-Host "     → http://localhost:3001`n" -ForegroundColor DarkGray
Write-Host "  3. SLR Viewer (Standalone Visualization):" -ForegroundColor White
Write-Host "     npm run dev:viewer (or: cd slr-viewer; npm run dev)" -ForegroundColor Cyan
Write-Host "     → http://localhost:3002`n" -ForegroundColor DarkGray
Write-Host "Enjoy researching with SLR Magic!" -ForegroundColor White
