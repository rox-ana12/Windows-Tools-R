import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./Monitor.css";

interface ResourceUsage {
  cpu_percent: number;
  memory_used: number;
  memory_total: number;
  memory_percent: number;
  disk_used: number;
  disk_total: number;
  disk_percent: number;
}

interface BatteryStatus {
  is_present: boolean;
  is_charging: boolean;
  percent: number;
  ac_line_status: string;
  battery_status: string;
}

function Gauge({ label, percent, used, total, color, unit }: {
  label: string;
  percent: number;
  used: number;
  total: number;
  color: string;
  unit: string;
}) {
  const fmt = (v: number) => {
    if (unit === "GB") {
      const gb = v / 1024 / 1024 / 1024;
      return gb.toFixed(1) + " GB";
    }
    return v.toFixed(0) + "%";
  };

  return (
    <div className="gauge-card">
      <div className="gauge-label">{label}</div>
      <div className="gauge-bar-track">
        <div
          className="gauge-bar-fill"
          style={{ width: Math.min(percent, 100) + "%", background: color }}
        />
      </div>
      <div className="gauge-value">
        <span className="gauge-pct">{percent.toFixed(1)}%</span>
        <span className="gauge-detail">{fmt(used)} / {fmt(total)}</span>
      </div>
    </div>
  );
}

export default function Monitor() {
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [battery, setBattery] = useState<BatteryStatus | null>(null);
  const [usageHistory, setUsageHistory] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fetchUsage = () => {
      invoke<ResourceUsage>("get_resource_usage").then((u) => {
        setUsage(u);
        setUsageHistory((prev) => {
          const next = [...prev, u.cpu_percent];
          return next.length > 120 ? next.slice(-120) : next;
        });
      });
    };

    fetchUsage();
    const interval = setInterval(fetchUsage, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBattery = () => {
      invoke<BatteryStatus>("get_battery_status").then(setBattery).catch(() => {});
    };

    fetchBattery();
    const interval = setInterval(fetchBattery, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || usageHistory.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    canvas.width = w;
    canvas.height = h;
    ctx.scale(dpr, dpr);

    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;

    ctx.clearRect(0, 0, cw, ch);

    ctx.strokeStyle = "rgba(128,128,128,0.15)";
    ctx.lineWidth = 1;
    [25, 50, 75].forEach((pct) => {
      const y = ch - (ch * pct) / 100;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    });

    const stepX = cw / (usageHistory.length - 1);
    const cpuColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--monitor-cpu").trim() || "#4fc3f7";

    ctx.strokeStyle = cpuColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    usageHistory.forEach((val, i) => {
      const x = i * stepX;
      const y = ch - (ch * Math.min(val, 100)) / 100;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const fillColor = cpuColor + "20";
    ctx.lineTo((usageHistory.length - 1) * stepX, ch);
    ctx.lineTo(0, ch);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }, [usageHistory]);

  return (
    <div className="page-content">
      <h1 className="page-title">Monitor</h1>
      <p className="page-subtitle">Real-time system resource usage</p>

      {usage && (
        <div className="gauges-grid">
          <Gauge
            label="CPU"
            percent={usage.cpu_percent}
            used={usage.cpu_percent}
            total={100}
            color="var(--monitor-cpu)"
            unit="%"
          />
          <Gauge
            label="Memory"
            percent={usage.memory_percent}
            used={usage.memory_used}
            total={usage.memory_total}
            color="var(--monitor-memory)"
            unit="GB"
          />
          <Gauge
            label="Disk"
            percent={usage.disk_percent}
            used={usage.disk_used}
            total={usage.disk_total}
            color="var(--monitor-disk)"
            unit="GB"
          />
        </div>
      )}

      {usage && (
        <div className="sparkline-card">
          <div className="sparkline-header">
            <span>CPU History (last ~4 min)</span>
            <span className="sparkline-current">{usage.cpu_percent.toFixed(1)}% now</span>
          </div>
          <canvas ref={canvasRef} className="sparkline-canvas" />
        </div>
      )}

      {battery?.is_present && (
        <div className="gauge-card battery-card">
          <div className="gauge-label">Battery</div>
          <div className="gauge-bar-track">
            <div
              className="gauge-bar-fill"
              style={{
                width: Math.min(battery.percent, 100) + "%",
                background: battery.percent > 20
                  ? "var(--monitor-battery)"
                  : "var(--danger)",
              }}
            />
          </div>
          <div className="gauge-value">
            <span className="gauge-pct">{battery.percent}%</span>
            <span className="gauge-detail">
              {battery.battery_status}
              {battery.is_charging ? " ⚡" : ""}
            </span>
          </div>
        </div>
      )}

      {!usage && (
        <p className="loading-text">Loading system data...</p>
      )}
    </div>
  );
}
