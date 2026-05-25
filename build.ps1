<#
.SYNOPSIS
  Build script for Windows Tools - compiles the Tauri app into an EXE installer.
.DESCRIPTION
  This script installs dependencies and builds the Windows Tools native application.
  The output EXE installer will be in src-tauri\target\release\bundle\.
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

Write-Host "=== Windows Tools Builder ===" -ForegroundColor Cyan
Write-Host ""

# ---- Check prerequisites ----
$missing = @()

if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
  $missing += "Node.js (https://nodejs.org)"
}
if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
  $missing += "Rust (https://rustup.rs)"
}
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
  $missing += "npm (comes with Node.js)"
}

if ($missing.Count -gt 0) {
  Write-Host "Missing prerequisites:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

Write-Host "[1/3] Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host ""
Write-Host "[2/3] Building frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

Write-Host ""
Write-Host "[3/3] Building Tauri app (this will compile the Rust backend)..." -ForegroundColor Yellow
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }

Write-Host ""
Write-Host "=== Build complete! ===" -ForegroundColor Green
Write-Host "Installer location:" -ForegroundColor Cyan

$bundleDir = Join-Path -Path $ProjectRoot -ChildPath "src-tauri\target\release\bundle"
if (Test-Path $bundleDir) {
  Get-ChildItem -Path $bundleDir -Recurse -File | Where-Object { $_.Extension -in ".msi", ".exe" } | ForEach-Object {
    Write-Host "  $($_.FullName)" -ForegroundColor White
  }
}

Write-Host ""
Write-Host "To run in dev mode: npm run tauri dev" -ForegroundColor Gray
