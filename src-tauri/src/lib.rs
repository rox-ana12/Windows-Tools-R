use std::process::Command;
use std::fs;
use serde::Serialize;
use serde::Deserialize;
use sysinfo::{Disks, System};
use winreg::enums::*;
use winreg::RegKey;

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
pub struct ContextMenuState {
    pub classic_enabled: bool,
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
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("ipconfig failed: {}", stderr))
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

#[derive(Deserialize)]
struct AppEntry {
    name: String,
    version: String,
    publisher: String,
}

fn read_installed_apps() -> Vec<AppEntry> {
    let mut apps = Vec::new();
    let keys = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ];
    for key_path in keys {
        if let Ok(hklm) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(key_path) {
            for name in hklm.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(subkey) = hklm.open_subkey(&name) {
                    let display_name: String = subkey.get_value("DisplayName").unwrap_or_default();
                    if display_name.is_empty() { continue; }
                    let version: String = subkey.get_value("DisplayVersion").unwrap_or_default();
                    let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
                    apps.push(AppEntry { name: display_name, version, publisher });
                }
            }
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
        if p.is_dir() {
            let _ = fs::remove_dir_all(&p);
        } else {
            let _ = fs::remove_file(&p);
        }
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
fn empty_recycle_bin() -> Result<String, String> {
    let _ = Command::new("powershell")
        .args(["-Command", "(New-Object -ComObject Shell.Application).Namespace(0xa).Items() | ForEach-Object { Remove-Item $_.Path -Recurse -Force -ErrorAction SilentlyContinue }"])
        .output();
    Ok("Recycle Bin emptied".into())
}

#[tauri::command]
fn clean_temp_files() -> Result<String, String> {
    let mut total = 0;
    let temp = std::env::var("TEMP").map_err(|_| "TEMP not set".to_string())?;
    total += delete_files_in_dir(&temp)?;
    let sys_temp = r"C:\Windows\Temp";
    if std::path::Path::new(sys_temp).exists() {
        match delete_files_in_dir(sys_temp) {
            Ok(n) => total += n,
            Err(_) => {}, // skip if no permission
        }
    }
    Ok(format!("Cleaned {} temporary files", total))
}

#[tauri::command]
fn clean_prefetch() -> Result<String, String> {
    let path = r"C:\Windows\Prefetch";
    if !std::path::Path::new(path).exists() {
        return Ok("Prefetch folder not found".into());
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
