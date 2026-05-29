import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./Apps.css";

interface AppEntry {
  name: string;
  version: string;
  publisher: string;
  size: string;
  install_date: string;
  install_location: string;
  winget_id: string;
}

interface UpdatableApp {
  name: string;
  winget_id: string;
  current_version: string;
  available_version: string;
}

interface OperationEvent {
  app_name: string;
  action: string;
  success: boolean;
  message: string;
}

function Apps() {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updates, setUpdates] = useState<UpdatableApp[]>([]);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [updatesDone, setUpdatesDone] = useState(false);

  useEffect(() => {
    invoke<AppEntry[]>("get_all_apps").then((data) => {
      setApps(data);
    }).catch((e) => {
      console.error("Failed to load apps:", e);
    });
    invoke<UpdatableApp[]>("check_updates").then((data) => {
      setUpdates(data);
      setLoading(false);
    }).catch((e) => {
      console.error("Failed to check updates:", e);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const unlisten = listen<OperationEvent>("operation-done", (event) => {
      const { app_name, action } = event.payload;
      if (action === "update") {
        setUpdating((prev) => { const next = new Set(prev); next.delete(app_name); return next; });
        if (event.payload.success) {
          setUpdates((prev) => prev.filter((u) => u.name !== app_name));
        }
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    if (updates.length === 0 && !loading) setUpdatesDone(true);
  }, [updates, loading]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.publisher.toLowerCase().includes(q) ||
        a.install_location.toLowerCase().includes(q)
    );
  }, [search, apps]);

  const updateApp = (item: UpdatableApp) => {
    setUpdating((prev) => new Set(prev).add(item.name));
    invoke("update_app", { wingetId: item.winget_id, appName: item.name });
  };

  const updateAll = () => {
    setBatchUpdating(true);
    for (const app of updates) {
      setUpdating((prev) => new Set(prev).add(app.name));
      invoke("update_app", { wingetId: app.winget_id, appName: app.name });
    }
  };

  useEffect(() => {
    if (!batchUpdating) return;
    if (updates.every((u) => !updating.has(u.name))) {
      setBatchUpdating(false);
    }
  }, [updating, updates, batchUpdating]);

  if (loading) {
    return (
      <div className="page-content">
        <h1 className="page-title">Installed Apps</h1>
        <p className="page-subtitle">Loading installed applications...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <h1 className="page-title">Installed Apps</h1>
      <p className="page-subtitle">{apps.length} applications installed</p>

      {updates.length > 0 && !updatesDone && (
        <div className="updates-section">
          <div className="updates-header">
            <h2>Updates Available</h2>
            <button className="update-all-btn" onClick={updateAll} disabled={batchUpdating}>
              {batchUpdating ? "Updating..." : `Update All (${updates.length})`}
            </button>
          </div>
          <div className="updates-list">
            {updates.map((app, i) => {
              const isUpdating = updating.has(app.name);
              return (
                <div key={i} className="update-item">
                  <div className="update-info">
                    <span className="update-name">{app.name}</span>
                    <span className="update-versions">
                      {app.current_version} → {app.available_version}
                    </span>
                  </div>
                  <div className="update-action">
                    {isUpdating ? (
                      <span className="installing-spinner">⟳</span>
                    ) : (
                      <button className="update-btn" onClick={() => updateApp(app)} disabled={batchUpdating}>
                        Update
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {updatesDone && (
        <div className="up-to-date-banner">All apps are up to date</div>
      )}

      <div className="apps-search">
        <input
          type="text"
          placeholder="Search by name, publisher, or path..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <span className="search-count">{filtered.length} app{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="apps-table-wrap">
        <table className="apps-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Publisher</th>
              <th>Version</th>
              <th>Size</th>
              <th>Install Date</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app, i) => (
              <tr key={i}>
                <td className="app-name-cell">{app.name}</td>
                <td>{app.publisher || "—"}</td>
                <td>{app.version || "—"}</td>
                <td>{app.size || "—"}</td>
                <td>{app.install_date || "—"}</td>
                <td className="app-location-cell">{app.install_location || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Apps;
