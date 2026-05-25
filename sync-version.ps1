$version = (Get-Content -Path "$PSScriptRoot\.version" -Raw).Trim()
if (-not $version) { Write-Error ".version is empty"; exit 1 }

Write-Host "Syncing version $version to all files..."

$replace = '"version": "' + $version + '"'

# package.json
$pkg = Get-Content -Path "$PSScriptRoot\package.json" -Raw
$pkg = $pkg -replace '"version":\s*"[^"]*"', $replace
Set-Content -Path "$PSScriptRoot\package.json" -Value $pkg -NoNewline

# src-tauri/tauri.conf.json
$conf = Get-Content -Path "$PSScriptRoot\src-tauri\tauri.conf.json" -Raw
$conf = $conf -replace '"version":\s*"[^"]*"', $replace
Set-Content -Path "$PSScriptRoot\src-tauri\tauri.conf.json" -Value $conf -NoNewline

# src-tauri/Cargo.toml
$cargo = Get-Content -Path "$PSScriptRoot\src-tauri\Cargo.toml" -Raw
$replaceCargo = 'version = "' + $version + '"'
$cargo = $cargo -replace '(?m)^version\s*=\s*"[^"]*"', $replaceCargo
Set-Content -Path "$PSScriptRoot\src-tauri\Cargo.toml" -Value $cargo -NoNewline

Write-Host "Done. All files now at version $version"
