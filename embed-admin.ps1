$tauriDir = Join-Path $PSScriptRoot "src-tauri"
$exe = Join-Path $tauriDir "target\release\app.exe"
$manifest = Join-Path $tauriDir "app.manifest"

if (-not (Test-Path $exe)) {
    Write-Host "EXE not found at $exe. Build first with: npm run tauri build"
    exit 1
}

$mt = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\mt.exe"
if (-not (Test-Path $mt)) {
    Write-Error "mt.exe not found at $mt"
    exit 1
}

Write-Host "Embedding admin manifest into $exe ..."
& $mt -manifest $manifest "-outputresource:$exe;#1" -nologo
if ($LASTEXITCODE -eq 0) {
    Write-Host "Manifest embedded successfully."
} else {
    Write-Error "Failed to embed manifest (exit code $LASTEXITCODE)"
}
