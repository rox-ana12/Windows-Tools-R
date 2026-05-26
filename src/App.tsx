import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { save } from "@tauri-apps/plugin-dialog";
import "./App.css";

type Page = "dashboard" | "tools" | "about";

interface SystemInfo {
  os_name: string;
  os_version: string;
  hostname: string;
  kernel_version: string;
  cpu_brand: string;
  cpu_cores: number;
  total_memory: number;
  used_memory: number;
  total_disk: number;
  used_disk: number;
}

interface ContextMenuState {
  classic_enabled: boolean;
}

function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb.toFixed(1) + " GB";
}

function Sidebar({
  currentPage,
  onNavigate,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}) {
  const pages: { id: Page; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" },
    { id: "tools", label: "Tools", icon: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.611 3.611 0 0112 15.6z" },
    { id: "about", label: "About", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>Windows Tools R</h1>
        <span>System Utility</span>
      </div>
      <nav className="sidebar-nav">
        {pages.map((p) => (
          <button
            key={p.id}
            className={`nav-item ${currentPage === p.id ? "active" : ""}`}
            onClick={() => onNavigate(p.id)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d={p.icon} />
            </svg>
            {p.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Dashboard() {
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    invoke<SystemInfo>("get_system_info").then(setInfo);
  }, []);

  if (!info) return <div className="page-content"><p>Loading system info...</p></div>;

  const fields = [
    { label: "OS Name", value: info.os_name },
    { label: "OS Version", value: info.os_version },
    { label: "Hostname", value: info.hostname },
    { label: "Kernel", value: info.kernel_version },
    { label: "CPU", value: info.cpu_brand },
    { label: "CPU Cores", value: info.cpu_cores.toString() },
    { label: "Total Memory", value: formatBytes(info.total_memory) },
    { label: "Used Memory", value: formatBytes(info.used_memory) },
    { label: "Total Disk", value: formatBytes(info.total_disk) },
    { label: "Used Disk", value: formatBytes(info.used_disk) },
  ];

  return (
    <div className="page-content">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">System information for this Windows machine</p>
      <div className="info-grid">
        {fields.map((f) => (
          <div key={f.label} className="info-card">
            <div className="label">{f.label}</div>
            <div className="value">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tools() {
  const [loading, setLoading] = useState(true);
  const [classic, setClassic] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [ipOutput, setIpOutput] = useState("");
  const [ipRunning, setIpRunning] = useState(false);
  const [reportStatus, setReportStatus] = useState("");

  useEffect(() => {
    invoke<ContextMenuState>("get_context_menu_state").then((state) => {
      setClassic(state.classic_enabled);
      setLoading(false);
    }).catch((e) => {
      setLoading(false);
      setActionMsg("Error: " + String(e));
    });
  }, []);

  const toggle = () => {
    const newVal = !classic;
    setClassic(newVal);
    setActionMsg(newVal ? "Enabling..." : "Disabling...");
    invoke("toggle_context_menu", { classic: newVal }).then(() => {
      setActionMsg(newVal ? "Classic ON" : "Classic OFF");
    }).catch((e) => {
      setActionMsg("Error: " + String(e));
      setClassic(!newVal);
    });
  };

  const runIpconfig = () => {
    setIpRunning(true);
    setIpOutput("");
    invoke<string>("run_ipconfig").then((out) => {
      setIpOutput(out);
      setIpRunning(false);
    }).catch((e) => {
      setIpOutput("Error: " + String(e));
      setIpRunning(false);
    });
  };

  const generateReport = async () => {
    try {
      const filePath = await save({
        defaultPath: "installed-apps-report.html",
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (!filePath) return;
      setReportStatus("Generating...");
      await invoke("generate_apps_report", { path: filePath });
      setReportStatus("Report saved!");
    } catch (e) {
      setReportStatus("Error: " + String(e));
    }
  };

  if (loading) return <div className="page-content"><p>Loading tools...</p></div>;

  return (
    <div className="page-content">
      <h1 className="page-title">Tools</h1>
      <p className="page-subtitle">System utilities and tweaks</p>
      {actionMsg && <div className={"action-banner" + (actionMsg.startsWith("Error") ? " error" : " info")}>{actionMsg}</div>}
      <div className="tools-card">
        <div className="toggle-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h3>Classic Context Menu</h3>
            <p>Switch between Windows 11 modern and Windows 10 classic right-click menu</p>
          </div>
          <button className={"toggle-btn" + (classic ? " on" : "")} onClick={toggle}>
            {classic ? "MODERN" : "CLASSIC"}
          </button>
        </div>
      </div>
      <div className="tools-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h3>IPConfig</h3>
            <p>Display network configuration</p>
          </div>
          <button className="toggle-btn" onClick={runIpconfig} disabled={ipRunning}>
            {ipRunning ? "Running..." : "Run"}
          </button>
        </div>
        {ipOutput && (
          <pre className="cmd-output">{ipOutput}</pre>
        )}
      </div>
      <div className="tools-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <h3>Installed Apps Report</h3>
            <p>Generate an HTML report of all installed applications</p>
          </div>
          <button className="toggle-btn" onClick={generateReport}>
            Generate
          </button>
        </div>
        {reportStatus && <div className={"action-banner" + (reportStatus.startsWith("Error") ? " error" : " info")} style={{ marginTop: "12px", marginBottom: 0 }}>{reportStatus}</div>}
      </div>
    </div>
  );
}

function About() {
  const [ver, setVer] = useState("");

  useEffect(() => {
    getVersion().then(setVer);
  }, []);

  return (
    <div className="page-content">
      <h1 className="page-title">About</h1>
      <p className="page-subtitle">About this application</p>
      <div className="about-content">
        <div className="section">
          <h2>Windows Tools R</h2>
          <p>
            A native Windows utility built with Rust and React, providing quick access to
            system information and useful Windows tweaks in a modern interface.
          </p>
        </div>
        <div className="section">
          <h3>Developer</h3>
          <p>
            This application was built using Tauri v2, combining a Rust backend for
            native Windows API access with a React frontend for a modern UI experience.
          </p>
        </div>
        <div className="section">
          <h3>Tech Stack</h3>
          <p>
            <strong>Backend:</strong> Rust with sysinfo &amp; winreg crates<br />
            <strong>Frontend:</strong> React + TypeScript + Vite<br />
            <strong>Framework:</strong> Tauri v2
          </p>
        </div>
        <div className="section">
          <h3>Version</h3>
          <p>{ver || "loading..."}</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "tools":
        return <Tools />;
      case "about":
        return <About />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentPage={page} onNavigate={setPage} />
      <div className="main-area">
        <header className="header">
          <button className="theme-btn" onClick={toggleTheme}>
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
              </svg>
            )}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </header>
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
