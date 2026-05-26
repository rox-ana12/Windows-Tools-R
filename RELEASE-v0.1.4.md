# Windows Tools R v0.1.4

## Overview
A native Windows utility built with **Rust** (Tauri v2) and **React + TypeScript**, providing system information, useful tweaks, and cleanup tools — now running with administrator privileges for full system access.

## What's New in v0.1.4

### System Cleanup (New Tools Section)
- **Empty Recycle Bin** — empties the Recycle Bin via COM API
- **Clean Temp Files** — removes temporary files from `%TEMP%` (skips system temp if lacking permissions)
- **Clean Prefetch** — removes Windows Prefetch files (admin required)
- **Disk Cleanup C:** — launches the built-in Windows Disk Cleanup tool

### Admin Mode
- App now requests administrator privileges on launch (UAC prompt)
- Required for Prefetch cleanup and full system temp access
- Windows manifest properly includes `Common-Controls v6` dependency

### Renamed to "Windows Tools R"
- Updated app title, window title, and installer names
- New GitHub repository identity

### Usability Improvements
- Toggle action buttons redesigned: right-aligned, compact, with Enable/Disable/Refresh options
- Automatic Explorer restart after context menu toggle — no manual reboot needed
- Graceful error handling for cleanup operations (no crashes on permission errors)

## Tech Stack
| Component | Technology |
|-----------|-----------|
| Backend | Rust with `sysinfo`, `winreg`, `serde` |
| Frontend | React 19 + TypeScript + Vite 8 |
| Framework | Tauri v2 |
| Plugins | `tauri-plugin-dialog`, `tauri-plugin-log` |

## Build
- Produces `.exe` (portable), `.msi` (Windows Installer), and `.exe` (NSIS setup)
- Version synchronized across all files via `sync-version.ps1` (edit only `.version`)

## Installation
Download the latest installer from Releases:
- `Windows Tools R_0.1.4_x64-setup.exe` — NSIS installer
- `Windows Tools R_0.1.4_x64_en-US.msi` — MSI installer
- `Windows Tools R_0.1.4_x64_en-US.msi` — portable executable

## Changelog

### v0.1.4 — System Cleanup & Admin Mode
- New: System Cleanup tools (Recycle Bin, Temp, Prefetch, Disk Cleanup)
- New: App runs with administrator privileges (UAC on launch)
- Changed: App renamed to "Windows Tools R" across all files
- Changed: Compact, right-aligned toggle action buttons
- Changed: Automatic Explorer restart on context menu toggle
- Fixed: TaskDialogIndirect entry point error (added Common-Controls v6 manifest dependency)
- Fixed: Cleanup operations gracefully handle permission errors

### v0.1.3 — Installed Apps Report
- New: Installed Apps Report generator (HTML output)
- New: Save-file dialog using `tauri-plugin-dialog`

### v0.1.2 — IPConfig + Responsive Layout
- New: IPConfig tool (run `ipconfig` from UI)
- Changed: Smaller default window size (1000×650, min 800×500)
- Fixed: About page now reads version dynamically from Tauri manifest

### v0.1.1 — Version Sync & Bugfixes
- New: `sync-version.ps1` — single-source version management
- New: `.version` file as the single source of truth
- Changed: `beforeBuildCommand` now runs sync automatically
- Fixed: Registry check uses key existence, not value content

### v0.1.0 — Initial Release
- Dashboard with system info (OS, CPU, RAM, Disk)
- Classic Context Menu toggle with automatic Explorer restart
- About page
- Dark/Light theme toggle with localStorage
- Sidebar navigation (15% / 85% layout)
