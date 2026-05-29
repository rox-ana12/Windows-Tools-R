use std::process::Command;
use std::fs;
use std::sync::{Mutex, OnceLock};
use serde::Serialize;
use sysinfo::{CpuRefreshKind, Disks, System};
use winreg::enums::*;
use winreg::RegKey;
use std::os::windows::process::CommandExt;
use tauri::Emitter;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
pub struct SystemInfo {
    pub os_name: String,
    pub os_version: String,
    pub hostname: String,
    pub kernel_version: String,
    pub cpu_brand: String,
    pub cpu_cores: u32,
    pub total_memory: u64,
    pub used_memory: u64,
    pub total_disk: u64,
    pub used_disk: u64,
}

#[derive(Serialize)]
pub struct InstallResult {
    pub success: bool,
    pub message: String,
    pub installed: bool,
}

#[derive(Clone, Serialize)]
struct OperationEvent {
    app_name: String,
    action: String,
    success: bool,
    message: String,
}

fn winget_cmd() -> Command {
    let mut cmd = Command::new("winget");
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[tauri::command]
fn install_app(app_handle: tauri::AppHandle, winget_id: String, app_name: String) {
    std::thread::spawn(move || {
        let result = winget_cmd()
            .args([
                "install", "--id", &winget_id, "-e", "-h",
                "--accept-source-agreements", "--accept-package-agreements"
            ])
            .output();
        let (success, message) = match result {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{}\n{}", stdout, stderr).to_lowercase();
                let already = combined.contains("0x8a150019") || combined.contains("already installed");
                (out.status.success() || already,
                 if already { format!("{} already installed", app_name) } else { format!("{} installed", app_name) })
            }
            Err(e) => (false, format!("Error: {}", e)),
        };
        let _ = app_handle.emit("operation-done", OperationEvent {
            app_name, action: "install".into(), success, message,
        });
    });
}

#[tauri::command]
fn uninstall_app(app_handle: tauri::AppHandle, winget_id: String, app_name: String) {
    std::thread::spawn(move || {
        let _ = winget_cmd()
            .args([
                "uninstall", "--id", &winget_id, "-e",
                "--accept-source-agreements"
            ])
            .output();
        std::thread::sleep(std::time::Duration::from_secs(10));
        let check = winget_cmd()
            .args(["list", "--id", &winget_id, "--accept-source-agreements"])
            .output();
        let still_installed = match check {
            Ok(out) => String::from_utf8_lossy(&out.stdout).to_lowercase().contains(&winget_id.to_lowercase()),
            Err(_) => true,
        };
        let (success, message) = if still_installed {
            (false, format!("Uninstall may have failed: {}", app_name))
        } else {
            (true, format!("{} uninstalled", app_name))
        };
        let _ = app_handle.emit("operation-done", OperationEvent {
            app_name, action: "uninstall".into(), success, message,
        });
    });
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let os_name = System::name().unwrap_or_default();
    let os_version = System::os_version().unwrap_or_default();
    let hostname = System::host_name().unwrap_or_default();
    let kernel_version = System::kernel_version().unwrap_or_default();

    let cpu = sys.cpus().first();
    let cpu_brand = cpu.map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_cores = sys.cpus().len() as u32;

    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();

    let disks = Disks::new_with_refreshed_list();
    let total_disk: u64 = disks.iter().map(|d| d.total_space()).sum();
    let used_disk: u64 = disks.iter().map(|d| d.total_space() - d.available_space()).sum();

    SystemInfo {
        os_name,
        os_version,
        hostname,
        kernel_version,
        cpu_brand,
        cpu_cores,
        total_memory,
        used_memory,
        total_disk,
        used_disk,
    }
}

fn global_system() -> &'static Mutex<System> {
    static SYS: OnceLock<Mutex<System>> = OnceLock::new();
    SYS.get_or_init(|| {
        let mut sys = System::new();
        sys.refresh_cpu_list(CpuRefreshKind::everything());
        Mutex::new(sys)
    })
}

#[derive(Serialize)]
pub struct ResourceUsage {
    cpu_percent: f32,
    memory_used: u64,
    memory_total: u64,
    memory_percent: f32,
    disk_used: u64,
    disk_total: u64,
    disk_percent: f32,
}

#[tauri::command]
fn get_resource_usage() -> ResourceUsage {
    let sys_lock = global_system();
    let mut sys = sys_lock.lock().unwrap();

    sys.refresh_cpu_all();
    sys.refresh_memory();
    let cpu_percent = sys.global_cpu_usage();

    let memory_used = sys.used_memory();
    let memory_total = sys.total_memory();
    let memory_percent = if memory_total > 0 {
        (memory_used as f64 / memory_total as f64 * 100.0) as f32
    } else {
        0.0
    };

    let disks = Disks::new_with_refreshed_list();
    let disk_total: u64 = disks.iter().map(|d| d.total_space()).sum();
    let disk_used: u64 = disks.iter().map(|d| d.total_space() - d.available_space()).sum();
    let disk_percent = if disk_total > 0 {
        (disk_used as f64 / disk_total as f64 * 100.0) as f32
    } else {
        0.0
    };

    ResourceUsage {
        cpu_percent,
        memory_used,
        memory_total,
        memory_percent,
        disk_used,
        disk_total,
        disk_percent,
    }
}

#[derive(Serialize)]
pub struct BatteryStatus {
    is_present: bool,
    is_charging: bool,
    percent: u32,
    ac_line_status: String,
    battery_status: String,
}

#[tauri::command]
fn get_battery_status() -> BatteryStatus {
    let output = Command::new("powercfg")
        .args(["/batteryreport", "/output", "C:\\Windows\\Temp\\battery-report.html"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    let (ac_line_status, battery_status, percent, is_charging, is_present) = match output {
        Ok(_) => {
            let ps_script = r#"
$status = Get-WmiObject -Class Win32_Battery
if (-not $status) {
    Write-Host "NOT_PRESENT::--::0::0"
    return
}
$ac = (Get-WmiObject -Class Win32_PowerStatus).PowerLineStatus
$acLine = if ($ac -eq 1) { "Online" } else { "Offline" }
$batStatus = switch ($status.BatteryStatus) {
    1 { "Discharging" }
    2 { "AC Power" }
    3 { "Fully Charged" }
    4 { "Low" }
    5 { "Critical" }
    6 { "Charging" }
    7 { "Charging High" }
    8 { "Charging Low" }
    9 { "Undefined" }
    10 { "Partially Charged" }
    default { "Unknown" }
}
$charging = if ($ac -eq 1 -or $status.BatteryStatus -eq 2 -or $status.BatteryStatus -eq 6) { "1" } else { "0" }
Write-Host "$acLine::$batStatus::$($status.EstimatedChargeRemaining)::$charging"
"#;
            let temp = format!("C:\\Windows\\Temp\\battery-ps.ps1");
            let _ = std::fs::write(&temp, ps_script);
            let ps_out = Command::new("powershell")
                .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", &temp])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            let _ = std::fs::remove_file(&temp);

            match ps_out {
                Ok(o) => {
                    let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                    let parts: Vec<&str> = s.split("::").collect();
                    if parts.len() >= 4 {
                        let ac = parts[0].to_string();
                        let bs = parts[1].to_string();
                        let pct: u32 = parts[2].parse().unwrap_or(0);
                        let chg = parts[3] == "1";
                        (ac, bs, pct, chg, true)
                    } else {
                        ("N/A".into(), "N/A".into(), 0u32, false, false)
                    }
                }
                Err(_) => ("N/A".into(), "N/A".into(), 0u32, false, false),
            }
        }
        Err(_) => ("N/A".into(), "N/A".into(), 0u32, false, false),
    };

    BatteryStatus {
        is_present,
        is_charging,
        percent,
        ac_line_status,
        battery_status,
    }
}

#[derive(Serialize)]
pub struct ContextMenuState {
    pub classic_enabled: bool,
}

#[tauri::command]
fn get_context_menu_state() -> ContextMenuState {
    let key_path = r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32";
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    let classic = hkcu.open_subkey(key_path).is_ok();
    ContextMenuState { classic_enabled: classic }
}

#[tauri::command]
fn run_ipconfig() -> Result<String, String> {
    let output = Command::new("ipconfig")
        .output()
        .map_err(|e| format!("Failed to run ipconfig: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(format!("ipconfig failed: {}", String::from_utf8_lossy(&output.stderr)))
    }
}

#[tauri::command]
fn toggle_context_menu(classic: bool) -> Result<(), String> {
    let key_path = r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32";
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    if classic {
        let (subkey, _) = hkcu.create_subkey(key_path).map_err(|e| e.to_string())?;
        subkey.set_value("", &"").map_err(|e| e.to_string())?;
    } else {
        let _ = hkcu.delete_subkey_all(key_path);
    }
    let _ = Command::new("taskkill").args(["/f", "/im", "explorer.exe"]).status();
    let _ = Command::new("explorer.exe").spawn();
    Ok(())
}

#[derive(Serialize)]
struct AppEntry {
    name: String,
    version: String,
    publisher: String,
    size: String,
    install_date: String,
    install_location: String,
    winget_id: String,
}

fn read_registry_apps(hive: RegKey, path: &str) -> Vec<AppEntry> {
    let mut apps = Vec::new();
    if let Ok(key) = hive.open_subkey(path) {
        for name in key.enum_keys().filter_map(|k| k.ok()) {
            if let Ok(subkey) = key.open_subkey(&name) {
                let display_name: String = subkey.get_value("DisplayName").unwrap_or_default();
                if display_name.is_empty() { continue; }
                let version: String = subkey.get_value("DisplayVersion").unwrap_or_default();
                let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
                let size_kb: u32 = subkey.get_value("EstimatedSize").unwrap_or(0u32);
                let size = if size_kb == 0 { String::new() } else if size_kb >= 1024 {
                    format!("{:.1} MB", size_kb as f64 / 1024.0)
                } else {
                    format!("{} KB", size_kb)
                };
                let raw_date: String = subkey.get_value("InstallDate").unwrap_or_default();
                let install_date = if raw_date.len() == 8 {
                    format!("{}-{}-{}", &raw_date[0..4], &raw_date[4..6], &raw_date[6..8])
                } else {
                    raw_date
                };
                let install_location: String = subkey.get_value("InstallLocation")
                    .or_else(|_| subkey.get_value("InstallDir"))
                    .or_else(|_| subkey.get_value("InstallPath"))
                    .unwrap_or_default();
                let install_location = if install_location.is_empty() {
                    let us: Result<String, _> = subkey.get_value("UninstallString");
                    if let Ok(us) = us {
                        let trimmed = us.trim_matches('"');
                        if let Some(pos) = trimmed.rfind('\\') {
                            trimmed[..pos].to_string()
                        } else {
                            String::new()
                        }
                    } else { String::new() }
                } else { install_location };
                apps.push(AppEntry { name: display_name, version, publisher, size, install_date, install_location, winget_id: String::new() });
            }
        }
    }
    apps
}

fn read_installed_apps() -> Vec<AppEntry> {
    let mut seen = std::collections::HashSet::new();
    let mut apps = Vec::new();

    for app in read_registry_apps(RegKey::predef(HKEY_LOCAL_MACHINE), r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall") {
        if seen.insert(app.name.to_lowercase()) { apps.push(app); }
    }
    for app in read_registry_apps(RegKey::predef(HKEY_LOCAL_MACHINE), r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall") {
        if seen.insert(app.name.to_lowercase()) { apps.push(app); }
    }
    for app in read_registry_apps(RegKey::predef(HKEY_CURRENT_USER), r"Software\Microsoft\Windows\CurrentVersion\Uninstall") {
        if seen.insert(app.name.to_lowercase()) { apps.push(app); }
    }

    let winget_rows: Vec<Vec<String>> = winget_cmd().args(["list", "--accept-source-agreements"]).output().ok()
        .map(|o| parse_winget_table(&String::from_utf8_lossy(&o.stdout).to_string()))
        .unwrap_or_default();

    // Attach winget_id to registry apps that have a match
    let name_to_id: std::collections::HashMap<&str, &str> = winget_rows.iter()
        .filter(|r| r.len() >= 2)
        .map(|r| (r[0].as_str(), r[1].as_str()))
        .collect();
    for app in &mut apps {
        if app.winget_id.is_empty() {
            if let Some(&id) = name_to_id.get(app.name.as_str()) {
                app.winget_id = id.to_string();
            }
        }
    }

    // Supplement with winget list for apps not found in registry
    for r in &winget_rows {
        if r.len() < 2 { continue; }
        let name = r[0].trim().to_string();
        if name.is_empty() || name == "Name" { continue; }
        if seen.insert(name.to_lowercase()) {
            let winget_id = r[1].trim();
            let publisher = if let Some(dot) = winget_id.find('.') {
                winget_id[..dot].to_string()
            } else { String::new() };
            apps.push(AppEntry {
                name,
                version: r.get(2).cloned().unwrap_or_default(),
                publisher,
                size: String::new(),
                install_date: String::new(),
                install_location: String::new(),
                winget_id: winget_id.to_string(),
            });
        }
    }

    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps
}

#[tauri::command]
fn generate_apps_report(path: String) -> Result<(), String> {
    let apps = read_installed_apps();
    let mut html = String::new();
    html.push_str(r#"<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Installed Apps Report</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:32px;color:#1a1a2e;background:#fff}h1{font-size:24px;margin-bottom:4px}p{color:#666;margin-bottom:24px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0}th{background:#f8f8fc;font-weight:600}tr:hover{background:#f0f0fa}</style></head><body>"#);
    html.push_str(&format!("<h1>Installed Apps Report</h1><p>Total: {} applications</p>", apps.len()));
    html.push_str("<table><thead><tr><th>Name</th><th>Version</th><th>Publisher</th></tr></thead><tbody>");
    for app in &apps {
        html.push_str(&format!("<tr><td>{}</td><td>{}</td><td>{}</td></tr>", app.name, app.version, app.publisher));
    }
    html.push_str("</tbody></table></body></html>");
    fs::write(&path, html).map_err(|e| format!("Failed to write report: {}", e))?;
    Ok(())
}

fn delete_files_in_dir(path: &str) -> Result<usize, String> {
    let dir = std::path::Path::new(path);
    if !dir.exists() { return Ok(0); }
    let mut count = 0;
    for entry in fs::read_dir(dir).map_err(|e| format!("Cannot read {}: {}", path, e))? {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let p = entry.path();
        if p.is_dir() { let _ = fs::remove_dir_all(&p); } else { let _ = fs::remove_file(&p); }
        count += 1;
    }
    Ok(count)
}

#[link(name = "shell32")]
extern "system" {
    fn SHEmptyRecycleBinW(
        hwnd: *mut std::ffi::c_void,
        pszRootPath: *const u16,
        dwFlags: u32,
    ) -> i32;
}

#[tauri::command]
fn empty_recycle_bin() -> Result<String, String> {
    const SHERB_NOCONFIRMATION: u32 = 0x00000001;
    const SHERB_NOPROGRESSUI: u32 = 0x00000002;
    const SHERB_NOSOUND: u32 = 0x00000004;

    let result = unsafe {
        SHEmptyRecycleBinW(
            std::ptr::null_mut(),
            std::ptr::null(),
            SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND,
        )
    };

    if result == 0 || result == 1 {
        Ok("Recycle Bin emptied".into())
    } else {
        Err(format!("Failed to empty Recycle Bin (error: {})", result))
    }
}

#[tauri::command]
fn clean_temp_files() -> Result<String, String> {
    let mut total = 0;
    let temp = std::env::var("TEMP").map_err(|_| "TEMP not set".to_string())?;
    total += delete_files_in_dir(&temp)?;
    let sys_temp = r"C:\Windows\Temp";
    if std::path::Path::new(sys_temp).exists() {
        if let Ok(n) = delete_files_in_dir(sys_temp) { total += n; }
    }
    Ok(format!("Cleaned {} temporary files", total))
}

#[tauri::command]
fn clean_prefetch() -> Result<String, String> {
    let path = r"C:\Windows\Prefetch";
    if !std::path::Path::new(path).exists() { return Ok("Prefetch folder not found".into()); }
    match delete_files_in_dir(path) {
        Ok(count) => Ok(format!("Cleaned {} Prefetch files", count)),
        Err(_) => Err("Access denied. Run as administrator to clean Prefetch.".into()),
    }
}

#[tauri::command]
fn run_disk_cleanup() -> Result<String, String> {
    Command::new("cleanmgr.exe")
        .args(["/d", "C:"])
        .spawn()
        .map_err(|e| format!("Failed to launch Disk Cleanup: {}", e))?;
    Ok("Disk Cleanup launched".into())
}

#[tauri::command]
fn get_all_apps() -> Vec<AppEntry> {
    read_installed_apps()
}

#[derive(Serialize)]
struct UpdatableApp {
    name: String,
    winget_id: String,
    current_version: String,
    available_version: String,
}

fn parse_winget_table(output: &str) -> Vec<Vec<String>> {
    let lines: Vec<&str> = output.lines().collect();
    if lines.len() < 3 { return vec![]; }
    let sep_idx = lines.iter().position(|l| l.starts_with("---")).unwrap_or(0);
    if sep_idx == 0 { return vec![]; }
    let separator = lines[sep_idx];
    let mut col_starts: Vec<usize> = Vec::new();
    let mut in_group = false;
    for (i, c) in separator.char_indices() {
        if c == '-' && !in_group { col_starts.push(i); in_group = true; }
        if c == ' ' { in_group = false; }
    }
    let mut result = Vec::new();
    for &line in &lines[sep_idx + 1..] {
        if line.trim().is_empty() { continue; }
        let mut row = Vec::new();
        for (idx, &start) in col_starts.iter().enumerate() {
            let end = if idx + 1 < col_starts.len() { col_starts[idx + 1] } else { line.len() };
            row.push(line[start..end.min(line.len())].trim().to_string());
        }
        result.push(row);
    }
    result
}

#[tauri::command]
fn check_updates() -> Vec<UpdatableApp> {
    let output = winget_cmd()
        .args(["upgrade", "--accept-source-agreements"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    let rows = parse_winget_table(&output);
    rows.iter().filter_map(|r| {
        if r.len() < 5 { return None; }
        let name = r[0].clone();
        let winget_id = r[1].clone();
        if winget_id.is_empty() { return None; }
        Some(UpdatableApp {
            name,
            winget_id,
            current_version: r[2].clone(),
            available_version: r[3].clone(),
        })
    }).collect()
}

#[tauri::command]
fn update_app(app_handle: tauri::AppHandle, winget_id: String, app_name: String) {
    std::thread::spawn(move || {
        let result = winget_cmd()
            .args(["upgrade", "--id", &winget_id, "-e", "-h",
                   "--accept-source-agreements", "--accept-package-agreements"])
            .output();
        let (success, message) = match result {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{}\n{}", stdout, stderr).to_lowercase();
                let ok = out.status.success() || combined.contains("no upgrade");
                (ok, if ok { format!("{} updated", app_name) } else { format!("Update failed: {}", combined.trim()) })
            }
            Err(e) => (false, format!("Error: {}", e)),
        };
        let _ = app_handle.emit("operation-done", OperationEvent {
            app_name, action: "update".into(), success, message,
        });
    });
}

#[tauri::command]
fn check_winget() -> bool {
    winget_cmd().arg("--version").output().is_ok_and(|o| o.status.success())
}

#[tauri::command]
fn check_apps_installed(apps: Vec<String>) -> Vec<String> {
    let output = winget_cmd()
        .args(["list", "--accept-source-agreements"])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase())
        .unwrap_or_default();

    apps.iter().map(|id| {
        if output.contains(&id.to_lowercase()) { "installed".to_string() } else { "not_installed".to_string() }
    }).collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            get_context_menu_state,
            toggle_context_menu,
            run_ipconfig,
            generate_apps_report,
            empty_recycle_bin,
            clean_temp_files,
            clean_prefetch,
            run_disk_cleanup,
            check_winget,
            install_app,
            uninstall_app,
            check_apps_installed,
            get_all_apps,
            check_updates,
            update_app,
            get_resource_usage,
            get_battery_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
