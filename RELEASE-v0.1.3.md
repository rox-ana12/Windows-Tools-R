# Windows Tools v0.1.3

## Overview
A native Windows utility built with **Rust** (Tauri v2) and **React + TypeScript**, providing quick access to system information and useful Windows tweaks in a modern interface with dark/light theme support.

## Features

### Dashboard
- **System Information** — real-time display of OS details, CPU, memory, and disk usage
- Clean card grid layout with auto-adapting columns

### Tools

#### Classic Context Menu
- Toggle between Windows 11 modern and Windows 10 classic right-click context menu
- Registry-based toggle (`HKCU\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32`)
- Automatic Explorer restart on toggle — no manual reboot required
- Reads current state from registry on launch

#### IPConfig
- Run `ipconfig` command directly from the UI
- Output displayed in a scrollable monospace block

#### Installed Apps Report
- Scans installed applications from Windows Registry (`HKLM\Software\...\Uninstall`)
- Generates an HTML report with Name, Version, and Publisher for each app
- Save location chosen via native file dialog
- Clean, sortable table layout in the generated report

### About
- Displays app information, tech stack, and current version
- Version fetched dynamically from the app manifest

### Theme
- Dark/Light theme toggle with `localStorage` persistence
- Smooth CSS transitions between themes

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
- `Windows Tools_0.1.3_x64-setup.exe` — NSIS installer
- `Windows Tools_0.1.3_x64_en-US.msi` — MSI installer
- `app.exe` — portable executable

## Changelog

### v0.1.3 — Installed Apps Report
- New: Installed Apps Report generator (HTML output)
- New: Save-file dialog using `tauri-plugin-dialog`

### v0.1.2 — IPConfig + Responsive Layout
- New: IPConfig tool (run `ipconfig` from UI)
- Changed: Smaller default window size for small laptops (1000×650, min 800×500)
- Fixed: About page now reads version dynamically from Tauri manifest

### v0.1.1 — Version Sync & Bugfixes
- New: `sync-version.ps1` — single-source version management
- New: `.version` file as the single source of truth
- Changed: `beforeBuildCommand` now runs sync automatically
- Fixed: `get_context_menu_state` now correctly detects classic mode via key existence, not value content

### v0.1.0 — Initial Release
- Dashboard with system info (OS, CPU, RAM, Disk)
- Classic Context Menu toggle with automatic Explorer restart
- About page
- Dark/Light theme toggle with localStorage
- Sidebar navigation (15% / 85% layout)
- Scrollable main content area
