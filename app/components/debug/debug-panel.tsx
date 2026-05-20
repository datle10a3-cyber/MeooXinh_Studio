"use client";

import { useEffect, useRef, useState } from "react";

// Build metadata — updated each deploy
const BUILD_INFO = {
  commitHash: "b51d057",
  buildTime: "2026-05-20T16:36Z",
  version: "tablet-debug-v5",
};

// ─── Render Counter ───
// Global mutable map — not reactive, just a counter.
const renderCounts: Record<string, number> = {};

/**
 * Call at the TOP of a component body to count renders.
 * Only active when ?debug=1 is in URL.
 */
export function useRenderCount(name: string) {
  if (typeof window === "undefined") return;
  if (!new URLSearchParams(window.location.search).has("debug")) return;
  renderCounts[name] = (renderCounts[name] ?? 0) + 1;
  // eslint-disable-next-line no-console
  console.count(`[RENDER] ${name}`);
}

/**
 * Debug overlay — only shown when URL has ?debug=1.
 * Shows build info, SW status, render counts, and test switches.
 */
export function DebugPanel() {
  const [visible, setVisible] = useState(false);
  const [swInfo, setSwInfo] = useState<string>("checking...");
  const [cacheNames, setCacheNames] = useState<string[]>([]);
  const [isPWA, setIsPWA] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const intervalRef = useRef<number | null>(null);

  // Test switches stored in sessionStorage
  const [testA, setTestA] = useState(false); // Disable TabletMenu open
  const [testB, setTestB] = useState(false); // TabletMenu empty div
  const [testC, setTestC] = useState(false); // Title-only pages

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    setVisible(true);

    // PWA detection
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsPWA(isStandalone);

    // SW status
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        const ctrl = navigator.serviceWorker.controller;
        setSwInfo(
          ctrl
            ? `Active (scope: ${reg.scope})`
            : `No controller (scope: ${reg.scope})`
        );
      }).catch(() => setSwInfo("SW error"));
    } else {
      setSwInfo("No SW support");
    }

    // Cache names
    if ("caches" in window) {
      caches.keys().then(setCacheNames).catch(() => {});
    }

    // Load test switches
    setTestA(sessionStorage.getItem("debug-testA") === "1");
    setTestB(sessionStorage.getItem("debug-testB") === "1");
    setTestC(sessionStorage.getItem("debug-testC") === "1");

    // Poll render counts
    intervalRef.current = window.setInterval(() => {
      setCounts({ ...renderCounts });
    }, 500);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  function toggleTest(key: string, value: boolean, setter: (v: boolean) => void) {
    setter(value);
    sessionStorage.setItem(`debug-${key}`, value ? "1" : "0");
    // Force reload to apply
    window.location.reload();
  }

  function resetCounts() {
    for (const key of Object.keys(renderCounts)) {
      renderCounts[key] = 0;
    }
    setCounts({});
  }

  if (!visible) return null;

  const sortedCounts = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .filter(([, v]) => v > 0);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 99999,
        background: "rgba(0,0,0,0.92)",
        color: "#0f0",
        fontSize: 10,
        fontFamily: "monospace",
        padding: 8,
        borderRadius: 8,
        maxWidth: 320,
        maxHeight: "50vh",
        overflowY: "auto",
        lineHeight: 1.5,
        pointerEvents: "auto",
      }}
    >
      <div style={{ fontWeight: "bold", color: "#ff0", marginBottom: 4 }}>
        🐛 DEBUG PANEL
      </div>

      {/* Build Info */}
      <div style={{ color: "#aaa" }}>
        Commit: <span style={{ color: "#0ff" }}>{BUILD_INFO.commitHash}</span>
        <br />
        Build: {BUILD_INFO.buildTime}
        <br />
        Ver: {BUILD_INFO.version}
        <br />
        PWA: {isPWA ? "✅ Standalone" : "❌ Browser tab"}
        <br />
        SW: {swInfo}
        <br />
        Caches: {cacheNames.length > 0 ? cacheNames.join(", ") : "none"}
      </div>

      <hr style={{ borderColor: "#333", margin: "6px 0" }} />

      {/* Test Switches */}
      <div style={{ color: "#ff0", fontWeight: "bold" }}>Test Switches:</div>
      <label style={{ display: "block", color: "#fff", cursor: "pointer" }}>
        <input type="checkbox" checked={testA} onChange={(e) => toggleTest("testA", e.target.checked, setTestA)} />
        {" "}A: Disable TabletMenu (3-gạch = console.log only)
      </label>
      <label style={{ display: "block", color: "#fff", cursor: "pointer" }}>
        <input type="checkbox" checked={testB} onChange={(e) => toggleTest("testB", e.target.checked, setTestB)} />
        {" "}B: TabletMenu = empty div
      </label>
      <label style={{ display: "block", color: "#fff", cursor: "pointer" }}>
        <input type="checkbox" checked={testC} onChange={(e) => toggleTest("testC", e.target.checked, setTestC)} />
        {" "}C: Title-only pages (no content)
      </label>

      <hr style={{ borderColor: "#333", margin: "6px 0" }} />

      {/* Render Counts */}
      <div style={{ color: "#ff0", fontWeight: "bold" }}>
        Render Counts:{" "}
        <button onClick={resetCounts} style={{ color: "#f00", background: "none", border: "1px solid #f00", fontSize: 9, cursor: "pointer", padding: "1px 4px", borderRadius: 4 }}>
          Reset
        </button>
      </div>
      {sortedCounts.length === 0 ? (
        <div style={{ color: "#666" }}>No renders yet</div>
      ) : (
        sortedCounts.map(([name, count]) => (
          <div key={name} style={{ color: count > 5 ? "#f55" : "#0f0" }}>
            {name}: <strong>{count}</strong>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Read a debug test switch from sessionStorage.
 * Returns false if ?debug=1 is not in URL.
 */
export function useDebugTest(key: "testA" | "testB" | "testC"): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    setValue(sessionStorage.getItem(`debug-${key}`) === "1");
  }, [key]);
  return value;
}
