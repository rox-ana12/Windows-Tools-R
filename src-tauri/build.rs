fn main() {
    let mut windows_attrs = tauri_build::WindowsAttributes::new();
    windows_attrs = windows_attrs.app_manifest(include_str!("app.manifest"));
    let attrs = tauri_build::Attributes::new().windows_attributes(windows_attrs);
    tauri_build::try_build(attrs).expect("Failed to build Tauri app");
}
