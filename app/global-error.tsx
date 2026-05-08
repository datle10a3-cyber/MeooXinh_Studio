"use client";

import { useEffect } from "react";

function isChunkLikeError(error: Error) {
  const message = `${error.name || ""} ${error.message || ""} ${error.stack || ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|module script failed/i.test(message);
}

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (!isChunkLikeError(error)) return;
    try {
      if (sessionStorage.getItem("studio-global-error-chunk-reload")) return;
      sessionStorage.setItem("studio-global-error-chunk-reload", "1");
      window.location.replace("/");
    } catch {}
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <main style={{ minHeight: "100dvh", background: "#FFF3EC", color: "#5B342C", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
          <section style={{ width: "100%", maxWidth: 560, border: "1px solid #F4C7C4", borderRadius: 32, background: "rgba(255,255,255,0.92)", padding: 24, textAlign: "center", boxShadow: "0 22px 60px rgba(184,95,108,0.16)" }}>
            <p style={{ margin: 0, color: "#EA7188", fontSize: 12, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase" }}>Mèoo Xinhh Studio</p>
            <h1 style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 900 }}>Không thể mở ứng dụng</h1>
            <p style={{ margin: "8px 0 0", color: "#9B746B", fontSize: 14, fontWeight: 650 }}>Trình duyệt có thể đang giữ cache cũ. Hãy tải lại hoặc quay về trang chính.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
              <button style={{ border: 0, borderRadius: 999, background: "#EA7188", color: "white", padding: "12px 20px", fontWeight: 900 }} onClick={() => unstable_retry()} type="button">
                Thử lại
              </button>
              <button style={{ border: "1px solid #F4C7C4", borderRadius: 999, background: "white", color: "#5B342C", padding: "12px 20px", fontWeight: 900 }} onClick={() => window.location.replace("/")} type="button">
                Về trang chính
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
