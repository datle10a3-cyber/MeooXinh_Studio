"use client";

import { useEffect } from "react";

function isChunkLikeError(error: Error) {
  const message = `${error.name || ""} ${error.message || ""} ${error.stack || ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|module script failed/i.test(message);
}

function clearCaches() {
  if (!("caches" in window)) return Promise.resolve();
  return caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => undefined);
}

function unregisterWorkers() {
  if (!("serviceWorker" in navigator)) return Promise.resolve();
  return navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).then(() => undefined);
}

function hardRecover() {
  const reload = () => {
    const target = `${window.location.origin}/?recovered=${Date.now()}`;
    window.location.replace(target);
  };
  unregisterWorkers().then(clearCaches).then(reload).catch(reload);
}

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Tự động recover cho MỌI lỗi một lần duy nhất
    try {
      if (sessionStorage.getItem("studio-global-error-auto-recovery")) return;
      sessionStorage.setItem("studio-global-error-auto-recovery", "1");
      hardRecover();
    } catch {}
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ margin: 0 }}>
        <main style={{ minHeight: "100dvh", background: "#FFF3EC", display: "grid", placeItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ height: 32, width: 32, borderRadius: "50%", border: "4px solid #EA7188", borderTopColor: "transparent", animation: "spin 1s linear infinite", margin: "0 auto" }}></div>
            <p style={{ marginTop: 16, fontWeight: "bold", color: "#5B342C", fontFamily: "sans-serif" }}>Đang đồng bộ và khởi động lại...</p>
            <p style={{ marginTop: 4, fontSize: 12, color: "#9B746B", fontFamily: "sans-serif" }}>Vui lòng đợi trong giây lát</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </main>
      </body>
    </html>
  );
}
